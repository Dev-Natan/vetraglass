import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ToggleEmployeeAccessRequest {
  employeeId: string;
  userId: string;
  isActive: boolean;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { employeeId, userId, isActive }: ToggleEmployeeAccessRequest = await req.json();

    if (!employeeId || !userId) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: employeeId, userId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Toggling access for employee ${employeeId}, user ${userId}, isActive: ${isActive}`);

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

    // Update user_companies to reflect active status
    const { error: userCompanyError } = await supabaseAdmin
      .from("user_companies")
      .update({ is_active: isActive })
      .eq("user_id", userId);

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
