-- Add width_formula and height_formula columns for glass items
ALTER TABLE public.product_template_items
ADD COLUMN width_formula text DEFAULT NULL,
ADD COLUMN height_formula text DEFAULT NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN public.product_template_items.width_formula IS 'Formula to calculate glass width (e.g., "Largura - 40")';
COMMENT ON COLUMN public.product_template_items.height_formula IS 'Formula to calculate glass height (e.g., "Altura - 20")';