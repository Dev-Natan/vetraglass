ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS pieces_formula text;
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS pieces_formula text;
