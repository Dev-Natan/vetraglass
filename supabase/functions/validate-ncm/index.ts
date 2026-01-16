import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Common NCM codes for glass and aluminum industry (vidro e alumínio)
const commonNCMs: Record<string, { description: string; category: string }> = {
  // Vidros
  '70031200': { description: 'Vidro vazado ou laminado, não armado, colorido, opacificado, folheado ou com camada absorvente', category: 'Vidro' },
  '70031990': { description: 'Outros vidros vazados ou laminados', category: 'Vidro' },
  '70042090': { description: 'Outros vidros estirados ou soprados', category: 'Vidro' },
  '70049000': { description: 'Outros vidros em chapas ou folhas', category: 'Vidro' },
  '70051000': { description: 'Vidro float não armado, com camada absorvente, refletora ou não', category: 'Vidro Float' },
  '70052100': { description: 'Vidro float não armado, colorido na massa, opacificado, folheado', category: 'Vidro Float' },
  '70052900': { description: 'Outros vidros float não armados', category: 'Vidro Float' },
  '70060000': { description: 'Vidro das posições 70.03 a 70.05, recurvado, biselado, gravado, etc.', category: 'Vidro Beneficiado' },
  '70071100': { description: 'Vidros de segurança temperados, para veículos automóveis', category: 'Vidro Temperado' },
  '70071900': { description: 'Outros vidros de segurança temperados', category: 'Vidro Temperado' },
  '70072100': { description: 'Vidros de segurança laminados, para veículos automóveis', category: 'Vidro Laminado' },
  '70072900': { description: 'Outros vidros de segurança laminados', category: 'Vidro Laminado' },
  '70080000': { description: 'Vidros isolantes de paredes múltiplas', category: 'Vidro Insulado' },
  '70091000': { description: 'Espelhos retrovisores para veículos', category: 'Espelho' },
  '70099100': { description: 'Espelhos de vidro não emoldurados', category: 'Espelho' },
  '70099200': { description: 'Espelhos de vidro emoldurados', category: 'Espelho' },
  '70200010': { description: 'Ampolas de vidro para garrafas térmicas', category: 'Vidro' },
  
  // Alumínio e perfis
  '76041010': { description: 'Perfis de alumínio não ligado', category: 'Perfil Alumínio' },
  '76041090': { description: 'Outros perfis de alumínio não ligado', category: 'Perfil Alumínio' },
  '76042100': { description: 'Perfis ocos de ligas de alumínio', category: 'Perfil Alumínio' },
  '76042910': { description: 'Barras de ligas de alumínio', category: 'Perfil Alumínio' },
  '76042990': { description: 'Outros perfis de ligas de alumínio', category: 'Perfil Alumínio' },
  '76061100': { description: 'Chapas e tiras de alumínio não ligado, de espessura superior a 0,2mm', category: 'Chapa Alumínio' },
  '76061200': { description: 'Chapas e tiras de ligas de alumínio', category: 'Chapa Alumínio' },
  '76069100': { description: 'Outras chapas de alumínio não ligado', category: 'Chapa Alumínio' },
  '76069200': { description: 'Outras chapas de ligas de alumínio', category: 'Chapa Alumínio' },
  '76071110': { description: 'Folhas de alumínio, laminadas, de espessura <= 0,2mm', category: 'Folha Alumínio' },
  '76072010': { description: 'Folhas de alumínio com suporte de papel', category: 'Folha Alumínio' },
  '76081000': { description: 'Tubos de alumínio não ligado', category: 'Tubo Alumínio' },
  '76082000': { description: 'Tubos de ligas de alumínio', category: 'Tubo Alumínio' },
  '76090000': { description: 'Acessórios para tubos de alumínio', category: 'Acessório Alumínio' },
  '76101000': { description: 'Portas, janelas e seus caixilhos, de alumínio', category: 'Esquadria Alumínio' },
  '76109000': { description: 'Outras construções e suas partes, de alumínio', category: 'Construção Alumínio' },
  '76110000': { description: 'Reservatórios, tonéis, cubas, de alumínio', category: 'Alumínio' },
  '76121010': { description: 'Embalagens tubulares flexíveis de alumínio', category: 'Embalagem Alumínio' },
  '76129010': { description: 'Latas de alumínio para bebidas', category: 'Lata Alumínio' },
  '76130000': { description: 'Recipientes de alumínio para gases comprimidos', category: 'Alumínio' },
  '76141000': { description: 'Cabos com alma de aço, de alumínio', category: 'Cabo Alumínio' },
  '76149000': { description: 'Outros cabos de alumínio', category: 'Cabo Alumínio' },
  '76151100': { description: 'Esponjas, esfregões, luvas para cozinha, de alumínio', category: 'Utensílio Alumínio' },
  '76151910': { description: 'Panelas de pressão de alumínio', category: 'Utensílio Alumínio' },
  '76152000': { description: 'Artigos de higiene ou de toucador, de alumínio', category: 'Alumínio' },
  '76161000': { description: 'Tachas, pregos, escápulas, de alumínio', category: 'Fixação Alumínio' },
  '76169100': { description: 'Telas, grades, redes, de alumínio', category: 'Alumínio' },
  '76169900': { description: 'Outras obras de alumínio', category: 'Alumínio' },
  
  // Acessórios e ferragens
  '83014000': { description: 'Outras fechaduras, ferrolhos', category: 'Fechadura' },
  '83016000': { description: 'Partes de fechaduras, cadeados, ferrolhos', category: 'Acessório Fechadura' },
  '83021000': { description: 'Dobradiças de qualquer tipo', category: 'Dobradiça' },
  '83022000': { description: 'Rodízios', category: 'Rodízio' },
  '83024100': { description: 'Outras guarnições para construções', category: 'Guarnição' },
  '83024200': { description: 'Outras guarnições para móveis', category: 'Guarnição' },
  '83025000': { description: 'Porta-chapéus, cabides, suportes', category: 'Suporte' },
  '83026000': { description: 'Fechos automáticos para portas', category: 'Fecho' },
  
  // Borrachas e vedações
  '40169300': { description: 'Juntas, gaxetas e semelhantes de borracha vulcanizada', category: 'Vedação' },
  '40169990': { description: 'Outras obras de borracha vulcanizada não endurecida', category: 'Borracha' },
  
  // Plásticos
  '39259090': { description: 'Outros artigos para construção, de plástico', category: 'Plástico' },
  '39269090': { description: 'Outras obras de plásticos', category: 'Plástico' },
};

interface NCMValidationResult {
  valid: boolean;
  ncm: string;
  description?: string;
  category?: string;
  source: 'local' | 'api';
  message: string;
}

async function validateNCMFromAPI(ncm: string): Promise<NCMValidationResult | null> {
  try {
    // Try multiple APIs for NCM validation
    
    // API 1: Cosmos (free tier)
    const cosmosUrl = `https://api.cosmos.bluesoft.com.br/ncms/${ncm}`;
    
    // Note: This API requires authentication, so we'll use local validation primarily
    // For production, you would want to get an API key from Cosmos/Bluesoft
    
    // API 2: Alternative - Brasil API (if available)
    // const brasilApiUrl = `https://brasilapi.com.br/api/ncm/v1/${ncm}`;
    
    return null; // Return null to fall back to local validation
  } catch (error) {
    console.log('API validation failed, falling back to local:', error);
    return null;
  }
}

function validateNCMFormat(ncm: string): { valid: boolean; message: string } {
  // Remove any non-numeric characters
  const cleanNCM = ncm.replace(/\D/g, '');
  
  if (cleanNCM.length !== 8) {
    return {
      valid: false,
      message: `NCM deve ter 8 dígitos. Atual: ${cleanNCM.length} dígitos`
    };
  }
  
  // Basic structural validation
  const chapter = cleanNCM.substring(0, 2);
  const chapterNum = parseInt(chapter, 10);
  
  // Valid chapters are 01-97 (with some gaps)
  if (chapterNum < 1 || chapterNum > 97) {
    return {
      valid: false,
      message: 'Capítulo NCM inválido (deve ser entre 01 e 97)'
    };
  }
  
  // Some chapters don't exist (77 is reserved)
  if (chapterNum === 77) {
    return {
      valid: false,
      message: 'Capítulo 77 está reservado para uso futuro'
    };
  }
  
  return { valid: true, message: 'Formato válido' };
}

function validateNCMLocal(ncm: string): NCMValidationResult {
  const cleanNCM = ncm.replace(/\D/g, '');
  
  // First check format
  const formatCheck = validateNCMFormat(cleanNCM);
  if (!formatCheck.valid) {
    return {
      valid: false,
      ncm: cleanNCM,
      source: 'local',
      message: formatCheck.message
    };
  }
  
  // Check if it's in our known list
  if (commonNCMs[cleanNCM]) {
    return {
      valid: true,
      ncm: cleanNCM,
      description: commonNCMs[cleanNCM].description,
      category: commonNCMs[cleanNCM].category,
      source: 'local',
      message: 'NCM válido e reconhecido para o segmento de vidros e alumínio'
    };
  }
  
  // Check if it's in a relevant chapter for glass/aluminum industry
  const chapter = cleanNCM.substring(0, 2);
  const relevantChapters: Record<string, string> = {
    '39': 'Plásticos e suas obras',
    '40': 'Borracha e suas obras',
    '70': 'Vidro e suas obras',
    '76': 'Alumínio e suas obras',
    '83': 'Obras diversas de metais comuns',
    '73': 'Obras de ferro fundido, ferro ou aço',
  };
  
  if (relevantChapters[chapter]) {
    return {
      valid: true,
      ncm: cleanNCM,
      category: relevantChapters[chapter],
      source: 'local',
      message: `NCM válido - Capítulo ${chapter}: ${relevantChapters[chapter]}. Código não está na base local detalhada, mas pertence a um capítulo relevante.`
    };
  }
  
  // Valid format but not in our industry
  return {
    valid: true,
    ncm: cleanNCM,
    source: 'local',
    message: `NCM com formato válido, mas não é comum para o segmento de vidros e alumínio. Capítulo ${chapter}.`
  };
}

function getSuggestedNCMs(itemType?: string): { ncm: string; description: string }[] {
  const suggestions: { ncm: string; description: string }[] = [];
  
  if (itemType === 'glass') {
    suggestions.push(
      { ncm: '70051000', description: 'Vidro float com camada absorvente/refletora' },
      { ncm: '70052900', description: 'Outros vidros float não armados' },
      { ncm: '70071900', description: 'Vidros de segurança temperados' },
      { ncm: '70072900', description: 'Vidros de segurança laminados' },
      { ncm: '70091000', description: 'Espelhos retrovisores' },
      { ncm: '70099100', description: 'Espelhos de vidro não emoldurados' },
    );
  } else if (itemType === 'profile') {
    suggestions.push(
      { ncm: '76042100', description: 'Perfis ocos de ligas de alumínio' },
      { ncm: '76042990', description: 'Outros perfis de ligas de alumínio' },
      { ncm: '76101000', description: 'Portas, janelas e caixilhos de alumínio' },
    );
  } else if (itemType === 'accessory') {
    suggestions.push(
      { ncm: '83014000', description: 'Fechaduras e ferrolhos' },
      { ncm: '83021000', description: 'Dobradiças' },
      { ncm: '83024100', description: 'Guarnições para construções' },
      { ncm: '76169900', description: 'Outras obras de alumínio' },
      { ncm: '40169300', description: 'Juntas e gaxetas de borracha' },
    );
  } else {
    // General suggestions
    suggestions.push(
      { ncm: '70071900', description: 'Vidros temperados' },
      { ncm: '76042100', description: 'Perfis de alumínio' },
      { ncm: '76101000', description: 'Esquadrias de alumínio' },
    );
  }
  
  return suggestions;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Autenticação necessária' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Authenticated user:', claimsData.claims.sub);
    // ========== END AUTHENTICATION CHECK ==========

    const { ncm, itemType, getSuggestions } = await req.json();
    
    console.log('NCM validation request:', { ncm, itemType, getSuggestions });
    
    // If just requesting suggestions
    if (getSuggestions) {
      const suggestions = getSuggestedNCMs(itemType);
      return new Response(
        JSON.stringify({ 
          success: true, 
          suggestions 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!ncm) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'NCM não informado' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // First try API validation
    const apiResult = await validateNCMFromAPI(ncm);
    
    if (apiResult) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          result: apiResult,
          suggestions: getSuggestedNCMs(itemType)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Fall back to local validation
    const localResult = validateNCMLocal(ncm);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        result: localResult,
        suggestions: !localResult.valid ? getSuggestedNCMs(itemType) : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error validating NCM:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao validar NCM';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
