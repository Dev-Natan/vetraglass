-- Migration to fix missing columns
ALTER TABLE public.product_templates ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;
ALTER TABLE public.company_products ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;
ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS side TEXT;
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS side TEXT;
