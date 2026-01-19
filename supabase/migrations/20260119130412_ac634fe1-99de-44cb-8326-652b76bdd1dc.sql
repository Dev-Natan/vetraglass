
-- Criar tabela company_linhas para armazenar linhas criadas pelas empresas
-- Isso permite linhas sem produtos ativos

CREATE TABLE IF NOT EXISTS public.company_linhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- RLS policies
ALTER TABLE public.company_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company linhas" 
ON public.company_linhas FOR SELECT 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can insert company linhas" 
ON public.company_linhas FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can update company linhas" 
ON public.company_linhas FOR UPDATE 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can delete company linhas" 
ON public.company_linhas FOR DELETE 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_company_linhas_company_id ON public.company_linhas(company_id);
CREATE INDEX IF NOT EXISTS idx_company_linhas_name ON public.company_linhas(name);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_company_linhas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_company_linhas_updated_at ON public.company_linhas;
CREATE TRIGGER update_company_linhas_updated_at
BEFORE UPDATE ON public.company_linhas
FOR EACH ROW
EXECUTE FUNCTION public.update_company_linhas_updated_at();
