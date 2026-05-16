-- =====================================================
-- FLUXO DE ORÇAMENTO COM ENTRADA, CAIXA E VENDA FINAL
-- =====================================================

-- 1. Criar tabela quote_deposits para rastrear entradas de orçamentos
CREATE TABLE public.quote_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'billed')),
  received_at TIMESTAMPTZ,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  cash_movement_id UUID REFERENCES public.cash_movements(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Adicionar coluna receivable_type em accounts_receivable
ALTER TABLE public.accounts_receivable 
  ADD COLUMN IF NOT EXISTS receivable_type TEXT DEFAULT 'installment';

-- 3. Adicionar colunas de controle de entrada em quotes
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'none';

-- 4. Habilitar RLS na tabela quote_deposits
ALTER TABLE public.quote_deposits ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS para quote_deposits usando user_belongs_to_company
CREATE POLICY "Users can view quote deposits in their company" 
  ON public.quote_deposits 
  FOR SELECT 
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can insert quote deposits in their company" 
  ON public.quote_deposits 
  FOR INSERT 
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update quote deposits in their company" 
  ON public.quote_deposits 
  FOR UPDATE 
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can delete quote deposits in their company" 
  ON public.quote_deposits 
  FOR DELETE 
  USING (user_belongs_to_company(auth.uid(), company_id));

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_quote_deposits_company_status 
  ON public.quote_deposits(company_id, status);

CREATE INDEX IF NOT EXISTS idx_quote_deposits_quote_id 
  ON public.quote_deposits(quote_id);

CREATE INDEX IF NOT EXISTS idx_quote_deposits_ordem_servico_id 
  ON public.quote_deposits(ordem_servico_id);

-- 7. Trigger para atualizar updated_at
CREATE TRIGGER update_quote_deposits_updated_at
  BEFORE UPDATE ON public.quote_deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();