-- Add has_multiple_sides to product_templates
ALTER TABLE public.product_templates 
ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.product_templates.has_multiple_sides IS 'Indicates if the product has multiple sides (e.g., L-shaped showers)';

-- Add side to product_template_items
ALTER TABLE public.product_template_items 
ADD COLUMN IF NOT EXISTS side TEXT;

COMMENT ON COLUMN public.product_template_items.side IS 'Side of the product template (e.g., Lado A, Lado B) for multi-side products';
