import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateEmployeeUserRequest {
  generatedLogin: string; // Login gerado automaticamente (ex: joaoVETRA)
  password: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  permissionProfileId?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { 
      generatedLogin,
      password,
      employeeId, 
      employeeName,
      companyId, 
      permissionProfileId,
    }: CreateEmployeeUserRequest = await req.json();

    if (!generatedLogin || !password || !employeeId || !companyId) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: generatedLogin, password, employeeId, companyId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate login format (nome + TOKEN, ex: joaoVETRA)
    if (!/^[a-zA-Z0-9]+$/.test(generatedLogin)) {
      return new Response(
        JSON.stringify({ error: "Login inválido. Use apenas letras e números." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate password strength
    if (password.length < 10) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter pelo menos 10 caracteres" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (!/[A-Z]/.test(password)) {
      return new Response(
        JSON.stringify({ error: "Senha deve conter pelo menos uma letra maiúscula" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (!/[a-z]/.test(password)) {
      return new Response(
        JSON.stringify({ error: "Senha deve conter pelo menos uma letra minúscula" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (!/[0-9]/.test(password)) {
      return new Response(
        JSON.stringify({ error: "Senha deve conter pelo menos um número" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return new Response(
        JSON.stringify({ error: "Senha deve conter pelo menos um caractere especial (!@#$%^&*)" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    if (password.length > 128) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter no máximo 128 caracteres" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Creating user for employee ${employeeName} (login: ${generatedLogin})`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Identify requester and verify permissions
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida. Faça login novamente." }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Verify the employee belongs to the target company (prevents cross-tenant hijack)
    const { data: employeeRow, error: employeeLookupError } = await supabaseAdmin
      .from("employees")
      .select("id, company_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeLookupError || !employeeRow) {
      return new Response(JSON.stringify({ error: "Funcionário não encontrado." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (employeeRow.company_id !== companyId) {
      return new Response(
        JSON.stringify({ error: "Funcionário não pertence à empresa informada." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 4. Check if requester has admin/manager permissions in the target company
    const { data: userCompany, error: checkError } = await supabaseAdmin
      .from("user_companies")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", companyId)
      .eq("is_active", true)
      .in("role", ["admin", "manager"])
      .maybeSingle();

    if (checkError || !userCompany) {
      // Also check if they are a SaaS Admin
      const { data: saasAdmin } = await supabaseAdmin
        .from("saas_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!saasAdmin) {
        return new Response(JSON.stringify({ error: "Você não tem permissão para criar usuários nesta empresa." }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Generate internal email from generated login
    // Format: joaovetra@internal.vetra (simplificado e único)
    const internalEmail = `${generatedLogin.toLowerCase()}@internal.vetra`;

    // Check if user already exists with this email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === internalEmail);

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "Este login já existe no sistema. Tente outro nome." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if login is already taken in employees table
    const { data: existingEmployee } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("username", generatedLogin.toLowerCase())
      .neq("id", employeeId)
      .single();

    if (existingEmployee) {
      return new Response(
        JSON.stringify({ error: "Este login já está em uso. Tente um nome diferente." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create new user with the provided password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: password,
      email_confirm: true, // Auto-confirm (no email verification needed)
      user_metadata: {
        full_name: employeeName,
        login: generatedLogin.toLowerCase(),
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const userId = newUser.user.id;
    console.log(`User created: ${userId}`);

    // Update employee with user_id and generated login
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ 
        user_id: userId,
        username: generatedLogin.toLowerCase(),
        permission_profile_id: permissionProfileId || null,
      })
      .eq("id", employeeId);

    if (updateError) {
      console.error("Error updating employee:", updateError);
      // Try to clean up the created user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Link user to company
    const { error: linkError } = await supabaseAdmin
      .from("user_companies")
      .upsert({
        user_id: userId,
        company_id: companyId,
        role: "employee",
        is_active: true,
      }, {
        onConflict: "user_id,company_id",
      });

    if (linkError) {
      console.error("Error linking user to company:", linkError);
      // Don't fail the request, user is created
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        login: generatedLogin.toLowerCase(),
        message: "Usuário criado com sucesso! O funcionário já pode acessar o sistema."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in create-employee-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
