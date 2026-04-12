-- Add has_multiple_sides to product_templates
ALTER TABLE public.product_templates 
ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

-- Add has_multiple_sides to company_products
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

-- Add side to product_template_items
ALTER TABLE public.product_template_items 
ADD COLUMN IF NOT EXISTS side TEXT;

-- Add side to company_product_items
ALTER TABLE public.company_product_items 
ADD COLUMN IF NOT EXISTS side TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.product_templates.has_multiple_sides IS 'Indicates if the product has multiple sides (e.g., L-shaped showers)';
COMMENT ON COLUMN public.company_products.has_multiple_sides IS 'Indicates if the product has multiple sides (e.g., L-shaped showers)';
COMMENT ON COLUMN public.product_template_items.side IS 'Side of the product template (e.g., Lado A, Lado B) for multi-side products';
COMMENT ON COLUMN public.company_product_items.side IS 'Side of the company product item (e.g., Lado A, Lado B) for multi-side products';
