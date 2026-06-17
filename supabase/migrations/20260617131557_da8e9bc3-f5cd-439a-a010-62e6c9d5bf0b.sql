CREATE TABLE public.sale_item_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  source TEXT NOT NULL DEFAULT 'formula' CHECK (source IN ('formula','manual_add','manual_swap')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sic_sale_item ON public.sale_item_components(sale_item_id);
CREATE INDEX idx_sic_company ON public.sale_item_components(company_id);
CREATE INDEX idx_sic_company_item ON public.sale_item_components(company_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_item_components TO authenticated;
GRANT ALL ON public.sale_item_components TO service_role;

ALTER TABLE public.sale_item_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view sale components"
ON public.sale_item_components FOR SELECT TO authenticated
USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Members can insert sale components"
ON public.sale_item_components FOR INSERT TO authenticated
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Members can update sale components"
ON public.sale_item_components FOR UPDATE TO authenticated
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Members can delete sale components"
ON public.sale_item_components FOR DELETE TO authenticated
USING (public.user_belongs_to_company(auth.uid(), company_id));