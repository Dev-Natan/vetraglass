import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Server-side CNPJ lookup with multi-provider fallback.
// Normalizes every provider response to the BrasilAPI shape consumed by the
// frontend (razao_social, nome_fantasia, ddd_telefone_1, logradouro, ...).

interface NormalizedCnpj {
  razao_social: string;
  nome_fantasia: string;
  ddd_telefone_1: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  descricao_situacao_cadastral: string;
}

const TIMEOUT_MS = 6000;

async function timedFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'Accept': 'application/json', 'User-Agent': 'Vetra/1.0' },
    });
  } finally {
    clearTimeout(t);
  }
}

async function fromBrasilApi(cnpj: string): Promise<NormalizedCnpj | null> {
  const r = await timedFetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (!r.ok) return null;
  const d = await r.json();
  return {
    razao_social: d.razao_social || '',
    nome_fantasia: d.nome_fantasia || '',
    ddd_telefone_1: d.ddd_telefone_1 || '',
    logradouro: d.logradouro || '',
    numero: d.numero ? String(d.numero) : '',
    complemento: d.complemento || '',
    bairro: d.bairro || '',
    municipio: d.municipio || '',
    uf: d.uf || '',
    cep: d.cep ? String(d.cep) : '',
    email: d.email || '',
    descricao_situacao_cadastral: d.descricao_situacao_cadastral || '',
  };
}

async function fromMinhaReceita(cnpj: string): Promise<NormalizedCnpj | null> {
  const r = await timedFetch(`https://minhareceita.org/${cnpj}`);
  if (!r.ok) return null;
  const d = await r.json();
  return {
    razao_social: d.razao_social || '',
    nome_fantasia: d.nome_fantasia || '',
    ddd_telefone_1: d.ddd_telefone_1 ? `${d.ddd_telefone_1}${d.telefone_1 || ''}` : '',
    logradouro: d.logradouro || '',
    numero: d.numero ? String(d.numero) : '',
    complemento: d.complemento || '',
    bairro: d.bairro || '',
    municipio: d.municipio || '',
    uf: d.uf || '',
    cep: d.cep ? String(d.cep) : '',
    email: d.email || '',
    descricao_situacao_cadastral: d.descricao_situacao_cadastral || '',
  };
}

async function fromPublicaCnpjWs(cnpj: string): Promise<NormalizedCnpj | null> {
  const r = await timedFetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
  if (!r.ok) return null;
  const d = await r.json();
  const est = d.estabelecimento || {};
  const tel = (est.telefone1 || est.ddd1) ? `${est.ddd1 || ''}${est.telefone1 || ''}` : '';
  return {
    razao_social: d.razao_social || '',
    nome_fantasia: est.nome_fantasia || '',
    ddd_telefone_1: tel,
    logradouro: est.logradouro || '',
    numero: est.numero ? String(est.numero) : '',
    complemento: est.complemento || '',
    bairro: est.bairro || '',
    municipio: est.cidade?.nome || '',
    uf: est.estado?.sigla || '',
    cep: est.cep ? String(est.cep) : '',
    email: est.email || '',
    descricao_situacao_cadastral: est.situacao_cadastral || '',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { cnpj } = await req.json();
    const digits = String(cnpj || '').replace(/\D/g, '');
    if (digits.length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const providers = [fromBrasilApi, fromMinhaReceita, fromPublicaCnpjWs];
    const errors: string[] = [];
    for (const fn of providers) {
      try {
        const data = await fn(digits);
        if (data && data.razao_social) {
          return new Response(JSON.stringify({ data, source: fn.name }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        errors.push(`${fn.name}: ${(e as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ error: 'CNPJ não encontrado em nenhuma fonte', errors }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
