-- Add fiscal fields to company_items for NFe emission
ALTER TABLE public.company_items
ADD COLUMN IF NOT EXISTS ncm text,
ADD COLUMN IF NOT EXISTS cfop_venda text,
ADD COLUMN IF NOT EXISTS cfop_venda_interestadual text,
ADD COLUMN IF NOT EXISTS cest text,
ADD COLUMN IF NOT EXISTS origem text,
ADD COLUMN IF NOT EXISTS codigo_servico text,
ADD COLUMN IF NOT EXISTS aliquota_iss numeric;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_items_ncm ON public.company_items(ncm) WHERE ncm IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.company_items.ncm IS 'Nomenclatura Comum do Mercosul - 8 dígitos';
COMMENT ON COLUMN public.company_items.cfop_venda IS 'CFOP para vendas dentro do estado';
COMMENT ON COLUMN public.company_items.cfop_venda_interestadual IS 'CFOP para vendas interestaduais';
COMMENT ON COLUMN public.company_items.cest IS 'Código Especificador da Substituição Tributária - 7 dígitos';
COMMENT ON COLUMN public.company_items.origem IS 'Origem da mercadoria (0-8)';
COMMENT ON COLUMN public.company_items.codigo_servico IS 'Código do serviço para NFS-e';
COMMENT ON COLUMN public.company_items.aliquota_iss IS 'Alíquota ISS para serviços (%)';