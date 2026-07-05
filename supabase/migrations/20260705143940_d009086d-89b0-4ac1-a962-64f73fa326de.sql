
CREATE TABLE public.company_suggested_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('glass','aluminum')),
  glass_color TEXT,
  thickness_mm INTEGER,
  aluminum_color TEXT,
  cost_per_sqm NUMERIC(12,2),
  price_per_sqm NUMERIC(12,2),
  cost_per_meter NUMERIC(12,2),
  price_per_meter NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX company_suggested_glass_key ON public.company_suggested_prices (company_id, glass_color, thickness_mm) WHERE kind='glass';
CREATE UNIQUE INDEX company_suggested_aluminum_key ON public.company_suggested_prices (company_id, aluminum_color) WHERE kind='aluminum';
CREATE INDEX company_suggested_company_idx ON public.company_suggested_prices (company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_suggested_prices TO authenticated;
GRANT ALL ON public.company_suggested_prices TO service_role;

ALTER TABLE public.company_suggested_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view company suggested prices"
  ON public.company_suggested_prices FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Members manage company suggested prices"
  ON public.company_suggested_prices FOR ALL
  USING (user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE TRIGGER trg_company_suggested_prices_updated
  BEFORE UPDATE ON public.company_suggested_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
