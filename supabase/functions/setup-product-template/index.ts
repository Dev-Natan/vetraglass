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

    const names = ["SU-001", "SU-002", "SU-003", "SU-053", "SU-102", "SU-041", "SU-040", "SU-039", "MP-347", "CM-063"];
    
    // Search by name - some may have additional description after the code
    const { data: exactItems } = await supabase.from("item_templates").select("id, name, linha").in("name", names);
    
    // Also search with ilike for names that include the code
    const results: any[] = exactItems || [];
    for (const name of names) {
      if (!results.find(i => i.name === name)) {
        const { data } = await supabase.from("item_templates").select("id, name, linha").ilike("name", `${name}%`).limit(5);
        if (data) results.push(...data);
      }
    }

    // Also get all Suprema items
    const { data: supremaItems } = await supabase.from("item_templates").select("id, name, linha, type").eq("linha", "Suprema").order("name");

    // Also search with lowercase
    const { data: supremaLower } = await supabase.from("item_templates").select("id, name, linha, type").eq("linha", "suprema").order("name");

    return new Response(JSON.stringify({ 
      matchedItems: results,
      supremaItems,
      supremaLowerItems: supremaLower,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
