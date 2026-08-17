CREATE OR REPLACE FUNCTION public.pay_employee_commissions_transactional(
  _commission_ids uuid[],
  _cash_register_id uuid,
  _operation_key uuid,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid:=auth.uid();
  v_company_id uuid;
  v_amount numeric;
  v_count integer;
  v_movement_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Authentication required'; END IF;
  IF _operation_key IS NULL OR COALESCE(array_length(_commission_ids,1),0)=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Commission ids and operation key are required';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.employee_commissions
  WHERE id=ANY(_commission_ids)
  LIMIT 1;
  IF v_company_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Commission not found'; END IF;
  IF NOT public.user_has_elevated_role_in_company(v_user_id,v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Forbidden company scope';
  END IF;

  INSERT INTO public.financial_operation_keys(company_id,operation_key,operation_type,reference_id,created_by)
  VALUES(v_company_id,_operation_key,'commission_payment',_commission_ids[1],v_user_id)
  ON CONFLICT(company_id,operation_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT result INTO v_result FROM public.financial_operation_keys
    WHERE company_id=v_company_id AND operation_key=_operation_key;
    RETURN COALESCE(v_result,'{}'::jsonb)||jsonb_build_object('success',true,'idempotent',true);
  END IF;

  PERFORM 1 FROM public.employee_commissions WHERE id=ANY(_commission_ids) FOR UPDATE;
  SELECT sum(commission_amount),count(*) INTO v_amount,v_count
  FROM public.employee_commissions
  WHERE id=ANY(_commission_ids) AND company_id=v_company_id AND status='pending';
  IF v_count<>array_length(_commission_ids,1) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Commission is invalid or already paid';
  END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.cash_registers
    WHERE id=_cash_register_id AND company_id=v_company_id AND status='open'
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='An open company cash register is required';
  END IF;

  INSERT INTO public.cash_movements(
    company_id,cash_register_id,type,category,amount,description,payment_method,
    created_by,origem,operation_key
  ) VALUES(
    v_company_id,_cash_register_id,'saida','comissao',v_amount,
    'Pagamento de comissões','dinheiro',v_user_id,'comissao',_operation_key
  ) RETURNING id INTO v_movement_id;

  UPDATE public.employee_commissions
  SET status='paid',paid_at=now(),notes=NULLIF(_notes,''),updated_at=now()
  WHERE id=ANY(_commission_ids);

  v_result:=jsonb_build_object(
    'success',true,'idempotent',false,'movement_id',v_movement_id,
    'paid_count',v_count,'amount',v_amount
  );
  UPDATE public.financial_operation_keys SET result=v_result
  WHERE company_id=v_company_id AND operation_key=_operation_key;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_employee_commissions_transactional(uuid[],uuid,uuid,text)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pay_employee_commissions_transactional(uuid[],uuid,uuid,text)
TO authenticated,service_role;
