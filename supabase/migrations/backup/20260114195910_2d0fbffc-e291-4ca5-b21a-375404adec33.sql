-- Add fiscal mode flag to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS modo_fiscal_ativo boolean NOT NULL DEFAULT false;

-- Add fiscal fields to item_templates
ALTER TABLE public.item_templates
ADD COLUMN IF NOT EXISTS ncm character varying(10),
ADD COLUMN IF NOT EXISTS cfop_venda character varying(4) DEFAULT '5102',
ADD COLUMN IF NOT EXISTS cfop_venda_interestadual character varying(4) DEFAULT '6102',
ADD COLUMN IF NOT EXISTS cest character varying(7),
ADD COLUMN IF NOT EXISTS origem character varying(1) DEFAULT '0',
ADD COLUMN IF NOT EXISTS codigo_servico character varying(20),
ADD COLUMN IF NOT EXISTS aliquota_iss numeric DEFAULT 0;

-- Add fiscal fields to product_templates  
ALTER TABLE public.product_templates
ADD COLUMN IF NOT EXISTS ncm character varying(10),
ADD COLUMN IF NOT EXISTS cfop_venda character varying(4) DEFAULT '5102',
ADD COLUMN IF NOT EXISTS cfop_venda_interestadual character varying(4) DEFAULT '6102',
ADD COLUMN IF NOT EXISTS cest character varying(7),
ADD COLUMN IF NOT EXISTS origem character varying(1) DEFAULT '0',
ADD COLUMN IF NOT EXISTS codigo_servico character varying(20),
ADD COLUMN IF NOT EXISTS aliquota_iss numeric DEFAULT 0;

-- Comment the columns for documentation
COMMENT ON COLUMN public.companies.modo_fiscal_ativo IS 'Ativa ou desativa o modo fiscal para a empresa';

COMMENT ON COLUMN public.item_templates.ncm IS 'Nomenclatura Comum do Mercosul - 8 dígitos';
COMMENT ON COLUMN public.item_templates.cfop_venda IS 'Código Fiscal de Operações - venda dentro do estado';
COMMENT ON COLUMN public.item_templates.cfop_venda_interestadual IS 'CFOP para vendas interestaduais';
COMMENT ON COLUMN public.item_templates.cest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN public.item_templates.origem IS 'Origem da mercadoria: 0-Nacional, 1-Estrangeira Importação direta, etc';
COMMENT ON COLUMN public.item_templates.codigo_servico IS 'Código do serviço conforme tabela do município';
COMMENT ON COLUMN public.item_templates.aliquota_iss IS 'Alíquota do ISS em percentual';

COMMENT ON COLUMN public.product_templates.ncm IS 'Nomenclatura Comum do Mercosul - 8 dígitos';
COMMENT ON COLUMN public.product_templates.cfop_venda IS 'Código Fiscal de Operações - venda dentro do estado';
COMMENT ON COLUMN public.product_templates.cfop_venda_interestadual IS 'CFOP para vendas interestaduais';
COMMENT ON COLUMN public.product_templates.cest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN public.product_templates.origem IS 'Origem da mercadoria: 0-Nacional, 1-Estrangeira Importação direta, etc';
COMMENT ON COLUMN public.product_templates.codigo_servico IS 'Código do serviço conforme tabela do município';
COMMENT ON COLUMN public.product_templates.aliquota_iss IS 'Alíquota do ISS em percentual';