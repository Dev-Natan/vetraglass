-- Add pricing_type column to company_products
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'none';

-- Set pricing_type based on existing uses_glass flag
UPDATE public.company_products 
SET pricing_type = 'glass' 
WHERE uses_glass = true;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_company_products_pricing_type ON public.company_products(pricing_type);