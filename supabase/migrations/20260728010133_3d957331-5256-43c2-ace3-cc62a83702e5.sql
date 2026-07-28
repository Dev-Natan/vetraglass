CREATE TABLE public.investment_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (percentage >= 0 AND percentage <= 100),
  color TEXT NOT NULL DEFAULT '#3b82f6',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investment_allocations_company ON public.investment_allocations(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_allocations TO authenticated;
GRANT ALL ON public.investment_allocations TO service_role;

ALTER TABLE public.investment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view allocations"
  ON public.investment_allocations FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Members can insert allocations"
  ON public.investment_allocations FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Members can update allocations"
  ON public.investment_allocations FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Members can delete allocations"
  ON public.investment_allocations FOR DELETE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TRIGGER update_investment_allocations_updated_at
  BEFORE UPDATE ON public.investment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.investment_allocations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_cash;