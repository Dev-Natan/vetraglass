ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS pieces_formula text;
NOTIFY pgrst, 'reload schema';