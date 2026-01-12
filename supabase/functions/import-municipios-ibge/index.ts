import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Municipio {
  codigo: string;
  nome: string;
  uf: string;
  uf_nome: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Autenticação necessária' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify user is admin
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );
    
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Autenticação inválida' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Check if admin
    const { data: adminCheck } = await supabaseClient
      .from('saas_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Acesso não autorizado. Apenas administradores podem importar municípios.' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse request body
    const body = await req.json();
    const municipios: Municipio[] = body.municipios || [];

    if (!municipios.length) {
      return new Response(
        JSON.stringify({ error: 'Nenhum município fornecido para importação' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Admin ${user.id} importing ${municipios.length} municipalities`);

    // Insert municipalities in batches
    const batchSize = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < municipios.length; i += batchSize) {
      const batch = municipios.slice(i, i + batchSize).map(m => ({
        codigo_ibge: m.codigo,
        nome_municipio: m.nome,
        uf_codigo: m.uf,
        uf_nome: m.uf_nome,
      }));

      const { error } = await supabaseClient
        .from('municipios_ibge')
        .upsert(batch, { onConflict: 'codigo_ibge' });

      if (error) {
        console.error('Batch error:', error);
        errors++;
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted,
        errors,
        message: `${inserted} municípios importados com sucesso${errors > 0 ? `, ${errors} erros` : ''}` 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
