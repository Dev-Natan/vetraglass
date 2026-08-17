CREATE OR REPLACE FUNCTION public.receive_sale_payment_transactional(
  _sale_id uuid,
  _amount numeric,
  _payment_method text,
  _cash_register_id uuid,
  _operation_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid:=auth.uid();
  v_sale public.sales%ROWTYPE;
  v_register public.cash_registers%ROWTYPE;
  v_receivable public.accounts_receivable%ROWTYPE;
  v_first_receivable_id uuid;
  v_remaining numeric:=_amount;
  v_apply numeric;
  v_total_due numeric;
  v_sale_paid numeric;
  v_os_paid numeric;
  v_movement_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Authentication required';
  END IF;
  IF _operation_key IS NULL OR _amount IS NULL OR _amount<=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Positive amount and operation key are required';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Sale not found'; END IF;
  IF NOT public.user_belongs_to_company(v_user_id,v_sale.company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Forbidden company scope';
  END IF;

  INSERT INTO public.financial_operation_keys(company_id,operation_key,operation_type,reference_id,created_by)
  VALUES(v_sale.company_id,_operation_key,'sale_payment',v_sale.id,v_user_id)
  ON CONFLICT(company_id,operation_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT result INTO v_result FROM public.financial_operation_keys
    WHERE company_id=v_sale.company_id AND operation_key=_operation_key;
    RETURN COALESCE(v_result,'{}'::jsonb)||jsonb_build_object('success',true,'idempotent',true);
  END IF;

  IF v_sale.payment_status='cancelled' THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Cancelled sale cannot receive payments';
  END IF;
  SELECT * INTO v_register FROM public.cash_registers
  WHERE id=_cash_register_id AND company_id=v_sale.company_id AND status='open' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='An open company cash register is required';
  END IF;

  SELECT sum(total_amount-COALESCE(paid_amount,0)) INTO v_total_due
  FROM public.accounts_receivable
  WHERE sale_id=v_sale.id AND status IN('pending','partial','overdue');
  IF COALESCE(v_total_due,0)=0 THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Sale has no payable receivable';
  END IF;
  IF _amount>v_total_due THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment exceeds sale receivable balance';
  END IF;

  FOR v_receivable IN
    SELECT * FROM public.accounts_receivable
    WHERE sale_id=v_sale.id AND status IN('pending','partial','overdue')
    ORDER BY due_date,installment_number,id
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining<=0;
    v_apply:=LEAST(v_remaining,v_receivable.total_amount-COALESCE(v_receivable.paid_amount,0));
    IF v_first_receivable_id IS NULL THEN v_first_receivable_id:=v_receivable.id; END IF;
    UPDATE public.accounts_receivable SET
      paid_amount=COALESCE(paid_amount,0)+v_apply,
      status=CASE WHEN COALESCE(paid_amount,0)+v_apply=total_amount THEN 'paid' ELSE 'partial' END,
      paid_date=current_date,payment_method=_payment_method,updated_at=now()
    WHERE id=v_receivable.id;
    v_remaining:=v_remaining-v_apply;
  END LOOP;

  INSERT INTO public.cash_movements(
    company_id,cash_register_id,type,category,amount,description,payment_method,
    receivable_id,sale_id,quote_id,ordem_servico_id,created_by,origem,operation_key
  ) VALUES(
    v_sale.company_id,v_register.id,'entrada','recebimento_parcela',_amount,
    format('Recebimento - Venda #%s',v_sale.sale_number),_payment_method,
    v_first_receivable_id,v_sale.id,v_sale.quote_id,v_sale.ordem_servico_id,
    v_user_id,'venda',_operation_key
  ) RETURNING id INTO v_movement_id;

  SELECT COALESCE(sum(paid_amount),0) INTO v_sale_paid
  FROM public.accounts_receivable WHERE sale_id=v_sale.id AND status<>'cancelled';
  UPDATE public.sales SET
    paid_amount=LEAST(total_amount,v_sale_paid),
    pending_amount=GREATEST(0,total_amount-v_sale_paid),
    payment_status=CASE WHEN v_sale_paid>=total_amount THEN 'paid' WHEN v_sale_paid>0 THEN 'partial' ELSE 'pending' END,
    sale_type=CASE WHEN v_sale_paid>=total_amount THEN 'full' ELSE 'partial' END,
    updated_at=now()
  WHERE id=v_sale.id;

  IF v_sale.ordem_servico_id IS NOT NULL THEN
    SELECT COALESCE(sum(paid_amount),0) INTO v_os_paid
    FROM public.accounts_receivable
    WHERE ordem_servico_id=v_sale.ordem_servico_id AND status<>'cancelled';
    UPDATE public.ordens_servico SET
      paid_amount=LEAST(total_amount,v_os_paid),
      pending_amount=GREATEST(0,total_amount-v_os_paid),
      updated_at=now()
    WHERE id=v_sale.ordem_servico_id;
  END IF;

  IF v_sale.quote_id IS NOT NULL THEN
    UPDATE public.quotes SET
      status=CASE WHEN v_sale_paid>=v_sale.total_amount THEN 'converted' ELSE 'approved' END,
      deposit_status=CASE WHEN v_sale_paid>=v_sale.total_amount THEN 'billed' ELSE deposit_status END,
      updated_at=now()
    WHERE id=v_sale.quote_id;
  END IF;

  v_result:=jsonb_build_object(
    'success',true,'idempotent',false,'movement_id',v_movement_id,
    'sale_id',v_sale.id,'paid_amount',v_sale_paid,
    'pending_amount',GREATEST(0,v_sale.total_amount-v_sale_paid),
    'status',CASE WHEN v_sale_paid>=v_sale.total_amount THEN 'paid' ELSE 'partial' END
  );
  UPDATE public.financial_operation_keys SET result=v_result
  WHERE company_id=v_sale.company_id AND operation_key=_operation_key;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.receive_sale_payment_transactional(uuid,numeric,text,uuid,uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_sale_payment_transactional(uuid,numeric,text,uuid,uuid)
TO authenticated,service_role;
