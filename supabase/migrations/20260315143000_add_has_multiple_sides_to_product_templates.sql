ALTER TABLE public.product_templates 
ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.product_templates.has_multiple_sides IS 'Indicates if the product has multiple sides (e.g., L-shaped showers)';
