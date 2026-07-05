
CREATE TABLE public.item_template_color_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  cost_per_meter NUMERIC,
  price_per_meter NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_template_id, color_name)
);
CREATE INDEX idx_itcp_template ON public.item_template_color_prices(item_template_id);

GRANT SELECT ON public.item_template_color_prices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.item_template_color_prices TO authenticated;
GRANT ALL ON public.item_template_color_prices TO service_role;

ALTER TABLE public.item_template_color_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read template color prices"
  ON public.item_template_color_prices FOR SELECT USING (true);

CREATE POLICY "Only SaaS admins can manage template color prices"
  ON public.item_template_color_prices FOR ALL
  TO authenticated
  USING (public.is_saas_admin(auth.uid()))
  WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TRIGGER trg_itcp_updated_at
  BEFORE UPDATE ON public.item_template_color_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.company_item_color_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  cost_per_meter NUMERIC,
  price_per_meter NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, item_template_id, color_name)
);
CREATE INDEX idx_cicp_company_template ON public.company_item_color_prices(company_id, item_template_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_item_color_prices TO authenticated;
GRANT ALL ON public.company_item_color_prices TO service_role;

ALTER TABLE public.company_item_color_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view own color prices"
  ON public.company_item_color_prices FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can insert own color prices"
  ON public.company_item_color_prices FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can update own color prices"
  ON public.company_item_color_prices FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can delete own color prices"
  ON public.company_item_color_prices FOR DELETE
  TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TRIGGER trg_cicp_updated_at
  BEFORE UPDATE ON public.company_item_color_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
