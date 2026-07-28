
CREATE TABLE public.company_enabled_linhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  linha_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, linha_slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_enabled_linhas TO authenticated;
GRANT ALL ON public.company_enabled_linhas TO service_role;

ALTER TABLE public.company_enabled_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view enabled linhas"
  ON public.company_enabled_linhas FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "admins/managers can insert enabled linhas"
  ON public.company_enabled_linhas FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager')
  );

CREATE POLICY "admins/managers can delete enabled linhas"
  ON public.company_enabled_linhas FOR DELETE
  TO authenticated
  USING (
    public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager')
  );

CREATE INDEX idx_company_enabled_linhas_company ON public.company_enabled_linhas(company_id);
