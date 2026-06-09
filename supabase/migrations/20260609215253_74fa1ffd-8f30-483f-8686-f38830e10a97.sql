CREATE OR REPLACE FUNCTION public.close_cash_register_direct(_cash_register_id uuid, _counts jsonb, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_register RECORD;
  v_company_cash RECORD;
  v_expected_amount NUMERIC;
  v_total_counted NUMERIC;
  v_difference NUMERIC;
  v_balance_before NUMERIC;
BEGIN
  SELECT * INTO v_register FROM cash_registers
  WHERE id = _cash_register_id AND status = 'open' FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado ou já fechado');
  END IF;

  SELECT v_register.opening_amount +
    COALESCE((SELECT SUM(total_amount) FROM sales
              WHERE cash_register_id = _cash_register_id
              AND payment_method = 'dinheiro' AND payment_status != 'cancelled'), 0) +
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = _cash_register_id AND type = 'entrada'), 0) -
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = _cash_register_id AND type = 'saida'), 0)
  INTO v_expected_amount;

  SELECT COALESCE(SUM((item->>'amount')::NUMERIC), 0) INTO v_total_counted
  FROM jsonb_array_elements(_counts) AS item;

  v_difference := v_total_counted - v_expected_amount;

  DELETE FROM cash_counts WHERE cash_register_id = _cash_register_id;
  INSERT INTO cash_counts (cash_register_id, user_id, payment_method, valor_informado)
  SELECT _cash_register_id, auth.uid(), item->>'payment_method', (item->>'amount')::NUMERIC
  FROM jsonb_array_elements(_counts) AS item;

  UPDATE cash_registers
  SET status = 'closed',
      closed_at = now(),
      closed_by = auth.uid(),
      operator_id = COALESCE(operator_id, auth.uid()),
      closing_requested_at = now(),
      closing_amount = v_expected_amount,
      actual_amount = v_total_counted,
      difference = v_difference,
      notes = _notes,
      audit_status = 'approved'
  WHERE id = _cash_register_id;

  -- Devolve o valor contado ao caixa da empresa (soma ao saldo atual)
  IF v_total_counted > 0 THEN
    SELECT * INTO v_company_cash FROM company_cash
    WHERE company_id = v_register.company_id FOR UPDATE;

    IF v_company_cash IS NULL THEN
      INSERT INTO company_cash (company_id, current_balance, fixed_fund)
      VALUES (v_register.company_id, 0, v_register.opening_amount)
      RETURNING * INTO v_company_cash;
    END IF;

    v_balance_before := COALESCE(v_company_cash.current_balance, 0);

    INSERT INTO company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'fechamento_caixa', v_total_counted,
      v_balance_before, v_balance_before + v_total_counted,
      'Retorno do fechamento do caixa do dia', auth.uid()
    );

    UPDATE company_cash
    SET current_balance = v_balance_before + v_total_counted,
        last_movement_at = now(),
        updated_at = now()
    WHERE company_id = v_register.company_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'total_counted', v_total_counted,
    'difference', v_difference
  );
END;
$function$;