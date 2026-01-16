import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CertificateValidationResult {
  valid: boolean;
  passwordCorrect: boolean;
  expired: boolean;
  cnpj: string | null;
  cnpjMatch: boolean;
  subject: {
    commonName: string | null;
    organizationName: string | null;
  };
  issuer: {
    commonName: string | null;
    organizationName: string | null;
  };
  validFrom: string | null;
  validUntil: string | null;
  daysUntilExpiration: number | null;
  serialNumber: string | null;
  error?: string;
}

function extractCNPJ(subject: forge.pki.CertificateField[]): string | null {
  // CNPJ can be in different OIDs depending on the CA
  // Common locations:
  // - OID 2.16.76.1.3.3 (ICP-Brasil CNPJ)
  // - In the CN field as part of the name
  // - In serialName field
  
  for (const field of subject) {
    // Check for ICP-Brasil CNPJ OID
    if (field.type === '2.16.76.1.3.3') {
      return formatCNPJ(field.value as string);
    }
    
    // Check serialName (often contains CNPJ)
    if (field.name === 'serialName' || field.shortName === 'serialNumber') {
      const value = field.value as string;
      const cnpjMatch = value.match(/\d{14}/);
      if (cnpjMatch) {
        return formatCNPJ(cnpjMatch[0]);
      }
    }
    
    // Check CN for CNPJ pattern
    if (field.name === 'commonName') {
      const value = field.value as string;
      // Look for CNPJ pattern (14 digits or formatted XX.XXX.XXX/XXXX-XX)
      const cnpjPattern = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
      const match = value.match(cnpjPattern);
      if (match) {
        return formatCNPJ(match[1].replace(/\D/g, ''));
      }
    }
  }
  
  // Try to find in any field
  for (const field of subject) {
    if (typeof field.value === 'string') {
      const cnpjPattern = /(\d{14})/;
      const match = field.value.match(cnpjPattern);
      if (match) {
        return formatCNPJ(match[1]);
      }
    }
  }
  
  return null;
}

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return digits;
  return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`;
}

function normalizeCNPJ(cnpj: string | null): string {
  if (!cnpj) return '';
  return cnpj.replace(/\D/g, '');
}

function getFieldValue(fields: forge.pki.CertificateField[], name: string): string | null {
  const field = fields.find(f => f.name === name || f.shortName === name);
  return field ? (field.value as string) : null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ========== AUTHENTICATION CHECK ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Unauthorized: Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ 
          valid: false, 
          passwordCorrect: false,
          error: 'Autenticação necessária' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
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
      console.log('Unauthorized: Invalid token', claimsError);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          passwordCorrect: false,
          error: 'Token de autenticação inválido' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub;
    console.log('Authenticated user:', userId);
    // ========== END AUTHENTICATION CHECK ==========

    const { pfxBase64, password, companyCnpj } = await req.json();

    if (!pfxBase64) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          passwordCorrect: false,
          error: 'Arquivo PFX não fornecido' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          passwordCorrect: false,
          error: 'Senha não fornecida' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let result: CertificateValidationResult = {
      valid: false,
      passwordCorrect: false,
      expired: true,
      cnpj: null,
      cnpjMatch: false,
      subject: { commonName: null, organizationName: null },
      issuer: { commonName: null, organizationName: null },
      validFrom: null,
      validUntil: null,
      daysUntilExpiration: null,
      serialNumber: null,
    };

    try {
      // Decode Base64 to binary
      const pfxBinary = atob(pfxBase64);
      
      // Parse PFX using node-forge
      const pfxAsn1 = forge.asn1.fromDer(pfxBinary);
      const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);
      
      // Password is correct if we get here
      result.passwordCorrect = true;
      
      // Get certificate bags
      const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag];
      
      if (!certBag || certBag.length === 0) {
        result.error = 'Nenhum certificado encontrado no arquivo PFX';
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get the certificate (usually the first one is the main certificate)
      const cert = certBag[0].cert;
      
      if (!cert) {
        result.error = 'Certificado inválido';
        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Extract certificate information
      const now = new Date();
      const validFrom = cert.validity.notBefore;
      const validUntil = cert.validity.notAfter;
      
      // Calculate days until expiration
      const msPerDay = 24 * 60 * 60 * 1000;
      const daysUntilExpiration = Math.floor((validUntil.getTime() - now.getTime()) / msPerDay);
      
      // Check if expired
      const expired = now > validUntil || now < validFrom;
      
      // Extract CNPJ from certificate
      const certCnpj = extractCNPJ(cert.subject.attributes);
      
      // Check CNPJ match if provided
      const cnpjMatch = companyCnpj 
        ? normalizeCNPJ(certCnpj) === normalizeCNPJ(companyCnpj)
        : true;
      
      // Build result
      result = {
        valid: true,
        passwordCorrect: true,
        expired,
        cnpj: certCnpj,
        cnpjMatch,
        subject: {
          commonName: getFieldValue(cert.subject.attributes, 'commonName'),
          organizationName: getFieldValue(cert.subject.attributes, 'organizationName'),
        },
        issuer: {
          commonName: getFieldValue(cert.issuer.attributes, 'commonName'),
          organizationName: getFieldValue(cert.issuer.attributes, 'organizationName'),
        },
        validFrom: validFrom.toISOString(),
        validUntil: validUntil.toISOString(),
        daysUntilExpiration,
        serialNumber: cert.serialNumber,
      };
      
      console.log('Certificate validated successfully:', {
        cnpj: result.cnpj,
        expired: result.expired,
        daysUntilExpiration: result.daysUntilExpiration,
        issuer: result.issuer.commonName,
      });
      
    } catch (parseError: any) {
      console.error('Error parsing PFX:', parseError);
      
      // Check if it's a password error
      if (parseError.message?.includes('Invalid password') || 
          parseError.message?.includes('PKCS#12 MAC') ||
          parseError.message?.includes('mac verify failure')) {
        result.error = 'Senha incorreta';
        result.passwordCorrect = false;
      } else {
        result.error = `Erro ao processar certificado: ${parseError.message}`;
      }
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Error in validate-certificate:', error);
    return new Response(
      JSON.stringify({ 
        valid: false, 
        passwordCorrect: false,
        error: error.message || 'Erro interno do servidor' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
