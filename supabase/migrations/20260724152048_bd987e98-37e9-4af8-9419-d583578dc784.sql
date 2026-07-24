ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS min_width numeric,
  ADD COLUMN IF NOT EXISTS max_width numeric,
  ADD COLUMN IF NOT EXISTS min_height numeric,
  ADD COLUMN IF NOT EXISTS max_height numeric,
  ADD COLUMN IF NOT EXISTS base_price numeric;