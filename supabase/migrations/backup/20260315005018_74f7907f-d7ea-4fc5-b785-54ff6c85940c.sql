
CREATE TABLE public.company_folga_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folga_largura NUMERIC NOT NULL DEFAULT 0,
  folga_altura NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_folga_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company folga settings"
  ON public.company_folga_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage their company folga settings"
  ON public.company_folga_settings
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );
