CREATE TABLE public.company_product_price_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  company_product_id UUID NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  glass_type TEXT,
  thickness_mm NUMERIC,
  color TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  price NUMERIC NOT NULL DEFAULT 0,
  cost NUMERIC,
  unit TEXT NOT NULL DEFAULT 'm2',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cppl_product ON public.company_product_price_lines(company_product_id);
CREATE INDEX idx_cppl_company ON public.company_product_price_lines(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_product_price_lines TO authenticated;
GRANT ALL ON public.company_product_price_lines TO service_role;

ALTER TABLE public.company_product_price_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage price lines"
ON public.company_product_price_lines
FOR ALL
TO authenticated
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TRIGGER update_cppl_updated_at
BEFORE UPDATE ON public.company_product_price_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();