-- Add cost_per_sqm column to company_products for cost tracking
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS cost_per_sqm NUMERIC DEFAULT NULL;