
ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS section text DEFAULT null;
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS section text DEFAULT null;

COMMENT ON COLUMN public.product_template_items.section IS 'Section categorization: null=auto-detect by type, contramarco=contramarco section';
COMMENT ON COLUMN public.company_product_items.section IS 'Section categorization: null=auto-detect by type, contramarco=contramarco section';
