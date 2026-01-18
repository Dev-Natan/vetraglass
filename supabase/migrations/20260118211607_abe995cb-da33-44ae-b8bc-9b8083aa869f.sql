-- =============================================
-- Fase 1: Contas a Receber e Movimentações de Caixa
-- =============================================

-- 1. Tabela de Contas a Receber (parcelas futuras)
CREATE TABLE public.accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  customer_name TEXT NOT NULL,
  description TEXT NOT NULL,
  
  total_amount NUMERIC(12,2) NOT NULL,
  installment_number INTEGER NOT NULL DEFAULT 1,
  total_installments INTEGER NOT NULL DEFAULT 1,
  
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_amount NUMERIC(12,2),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'partial')),
  payment_method TEXT,
  
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Movimentações de Caixa (entradas/saídas avulsas)
CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL,
  
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  payment_method TEXT DEFAULT 'dinheiro',
  
  -- Referências opcionais
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  receivable_id UUID REFERENCES accounts_receivable(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Adicionar campos de parcelamento na tabela sales
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'full' CHECK (payment_type IN ('full', 'partial', 'installment')),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installments_count INTEGER DEFAULT 1;

-- 4. Índices para performance
CREATE INDEX idx_accounts_receivable_company ON accounts_receivable(company_id);
CREATE INDEX idx_accounts_receivable_status ON accounts_receivable(company_id, status);
CREATE INDEX idx_accounts_receivable_due_date ON accounts_receivable(company_id, due_date);
CREATE INDEX idx_accounts_receivable_client ON accounts_receivable(client_id);
CREATE INDEX idx_accounts_receivable_sale ON accounts_receivable(sale_id);

CREATE INDEX idx_cash_movements_company ON cash_movements(company_id);
CREATE INDEX idx_cash_movements_register ON cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_date ON cash_movements(created_at);

-- 5. Enable RLS
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies para accounts_receivable
CREATE POLICY "Users can view their company receivables"
ON public.accounts_receivable FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create receivables for their company"
ON public.accounts_receivable FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update their company receivables"
ON public.accounts_receivable FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete receivables"
ON public.accounts_receivable FOR DELETE
USING (user_has_elevated_role_in_company(auth.uid(), company_id));

-- 7. RLS Policies para cash_movements
CREATE POLICY "Users can view their company movements"
ON public.cash_movements FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create movements for their company"
ON public.cash_movements FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete movements"
ON public.cash_movements FOR DELETE
USING (user_has_elevated_role_in_company(auth.uid(), company_id));

-- 8. Trigger para atualizar updated_at em accounts_receivable
CREATE TRIGGER update_accounts_receivable_updated_at
BEFORE UPDATE ON public.accounts_receivable
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 9. Função para atualizar status de parcelas vencidas
CREATE OR REPLACE FUNCTION public.update_overdue_receivables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE accounts_receivable
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$;