import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CNPJResponse {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  situacao_cadastral: string;
  descricao_situacao_cadastral: string;
  data_situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  ddd_telefone_1: string;
  email: string;
}

interface ValidationResult {
  valid: boolean;
  active: boolean;
  data?: {
    razaoSocial: string;
    nomeFantasia: string;
    situacao: string;
    endereco: string;
    telefone: string;
    email: string;
  };
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          active: false,
          error: 'Autenticação necessária' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Verify JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          active: false,
          error: 'Autenticação inválida' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const { cnpj } = await req.json();
    
    if (!cnpj) {
      return new Response(
        JSON.stringify({ valid: false, active: false, error: 'CNPJ não informado' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Remove non-numeric characters
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    if (cleanCNPJ.length !== 14) {
      return new Response(
        JSON.stringify({ valid: false, active: false, error: 'CNPJ deve ter 14 dígitos' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`User ${user.id} validating CNPJ: ${cleanCNPJ}`);

    // Query BrasilAPI
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('CNPJ not found in Receita Federal database');
        return new Response(
          JSON.stringify({ 
            valid: false, 
            active: false, 
            error: 'CNPJ não encontrado na base da Receita Federal' 
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      
      if (response.status === 429) {
        console.log('Rate limit exceeded');
        return new Response(
          JSON.stringify({ 
            valid: false, 
            active: false, 
            error: 'Limite de consultas excedido. Tente novamente em alguns minutos.' 
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      throw new Error(`API returned status ${response.status}`);
    }

    const data: CNPJResponse = await response.json();
    console.log(`CNPJ found: ${data.razao_social}, Status: ${data.descricao_situacao_cadastral}`);

    // Check if company is active (situacao_cadastral = 2 means ATIVA)
    const isActive = data.situacao_cadastral === '02' || 
                     data.descricao_situacao_cadastral?.toUpperCase() === 'ATIVA';

    const endereco = [
      data.logradouro,
      data.numero,
      data.complemento,
      data.bairro,
      data.municipio,
      data.uf,
      data.cep
    ].filter(Boolean).join(', ');

    const result: ValidationResult = {
      valid: true,
      active: isActive,
      data: {
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || '',
        situacao: data.descricao_situacao_cadastral || '',
        endereco: endereco,
        telefone: data.ddd_telefone_1 || '',
        email: data.email || '',
      }
    };

    if (!isActive) {
      result.error = `Empresa com situação: ${data.descricao_situacao_cadastral}. Apenas empresas ATIVAS podem se cadastrar.`;
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error validating CNPJ:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        active: false, 
        error: 'Erro ao consultar CNPJ. Tente novamente.' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
