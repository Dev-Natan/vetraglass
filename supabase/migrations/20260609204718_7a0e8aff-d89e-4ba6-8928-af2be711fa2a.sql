CREATE OR REPLACE FUNCTION public.close_cash_register_direct(
  _cash_register_id uuid,
  _counts jsonb,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_register RECORD;
  v_expected_amount NUMERIC;
  v_total_counted NUMERIC;
  v_difference NUMERIC;
  v_operator_name TEXT;
BEGIN
  SELECT * INTO v_register FROM cash_registers
  WHERE id = _cash_register_id AND status = 'open' FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado ou já fechado');
  END IF;

  SELECT COALESCE(e.name, p.full_name, 'Operador') INTO v_operator_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.user_id
  WHERE p.user_id = auth.uid();

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

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'total_counted', v_total_counted,
    'difference', v_difference
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_cash_register_direct(uuid, jsonb, text) TO authenticated;