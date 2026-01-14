-- Add certificate validation columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS certificado_cnpj text,
ADD COLUMN IF NOT EXISTS certificado_emissor text,
ADD COLUMN IF NOT EXISTS certificado_serial text,
ADD COLUMN IF NOT EXISTS certificado_status text CHECK (certificado_status IN ('valido', 'expirando', 'expirado', 'invalido')),
ADD COLUMN IF NOT EXISTS certificado_ultima_verificacao timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.certificado_cnpj IS 'CNPJ extraído do certificado digital';
COMMENT ON COLUMN public.companies.certificado_emissor IS 'Autoridade Certificadora emissora';
COMMENT ON COLUMN public.companies.certificado_serial IS 'Número serial do certificado';
COMMENT ON COLUMN public.companies.certificado_status IS 'Status atual: valido, expirando, expirado, invalido';
COMMENT ON COLUMN public.companies.certificado_ultima_verificacao IS 'Timestamp da última verificação';