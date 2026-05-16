-- Criar tabela de ordens de serviço
CREATE TABLE public.ordens_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  os_number SERIAL,
  
  -- Informações do cliente (copiadas do orçamento)
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  
  -- Status e controle
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Responsável e prazos
  assigned_to UUID,
  estimated_start DATE,
  estimated_end DATE,
  actual_start DATE,
  actual_end DATE,
  
  -- Valores
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  pending_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Observações e etapas
  notes TEXT,
  current_stage TEXT DEFAULT 'Aguardando início',
  stages JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas na tabela sales para vendas parciais
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'full' CHECK (sale_type IN ('full', 'partial', 'completion')),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem_servico_id UUID,
  ADD COLUMN IF NOT EXISTS parent_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

-- Adicionar FK para ordem_servico_id após criar a tabela
ALTER TABLE public.sales 
  ADD CONSTRAINT sales_ordem_servico_id_fkey 
  FOREIGN KEY (ordem_servico_id) REFERENCES public.ordens_servico(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ordens_servico
CREATE POLICY "Users can view company service orders"
  ON public.ordens_servico
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company service orders"
  ON public.ordens_servico
  FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company service orders"
  ON public.ordens_servico
  FOR UPDATE
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company service orders"
  ON public.ordens_servico
  FOR DELETE
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_ordens_servico_company ON public.ordens_servico(company_id);
CREATE INDEX idx_ordens_servico_quote ON public.ordens_servico(quote_id);
CREATE INDEX idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX idx_sales_quote_id ON public.sales(quote_id);
CREATE INDEX idx_sales_ordem_servico_id ON public.sales(ordem_servico_id);