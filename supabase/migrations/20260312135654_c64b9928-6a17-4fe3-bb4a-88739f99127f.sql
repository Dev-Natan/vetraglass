
-- Add product configuration fields to product_templates
ALTER TABLE public.product_templates 
  ADD COLUMN IF NOT EXISTS acabamento text DEFAULT null,
  ADD COLUMN IF NOT EXISTS cor_componentes text DEFAULT null,
  ADD COLUMN IF NOT EXISTS reforco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS contramarco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS corte_contramarco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS arremate text DEFAULT null;

-- Add same fields to company_products
ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS acabamento text DEFAULT null,
  ADD COLUMN IF NOT EXISTS cor_componentes text DEFAULT null,
  ADD COLUMN IF NOT EXISTS reforco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS contramarco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS corte_contramarco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS arremate text DEFAULT null;
