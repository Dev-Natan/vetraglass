import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is saas_admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check saas_admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "saas_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas SaaS Admin pode excluir empresas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get users linked to this company
    const { data: companyUsers } = await adminClient
      .from("user_companies")
      .select("user_id")
      .eq("company_id", company_id);

    const userIds = companyUsers?.map(u => u.user_id) || [];

    // Delete in order to respect foreign keys
    const tablesToClean = [
      "cash_counts",
      "cash_movements",
      "cash_register_advances",
      "cash_register_audits",
      "cash_shortages",
      "operator_discrepancies",
      "cash_registers",
      "company_cash_movements",
      "company_cash",
      "employee_commissions",
      "employee_invites",
      "stock_reservations",
      "material_consumption",
      "stock_movements",
      "company_stock",
      "sale_items",
      "sales",
      "accounts_receivable",
      "expenses",
      "company_product_items",
      "company_products",
      "company_item_prices",
      "company_items",
      "company_linhas",
      "quote_items",
      "quotes",
      "ordens_servico",
      "measurements",
      "schedule_events",
      "clients",
      "employees",
      "company_notification_settings",
      "company_notifications",
      "company_payment_settings",
      "company_sales_goals",
      "company_security_settings",
      "role_permissions",
      "purchase_order_items",
      "purchase_orders",
      "notas_fiscais",
      "audit_logs",
      "user_companies",
    ];

    for (const table of tablesToClean) {
      try {
        await adminClient.from(table).delete().eq("company_id", company_id);
      } catch (e) {
        console.log(`Skipping table ${table}: ${e.message}`);
      }
    }

    // Delete the company itself
    const { error: deleteError } = await adminClient
      .from("companies")
      .delete()
      .eq("id", company_id);

    if (deleteError) {
      console.error("Error deleting company:", deleteError);
      return new Response(JSON.stringify({ error: `Erro ao excluir empresa: ${deleteError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally delete auth users that have no other companies
    for (const uid of userIds) {
      const { data: otherCompanies } = await adminClient
        .from("user_companies")
        .select("id")
        .eq("user_id", uid)
        .limit(1);

      if (!otherCompanies || otherCompanies.length === 0) {
        // Delete profile and auth user
        await adminClient.from("profiles").delete().eq("id", uid);
        await adminClient.auth.admin.deleteUser(uid);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
