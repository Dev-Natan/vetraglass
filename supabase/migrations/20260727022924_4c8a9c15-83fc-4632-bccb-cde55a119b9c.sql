ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS notes text;
NOTIFY pgrst, 'reload schema';