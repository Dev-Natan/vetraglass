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

    // 1. Delete glass_line_formulas
    const { error: e1 } = await supabase.from("glass_line_formulas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`glass_line_formulas: ${e1 ? e1.message : "OK"}`);

    // 2. Delete company_product_items
    const { error: e2 } = await supabase.from("company_product_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`company_product_items: ${e2 ? e2.message : "OK"}`);

    // 3. Delete company_products
    const { error: e3 } = await supabase.from("company_products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`company_products: ${e3 ? e3.message : "OK"}`);

    // 4. Delete product_template_items
    const { error: e4 } = await supabase.from("product_template_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`product_template_items: ${e4 ? e4.message : "OK"}`);

    // 5. Delete product_templates
    const { error: e5 } = await supabase.from("product_templates").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    results.push(`product_templates: ${e5 ? e5.message : "OK"}`);

    // 6. Nullify references (glass_projects, quote_items, measurement_items, os_cutting_plan)
    // These need RPC or raw SQL - skip for now as they may already be null

    // 7. Create the product template
    const { data: pt, error: e6 } = await supabase.from("product_templates").insert({
      name: "Janela de Correr 02 Folhas",
      category: "janelas",
      linha: "suprema",
      description: "Janela de correr com 02 folhas - Linha Suprema",
      is_active: true,
    }).select("id").single();
    results.push(`product_template insert: ${e6 ? e6.message : "OK - " + pt?.id}`);

    if (!pt) {
      return new Response(JSON.stringify({ results, error: "Failed to create template" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const templateId = pt.id;

    // 8. Get item_templates by code
    const codes = ["SU-001", "SU-002", "SU-003", "SU-053", "SU-102", "SU-041", "SU-040", "SU-039", "MP-347", "CM-063"];
    const { data: items } = await supabase.from("item_templates").select("id, code").in("code", codes);
    const itemMap: Record<string, string> = {};
    items?.forEach((i: any) => { itemMap[i.code] = i.id; });
    results.push(`item_templates found: ${Object.keys(itemMap).join(", ")}`);

    // 9. Insert composition items
    const compositionItems = [
      // SU-001 | L | 90/90 | L - 26 | Qty 1
      { product_template_id: templateId, item_template_id: itemMap["SU-001"], section: "Perfis", width_formula: "L - 26", pieces_quantity: 1, cut_angle: 90, quantity_formula: "1" },
      // SU-002 | L | 90/90 | L - 26 | Qty 1
      { product_template_id: templateId, item_template_id: itemMap["SU-002"], section: "Perfis", width_formula: "L - 26", pieces_quantity: 1, cut_angle: 90, quantity_formula: "1" },
      // SU-003 | H | 90/90 | H | Qty 2
      { product_template_id: templateId, item_template_id: itemMap["SU-003"], section: "Perfis", height_formula: "H", pieces_quantity: 2, cut_angle: 90, quantity_formula: "1" },
      // SU-053 | L | 90/90 | L - 67 | Qty 4
      { product_template_id: templateId, item_template_id: itemMap["SU-053"], section: "Perfis", width_formula: "L - 67", pieces_quantity: 4, cut_angle: 90, quantity_formula: "1" },
      // SU-102 | L | 90/90 | L - 67 | Qty 4
      { product_template_id: templateId, item_template_id: itemMap["SU-102"], section: "Perfis", width_formula: "L - 67", pieces_quantity: 4, cut_angle: 90, quantity_formula: "1" },
      // SU-041 | H | 90/90 | H - 50 | Qty 1
      { product_template_id: templateId, item_template_id: itemMap["SU-041"], section: "Perfis", height_formula: "H - 50", pieces_quantity: 1, cut_angle: 90, quantity_formula: "1" },
      // SU-040 | H | 90/90 | H - 50 | Qty 1
      { product_template_id: templateId, item_template_id: itemMap["SU-040"], section: "Perfis", height_formula: "H - 50", pieces_quantity: 1, cut_angle: 90, quantity_formula: "1" },
      // SU-039 | H | 90/90 | H - 50 | Qty 2
      { product_template_id: templateId, item_template_id: itemMap["SU-039"], section: "Perfis", height_formula: "H - 50", pieces_quantity: 2, cut_angle: 90, quantity_formula: "1" },
      // SU-102 | H | 90/90 | H - 152 | Qty 4
      { product_template_id: templateId, item_template_id: itemMap["SU-102"], section: "Perfis", height_formula: "H - 152", pieces_quantity: 4, cut_angle: 90, quantity_formula: "1" },
      // MP-347 | L | 45/45 | L + 48 | Qty 2
      { product_template_id: templateId, item_template_id: itemMap["MP-347"], section: "Arremate", width_formula: "L + 48", pieces_quantity: 2, cut_angle: 45, quantity_formula: "1" },
      // MP-347 | H | 45/45 | H + 48 | Qty 2
      { product_template_id: templateId, item_template_id: itemMap["MP-347"], section: "Arremate", height_formula: "H + 48", pieces_quantity: 2, cut_angle: 45, quantity_formula: "1" },
      // CM-063 | L | 45/45 | L + 27 | Qty 2
      { product_template_id: templateId, item_template_id: itemMap["CM-063"], section: "Contramarco", width_formula: "L + 27", pieces_quantity: 2, cut_angle: 45, quantity_formula: "1" },
      // CM-063 | H | 45/45 | H + 27 | Qty 2
      { product_template_id: templateId, item_template_id: itemMap["CM-063"], section: "Contramarco", height_formula: "H + 27", pieces_quantity: 2, cut_angle: 45, quantity_formula: "1" },
    ].filter(item => item.item_template_id);

    const { error: e7 } = await supabase.from("product_template_items").insert(compositionItems);
    results.push(`composition items (${compositionItems.length}): ${e7 ? e7.message : "OK"}`);

    return new Response(JSON.stringify({ success: true, templateId, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
