-- ============================================
-- APRIMORAMENTOS DO SISTEMA DE CAIXA PROFISSIONAL
-- ============================================

-- 1. Adicionar coluna 'origem' em cash_movements para rastreabilidade
ALTER TABLE public.cash_movements 
ADD COLUMN IF NOT EXISTS origem TEXT;

-- 2. Atualizar CHECK do tipo em company_cash_movements para incluir mais categorias
ALTER TABLE public.company_cash_movements 
DROP CONSTRAINT IF EXISTS company_cash_movements_category_check;

ALTER TABLE public.company_cash_movements 
ADD CONSTRAINT company_cash_movements_category_check 
CHECK (category IN (
  'abertura_caixa',       -- Transferência para caixa do dia
  'fechamento_caixa',     -- Retorno do excedente do caixa do dia
  'deposito',             -- Depósito manual (capital, venda de ativo, etc.)
  'retirada',             -- Retirada de sócio
  'transferencia_banco',  -- Transferência para conta bancária
  'ajuste_positivo',      -- Ajuste de inventário positivo
  'ajuste_negativo',      -- Ajuste de inventário negativo
  'reforco_caixa',        -- Reforço para caixa do dia
  'compensacao_adiantamento'  -- Compensação de adiantamentos
));

-- 3. Criar tabela stock_movements se não existir (integração estoque/caixa)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL CHECK (category IN (
    'compra_material',     -- Compra de material
    'venda',               -- Saída por venda
    'devolucao',           -- Devolução
    'perda',               -- Perda/quebra
    'ajuste_positivo',     -- Ajuste de inventário +
    'ajuste_negativo',     -- Ajuste de inventário -
    'producao'             -- Consumo para produção
  )),
  
  -- Dados financeiros
  valor_financeiro NUMERIC NOT NULL DEFAULT 0,
  
  -- Referências
  cash_movement_id UUID REFERENCES public.cash_movements(id),
  sale_id UUID REFERENCES public.sales(id),
  expense_id UUID REFERENCES public.expenses(id),
  item_template_id UUID REFERENCES public.item_templates(id),
  
  -- Detalhes
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC,
  description TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON public.stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_cash ON public.stock_movements(cash_movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_template_id);

-- 4. RLS para stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view stock movements"
  ON public.stock_movements FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company users can insert stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- 5. Adicionar campos de controle ao cash_registers
ALTER TABLE public.cash_registers 
ADD COLUMN IF NOT EXISTS fixed_fund_at_close NUMERIC,
ADD COLUMN IF NOT EXISTS excess_collected NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_justification TEXT;

-- 6. Função melhorada para abrir caixa com validação
CREATE OR REPLACE FUNCTION public.open_daily_cash(
  _company_id UUID,
  _opening_amount NUMERIC,
  _user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_cash RECORD;
  v_open_register RECORD;
  v_new_register public.cash_registers;
  v_movement public.company_cash_movements;
BEGIN
  -- Verificar se já existe caixa aberto
  SELECT * INTO v_open_register
  FROM public.cash_registers
  WHERE company_id = _company_id AND status = 'open';

  IF v_open_register IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.'
    );
  END IF;

  -- Buscar caixa da empresa
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;

  IF v_company_cash IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa da empresa não configurado. Configure em Configurações.'
    );
  END IF;

  -- Verificar saldo suficiente
  IF v_company_cash.current_balance < _opening_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Saldo insuficiente. Disponível: R$ %s, Solicitado: R$ %s', 
        v_company_cash.current_balance, _opening_amount)
    );
  END IF;

  -- Registrar saída do caixa da empresa
  INSERT INTO public.company_cash_movements (
    company_id, type, category, amount,
    balance_before, balance_after, description, created_by
  ) VALUES (
    _company_id, 'saida', 'abertura_caixa', _opening_amount,
    v_company_cash.current_balance, 
    v_company_cash.current_balance - _opening_amount,
    'Transferência para caixa do dia',
    _user_id
  )
  RETURNING * INTO v_movement;

  -- Atualizar saldo da empresa
  UPDATE public.company_cash
  SET current_balance = current_balance - _opening_amount,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = _company_id;

  -- Criar caixa do dia
  INSERT INTO public.cash_registers (
    company_id, opened_by, opening_amount, status
  ) VALUES (
    _company_id, _user_id, _opening_amount, 'open'
  )
  RETURNING * INTO v_new_register;

  RETURN jsonb_build_object(
    'success', true,
    'cash_register_id', v_new_register.id,
    'opening_amount', _opening_amount,
    'company_balance_after', v_company_cash.current_balance - _opening_amount
  );
END;
$$;

-- 7. Função melhorada para fechar caixa com todas as regras
CREATE OR REPLACE FUNCTION public.close_daily_cash(
  _cash_register_id UUID,
  _actual_amount NUMERIC,
  _notes TEXT DEFAULT NULL,
  _user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_register RECORD;
  v_company_cash RECORD;
  v_opening_amount NUMERIC;
  v_fixed_fund NUMERIC;
  v_expected_amount NUMERIC;
  v_difference NUMERIC;
  v_gross_excess NUMERIC;
  v_compensation_result jsonb;
  v_net_excess NUMERIC;
  v_closing_below_fund BOOLEAN;
BEGIN
  -- Buscar caixa aberto
  SELECT cr.*, cc.fixed_fund, cc.current_balance as company_balance
  INTO v_register
  FROM public.cash_registers cr
  JOIN public.company_cash cc ON cc.company_id = cr.company_id
  WHERE cr.id = _cash_register_id AND cr.status = 'open'
  FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;

  v_opening_amount := v_register.opening_amount;
  v_fixed_fund := COALESCE(v_register.fixed_fund, v_opening_amount);

  -- Calcular saldo esperado (abertura + entradas - saídas)
  SELECT v_opening_amount + 
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id;

  v_difference := _actual_amount - v_expected_amount;
  v_gross_excess := GREATEST(0, _actual_amount - v_fixed_fund);
  v_closing_below_fund := _actual_amount < v_fixed_fund;

  -- Regra: Se fechamento abaixo do fundo fixo, exigir justificativa
  IF v_closing_below_fund AND (COALESCE(_notes, '') = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fechamento abaixo do fundo fixo requer justificativa obrigatória'
    );
  END IF;

  -- Compensar adiantamentos pendentes se houver excedente
  IF v_gross_excess > 0 THEN
    v_compensation_result := compensate_advances_on_closing(
      v_register.company_id,
      _cash_register_id,
      v_gross_excess
    );
    v_net_excess := (v_compensation_result->>'net_excess')::NUMERIC;
  ELSE
    v_compensation_result := NULL;
    v_net_excess := 0;
  END IF;

  -- Se há excedente líquido, transferir para caixa da empresa
  IF v_net_excess > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'fechamento_caixa', v_net_excess,
      v_register.company_balance, v_register.company_balance + v_net_excess,
      'Recolhimento do caixa do dia',
      _cash_register_id, COALESCE(_user_id, auth.uid())
    );

    UPDATE public.company_cash
    SET current_balance = current_balance + v_net_excess,
        last_movement_at = now(),
        updated_at = now()
    WHERE company_id = v_register.company_id;
  END IF;

  -- Atualizar e fechar o caixa
  UPDATE public.cash_registers
  SET status = 'closed',
      closed_at = now(),
      closed_by = COALESCE(_user_id, auth.uid()),
      closing_amount = v_expected_amount,
      actual_amount = _actual_amount,
      difference = v_difference,
      notes = _notes,
      fixed_fund_at_close = v_fixed_fund,
      excess_collected = v_net_excess,
      closing_justification = CASE WHEN v_closing_below_fund THEN _notes ELSE NULL END
  WHERE id = _cash_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'actual_amount', _actual_amount,
    'difference', v_difference,
    'fixed_fund', v_fixed_fund,
    'gross_excess', v_gross_excess,
    'compensation', v_compensation_result,
    'net_excess', v_net_excess,
    'closing_below_fund', v_closing_below_fund
  );
END;
$$;

-- 8. Função para registrar compra de material à vista (integra caixa + estoque)
CREATE OR REPLACE FUNCTION public.register_material_purchase(
  _cash_register_id UUID,
  _amount NUMERIC,
  _description TEXT,
  _item_template_id UUID DEFAULT NULL,
  _quantity NUMERIC DEFAULT 0,
  _user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_result jsonb;
  v_cash_movement_id UUID;
  v_stock_movement_id UUID;
  v_register RECORD;
BEGIN
  -- Buscar dados do caixa
  SELECT cr.*, c.id as company_id
  INTO v_register
  FROM public.cash_registers cr
  JOIN public.companies c ON c.id = cr.company_id
  WHERE cr.id = _cash_register_id AND cr.status = 'open';

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou fechado'
    );
  END IF;

  -- Registrar saída com reforço automático se necessário
  v_cash_result := register_cash_exit_with_reinforcement(
    _cash_register_id,
    _amount,
    'compra_material',
    _description,
    'dinheiro'
  );

  IF NOT (v_cash_result->>'success')::boolean THEN
    RETURN v_cash_result;
  END IF;

  v_cash_movement_id := (v_cash_result->>'movement_id')::UUID;

  -- Atualizar origem da movimentação
  UPDATE public.cash_movements
  SET origem = 'compra_material'
  WHERE id = v_cash_movement_id;

  -- Criar movimento de estoque (entrada)
  INSERT INTO public.stock_movements (
    company_id, type, category, valor_financeiro,
    cash_movement_id, item_template_id, quantity,
    unit_cost, description, created_by
  ) VALUES (
    v_register.company_id, 'entrada', 'compra_material', _amount,
    v_cash_movement_id, _item_template_id, _quantity,
    CASE WHEN _quantity > 0 THEN _amount / _quantity ELSE _amount END,
    _description, COALESCE(_user_id, auth.uid())
  )
  RETURNING id INTO v_stock_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'cash_movement_id', v_cash_movement_id,
    'stock_movement_id', v_stock_movement_id,
    'cash_result', v_cash_result,
    'message', 'Compra registrada no caixa e no estoque'
  );
END;
$$;

-- 9. Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_cash_movements_origem ON public.cash_movements(origem);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON public.cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_company_cash_movements_category ON public.company_cash_movements(category);