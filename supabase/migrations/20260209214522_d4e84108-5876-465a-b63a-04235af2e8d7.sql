
-- The product_aluminum_prices table, RLS policies, and pricing_type column were already created
-- in the previous partial migration. Now just add aluminum_color to quote_items.

ALTER TABLE public.quote_items 
ADD COLUMN aluminum_color TEXT;
