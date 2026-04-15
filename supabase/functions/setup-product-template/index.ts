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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const results: string[] = [];

    // First, check what item_templates exist
    const { data: allItems, error: itemErr } = await supabase.from("item_templates").select("id, code, name").order("code");
    results.push(`Total item_templates: ${allItems?.length ?? 0} (error: ${itemErr?.message ?? 'none'})`);
    if (allItems && allItems.length > 0) {
      results.push(`Sample codes: ${allItems.slice(0, 20).map((i: any) => i.code).join(", ")}`);
    }

    // Check what quote_items reference company_products or product_templates
    const { data: qi } = await supabase.from("quote_items").select("id, company_product_id, product_template_id").limit(5);
    results.push(`quote_items sample: ${JSON.stringify(qi)}`);

    // Nullify quote_items references first
    const { error: qe1 } = await supabase.from("quote_items").update({ company_product_id: null }).not("company_product_id", "is", null);
    results.push(`nullify quote_items.company_product_id: ${qe1?.message ?? 'OK'}`);
    
    const { error: qe2 } = await supabase.from("quote_items").update({ product_template_id: null }).not("product_template_id", "is", null);
    results.push(`nullify quote_items.product_template_id: ${qe2?.message ?? 'OK'}`);

    // Nullify glass_projects references
    const { error: gpe } = await supabase.from("glass_projects").update({ product_template_id: null }).not("product_template_id", "is", null);
    results.push(`nullify glass_projects: ${gpe?.message ?? 'OK'}`);

    // Nullify measurement_items references
    const { error: mie } = await supabase.from("measurement_items").update({ product_template_id: null }).not("product_template_id", "is", null);
    results.push(`nullify measurement_items: ${mie?.message ?? 'OK'}`);

    // Nullify os_cutting_plan references
    const { error: oce } = await supabase.from("os_cutting_plan").update({ product_template_id: null }).not("product_template_id", "is", null);
    results.push(`nullify os_cutting_plan: ${oce?.message ?? 'OK'}`);

    // Now delete in order
    const { error: e1 } = await supabase.from("glass_line_formulas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`glass_line_formulas: ${e1?.message ?? 'OK'}`);

    const { error: e2 } = await supabase.from("company_product_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`company_product_items: ${e2?.message ?? 'OK'}`);

    const { error: e3 } = await supabase.from("company_products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`company_products: ${e3?.message ?? 'OK'}`);

    const { error: e4 } = await supabase.from("product_template_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`product_template_items: ${e4?.message ?? 'OK'}`);

    const { error: e5 } = await supabase.from("product_templates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`product_templates: ${e5?.message ?? 'OK'}`);

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
