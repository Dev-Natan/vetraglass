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

    // Add pieces_formula to product_template_items
    const { error: err1 } = await supabase.rpc("exec_sql", {
      sql: "ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS pieces_formula text;"
    });

    // Try direct approach via postgres connection
    const { data, error } = await supabase.from("product_template_items").select("id").limit(1);
    
    return new Response(
      JSON.stringify({ 
        message: "Migration check complete",
        data,
        error: error?.message,
        err1: err1?.message
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
