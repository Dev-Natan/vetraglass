import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeocodeRequest {
  client_id: string;
  address: string;
  city?: string;
  state?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { client_id, address, city, state }: GeocodeRequest = await req.json();

    if (!client_id || !address) {
      return new Response(
        JSON.stringify({ error: "client_id and address are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build full address for geocoding
    const fullAddress = [address, city, state, "Brasil"].filter(Boolean).join(", ");
    
    // Use Nominatim (OpenStreetMap) for free geocoding
    const encodedAddress = encodeURIComponent(fullAddress);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
    
    const geocodeResponse = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "ClientesApp/1.0",
      },
    });

    if (!geocodeResponse.ok) {
      console.error("Nominatim API error:", geocodeResponse.status);
      return new Response(
        JSON.stringify({ error: "Geocoding service error", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = await geocodeResponse.json();

    if (!results || results.length === 0) {
      console.log("No results found for address:", fullAddress);
      return new Response(
        JSON.stringify({ success: false, message: "Address not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { lat, lon } = results[0];
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    // Update client with coordinates
    const { error: updateError } = await supabaseClient
      .from("clients")
      .update({ latitude, longitude })
      .eq("id", client_id);

    if (updateError) {
      console.error("Error updating client:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update client", success: false }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        latitude, 
        longitude,
        display_name: results[0].display_name 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in geocode-address function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
