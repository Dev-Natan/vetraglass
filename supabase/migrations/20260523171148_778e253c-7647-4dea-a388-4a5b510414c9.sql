-- Add new columns to product_template_items
ALTER TABLE public.product_template_items 
ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'formula',
ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'side';

-- Add new columns to company_product_items
ALTER TABLE public.company_product_items 
ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'formula',
ADD COLUMN IF NOT EXISTS applies_to TEXT DEFAULT 'side';

-- Add dimensions/counts to product_templates
ALTER TABLE public.product_templates
ADD COLUMN IF NOT EXISTS default_leaves_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS default_glasses_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS default_panels_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS default_sides_count INTEGER DEFAULT 1;

-- Add dimensions/counts to company_products
ALTER TABLE public.company_products
ADD COLUMN IF NOT EXISTS leaves_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS glasses_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS panels_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS sides_count INTEGER DEFAULT 1;

-- Add dimensions/counts to quote_items
ALTER TABLE public.quote_items
ADD COLUMN IF NOT EXISTS leaves_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS glasses_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS panels_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS sides_count INTEGER DEFAULT 1;

-- Initialize existing records
UPDATE public.product_template_items SET calculation_type = 'formula', applies_to = 'side' WHERE calculation_type IS NULL;
UPDATE public.company_product_items SET calculation_type = 'formula', applies_to = 'side' WHERE calculation_type IS NULL;

-- If side was 'Produto' or 'Todos', set as calculation_type = 'fixed'
UPDATE public.product_template_items SET calculation_type = 'fixed', applies_to = 'product' WHERE side IN ('Produto', 'Todos');
UPDATE public.company_product_items SET calculation_type = 'fixed', applies_to = 'product' WHERE side IN ('Produto', 'Todos');
