
CREATE TABLE IF NOT EXISTS public.stock_offcuts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('vidro','perfil')),
  name TEXT NOT NULL,
  color TEXT,
  thickness NUMERIC,
  width_mm NUMERIC,
  height_mm NUMERIC,
  length_mm NUMERIC,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','used','discarded')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','plano_corte','os','ajuste')),
  source_os_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  source_reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_offcuts TO authenticated;
GRANT ALL ON public.stock_offcuts TO service_role;

ALTER TABLE public.stock_offcuts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "offcuts_select_company" ON public.stock_offcuts
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "offcuts_insert_company" ON public.stock_offcuts
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "offcuts_update_company" ON public.stock_offcuts
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "offcuts_delete_company" ON public.stock_offcuts
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_offcuts_company_status ON public.stock_offcuts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_offcuts_item_template ON public.stock_offcuts(item_template_id);
CREATE INDEX IF NOT EXISTS idx_offcuts_kind ON public.stock_offcuts(company_id, kind);

CREATE TRIGGER trg_offcuts_updated_at
  BEFORE UPDATE ON public.stock_offcuts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
