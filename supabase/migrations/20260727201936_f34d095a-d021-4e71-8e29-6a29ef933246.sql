CREATE OR REPLACE FUNCTION public.close_cash_register_direct(_cash_register_id uuid, _counts jsonb, _notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_company uuid;
  v_opening numeric;
  v_entradas numeric := 0;
  v_saidas numeric := 0;
  v_expected numeric;
  v_counted numeric := 0;
  v_diff numeric;
  v_net numeric;
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
    notes = COALESCE(_notes, notes)
  WHERE id = _cash_register_id;

  -- Transfere o resultado líquido do dia para o caixa da empresa
  v_net := v_entradas - v_saidas;
  IF v_net <> 0 THEN
    INSERT INTO public.company_cash (company_id, current_balance)
    VALUES (v_company, 0)
    ON CONFLICT (company_id) DO NOTHING;

    UPDATE public.company_cash
       SET current_balance = current_balance + v_net,
           updated_at = now()
     WHERE company_id = v_company;

    INSERT INTO public.company_cash_movements
      (company_id, type, category, amount, description, created_by)
    VALUES (
      v_company,
      CASE WHEN v_net >= 0 THEN 'entrada' ELSE 'saida' END,
      'fechamento_caixa',
      ABS(v_net),
      'Fechamento de caixa ' || to_char(now(), 'DD/MM/YYYY') ||
        ' — Entradas ' || v_entradas::text || ' / Saídas ' || v_saidas::text,
      auth.uid()
    );
  END IF;

  -- Registra eventual quebra/sobra como ajuste
  IF v_diff <> 0 THEN
    INSERT INTO public.company_cash_movements
      (company_id, type, category, amount, description, created_by)
    VALUES (
      v_company,
      CASE WHEN v_diff > 0 THEN 'entrada' ELSE 'saida' END,
      CASE WHEN v_diff > 0 THEN 'sobra_caixa' ELSE 'quebra_caixa' END,
      ABS(v_diff),
      'Ajuste de fechamento de caixa ' || to_char(now(), 'DD/MM/YYYY'),
      auth.uid()
    );

    UPDATE public.company_cash
       SET current_balance = current_balance + v_diff,
           updated_at = now()
     WHERE company_id = v_company;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected,
    'closing_amount', v_counted,
    'difference', v_diff,
    'net_transferred', v_net
  );
END $function$;