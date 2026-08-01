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

  INSERT INTO public.company_cash (company_id, current_balance)
  VALUES (v_company, 0)
  ON CONFLICT (company_id) DO NOTHING;

  -- Devolve INTEGRALMENTE o valor conferido na gaveta para o caixa da empresa
  -- (o valor de abertura saiu do saldo da empresa na abertura, portanto retorna aqui)
  IF v_counted <> 0 THEN
    UPDATE public.company_cash
       SET current_balance = current_balance + v_counted,
           updated_at = now()
     WHERE company_id = v_company;

    INSERT INTO public.company_cash_movements
      (company_id, type, category, amount, description, created_by)
    VALUES (
      v_company,
      'entrada',
      'fechamento_caixa',
      v_counted,
      'Fechamento de caixa ' || to_char(now(), 'DD/MM/YYYY') ||
        ' — Abertura ' || COALESCE(v_opening,0)::text ||
        ' / Entradas ' || v_entradas::text || ' / Saídas ' || v_saidas::text,
      auth.uid()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected,
    'closing_amount', v_counted,
    'difference', v_diff,
    'net_transferred', v_counted
  );
END;
$function$;

-- Correção retroativa: devolve os valores de abertura que não retornaram nos fechamentos passados
DO $$
DECLARE
  r RECORD;
  v_missing numeric;
BEGIN
  FOR r IN
    SELECT cr.company_id, COALESCE(SUM(cr.opening_amount), 0) AS total_missing
    FROM public.cash_registers cr
    WHERE cr.status = 'closed'
      AND cr.closed_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.company_cash_movements m
        WHERE m.company_id = cr.company_id
          AND m.category = 'abertura_caixa'
          AND m.type = 'saida'
      )
    GROUP BY cr.company_id
  LOOP
    v_missing := r.total_missing;
    CONTINUE WHEN COALESCE(v_missing, 0) <= 0;

    UPDATE public.company_cash
       SET current_balance = current_balance + v_missing,
           updated_at = now()
     WHERE company_id = r.company_id;

    INSERT INTO public.company_cash_movements
      (company_id, type, category, amount, description)
    VALUES (
      r.company_id,
      'entrada',
      'ajuste_sistema',
      v_missing,
      'Correção: devolução dos valores de abertura não retornados em fechamentos anteriores'
    );
  END LOOP;
END $$;