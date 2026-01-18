-- Tabela para rastrear adiantamentos/reforços de caixa
CREATE TABLE public.cash_register_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  compensated_amount NUMERIC DEFAULT 0 CHECK (compensated_amount >= 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'compensated')),
  company_movement_id UUID REFERENCES public.company_cash_movements(id),
  daily_movement_id UUID REFERENCES public.cash_movements(id),
  compensated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_cash_register_advances_company ON public.cash_register_advances(company_id);
CREATE INDEX idx_cash_register_advances_status ON public.cash_register_advances(company_id, status) WHERE status != 'compensated';
CREATE INDEX idx_cash_register_advances_register ON public.cash_register_advances(cash_register_id);

-- RLS
ALTER TABLE public.cash_register_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view advances from their company"
  ON public.cash_register_advances FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Elevated users can manage advances"
  ON public.cash_register_advances FOR ALL
  USING (user_has_elevated_role_in_company(auth.uid(), company_id));

-- Função para solicitar reforço de caixa automaticamente
CREATE OR REPLACE FUNCTION public.request_cash_reinforcement(
  _company_id UUID,
  _cash_register_id UUID,
  _required_amount NUMERIC,
  _current_daily_balance NUMERIC,
  _reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reinforcement_needed NUMERIC;
  v_company_balance NUMERIC;
  v_company_movement public.company_cash_movements;
  v_daily_movement_id UUID;
  v_advance_id UUID;
BEGIN
  -- Calcular reforço necessário
  v_reinforcement_needed := _required_amount - _current_daily_balance;
  
  IF v_reinforcement_needed <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'reinforcement_needed', false,
      'message', 'Saldo suficiente no caixa do dia'
    );
  END IF;
  
  -- Verificar saldo do caixa da empresa
  SELECT current_balance INTO v_company_balance
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;
  
  IF v_company_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa da empresa não inicializado'
    );
  END IF;
  
  IF v_company_balance < v_reinforcement_needed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Saldo insuficiente no caixa da empresa. Disponível: R$ %s, Necessário: R$ %s', 
        v_company_balance, v_reinforcement_needed),
      'company_balance', v_company_balance,
      'reinforcement_needed', v_reinforcement_needed
    );
  END IF;
  
  -- Registrar saída do caixa da empresa
  INSERT INTO public.company_cash_movements (
    company_id, type, category, amount,
    balance_before, balance_after, description,
    cash_register_id, created_by
  ) VALUES (
    _company_id, 'saida', 'reforco_caixa', v_reinforcement_needed,
    v_company_balance, v_company_balance - v_reinforcement_needed,
    format('Reforço de caixa: %s', _reason),
    _cash_register_id, auth.uid()
  )
  RETURNING * INTO v_company_movement;
  
  -- Atualizar saldo do caixa da empresa
  UPDATE public.company_cash
  SET current_balance = current_balance - v_reinforcement_needed,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = _company_id;
  
  -- Registrar entrada no caixa do dia
  INSERT INTO public.cash_movements (
    company_id, cash_register_id, type, category,
    amount, description, payment_method, created_by
  ) VALUES (
    _company_id, _cash_register_id, 'entrada', 'reforco',
    v_reinforcement_needed, format('Reforço de caixa: %s', _reason),
    'transferencia', auth.uid()
  )
  RETURNING id INTO v_daily_movement_id;
  
  -- Criar registro de adiantamento
  INSERT INTO public.cash_register_advances (
    company_id, cash_register_id, amount, reason,
    company_movement_id, daily_movement_id, created_by
  ) VALUES (
    _company_id, _cash_register_id, v_reinforcement_needed, _reason,
    v_company_movement.id, v_daily_movement_id, auth.uid()
  )
  RETURNING id INTO v_advance_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'reinforcement_needed', true,
    'reinforcement_amount', v_reinforcement_needed,
    'advance_id', v_advance_id,
    'company_balance_before', v_company_balance,
    'company_balance_after', v_company_balance - v_reinforcement_needed,
    'message', format('Reforço de R$ %s transferido do caixa da empresa', v_reinforcement_needed)
  );
END;
$$;

-- Função para registrar saída com reforço automático se necessário
CREATE OR REPLACE FUNCTION public.register_cash_exit_with_reinforcement(
  _cash_register_id UUID,
  _amount NUMERIC,
  _category TEXT,
  _description TEXT,
  _payment_method TEXT DEFAULT 'dinheiro'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_register RECORD;
  v_current_balance NUMERIC;
  v_reinforcement_result jsonb;
  v_movement_id UUID;
BEGIN
  -- Buscar dados do caixa
  SELECT cr.*, c.id as comp_id
  INTO v_register
  FROM public.cash_registers cr
  JOIN public.companies c ON c.id = cr.company_id
  WHERE cr.id = _cash_register_id AND cr.status = 'open'
  FOR UPDATE;
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou não está aberto'
    );
  END IF;
  
  -- Verificar permissão
  IF NOT user_belongs_to_company(auth.uid(), v_register.company_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Acesso negado'
    );
  END IF;
  
  -- Calcular saldo atual do caixa do dia
  SELECT COALESCE(v_register.opening_amount, 0) + 
         COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE -amount END), 0)
  INTO v_current_balance
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id;
  
  -- Se saldo insuficiente, solicitar reforço
  IF v_current_balance < _amount THEN
    v_reinforcement_result := request_cash_reinforcement(
      v_register.company_id,
      _cash_register_id,
      _amount,
      v_current_balance,
      _description
    );
    
    IF NOT (v_reinforcement_result->>'success')::boolean THEN
      RETURN v_reinforcement_result;
    END IF;
  END IF;
  
  -- Registrar a saída
  INSERT INTO public.cash_movements (
    company_id, cash_register_id, type, category,
    amount, description, payment_method, created_by
  ) VALUES (
    v_register.company_id, _cash_register_id, 'saida', _category,
    _amount, _description, _payment_method, auth.uid()
  )
  RETURNING id INTO v_movement_id;
  
  -- Retornar resultado
  IF v_reinforcement_result IS NOT NULL AND (v_reinforcement_result->>'reinforcement_needed')::boolean THEN
    RETURN jsonb_build_object(
      'success', true,
      'movement_id', v_movement_id,
      'reinforcement', v_reinforcement_result,
      'message', format('Saída registrada com reforço automático de R$ %s', 
        v_reinforcement_result->>'reinforcement_amount')
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'movement_id', v_movement_id,
      'reinforcement', null,
      'message', 'Saída registrada com sucesso'
    );
  END IF;
END;
$$;

-- Função para compensar adiantamentos no fechamento
CREATE OR REPLACE FUNCTION public.compensate_advances_on_closing(
  _company_id UUID,
  _cash_register_id UUID,
  _excess_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance RECORD;
  v_remaining_excess NUMERIC := _excess_amount;
  v_total_compensated NUMERIC := 0;
  v_compensation_amount NUMERIC;
  v_compensations jsonb := '[]'::jsonb;
BEGIN
  -- Buscar adiantamentos pendentes (mais antigos primeiro)
  FOR v_advance IN
    SELECT *
    FROM public.cash_register_advances
    WHERE company_id = _company_id
      AND status IN ('pending', 'partial')
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_excess <= 0;
    
    -- Calcular quanto pode compensar neste adiantamento
    v_compensation_amount := LEAST(
      v_remaining_excess,
      v_advance.amount - v_advance.compensated_amount
    );
    
    -- Atualizar adiantamento
    UPDATE public.cash_register_advances
    SET compensated_amount = compensated_amount + v_compensation_amount,
        status = CASE 
          WHEN compensated_amount + v_compensation_amount >= amount THEN 'compensated'
          ELSE 'partial'
        END,
        compensated_at = CASE 
          WHEN compensated_amount + v_compensation_amount >= amount THEN now()
          ELSE NULL
        END
    WHERE id = v_advance.id;
    
    -- Atualizar contadores
    v_remaining_excess := v_remaining_excess - v_compensation_amount;
    v_total_compensated := v_total_compensated + v_compensation_amount;
    
    -- Adicionar à lista de compensações
    v_compensations := v_compensations || jsonb_build_object(
      'advance_id', v_advance.id,
      'original_amount', v_advance.amount,
      'compensated_now', v_compensation_amount,
      'reason', v_advance.reason
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'total_compensated', v_total_compensated,
    'net_excess', v_remaining_excess,
    'compensations', v_compensations
  );
END;
$$;

-- Função para obter resumo de adiantamentos pendentes
CREATE OR REPLACE FUNCTION public.get_pending_advances_summary(_company_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_pending NUMERIC;
  v_count INTEGER;
  v_advances jsonb;
BEGIN
  -- Verificar permissão
  IF NOT user_belongs_to_company(auth.uid(), _company_id) THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;
  
  -- Calcular totais
  SELECT 
    COALESCE(SUM(amount - compensated_amount), 0),
    COUNT(*)
  INTO v_total_pending, v_count
  FROM public.cash_register_advances
  WHERE company_id = _company_id
    AND status IN ('pending', 'partial');
  
  -- Buscar detalhes dos adiantamentos
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'amount', amount,
      'compensated_amount', compensated_amount,
      'pending_amount', amount - compensated_amount,
      'reason', reason,
      'status', status,
      'created_at', created_at
    ) ORDER BY created_at ASC
  ), '[]'::jsonb)
  INTO v_advances
  FROM public.cash_register_advances
  WHERE company_id = _company_id
    AND status IN ('pending', 'partial');
  
  RETURN jsonb_build_object(
    'total_pending', v_total_pending,
    'count', v_count,
    'advances', v_advances
  );
END;
$$;