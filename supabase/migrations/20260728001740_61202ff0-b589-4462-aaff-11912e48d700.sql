
-- Ensure default balance is zero for new companies
ALTER TABLE public.company_cash ALTER COLUMN current_balance SET DEFAULT 0;

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

  -- Se já existe caixa aberto, retorna
  SELECT id INTO existing_id FROM public.cash_registers
  WHERE company_id = _company_id AND status = 'open'
  ORDER BY opened_at DESC LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'cash_register_id', existing_id, 'already_open', true);
  END IF;

  -- Cria novo caixa
  INSERT INTO public.cash_registers (company_id, opened_by, opening_amount)
  VALUES (_company_id, _user_id, v_amount)
  RETURNING id INTO new_id;

  -- Garante linha de saldo para a empresa (default 0)
  INSERT INTO public.company_cash (company_id, current_balance)
  VALUES (_company_id, 0)
  ON CONFLICT (company_id) DO NOTHING;

  -- Injeta o valor de abertura no Saldo Real da Empresa como entrada auditável
  IF v_amount > 0 THEN
    UPDATE public.company_cash
       SET current_balance = current_balance + v_amount,
           updated_at = now()
     WHERE company_id = _company_id;

    INSERT INTO public.company_cash_movements
      (company_id, type, category, amount, description, created_by)
    VALUES (
      _company_id,
      'entrada',
      'abertura_caixa',
      v_amount,
      'Abertura de caixa ' || to_char(now(), 'DD/MM/YYYY') || ' — valor de abertura',
      _user_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'cash_register_id', new_id);
END $function$;
