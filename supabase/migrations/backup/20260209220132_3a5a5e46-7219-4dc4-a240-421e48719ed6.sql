-- Create product_aluminum_prices table for aluminum-color-based pricing
CREATE TABLE IF NOT EXISTS public.product_aluminum_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_product_id uuid NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  color_name text NOT NULL,
  price_per_sqm numeric NOT NULL DEFAULT 0,
  cost_per_sqm numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_product_id, color_name)
);

-- Enable RLS
ALTER TABLE public.product_aluminum_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage prices for products in their company
CREATE POLICY "Users can view aluminum prices for their company products"
ON public.product_aluminum_prices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_aluminum_prices.company_product_id
      AND uc.user_id = auth.uid()
      AND uc.is_active = true
  )
);

CREATE POLICY "Users can insert aluminum prices for their company products"
ON public.product_aluminum_prices FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_aluminum_prices.company_product_id
      AND uc.user_id = auth.uid()
      AND uc.is_active = true
  )
);

CREATE POLICY "Users can update aluminum prices for their company products"
ON public.product_aluminum_prices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_aluminum_prices.company_product_id
      AND uc.user_id = auth.uid()
      AND uc.is_active = true
  )
);

CREATE POLICY "Users can delete aluminum prices for their company products"
ON public.product_aluminum_prices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_aluminum_prices.company_product_id
      AND uc.user_id = auth.uid()
      AND uc.is_active = true
  )
);

-- Add aluminum_color to quote_items if not exists
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS aluminum_color text;