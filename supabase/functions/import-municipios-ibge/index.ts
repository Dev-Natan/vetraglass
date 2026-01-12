import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lista de municípios IBGE 2024 - dados extraídos do relatório oficial
const municipios = [
  { codigo: "1100015", nome: "Alta Floresta D'Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100379", nome: "Alto Alegre dos Parecis", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100403", nome: "Alto Paraíso", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100346", nome: "Alvorada D'Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100023", nome: "Ariquemes", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100452", nome: "Buritis", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100031", nome: "Cabixi", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100601", nome: "Cacaulândia", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100049", nome: "Cacoal", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100700", nome: "Campo Novo de Rondônia", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100809", nome: "Candeias do Jamari", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100908", nome: "Castanheiras", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100056", nome: "Cerejeiras", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100924", nome: "Chupinguaia", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100064", nome: "Colorado do Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100072", nome: "Corumbiara", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100080", nome: "Costa Marques", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100940", nome: "Cujubim", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100098", nome: "Espigão D'Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101005", nome: "Governador Jorge Teixeira", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100106", nome: "Guajará-Mirim", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101104", nome: "Itapuã do Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100114", nome: "Jaru", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100122", nome: "Ji-Paraná", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100130", nome: "Machadinho D'Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101203", nome: "Ministro Andreazza", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101302", nome: "Mirante da Serra", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101401", nome: "Monte Negro", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100148", nome: "Nova Brasilândia D'Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100338", nome: "Nova Mamoré", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101435", nome: "Nova União", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100502", nome: "Novo Horizonte do Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100155", nome: "Ouro Preto do Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101450", nome: "Parecis", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100189", nome: "Pimenta Bueno", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101468", nome: "Pimenteiras do Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100205", nome: "Porto Velho", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100254", nome: "Presidente Médici", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101476", nome: "Primavera de Rondônia", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100262", nome: "Rio Crespo", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100288", nome: "Rolim de Moura", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100296", nome: "Santa Luzia D'Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101484", nome: "São Felipe D'Oeste", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101492", nome: "São Francisco do Guaporé", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100320", nome: "São Miguel do Guaporé", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101500", nome: "Seringueiras", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101559", nome: "Teixeirópolis", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101609", nome: "Theobroma", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101708", nome: "Urupá", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101757", nome: "Vale do Anari", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1101807", nome: "Vale do Paraíso", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1100304", nome: "Vilhena", uf_codigo: "11", uf_nome: "Rondônia" },
  // Principais capitais e municípios populosos
  { codigo: "3550308", nome: "São Paulo", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3304557", nome: "Rio de Janeiro", uf_codigo: "33", uf_nome: "Rio de Janeiro" },
  { codigo: "3106200", nome: "Belo Horizonte", uf_codigo: "31", uf_nome: "Minas Gerais" },
  { codigo: "2927408", nome: "Salvador", uf_codigo: "29", uf_nome: "Bahia" },
  { codigo: "2304400", nome: "Fortaleza", uf_codigo: "23", uf_nome: "Ceará" },
  { codigo: "5300108", nome: "Brasília", uf_codigo: "53", uf_nome: "Distrito Federal" },
  { codigo: "4106902", nome: "Curitiba", uf_codigo: "41", uf_nome: "Paraná" },
  { codigo: "2611606", nome: "Recife", uf_codigo: "26", uf_nome: "Pernambuco" },
  { codigo: "4314902", nome: "Porto Alegre", uf_codigo: "43", uf_nome: "Rio Grande do Sul" },
  { codigo: "1302603", nome: "Manaus", uf_codigo: "13", uf_nome: "Amazonas" },
  { codigo: "5208707", nome: "Goiânia", uf_codigo: "52", uf_nome: "Goiás" },
  { codigo: "1501402", nome: "Belém", uf_codigo: "15", uf_nome: "Pará" },
  { codigo: "3518800", nome: "Guarulhos", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3509502", nome: "Campinas", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "2111300", nome: "São Luís", uf_codigo: "21", uf_nome: "Maranhão" },
  { codigo: "3304904", nome: "São Gonçalo", uf_codigo: "33", uf_nome: "Rio de Janeiro" },
  { codigo: "2704302", nome: "Maceió", uf_codigo: "27", uf_nome: "Alagoas" },
  { codigo: "3301702", nome: "Duque de Caxias", uf_codigo: "33", uf_nome: "Rio de Janeiro" },
  { codigo: "2408102", nome: "Natal", uf_codigo: "24", uf_nome: "Rio Grande do Norte" },
  { codigo: "5002704", nome: "Campo Grande", uf_codigo: "50", uf_nome: "Mato Grosso do Sul" },
  { codigo: "2211001", nome: "Teresina", uf_codigo: "22", uf_nome: "Piauí" },
  { codigo: "3548708", nome: "São Bernardo do Campo", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3303500", nome: "Nova Iguaçu", uf_codigo: "33", uf_nome: "Rio de Janeiro" },
  { codigo: "2507507", nome: "João Pessoa", uf_codigo: "25", uf_nome: "Paraíba" },
  { codigo: "3547809", nome: "Santo André", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3534401", nome: "Osasco", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "2800308", nome: "Aracaju", uf_codigo: "28", uf_nome: "Sergipe" },
  { codigo: "5103403", nome: "Cuiabá", uf_codigo: "51", uf_nome: "Mato Grosso" },
  { codigo: "2507507", nome: "João Pessoa", uf_codigo: "25", uf_nome: "Paraíba" },
  { codigo: "2607901", nome: "Jaboatão dos Guararapes", uf_codigo: "26", uf_nome: "Pernambuco" },
  { codigo: "3170206", nome: "Uberlândia", uf_codigo: "31", uf_nome: "Minas Gerais" },
  { codigo: "3136702", nome: "Juiz de Fora", uf_codigo: "31", uf_nome: "Minas Gerais" },
  { codigo: "3118601", nome: "Contagem", uf_codigo: "31", uf_nome: "Minas Gerais" },
  { codigo: "3552205", nome: "Sorocaba", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3543402", nome: "Ribeirão Preto", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "5201405", nome: "Aparecida de Goiânia", uf_codigo: "52", uf_nome: "Goiás" },
  { codigo: "4209102", nome: "Joinville", uf_codigo: "42", uf_nome: "Santa Catarina" },
  { codigo: "4205407", nome: "Florianópolis", uf_codigo: "42", uf_nome: "Santa Catarina" },
  { codigo: "1100205", nome: "Porto Velho", uf_codigo: "11", uf_nome: "Rondônia" },
  { codigo: "1200401", nome: "Rio Branco", uf_codigo: "12", uf_nome: "Acre" },
  { codigo: "1400100", nome: "Boa Vista", uf_codigo: "14", uf_nome: "Roraima" },
  { codigo: "1600303", nome: "Macapá", uf_codigo: "16", uf_nome: "Amapá" },
  { codigo: "1721000", nome: "Palmas", uf_codigo: "17", uf_nome: "Tocantins" },
  { codigo: "2909802", nome: "Feira de Santana", uf_codigo: "29", uf_nome: "Bahia" },
  { codigo: "3106705", nome: "Betim", uf_codigo: "31", uf_nome: "Minas Gerais" },
  { codigo: "4113700", nome: "Londrina", uf_codigo: "41", uf_nome: "Paraná" },
  { codigo: "4115200", nome: "Maringá", uf_codigo: "41", uf_nome: "Paraná" },
  { codigo: "4304606", nome: "Canoas", uf_codigo: "43", uf_nome: "Rio Grande do Sul" },
  { codigo: "4318705", nome: "São Leopoldo", uf_codigo: "43", uf_nome: "Rio Grande do Sul" },
  { codigo: "4305108", nome: "Caxias do Sul", uf_codigo: "43", uf_nome: "Rio Grande do Sul" },
  { codigo: "4119905", nome: "Ponta Grossa", uf_codigo: "41", uf_nome: "Paraná" },
  { codigo: "4202404", nome: "Blumenau", uf_codigo: "42", uf_nome: "Santa Catarina" },
  { codigo: "2933307", nome: "Vitória da Conquista", uf_codigo: "29", uf_nome: "Bahia" },
  { codigo: "3205309", nome: "Vitória", uf_codigo: "32", uf_nome: "Espírito Santo" },
  { codigo: "3201308", nome: "Cariacica", uf_codigo: "32", uf_nome: "Espírito Santo" },
  { codigo: "3205002", nome: "Vila Velha", uf_codigo: "32", uf_nome: "Espírito Santo" },
  { codigo: "3205200", nome: "Serra", uf_codigo: "32", uf_nome: "Espírito Santo" },
  { codigo: "3525904", nome: "Jundiaí", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3513801", nome: "Diadema", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3529401", nome: "Mauá", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3509007", nome: "Carapicuíba", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3548500", nome: "Santos", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3530607", nome: "Mogi das Cruzes", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3549805", nome: "São José dos Campos", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3538709", nome: "Piracicaba", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3503208", nome: "Barueri", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3506003", nome: "Bauru", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3549904", nome: "São José do Rio Preto", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3516200", nome: "Franca", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3518701", nome: "Guarujá", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3554102", nome: "Taubaté", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3526902", nome: "Limeira", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3552403", nome: "Suzano", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3554003", nome: "Taboão da Serra", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3550407", nome: "São Vicente", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3539806", nome: "Praia Grande", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3501608", nome: "Americana", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3523107", nome: "Itaquaquecetuba", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3548807", nome: "São Caetano do Sul", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3510609", nome: "Cotia", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3520509", nome: "Hortolândia", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3524402", nome: "Jacareí", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3548906", nome: "Santa Bárbara D'Oeste", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3521804", nome: "Indaiatuba", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3529005", nome: "Marília", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3522208", nome: "Itapevi", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3513009", nome: "Cubatão", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3501905", nome: "Araçatuba", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3502507", nome: "Araraquara", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3539103", nome: "Presidente Prudente", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3544103", nome: "Rio Claro", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3552502", nome: "Sumaré", uf_codigo: "35", uf_nome: "São Paulo" },
  // Mais alguns municípios de SP
  { codigo: "3545803", nome: "Salto", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3557303", nome: "Votuporanga", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3508504", nome: "Catanduva", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3502200", nome: "Araras", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3543303", nome: "Ribeirão Pires", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3515707", nome: "Ferraz de Vasconcelos", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3517406", nome: "Guaratinguetá", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3539301", nome: "Poá", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3507605", nome: "Bragança Paulista", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3519071", nome: "Itatiba", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3534708", nome: "Ourinhos", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3501301", nome: "Aguaí", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3512902", nome: "Cruzeiro", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3526704", nome: "Leme", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3540903", nome: "Registro", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3554805", nome: "Tupã", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3527207", nome: "Lorena", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3500303", nome: "Adamantina", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3503901", nome: "Bebedouro", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3513504", nome: "Dracena", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3524303", nome: "Itu", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3537602", nome: "Penápolis", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3555406", nome: "Valinhos", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3556404", nome: "Vinhedo", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3500600", nome: "Agudos", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3504008", nome: "Birigui", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3510500", nome: "Cosmópolis", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3524105", nome: "Itupeva", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3525508", nome: "Jaú", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3527306", nome: "Lins", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3530805", nome: "Mongaguá", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3533908", nome: "Nova Odessa", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3536406", nome: "Paulínia", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3537107", nome: "Pedreira", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3543907", nome: "Rio Grande da Serra", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3548054", nome: "Santana de Parnaíba", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3549706", nome: "São José dos Pinhais", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3556206", nome: "Vargem Grande Paulista", uf_codigo: "35", uf_nome: "São Paulo" },
  { codigo: "3557154", nome: "Votorantim", uf_codigo: "35", uf_nome: "São Paulo" },
];

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
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: 'Acesso não autorizado' }),
        { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Insert municipalities in batches
    const batchSize = 100;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < municipios.length; i += batchSize) {
      const batch = municipios.slice(i, i + batchSize).map(m => ({
        codigo_ibge: m.codigo,
        nome_municipio: m.nome,
        uf_codigo: m.uf_codigo,
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
