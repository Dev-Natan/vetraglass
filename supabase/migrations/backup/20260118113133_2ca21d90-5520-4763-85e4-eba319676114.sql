-- Add product_template_id to glass_line_formulas to link formulas to specific products
ALTER TABLE public.glass_line_formulas
ADD COLUMN product_template_id UUID REFERENCES public.product_templates(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_glass_line_formulas_product ON public.glass_line_formulas(product_template_id);

-- Add comment
COMMENT ON COLUMN public.glass_line_formulas.product_template_id IS 'Optional reference to a specific product template. If null, formula applies to all products in the linha.';