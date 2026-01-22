import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateEmployeeUserRequest {
  username: string;
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
    const { 
      username,
      password,
      employeeId, 
      employeeName,
      companyId, 
      permissionProfileId,
    }: CreateEmployeeUserRequest = await req.json();

    if (!username || !password || !employeeId || !companyId) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: username, password, employeeId, companyId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Validate username format
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      return new Response(
        JSON.stringify({ error: "Username inválido. Use apenas letras, números, ponto, hífen e underscore." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter pelo menos 6 caracteres" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Creating user for employee ${employeeName} (username: ${username})`);

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Generate internal email from username and company ID
    // This allows username-based login while using Supabase Auth
    const internalEmail = `${username.toLowerCase()}@${companyId}.internal`;

    // Check if user already exists with this email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === internalEmail);

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "Este usuário já existe no sistema" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if username is already taken in employees table
    const { data: existingEmployee } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("username", username.toLowerCase())
      .neq("id", employeeId)
      .single();

    if (existingEmployee) {
      return new Response(
        JSON.stringify({ error: "Este nome de usuário já está em uso" }),
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
        username: username.toLowerCase(),
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

    // Update employee with user_id and username
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ 
        user_id: userId,
        username: username.toLowerCase(),
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

    // Link user to company with permission profile
    const { error: linkError } = await supabaseAdmin
      .from("user_companies")
      .upsert({
        user_id: userId,
        company_id: companyId,
        role: "employee",
        permission_profile_id: permissionProfileId || null,
      }, {
        onConflict: "user_id,company_id",
      });

    if (linkError) {
      console.error("Error linking user to company:", linkError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        username: username.toLowerCase(),
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
