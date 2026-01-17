-- Criar tabela de funcionários
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'operador',
  specialty TEXT,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Índice para busca por empresa
CREATE INDEX idx_employees_company_id ON public.employees(company_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver funcionários da sua empresa
CREATE POLICY "Users can view employees of their company"
  ON public.employees FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- Política: Admins e managers podem inserir funcionários
CREATE POLICY "Admins can insert employees"
  ON public.employees FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
  ));

-- Política: Admins e managers podem atualizar funcionários
CREATE POLICY "Admins can update employees"
  ON public.employees FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
  ));

-- Política: Admins e managers podem deletar funcionários
CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
  ));