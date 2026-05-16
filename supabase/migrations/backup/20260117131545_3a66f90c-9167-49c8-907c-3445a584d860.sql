-- Add price_per_sqm column to company_products for simplified pricing
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS price_per_sqm NUMERIC DEFAULT NULL;