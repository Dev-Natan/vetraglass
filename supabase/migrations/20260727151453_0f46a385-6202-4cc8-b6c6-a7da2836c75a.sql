CREATE OR REPLACE FUNCTION public.close_cash_register_direct(
  _cash_register_id uuid,
  _counts jsonb,
  _notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_opening numeric;
  v_entradas numeric := 0;
  v_saidas numeric := 0;
  v_expected numeric;
  v_counted numeric := 0;
  v_diff numeric;
BEGIN
  SELECT company_id, opening_amount INTO v_company, v_opening
  FROM public.cash_registers WHERE id = _cash_register_id AND status = 'open';
  IF v_company IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'cash_register_not_open');
  END IF;
  IF NOT public.user_belongs_to_company(auth.uid(), v_company) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT COALESCE(SUM(amount),0) INTO v_entradas
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id AND type = 'entrada';

  SELECT COALESCE(SUM(amount),0) INTO v_saidas
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id AND type = 'saida';

  v_expected := COALESCE(v_opening,0) + v_entradas - v_saidas;

  SELECT COALESCE(SUM((elem->>'amount')::numeric), 0) INTO v_counted
  FROM jsonb_array_elements(COALESCE(_counts, '[]'::jsonb)) elem;

  v_diff := v_counted - v_expected;

  UPDATE public.cash_registers SET
    status = 'closed',
    closed_at = now(),
    closed_by = auth.uid(),
    closing_amount = v_counted,
    expected_amount = v_expected,
    difference_amount = v_diff,
    difference = v_diff,
    notes = COALESCE(_notes, notes)
  WHERE id = _cash_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected,
    'closing_amount', v_counted,
    'difference', v_diff
  );
END $$;