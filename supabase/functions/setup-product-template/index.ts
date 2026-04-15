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

    // First delete the template we just created (from failed attempt)
    const { error: delErr } = await supabase.from("product_template_items").delete().eq("product_template_id", "a6541467-a1c8-4be7-8df3-2962ad9ffe20");
    await supabase.from("product_templates").delete().eq("id", "a6541467-a1c8-4be7-8df3-2962ad9ffe20");
    // Also delete from first attempt
    await supabase.from("product_template_items").delete().eq("product_template_id", "7fcc2fb8-5c55-41db-8fdf-a4ecfabbccf0");
    await supabase.from("product_templates").delete().eq("id", "7fcc2fb8-5c55-41db-8fdf-a4ecfabbccf0");
    results.push("Cleaned up previous attempts");

    const itemIds: Record<string, string> = {
      "SU-001": "7ca2abee-9e00-4bd7-a183-ae5eaa8d8acb",
      "SU-002": "8714a493-63aa-4ea6-96a0-5fdcc032c2a4",
      "SU-003": "6e55cfda-f957-473e-b28a-635bf6250d58",
      "SU-053": "b640ad4b-2f1c-4e9a-997a-c1e465e1c157",
      "SU-102": "e3140dce-7fc5-4e8b-8fdb-723a4c62a124",
      "SU-041": "d8f8a4a7-8d8b-43b8-b580-f7ed705e5fce",
      "SU-040": "f7b8c08f-566c-4146-84f6-98b79121e2ce",
      "SU-039": "0373cf70-23d2-4d89-927f-36f4fdeded46",
      "MP-347": "56b27ffe-b8fc-4279-b744-ca379e95c6c3",
      "CM-063": "eb9202f0-eed3-44c4-a182-b87e37252dfc",
    };

    // Create product template
    const { data: pt, error: ptErr } = await supabase.from("product_templates").insert({
      name: "Janela de Correr 02 Folhas",
      category: "janelas",
      linha: "suprema",
      description: "Janela de correr com 02 folhas - Linha Suprema",
      is_active: true,
    }).select("id").single();
    
    if (ptErr || !pt) {
      return new Response(JSON.stringify({ error: ptErr?.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500
      });
    }
    results.push(`Template created: ${pt.id}`);
    const tid = pt.id;

    // Insert composition (no sort_order column)
    const items = [
      { product_template_id: tid, item_template_id: itemIds["SU-001"], section: "Perfis", width_formula: "L - 26", pieces_quantity: 1, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["SU-002"], section: "Perfis", width_formula: "L - 26", pieces_quantity: 1, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["SU-003"], section: "Perfis", height_formula: "H", pieces_quantity: 2, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["SU-053"], section: "Perfis", width_formula: "L - 67", pieces_quantity: 4, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["SU-102"], section: "Perfis", width_formula: "L - 67", pieces_quantity: 4, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["SU-041"], section: "Perfis", height_formula: "H - 50", pieces_quantity: 1, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["SU-040"], section: "Perfis", height_formula: "H - 50", pieces_quantity: 1, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["SU-039"], section: "Perfis", height_formula: "H - 50", pieces_quantity: 2, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["SU-102"], section: "Perfis", height_formula: "H - 152", pieces_quantity: 4, cut_angle: 90, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["MP-347"], section: "Arremate", width_formula: "L + 48", pieces_quantity: 2, cut_angle: 45, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["MP-347"], section: "Arremate", height_formula: "H + 48", pieces_quantity: 2, cut_angle: 45, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["CM-063"], section: "Contramarco", width_formula: "L + 27", pieces_quantity: 2, cut_angle: 45, quantity_formula: "1" },
      { product_template_id: tid, item_template_id: itemIds["CM-063"], section: "Contramarco", height_formula: "H + 27", pieces_quantity: 2, cut_angle: 45, quantity_formula: "1" },
    ];

    const { error: ciErr } = await supabase.from("product_template_items").insert(items);
    results.push(`Composition items (${items.length}): ${ciErr?.message ?? 'OK'}`);

    // Verify
    const { data: verify } = await supabase.from("product_template_items").select("id, item_template_id, section, width_formula, height_formula, pieces_quantity, cut_angle").eq("product_template_id", tid);
    results.push(`Verified items: ${verify?.length ?? 0}`);

    return new Response(JSON.stringify({ success: true, templateId: tid, results, compositionItems: verify }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
