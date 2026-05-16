
ALTER TABLE public.company_items
  ADD COLUMN IF NOT EXISTS bar_length_mm numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_per_meter numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_per_bar numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_per_kg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_per_meter numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price_per_bar numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price_per_kg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price_per_meter numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_margin_percent numeric DEFAULT 0;
