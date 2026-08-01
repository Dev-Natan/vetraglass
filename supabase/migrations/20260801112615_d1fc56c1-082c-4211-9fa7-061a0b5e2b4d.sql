DO $$
DECLARE
  v_company uuid;
  v_excess numeric := 8464.46;
BEGIN
  SELECT company_id INTO v_company FROM public.company_cash LIMIT 1;
  IF v_company IS NULL THEN RETURN; END IF;

  UPDATE public.company_cash
     SET current_balance = current_balance - v_excess,
         updated_at = now()
   WHERE company_id = v_company;

  INSERT INTO public.company_cash_movements
    (company_id, type, category, amount, description)
  VALUES (
    v_company, 'saida', 'ajuste_sistema', v_excess,
    'Correção: estorno de devolução em excesso referente a aberturas de caixa duplicadas (28/07)'
  );
END $$;