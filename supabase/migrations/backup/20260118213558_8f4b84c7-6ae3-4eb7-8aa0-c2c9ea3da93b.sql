-- =============================================
-- CAIXA PROFISSIONAL: Separação Empresa × Dia
-- =============================================

-- 1. Tabela do Caixa da Empresa (Patrimonial)
CREATE TABLE public.company_cash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  
  current_balance NUMERIC NOT NULL DEFAULT 0,           -- Saldo atual do caixa da empresa
  fixed_fund NUMERIC NOT NULL DEFAULT 500,              -- Fundo fixo para o caixa do dia
  
  last_movement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Movimentações do Caixa da Empresa
CREATE TABLE public.company_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL CHECK (category IN (
    'abertura_caixa',      -- Transferência para caixa do dia
    'fechamento_caixa',    -- Retorno do excedente do caixa do dia
    'deposito',            -- Depósito manual (capital, venda de ativo, etc.)
    'retirada',            -- Retirada de sócio
    'transferencia_banco', -- Transferência para conta bancária
    'ajuste_positivo',     -- Ajuste de inventário positivo
    'ajuste_negativo'      -- Ajuste de inventário negativo
  )),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  balance_before NUMERIC NOT NULL,                      -- Saldo antes da movimentação
  balance_after NUMERIC NOT NULL,                       -- Saldo após a movimentação
  description TEXT NOT NULL,
  
  cash_register_id UUID REFERENCES public.cash_registers(id),  -- Referência ao caixa do dia (se aplicável)
  reference_id UUID,                                            -- ID de referência genérico
  reference_type TEXT,                                          -- Tipo da referência (sale, expense, etc.)
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices para performance
CREATE INDEX idx_company_cash_company_id ON public.company_cash(company_id);
CREATE INDEX idx_company_cash_movements_company_id ON public.company_cash_movements(company_id);
CREATE INDEX idx_company_cash_movements_created_at ON public.company_cash_movements(created_at DESC);
CREATE INDEX idx_company_cash_movements_category ON public.company_cash_movements(category);
CREATE INDEX idx_company_cash_movements_cash_register ON public.company_cash_movements(cash_register_id);

-- 4. Trigger para atualizar updated_at
CREATE TRIGGER update_company_cash_updated_at
  BEFORE UPDATE ON public.company_cash
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Habilitar RLS
ALTER TABLE public.company_cash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_cash_movements ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para company_cash
CREATE POLICY "Users can view their company cash"
  ON public.company_cash
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can insert company cash"
  ON public.company_cash
  FOR INSERT
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can update company cash"
  ON public.company_cash
  FOR UPDATE
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- 7. Políticas RLS para company_cash_movements
CREATE POLICY "Users can view their company cash movements"
  ON public.company_cash_movements
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Elevated users can insert company cash movements"
  ON public.company_cash_movements
  FOR INSERT
  WITH CHECK (user_has_elevated_role_in_company(auth.uid(), company_id));

-- 8. Função para inicializar caixa da empresa
CREATE OR REPLACE FUNCTION public.initialize_company_cash(_company_id UUID, _initial_balance NUMERIC DEFAULT 0, _fixed_fund NUMERIC DEFAULT 500)
RETURNS public.company_cash
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash public.company_cash;
BEGIN
  -- Verificar se usuário é admin da empresa
  IF NOT user_has_role_in_company(auth.uid(), _company_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem inicializar o caixa da empresa';
  END IF;

  -- Inserir ou atualizar
  INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
  VALUES (_company_id, _initial_balance, _fixed_fund)
  ON CONFLICT (company_id) DO UPDATE
    SET current_balance = EXCLUDED.current_balance,
        fixed_fund = EXCLUDED.fixed_fund,
        updated_at = now()
  RETURNING * INTO v_cash;

  -- Registrar movimento inicial se houver saldo
  IF _initial_balance > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount, 
      balance_before, balance_after, description, created_by
    ) VALUES (
      _company_id, 'entrada', 'deposito', _initial_balance,
      0, _initial_balance, 'Saldo inicial do caixa da empresa', auth.uid()
    );
  END IF;

  RETURN v_cash;
END;
$$;

-- 9. Função para registrar movimentação do caixa da empresa
CREATE OR REPLACE FUNCTION public.register_company_cash_movement(
  _company_id UUID,
  _type TEXT,
  _category TEXT,
  _amount NUMERIC,
  _description TEXT,
  _cash_register_id UUID DEFAULT NULL,
  _reference_id UUID DEFAULT NULL,
  _reference_type TEXT DEFAULT NULL
)
RETURNS public.company_cash_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_movement public.company_cash_movements;
BEGIN
  -- Verificar permissão
  IF NOT user_has_elevated_role_in_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Acesso negado: permissão insuficiente';
  END IF;

  -- Buscar saldo atual (com lock para evitar race condition)
  SELECT current_balance INTO v_current_balance
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Caixa da empresa não inicializado';
  END IF;

  -- Calcular novo saldo
  IF _type = 'entrada' THEN
    v_new_balance := v_current_balance + _amount;
  ELSIF _type = 'saida' THEN
    IF v_current_balance < _amount THEN
      RAISE EXCEPTION 'Saldo insuficiente no caixa da empresa. Disponível: R$ %', v_current_balance;
    END IF;
    v_new_balance := v_current_balance - _amount;
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', _type;
  END IF;

  -- Atualizar saldo do caixa
  UPDATE public.company_cash
  SET current_balance = v_new_balance,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = _company_id;

  -- Registrar movimentação
  INSERT INTO public.company_cash_movements (
    company_id, type, category, amount,
    balance_before, balance_after, description,
    cash_register_id, reference_id, reference_type, created_by
  ) VALUES (
    _company_id, _type, _category, _amount,
    v_current_balance, v_new_balance, _description,
    _cash_register_id, _reference_id, _reference_type, auth.uid()
  )
  RETURNING * INTO v_movement;

  RETURN v_movement;
END;
$$;

-- 10. Função para verificar se pode abrir caixa do dia
CREATE OR REPLACE FUNCTION public.can_open_daily_cash(_company_id UUID, _opening_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash RECORD;
  v_open_register RECORD;
BEGIN
  -- Verificar se já existe caixa aberto
  SELECT * INTO v_open_register
  FROM public.cash_registers
  WHERE company_id = _company_id AND status = 'open';

  IF v_open_register IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', 'Já existe um caixa aberto',
      'open_register_id', v_open_register.id
    );
  END IF;

  -- Buscar caixa da empresa
  SELECT * INTO v_cash
  FROM public.company_cash
  WHERE company_id = _company_id;

  IF v_cash IS NULL THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', 'Caixa da empresa não inicializado. Configure o saldo inicial em Configurações.',
      'company_balance', 0,
      'fixed_fund', 500
    );
  END IF;

  IF v_cash.current_balance < _opening_amount THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', format('Saldo insuficiente. Disponível: R$ %s', v_cash.current_balance),
      'company_balance', v_cash.current_balance,
      'fixed_fund', v_cash.fixed_fund,
      'required', _opening_amount
    );
  END IF;

  RETURN jsonb_build_object(
    'can_open', true,
    'company_balance', v_cash.current_balance,
    'fixed_fund', v_cash.fixed_fund,
    'suggested_amount', v_cash.fixed_fund
  );
END;
$$;