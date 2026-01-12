import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOCUSNFE_TOKEN = Deno.env.get('FOCUSNFE_TOKEN') || '';
const FOCUSNFE_BASE_URL = 'https://api.focusnfe.com.br/v2';
// Para ambiente de homologação, use: 'https://homologacao.focusnfe.com.br/v2'

interface NFEPayload {
  natureza_operacao: string;
  forma_pagamento: number;
  tipo_documento: number;
  finalidade_emissao: number;
  cnpj_emitente: string;
  nome_destinatario: string;
  cpf_destinatario?: string;
  cnpj_destinatario?: string;
  email_destinatario?: string;
  telefone_destinatario?: string;
  logradouro_destinatario?: string;
  numero_destinatario?: string;
  bairro_destinatario?: string;
  municipio_destinatario?: string;
  uf_destinatario?: string;
  cep_destinatario?: string;
  items: Array<{
    numero_item: number;
    codigo_produto: string;
    descricao: string;
    cfop: string;
    unidade_comercial: string;
    quantidade_comercial: number;
    valor_unitario_comercial: number;
    valor_bruto: number;
    ncm: string;
    icms_origem: string;
    icms_situacao_tributaria: string;
    icms_aliquota?: number;
    icms_base_calculo?: number;
    icms_valor?: number;
  }>;
  informacoes_adicionais_contribuinte?: string;
}

interface NFSEPayload {
  prestador: {
    cnpj: string;
    inscricao_municipal: string;
    codigo_municipio: string;
  };
  tomador: {
    cpf?: string;
    cnpj?: string;
    razao_social: string;
    email?: string;
    telefone?: string;
    endereco?: {
      logradouro?: string;
      numero?: string;
      bairro?: string;
      codigo_municipio?: string;
      uf?: string;
      cep?: string;
    };
  };
  servico: {
    aliquota: number;
    discriminacao: string;
    codigo_tributario_municipio: string;
    valor_servicos: number;
    iss_retido: boolean;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, nota_id, tipo, payload } = await req.json();
    console.log(`[FocusNFe] Action: ${action}, Tipo: ${tipo}, NotaID: ${nota_id}`);

    // Verificar se o token está configurado
    if (!FOCUSNFE_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'FOCUSNFE_TOKEN não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeaderFocus = 'Basic ' + btoa(FOCUSNFE_TOKEN + ':');

    switch (action) {
      case 'emitir_nfe': {
        // Emitir NF-e
        const ref = `nfe_${nota_id}_${Date.now()}`;
        
        const response = await fetch(`${FOCUSNFE_BASE_URL}/nfe?ref=${ref}`, {
          method: 'POST',
          headers: {
            'Authorization': authHeaderFocus,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log('[FocusNFe] NF-e Response:', JSON.stringify(result));

        // Atualizar nota no banco
        const updateData: Record<string, any> = {
          focusnfe_ref: ref,
          focusnfe_status: result.status || 'enviado',
          status: result.status === 'autorizado' ? 'autorizada' : 
                  result.status === 'erro_autorizacao' ? 'rejeitada' : 'processando',
        };

        if (result.status === 'autorizado') {
          updateData.numero = result.numero;
          updateData.serie = result.serie;
          updateData.chave_acesso = result.chave_nfe;
          updateData.data_autorizacao = new Date().toISOString();
          updateData.pdf_url = result.caminho_danfe;
          updateData.xml_nota = result.caminho_xml_nota_fiscal;
        }

        if (result.status === 'erro_autorizacao') {
          updateData.motivo_rejeicao = result.mensagem_sefaz || result.mensagem;
        }

        await supabase
          .from('notas_fiscais')
          .update(updateData)
          .eq('id', nota_id);

        return new Response(
          JSON.stringify({ success: true, ref, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'emitir_nfse': {
        // Emitir NFS-e
        const ref = `nfse_${nota_id}_${Date.now()}`;
        
        const response = await fetch(`${FOCUSNFE_BASE_URL}/nfse?ref=${ref}`, {
          method: 'POST',
          headers: {
            'Authorization': authHeaderFocus,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        console.log('[FocusNFe] NFS-e Response:', JSON.stringify(result));

        // Atualizar nota no banco
        const updateData: Record<string, any> = {
          focusnfe_ref: ref,
          focusnfe_status: result.status || 'enviado',
          status: result.status === 'autorizado' ? 'autorizada' : 
                  result.status === 'erro_autorizacao' ? 'rejeitada' : 'processando',
        };

        if (result.status === 'autorizado') {
          updateData.numero = result.numero;
          updateData.data_autorizacao = new Date().toISOString();
          updateData.pdf_url = result.caminho_danfse;
        }

        if (result.status === 'erro_autorizacao') {
          updateData.motivo_rejeicao = result.mensagem || 'Erro na autorização';
        }

        await supabase
          .from('notas_fiscais')
          .update(updateData)
          .eq('id', nota_id);

        return new Response(
          JSON.stringify({ success: true, ref, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'consultar': {
        // Consultar status da nota
        const { data: nota } = await supabase
          .from('notas_fiscais')
          .select('focusnfe_ref, tipo')
          .eq('id', nota_id)
          .single();

        if (!nota?.focusnfe_ref) {
          return new Response(
            JSON.stringify({ error: 'Nota não possui referência FocusNFe' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const endpoint = nota.tipo === 'nfe' ? 'nfe' : 'nfse';
        const response = await fetch(`${FOCUSNFE_BASE_URL}/${endpoint}/${nota.focusnfe_ref}`, {
          method: 'GET',
          headers: {
            'Authorization': authHeaderFocus,
          },
        });

        const result = await response.json();
        console.log('[FocusNFe] Consulta Response:', JSON.stringify(result));

        // Atualizar status no banco
        const updateData: Record<string, any> = {
          focusnfe_status: result.status,
        };

        if (result.status === 'autorizado') {
          updateData.status = 'autorizada';
          updateData.numero = result.numero;
          updateData.data_autorizacao = new Date().toISOString();
          if (result.caminho_danfe) updateData.pdf_url = result.caminho_danfe;
          if (result.caminho_danfse) updateData.pdf_url = result.caminho_danfse;
          if (result.chave_nfe) updateData.chave_acesso = result.chave_nfe;
        } else if (result.status === 'erro_autorizacao') {
          updateData.status = 'rejeitada';
          updateData.motivo_rejeicao = result.mensagem_sefaz || result.mensagem;
        }

        await supabase
          .from('notas_fiscais')
          .update(updateData)
          .eq('id', nota_id);

        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancelar': {
        // Cancelar nota
        const { data: nota } = await supabase
          .from('notas_fiscais')
          .select('focusnfe_ref, tipo')
          .eq('id', nota_id)
          .single();

        if (!nota?.focusnfe_ref) {
          return new Response(
            JSON.stringify({ error: 'Nota não possui referência FocusNFe' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const endpoint = nota.tipo === 'nfe' ? 'nfe' : 'nfse';
        const response = await fetch(`${FOCUSNFE_BASE_URL}/${endpoint}/${nota.focusnfe_ref}`, {
          method: 'DELETE',
          headers: {
            'Authorization': authHeaderFocus,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ justificativa: payload?.justificativa || 'Cancelamento solicitado pelo emissor' }),
        });

        const result = await response.json();
        console.log('[FocusNFe] Cancelamento Response:', JSON.stringify(result));

        if (result.status === 'cancelado') {
          await supabase
            .from('notas_fiscais')
            .update({
              status: 'cancelada',
              focusnfe_status: 'cancelado',
              data_cancelamento: new Date().toISOString(),
            })
            .eq('id', nota_id);
        }

        return new Response(
          JSON.stringify({ success: true, result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Action not supported' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[FocusNFe] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
