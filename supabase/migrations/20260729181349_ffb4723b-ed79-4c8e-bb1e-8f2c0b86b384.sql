
ALTER TABLE public.cash_movements
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_cliente_id ON public.cash_movements(cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_movements_fornecedor_id ON public.cash_movements(fornecedor_id) WHERE fornecedor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cash_movements_funcionario_id ON public.cash_movements(funcionario_id) WHERE funcionario_id IS NOT NULL;
