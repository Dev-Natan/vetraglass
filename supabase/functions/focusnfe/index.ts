import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FOCUSNFE_TOKEN = Deno.env.get('FOCUSNFE_TOKEN') || '';

// URLs para cada ambiente
const FOCUSNFE_URLS = {
  producao: 'https://api.focusnfe.com.br/v2',
  homologacao: 'https://homologacao.focusnfe.com.br/v2'
};

interface NFEPayload {
  natureza_operacao: string;
  forma_pagamento: number;
  tipo_documento: number;
  finalidade_emissao: number;
  cnpj_emitente: string;
  inscricao_estadual_emitente?: string;
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

interface CompanyData {
  id: string;
  cnpj: string;
  name: string;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  codigo_municipio_ibge?: string | null;
  ambiente_fiscal?: string | null;
  certificado_digital_url?: string | null;
  certificado_digital_validade?: string | null;
  certificado_digital_nome?: string | null;
}

// Função para validar certificado digital
function validateCertificate(company: CompanyData): { valid: boolean; error?: string } {
  if (!company.certificado_digital_url) {
    return { valid: false, error: 'Certificado digital não configurado. Acesse Configurações > Área Fiscal para fazer upload do certificado A1.' };
  }

  if (!company.certificado_digital_validade) {
    return { valid: false, error: 'Data de validade do certificado não informada.' };
  }

  const validadeDate = new Date(company.certificado_digital_validade);
  const hoje = new Date();

  if (validadeDate < hoje) {
    return { valid: false, error: `Certificado digital vencido em ${validadeDate.toLocaleDateString('pt-BR')}. Por favor, faça upload de um novo certificado.` };
  }

  return { valid: true };
}

// Função para validar dados fiscais obrigatórios
function validateFiscalData(company: CompanyData, tipo: 'nfe' | 'nfse'): { valid: boolean; error?: string } {
  if (!company.cnpj) {
    return { valid: false, error: 'CNPJ da empresa não configurado.' };
  }

  if (tipo === 'nfe' && !company.inscricao_estadual) {
    return { valid: false, error: 'Inscrição Estadual (IE) não configurada. Acesse Configurações > Área Fiscal para preencher.' };
  }

  if (tipo === 'nfse') {
    if (!company.inscricao_municipal) {
      return { valid: false, error: 'Inscrição Municipal (IM) não configurada. Acesse Configurações > Área Fiscal para preencher.' };
    }
    if (!company.codigo_municipio_ibge) {
      return { valid: false, error: 'Código do município IBGE não configurado. Acesse Configurações > Área Fiscal para preencher.' };
    }
  }

  return { valid: true };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação usando getClaims
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    const { action, nota_id, tipo, payload, company_id } = await req.json();
    console.log(`[FocusNFe] Action: ${action}, Tipo: ${tipo}, NotaID: ${nota_id}`);

    // Verificar se o token está configurado
    if (!FOCUSNFE_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'FOCUSNFE_TOKEN não configurado. Entre em contato com o suporte.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados da empresa
    let companyData: CompanyData | null = null;
    
    if (company_id) {
      const { data, error } = await supabase
        .from('companies')
        .select('id, cnpj, name, inscricao_estadual, inscricao_municipal, codigo_municipio_ibge, ambiente_fiscal, certificado_digital_url, certificado_digital_validade, certificado_digital_nome')
        .eq('id', company_id)
        .single();
      
      if (error) {
        console.error('[FocusNFe] Erro ao buscar empresa:', error);
      } else {
        companyData = data;
      }
    }

    // Se não encontrou pelo company_id, buscar pela nota
    if (!companyData && nota_id) {
      const { data: nota } = await supabase
        .from('notas_fiscais')
        .select('company_id')
        .eq('id', nota_id)
        .single();

      if (nota?.company_id) {
        const { data, error } = await supabase
          .from('companies')
          .select('id, cnpj, name, inscricao_estadual, inscricao_municipal, codigo_municipio_ibge, ambiente_fiscal, certificado_digital_url, certificado_digital_validade, certificado_digital_nome')
          .eq('id', nota.company_id)
          .single();
        
        if (!error) {
          companyData = data;
        }
      }
    }

    if (!companyData) {
      return new Response(
        JSON.stringify({ error: 'Empresa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar ambiente (default: homologação para segurança)
    const ambiente = companyData.ambiente_fiscal === 'producao' ? 'producao' : 'homologacao';
    const FOCUSNFE_BASE_URL = FOCUSNFE_URLS[ambiente];
    console.log(`[FocusNFe] Ambiente: ${ambiente}, URL: ${FOCUSNFE_BASE_URL}`);

    const authHeaderFocus = 'Basic ' + btoa(FOCUSNFE_TOKEN + ':');

    switch (action) {
      case 'validar_configuracao': {
        // Validar se a empresa está pronta para emitir notas
        const certValidation = validateCertificate(companyData);
        if (!certValidation.valid) {
          return new Response(
            JSON.stringify({ valid: false, error: certValidation.error, field: 'certificado' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const fiscalValidation = validateFiscalData(companyData, tipo);
        if (!fiscalValidation.valid) {
          return new Response(
            JSON.stringify({ valid: false, error: fiscalValidation.error, field: 'dados_fiscais' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            valid: true, 
            ambiente,
            message: ambiente === 'homologacao' 
              ? 'Configuração válida. Atenção: Você está em ambiente de HOMOLOGAÇÃO.' 
              : 'Configuração válida para emissão em ambiente de PRODUÇÃO.' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'emitir_nfe': {
        // Validar certificado antes de emitir
        const certValidation = validateCertificate(companyData);
        if (!certValidation.valid) {
          return new Response(
            JSON.stringify({ error: certValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validar dados fiscais
        const fiscalValidation = validateFiscalData(companyData, 'nfe');
        if (!fiscalValidation.valid) {
          return new Response(
            JSON.stringify({ error: fiscalValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Adicionar IE ao payload se não estiver
        if (payload && companyData.inscricao_estadual) {
          payload.inscricao_estadual_emitente = companyData.inscricao_estadual.replace(/\D/g, '');
        }

        // Emitir NF-e
        const ref = `nfe_${nota_id}_${Date.now()}`;
        
        console.log(`[FocusNFe] Emitindo NF-e - Ref: ${ref}, Ambiente: ${ambiente}`);
        
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
          emitente_ie: companyData.inscricao_estadual,
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
          JSON.stringify({ success: true, ref, result, ambiente }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'emitir_nfse': {
        // Validar certificado antes de emitir
        const certValidation = validateCertificate(companyData);
        if (!certValidation.valid) {
          return new Response(
            JSON.stringify({ error: certValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Validar dados fiscais
        const fiscalValidation = validateFiscalData(companyData, 'nfse');
        if (!fiscalValidation.valid) {
          return new Response(
            JSON.stringify({ error: fiscalValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Atualizar payload com dados fiscais da empresa
        if (payload?.prestador) {
          payload.prestador.inscricao_municipal = companyData.inscricao_municipal?.replace(/\D/g, '') || '';
          payload.prestador.codigo_municipio = companyData.codigo_municipio_ibge || '';
        }

        // Emitir NFS-e
        const ref = `nfse_${nota_id}_${Date.now()}`;
        
        console.log(`[FocusNFe] Emitindo NFS-e - Ref: ${ref}, Ambiente: ${ambiente}`);
        
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
          emitente_im: companyData.inscricao_municipal,
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
          JSON.stringify({ success: true, ref, result, ambiente }),
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
