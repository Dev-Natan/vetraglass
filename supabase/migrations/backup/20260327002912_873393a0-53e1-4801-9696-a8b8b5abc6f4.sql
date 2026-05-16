
-- Pricing policies per company
CREATE TABLE public.pricing_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  margin_type TEXT NOT NULL DEFAULT 'simple' CHECK (margin_type IN ('simple', 'markup')),
  default_margin NUMERIC NOT NULL DEFAULT 30,
  default_loss_percent NUMERIC NOT NULL DEFAULT 5,
  include_labor BOOLEAN NOT NULL DEFAULT false,
  labor_cost_per_sqm NUMERIC NOT NULL DEFAULT 0,
  include_packaging BOOLEAN NOT NULL DEFAULT false,
  packaging_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  include_installation BOOLEAN NOT NULL DEFAULT false,
  installation_cost_per_sqm NUMERIC NOT NULL DEFAULT 0,
  include_transport BOOLEAN NOT NULL DEFAULT false,
  transport_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  include_commission BOOLEAN NOT NULL DEFAULT false,
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  include_tax BOOLEAN NOT NULL DEFAULT false,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  admin_fee NUMERIC NOT NULL DEFAULT 0,
  rounding_mode TEXT NOT NULL DEFAULT 'round' CHECK (rounding_mode IN ('round', 'ceil', 'floor', 'none')),
  price_decimals INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Add loss_percent to company_product_items for per-item loss
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS loss_percent NUMERIC DEFAULT 0;

-- Add loss_percent to product_template_items for per-item loss  
ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS loss_percent NUMERIC DEFAULT 0;

-- RLS
ALTER TABLE public.pricing_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pricing policies"
  ON public.pricing_policies FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own company pricing policies"
  ON public.pricing_policies FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own company pricing policies"
  ON public.pricing_policies FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));
