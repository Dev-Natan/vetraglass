CREATE OR REPLACE FUNCTION public.open_daily_cash(_company_id uuid, _opening_amount numeric, _user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_id UUID;
  new_id UUID;
  v_amount numeric := COALESCE(_opening_amount, 0);
BEGIN
  IF NOT public.user_belongs_to_company(_user_id, _company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT id INTO existing_id FROM public.cash_registers
  WHERE company_id = _company_id AND status = 'open'
  ORDER BY opened_at DESC LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'cash_register_id', existing_id, 'already_open', true);
  END IF;

  INSERT INTO public.cash_registers (company_id, opened_by, opening_amount)
  VALUES (_company_id, _user_id, v_amount)
  RETURNING id INTO new_id;

  INSERT INTO public.company_cash (company_id, current_balance)
  VALUES (_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  -- Transfere o valor de abertura do Saldo Real da Empresa para a gaveta do caixa
  -- (o dinheiro já estava contabilizado pelo fechamento anterior, então SAI da empresa)
  IF v_amount > 0 THEN
    UPDATE public.company_cash
       SET current_balance = current_balance - v_amount,
           updated_at = now()
     WHERE company_id = _company_id;

    INSERT INTO public.company_cash_movements
      (company_id, type, category, amount, description, created_by)
    VALUES (
      _company_id,
      'saida',
      'abertura_caixa',
      v_amount,
      'Abertura de caixa ' || to_char(now(), 'DD/MM/YYYY') || ' — transferência para gaveta',
      _user_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'cash_register_id', new_id);
END $function$;

-- Corrige duplicação atual da empresa URBANO (remove os R$ 4.232,23 duplicados)
UPDATE public.company_cash
SET current_balance = current_balance - 4232.23, updated_at = now()
WHERE company_id = '14a346d9-dc3d-4d14-865d-58bc5d5f62bf'
  AND current_balance = 8464.46;

-- Registra o ajuste como movimento auditável
INSERT INTO public.company_cash_movements (company_id, type, category, amount, description)
SELECT '14a346d9-dc3d-4d14-865d-58bc5d5f62bf', 'saida', 'ajuste_sistema', 4232.23,
       'Correção: remoção de duplicação do valor de abertura'
WHERE EXISTS (SELECT 1 FROM public.company_cash WHERE company_id = '14a346d9-dc3d-4d14-865d-58bc5d5f62bf');