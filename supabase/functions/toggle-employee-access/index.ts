import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ToggleEmployeeAccessRequest {
  employeeId: string;
  userId?: string; // ignored — resolved server-side from employees.user_id
  isActive: boolean;
}

serve(async (req: Request): Promise<Response> => {
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

    const { employeeId, isActive }: ToggleEmployeeAccessRequest = await req.json();

    if (!employeeId) {
      return new Response(
        JSON.stringify({ error: "Campo obrigatório: employeeId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Toggling access for employee ${employeeId}, isActive: ${isActive}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Get employee row (company + linked user) to check permission and resolve userId
    const { data: employeeData, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select("company_id, user_id")
      .eq("id", employeeId)
      .maybeSingle();

    if (employeeError || !employeeData) {
      return new Response(JSON.stringify({ error: "Funcionário não encontrado." }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!employeeData.user_id) {
      return new Response(JSON.stringify({ error: "Funcionário não possui login vinculado." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Resolve userId strictly from the employee row (prevents cross-tenant ban/unban)
    const userId = employeeData.user_id as string;

    // 3. Check if requester has admin/manager permissions in that company
    const { data: userCompany, error: checkError } = await supabaseAdmin
      .from("user_companies")
      .select("role")
      .eq("user_id", user.id)
      .eq("company_id", employeeData.company_id)
      .eq("is_active", true)
      .in("role", ["admin", "manager"])
      .maybeSingle();

    if (checkError || !userCompany) {
      // Check if they are a SaaS Admin
      const { data: saasAdmin } = await supabaseAdmin
        .from("saas_admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!saasAdmin) {
        return new Response(JSON.stringify({ error: "Você não tem permissão para gerenciar este funcionário." }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Update user_companies to reflect active status — scoped to this company only
    const { error: userCompanyError } = await supabaseAdmin
      .from("user_companies")
      .update({ is_active: isActive })
      .eq("user_id", userId)
      .eq("company_id", employeeData.company_id);

    if (userCompanyError) {
      console.error("Error updating user_companies:", userCompanyError);
    }

    // Ban or unban the user in Supabase Auth
    // When isActive is false, we ban the user to prevent login
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        ban_duration: isActive ? "none" : "876000h", // ~100 years ban when inactive
      }
    );

    if (authError) {
      console.error("Error updating auth user:", authError);
      return new Response(
        JSON.stringify({ error: `Erro ao ${isActive ? 'reativar' : 'desativar'} acesso: ${authError.message}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`User ${userId} access ${isActive ? 'enabled' : 'disabled'} successfully`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isActive 
          ? "Acesso do funcionário reativado com sucesso!" 
          : "Acesso do funcionário revogado. Ele não poderá mais entrar no sistema."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in toggle-employee-access function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
