-- =====================================================
-- FIX: Retorno do fundo fixo no fechamento de caixa
-- =====================================================
-- Problema: A função atual só retorna o excedente, mas não
-- retorna o fundo fixo de volta para o caixa da empresa.
-- Solução: Retornar TODO o valor contado (fundo + lucro).
-- =====================================================

-- Recriar função close_daily_cash com lógica corrigida
CREATE OR REPLACE FUNCTION public.close_daily_cash(_cash_register_id uuid, _actual_amount numeric, _notes text DEFAULT NULL::text, _user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_register RECORD;
  v_company_cash RECORD;
  v_opening_amount NUMERIC;
  v_fixed_fund NUMERIC;
  v_expected_amount NUMERIC;
  v_difference NUMERIC;
  v_profit NUMERIC;
  v_fund_to_return NUMERIC;
  v_compensation_result jsonb;
  v_net_profit NUMERIC;
  v_total_to_return NUMERIC;
  v_closing_below_fund BOOLEAN;
  v_company_balance NUMERIC;
  v_shortage_amount NUMERIC;
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
  WHERE company_id = v_register.company_id
  FOR UPDATE;

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
  v_profit := _actual_amount - v_fixed_fund;
  v_closing_below_fund := _actual_amount < v_fixed_fund;

  -- Regra: Se fechamento abaixo do fundo fixo, exigir justificativa
  IF v_closing_below_fund AND (COALESCE(_notes, '') = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fechamento abaixo do fundo fixo requer justificativa obrigatória'
    );
  END IF;

  -- Calcular quanto do fundo pode ser retornado (mínimo entre contado e fundo)
  v_fund_to_return := LEAST(_actual_amount, v_fixed_fund);
  
  -- Se há lucro, compensar adiantamentos pendentes
  IF v_profit > 0 THEN
    v_compensation_result := compensate_advances_on_closing(
      v_register.company_id,
      _cash_register_id,
      v_profit
    );
    v_net_profit := (v_compensation_result->>'net_excess')::NUMERIC;
  ELSE
    v_compensation_result := NULL;
    v_net_profit := v_profit; -- Pode ser negativo (prejuízo)
  END IF;

  -- Registrar falta se o valor contado for menor que o fundo
  IF v_closing_below_fund THEN
    v_shortage_amount := v_fixed_fund - _actual_amount;
    INSERT INTO public.cash_shortages (
      company_id, user_id, cash_register_id,
      amount, reason, status
    ) VALUES (
      v_register.company_id,
      COALESCE(_user_id, auth.uid()),
      _cash_register_id,
      v_shortage_amount,
      COALESCE(_notes, 'Fechamento abaixo do fundo fixo'),
      'pending'
    );
  END IF;

  -- SEMPRE retornar o fundo fixo para a empresa (o que foi contado até o valor do fundo)
  IF v_fund_to_return > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'retorno_fundo_fixo', v_fund_to_return,
      v_company_balance, v_company_balance + v_fund_to_return,
      'Retorno do fundo fixo do caixa do dia',
      _cash_register_id, COALESCE(_user_id, auth.uid())
    );
    
    v_company_balance := v_company_balance + v_fund_to_return;
  END IF;

  -- Se há lucro líquido após compensações, transferir para caixa da empresa
  IF v_net_profit > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'lucro_caixa', v_net_profit,
      v_company_balance, v_company_balance + v_net_profit,
      'Recolhimento - lucro do caixa do dia',
      _cash_register_id, COALESCE(_user_id, auth.uid())
    );
    
    v_company_balance := v_company_balance + v_net_profit;
  END IF;

  -- Atualizar saldo do caixa da empresa
  UPDATE public.company_cash
  SET current_balance = v_company_balance,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = v_register.company_id;

  -- Calcular total retornado
  v_total_to_return := v_fund_to_return + GREATEST(0, v_net_profit);

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
      excess_collected = v_total_to_return,
      closing_justification = CASE WHEN v_closing_below_fund THEN _notes ELSE NULL END
  WHERE id = _cash_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'actual_amount', _actual_amount,
    'difference', v_difference,
    'fixed_fund', v_fixed_fund,
    'fixed_fund_returned', v_fund_to_return,
    'profit', v_profit,
    'compensation', v_compensation_result,
    'net_profit', v_net_profit,
    'total_returned', v_total_to_return,
    'closing_below_fund', v_closing_below_fund,
    'shortage_amount', CASE WHEN v_closing_below_fund THEN v_shortage_amount ELSE 0 END,
    'company_balance_after', v_company_balance
  );
END;
$function$;