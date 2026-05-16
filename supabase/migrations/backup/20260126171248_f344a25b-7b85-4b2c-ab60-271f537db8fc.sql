-- Add glass_color column to product_glass_prices
ALTER TABLE public.product_glass_prices 
ADD COLUMN glass_color text DEFAULT 'Incolor';

-- Drop the old unique constraint
ALTER TABLE public.product_glass_prices 
DROP CONSTRAINT IF EXISTS unique_product_glass_price;

-- Create new unique constraint including glass_color
ALTER TABLE public.product_glass_prices 
ADD CONSTRAINT unique_product_glass_price_with_color 
UNIQUE (company_product_id, glass_type, thickness_mm, glass_color);

-- Add comment for documentation
COMMENT ON COLUMN public.product_glass_prices.glass_color IS 'Cor do vidro: Incolor, Verde, Fumê, Bronze, Jateado, etc.';