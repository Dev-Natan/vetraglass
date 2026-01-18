-- Fix close_daily_cash function to handle missing company_cash records
CREATE OR REPLACE FUNCTION close_daily_cash(
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
  v_company_balance NUMERIC;
BEGIN
  -- Buscar caixa aberto (sem JOIN obrigatório com company_cash)
  SELECT *
  INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id AND status = 'open'
  FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;

  -- Buscar company_cash separadamente (pode não existir)
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = v_register.company_id;

  -- Se não existir company_cash, criar um registro
  IF v_company_cash IS NULL THEN
    INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
    VALUES (v_register.company_id, 0, v_register.opening_amount)
    RETURNING * INTO v_company_cash;
  END IF;

  v_company_balance := COALESCE(v_company_cash.current_balance, 0);
  v_opening_amount := v_register.opening_amount;
  v_fixed_fund := COALESCE(v_company_cash.fixed_fund, v_opening_amount);

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
      v_company_balance, v_company_balance + v_net_excess,
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