ALTER TABLE public.product_aluminum_prices
  ADD COLUMN IF NOT EXISTS cost_per_meter NUMERIC,
  ADD COLUMN IF NOT EXISTS price_per_meter NUMERIC;