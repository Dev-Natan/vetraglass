-- Phase 2C: canonical transactional finance, cash, receivables and commissions.

CREATE TABLE public.financial_operation_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  operation_key uuid NOT NULL,
  operation_type text NOT NULL,
  reference_id uuid,
  result jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, operation_key)
);

ALTER TABLE public.financial_operation_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.financial_operation_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.financial_operation_keys TO service_role;

ALTER TABLE public.cash_movements
  ALTER COLUMN cash_register_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operation_key uuid,
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid,
  ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS party_type text,
  ADD COLUMN IF NOT EXISTS party_id uuid,
  ADD COLUMN IF NOT EXISTS party_name text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_movements_company_operation_key
  ON public.cash_movements(company_id, operation_key)
  WHERE operation_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_registers_open_user_company
  ON public.cash_registers(company_id, opened_by)
  WHERE status = 'open';

ALTER TABLE public.cash_movements
  DROP CONSTRAINT IF EXISTS cash_movements_category_check;
ALTER TABLE public.cash_movements
  ADD CONSTRAINT cash_movements_category_check CHECK (category IN (
    'venda','servico','recebimento','recebimento_parcela','troco','sangria',
    'suprimento','reforco','despesa','outros','entrada_orcamento',
    'entrada_venda','adiantamento','compensacao_adiantamento',
    'faturamento_final','comissao','pagamento_fornecedor','estorno'
  ));

ALTER TABLE public.cash_movements
  ADD CONSTRAINT cash_movements_positive_amount CHECK (amount > 0);
ALTER TABLE public.accounts_receivable
  ADD CONSTRAINT accounts_receivable_paid_amount_range
  CHECK (COALESCE(paid_amount, 0) >= 0 AND COALESCE(paid_amount, 0) <= total_amount);
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_paid_amount_range
  CHECK (COALESCE(paid_amount, 0) >= 0 AND COALESCE(paid_amount, 0) <= amount);
ALTER TABLE public.employee_commissions
  ADD CONSTRAINT employee_commissions_status_check
  CHECK (status IN ('pending','paid','cancelled'));

DROP POLICY IF EXISTS "Users can update their company receivables" ON public.accounts_receivable;
CREATE POLICY "Users can update their company receivables"
ON public.accounts_receivable FOR UPDATE TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS "Users can update company cash registers" ON public.cash_registers;
CREATE POLICY "Users can update company cash registers"
ON public.cash_registers FOR UPDATE TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS "Users with elevated role can update expenses" ON public.expenses;
CREATE POLICY "Users with elevated role can update expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (public.user_has_elevated_role_in_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_has_elevated_role_in_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS "Admins can update commissions" ON public.employee_commissions;
CREATE POLICY "Admins can update commissions"
ON public.employee_commissions FOR UPDATE TO authenticated
USING (public.user_has_elevated_role_in_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_has_elevated_role_in_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS "Users can update quote deposits in their company" ON public.quote_deposits;
CREATE POLICY "Users can update quote deposits in their company"
ON public.quote_deposits FOR UPDATE TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS "Users can update company sales" ON public.sales;
CREATE POLICY "Users can update company sales"
ON public.sales FOR UPDATE TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));

CREATE OR REPLACE FUNCTION public.receive_receivable_payment(
  _receivable_id uuid,
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
  v_user_id uuid := auth.uid();
  v_receivable public.accounts_receivable%ROWTYPE;
  v_register public.cash_registers%ROWTYPE;
  v_new_paid numeric;
  v_movement_id uuid;
  v_sale_paid numeric;
  v_os_paid numeric;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='Authentication required'; END IF;
  IF _operation_key IS NULL OR _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Positive amount and operation key are required';
  END IF;

  SELECT * INTO v_receivable FROM public.accounts_receivable
  WHERE id = _receivable_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Receivable not found'; END IF;
  IF NOT public.user_belongs_to_company(v_user_id, v_receivable.company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Forbidden company scope';
  END IF;

  INSERT INTO public.financial_operation_keys(company_id,operation_key,operation_type,reference_id,created_by)
  VALUES(v_receivable.company_id,_operation_key,'receivable_payment',_receivable_id,v_user_id)
  ON CONFLICT (company_id,operation_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT result INTO v_result FROM public.financial_operation_keys
    WHERE company_id=v_receivable.company_id AND operation_key=_operation_key;
    RETURN COALESCE(v_result,'{}'::jsonb) || jsonb_build_object('success',true,'idempotent',true);
  END IF;

  IF v_receivable.status IN ('paid','cancelled') THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Receivable is not payable';
  END IF;
  v_new_paid := COALESCE(v_receivable.paid_amount,0) + _amount;
  IF v_new_paid > v_receivable.total_amount THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Payment exceeds receivable balance';
  END IF;

  SELECT * INTO v_register FROM public.cash_registers
  WHERE id=_cash_register_id AND company_id=v_receivable.company_id AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='An open company cash register is required'; END IF;

  INSERT INTO public.cash_movements(
    company_id,cash_register_id,type,category,amount,description,payment_method,
    receivable_id,sale_id,quote_id,ordem_servico_id,created_by,origem,operation_key
  ) VALUES(
    v_receivable.company_id,v_register.id,'entrada','recebimento_parcela',_amount,
    format('Recebimento - %s',v_receivable.customer_name),_payment_method,
    v_receivable.id,v_receivable.sale_id,v_receivable.quote_id,v_receivable.ordem_servico_id,
    v_user_id,'conta_receber',_operation_key
  ) RETURNING id INTO v_movement_id;

  UPDATE public.accounts_receivable SET
    paid_amount=v_new_paid,
    status=CASE WHEN v_new_paid=total_amount THEN 'paid' ELSE 'partial' END,
    paid_date=current_date,
    payment_method=_payment_method,
    updated_at=now()
  WHERE id=v_receivable.id;

  IF v_receivable.sale_id IS NOT NULL THEN
    SELECT COALESCE(sum(paid_amount),0) INTO v_sale_paid FROM public.accounts_receivable
    WHERE sale_id=v_receivable.sale_id AND status<>'cancelled';
    UPDATE public.sales SET
      paid_amount=LEAST(total_amount,v_sale_paid),
      pending_amount=GREATEST(0,total_amount-v_sale_paid),
      payment_status=CASE WHEN v_sale_paid>=total_amount THEN 'paid' WHEN v_sale_paid>0 THEN 'partial' ELSE 'pending' END,
      updated_at=now()
    WHERE id=v_receivable.sale_id;
  END IF;

  IF v_receivable.ordem_servico_id IS NOT NULL THEN
    SELECT COALESCE(sum(paid_amount),0) INTO v_os_paid FROM public.accounts_receivable
    WHERE ordem_servico_id=v_receivable.ordem_servico_id AND status<>'cancelled';
    UPDATE public.ordens_servico SET
      paid_amount=LEAST(total_amount,v_os_paid),
      pending_amount=GREATEST(0,total_amount-v_os_paid),
      updated_at=now()
    WHERE id=v_receivable.ordem_servico_id;
  END IF;

  v_result := jsonb_build_object('success',true,'idempotent',false,'movement_id',v_movement_id,
    'receivable_id',v_receivable.id,'paid_amount',v_new_paid,'pending_amount',v_receivable.total_amount-v_new_paid,
    'status',CASE WHEN v_new_paid=v_receivable.total_amount THEN 'paid' ELSE 'partial' END);
  UPDATE public.financial_operation_keys SET result=v_result
  WHERE company_id=v_receivable.company_id AND operation_key=_operation_key;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_quote_deposit_transactional(
  _deposit_id uuid,
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
  v_user_id uuid := auth.uid();
  v_deposit public.quote_deposits%ROWTYPE;
  v_register public.cash_registers%ROWTYPE;
  v_movement_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000', MESSAGE='Authentication required'; END IF;
  IF _operation_key IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Operation key is required'; END IF;
  SELECT * INTO v_deposit FROM public.quote_deposits WHERE id=_deposit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Quote deposit not found'; END IF;
  IF NOT public.user_belongs_to_company(v_user_id,v_deposit.company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Forbidden company scope';
  END IF;

  INSERT INTO public.financial_operation_keys(company_id,operation_key,operation_type,reference_id,created_by)
  VALUES(v_deposit.company_id,_operation_key,'quote_deposit',_deposit_id,v_user_id)
  ON CONFLICT(company_id,operation_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT result INTO v_result FROM public.financial_operation_keys
    WHERE company_id=v_deposit.company_id AND operation_key=_operation_key;
    RETURN COALESCE(v_result,'{}'::jsonb) || jsonb_build_object('success',true,'idempotent',true);
  END IF;
  IF v_deposit.status<>'pending' THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Deposit already processed or cancelled'; END IF;
  SELECT * INTO v_register FROM public.cash_registers
  WHERE id=_cash_register_id AND company_id=v_deposit.company_id AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='An open company cash register is required'; END IF;

  INSERT INTO public.cash_movements(company_id,cash_register_id,type,category,amount,description,payment_method,
    quote_id,ordem_servico_id,created_by,origem,operation_key)
  VALUES(v_deposit.company_id,v_register.id,'entrada','entrada_orcamento',v_deposit.amount,
    format('Entrada - %s',v_deposit.customer_name),_payment_method,v_deposit.quote_id,v_deposit.ordem_servico_id,
    v_user_id,'orcamento',_operation_key) RETURNING id INTO v_movement_id;

  UPDATE public.quote_deposits SET status='received',received_at=now(),cash_register_id=v_register.id,
    cash_movement_id=v_movement_id,payment_method=_payment_method,updated_at=now() WHERE id=v_deposit.id;
  UPDATE public.accounts_receivable SET status='paid',paid_amount=total_amount,paid_date=current_date,
    payment_method=_payment_method,updated_at=now()
  WHERE quote_id=v_deposit.quote_id AND receivable_type='entrada_orcamento' AND status IN ('pending','partial','overdue');
  UPDATE public.quotes SET deposit_status='received',updated_at=now() WHERE id=v_deposit.quote_id;
  IF v_deposit.ordem_servico_id IS NOT NULL THEN
    UPDATE public.ordens_servico SET paid_amount=LEAST(total_amount,COALESCE(paid_amount,0)+v_deposit.amount),
      pending_amount=GREATEST(0,total_amount-(COALESCE(paid_amount,0)+v_deposit.amount)),updated_at=now()
    WHERE id=v_deposit.ordem_servico_id;
  END IF;
  v_result:=jsonb_build_object('success',true,'idempotent',false,'deposit_id',v_deposit.id,'movement_id',v_movement_id);
  UPDATE public.financial_operation_keys SET result=v_result
  WHERE company_id=v_deposit.company_id AND operation_key=_operation_key;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.pay_expense_transactional(
  _expense_id uuid,
  _amount numeric,
  _payment_method text,
  _cash_register_id uuid,
  _bank_account_id uuid,
  _operation_key uuid,
  _paid_date date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid:=auth.uid();
  v_expense public.expenses%ROWTYPE;
  v_register public.cash_registers%ROWTYPE;
  v_bank_balance numeric;
  v_new_paid numeric;
  v_movement_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Authentication required'; END IF;
  IF _operation_key IS NULL OR _amount IS NULL OR _amount<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Positive amount and operation key are required'; END IF;
  SELECT * INTO v_expense FROM public.expenses WHERE id=_expense_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Expense not found'; END IF;
  IF NOT public.user_has_elevated_role_in_company(v_user_id,v_expense.company_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Forbidden company scope'; END IF;
  INSERT INTO public.financial_operation_keys(company_id,operation_key,operation_type,reference_id,created_by)
  VALUES(v_expense.company_id,_operation_key,'expense_payment',_expense_id,v_user_id)
  ON CONFLICT(company_id,operation_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT result INTO v_result FROM public.financial_operation_keys WHERE company_id=v_expense.company_id AND operation_key=_operation_key;
    RETURN COALESCE(v_result,'{}'::jsonb)||jsonb_build_object('success',true,'idempotent',true);
  END IF;
  IF v_expense.status='cancelled' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Expense is cancelled'; END IF;
  v_new_paid:=COALESCE(v_expense.paid_amount,0)+_amount;
  IF v_new_paid>v_expense.amount THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Payment exceeds expense balance'; END IF;
  IF _bank_account_id IS NOT NULL THEN
    SELECT current_balance INTO v_bank_balance FROM public.bank_accounts
    WHERE id=_bank_account_id AND company_id=v_expense.company_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Bank account not found in company'; END IF;
    IF v_bank_balance<_amount THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Insufficient bank balance'; END IF;
    UPDATE public.bank_accounts SET current_balance=current_balance-_amount,updated_at=now() WHERE id=_bank_account_id;
  ELSE
    SELECT * INTO v_register FROM public.cash_registers
    WHERE id=_cash_register_id AND company_id=v_expense.company_id AND status='open' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Open cash register or bank account is required'; END IF;
  END IF;
  INSERT INTO public.cash_movements(company_id,cash_register_id,bank_account_id,type,category,amount,description,
    payment_method,expense_id,created_by,origem,operation_key)
  VALUES(v_expense.company_id,v_register.id,_bank_account_id,'saida','despesa',_amount,
    format('Pagamento - %s',v_expense.description),_payment_method,v_expense.id,v_user_id,'conta_pagar',_operation_key)
  RETURNING id INTO v_movement_id;
  UPDATE public.expenses SET paid_amount=v_new_paid,paid_date=_paid_date,payment_method=_payment_method,
    bank_account_id=COALESCE(_bank_account_id,bank_account_id),status=CASE WHEN v_new_paid=amount THEN 'paid' ELSE 'pending' END,
    updated_at=now() WHERE id=v_expense.id;
  v_result:=jsonb_build_object('success',true,'idempotent',false,'expense_id',v_expense.id,'movement_id',v_movement_id,
    'paid_amount',v_new_paid,'pending_amount',v_expense.amount-v_new_paid,'status',CASE WHEN v_new_paid=v_expense.amount THEN 'paid' ELSE 'pending' END);
  UPDATE public.financial_operation_keys SET result=v_result WHERE company_id=v_expense.company_id AND operation_key=_operation_key;
  RETURN v_result;
END;
$$;

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
  IF _operation_key IS NULL OR COALESCE(array_length(_commission_ids,1),0)=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Commission ids and operation key are required'; END IF;
  PERFORM 1 FROM public.employee_commissions WHERE id=ANY(_commission_ids) FOR UPDATE;
  SELECT min(company_id),sum(commission_amount),count(*) INTO v_company_id,v_amount,v_count
  FROM public.employee_commissions WHERE id=ANY(_commission_ids) AND status='pending';
  IF v_count<>array_length(_commission_ids,1) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Commission is invalid or already paid'; END IF;
  IF EXISTS(SELECT 1 FROM public.employee_commissions WHERE id=ANY(_commission_ids) AND company_id<>v_company_id) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Commissions must belong to one company'; END IF;
  IF NOT public.user_has_elevated_role_in_company(v_user_id,v_company_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Forbidden company scope'; END IF;
  INSERT INTO public.financial_operation_keys(company_id,operation_key,operation_type,reference_id,created_by)
  VALUES(v_company_id,_operation_key,'commission_payment',_commission_ids[1],v_user_id)
  ON CONFLICT(company_id,operation_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT result INTO v_result FROM public.financial_operation_keys WHERE company_id=v_company_id AND operation_key=_operation_key;
    RETURN COALESCE(v_result,'{}'::jsonb)||jsonb_build_object('success',true,'idempotent',true);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cash_registers WHERE id=_cash_register_id AND company_id=v_company_id AND status='open' FOR UPDATE) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='An open company cash register is required';
  END IF;
  INSERT INTO public.cash_movements(company_id,cash_register_id,type,category,amount,description,payment_method,created_by,origem,operation_key)
  VALUES(v_company_id,_cash_register_id,'saida','comissao',v_amount,'Pagamento de comissões','dinheiro',v_user_id,'comissao',_operation_key)
  RETURNING id INTO v_movement_id;
  UPDATE public.employee_commissions SET status='paid',paid_at=now(),notes=NULLIF(_notes,''),updated_at=now()
  WHERE id=ANY(_commission_ids);
  v_result:=jsonb_build_object('success',true,'idempotent',false,'movement_id',v_movement_id,'paid_count',v_count,'amount',v_amount);
  UPDATE public.financial_operation_keys SET result=v_result WHERE company_id=v_company_id AND operation_key=_operation_key;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_cash_movement_transactional(
  _cash_register_id uuid,
  _type text,
  _category text,
  _amount numeric,
  _description text,
  _payment_method text,
  _operation_key uuid,
  _cliente_id uuid DEFAULT NULL,
  _fornecedor_id uuid DEFAULT NULL,
  _funcionario_id uuid DEFAULT NULL,
  _quote_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid:=auth.uid();
  v_register public.cash_registers%ROWTYPE;
  v_balance numeric;
  v_reinforcement jsonb;
  v_movement_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Authentication required'; END IF;
  IF _operation_key IS NULL OR _amount IS NULL OR _amount<=0 OR _type NOT IN('entrada','saida') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid cash movement'; END IF;
  SELECT * INTO v_register FROM public.cash_registers WHERE id=_cash_register_id AND status='open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Cash register not found or closed'; END IF;
  IF NOT public.user_belongs_to_company(v_user_id,v_register.company_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Forbidden company scope'; END IF;
  INSERT INTO public.financial_operation_keys(company_id,operation_key,operation_type,reference_id,created_by)
  VALUES(v_register.company_id,_operation_key,'cash_movement',_cash_register_id,v_user_id)
  ON CONFLICT(company_id,operation_key) DO NOTHING;
  IF NOT FOUND THEN
    SELECT result INTO v_result FROM public.financial_operation_keys WHERE company_id=v_register.company_id AND operation_key=_operation_key;
    RETURN COALESCE(v_result,'{}'::jsonb)||jsonb_build_object('success',true,'idempotent',true);
  END IF;
  IF _type='saida' THEN
    SELECT v_register.opening_amount+COALESCE(sum(CASE WHEN type='entrada' THEN amount ELSE -amount END),0)
    INTO v_balance FROM public.cash_movements WHERE cash_register_id=v_register.id;
    IF v_balance<_amount THEN
      v_reinforcement:=public.request_cash_reinforcement(v_register.company_id,v_register.id,_amount,v_balance,_description);
      IF NOT COALESCE((v_reinforcement->>'success')::boolean,false) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE=COALESCE(v_reinforcement->>'error','Cash reinforcement failed'); END IF;
    END IF;
  END IF;
  INSERT INTO public.cash_movements(company_id,cash_register_id,type,category,amount,description,payment_method,
    created_by,origem,operation_key,cliente_id,fornecedor_id,funcionario_id,quote_id)
  VALUES(v_register.company_id,v_register.id,_type,_category,_amount,_description,_payment_method,
    v_user_id,'movimento_manual',_operation_key,_cliente_id,_fornecedor_id,_funcionario_id,_quote_id)
  RETURNING id INTO v_movement_id;
  v_result:=jsonb_build_object('success',true,'idempotent',false,'movement_id',v_movement_id,'reinforcement',v_reinforcement);
  UPDATE public.financial_operation_keys SET result=v_result WHERE company_id=v_register.company_id AND operation_key=_operation_key;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_daily_cash(_company_id uuid,_opening_amount numeric,_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_user_id uuid:=auth.uid(); v_cash public.company_cash%ROWTYPE; v_register public.cash_registers%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Authentication required'; END IF;
  IF NOT public.user_belongs_to_company(v_user_id,_company_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Forbidden company scope'; END IF;
  IF _opening_amount IS NULL OR _opening_amount<0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Invalid opening amount'; END IF;
  SELECT * INTO v_register FROM public.cash_registers WHERE company_id=_company_id AND opened_by=v_user_id AND status='open' FOR UPDATE;
  IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,'cash_register_id',v_register.id,'opening_amount',v_register.opening_amount); END IF;
  SELECT * INTO v_cash FROM public.company_cash WHERE company_id=_company_id FOR UPDATE;
  IF NOT FOUND OR v_cash.current_balance<_opening_amount THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Company cash is not configured or has insufficient balance'; END IF;
  INSERT INTO public.cash_registers(company_id,opened_by,operator_id,opening_amount,status)
  VALUES(_company_id,v_user_id,v_user_id,_opening_amount,'open') RETURNING * INTO v_register;
  UPDATE public.company_cash SET current_balance=current_balance-_opening_amount,last_movement_at=now(),updated_at=now() WHERE id=v_cash.id;
  IF _opening_amount>0 THEN
    INSERT INTO public.company_cash_movements(company_id,type,category,amount,balance_before,balance_after,description,cash_register_id,created_by)
    VALUES(_company_id,'saida','abertura_caixa',_opening_amount,v_cash.current_balance,v_cash.current_balance-_opening_amount,
      'Transferência para caixa do operador',v_register.id,v_user_id);
  END IF;
  RETURN jsonb_build_object('success',true,'idempotent',false,'cash_register_id',v_register.id,'opening_amount',_opening_amount,
    'company_balance_after',v_cash.current_balance-_opening_amount);
EXCEPTION WHEN unique_violation THEN
  SELECT * INTO v_register FROM public.cash_registers WHERE company_id=_company_id AND opened_by=v_user_id AND status='open';
  RETURN jsonb_build_object('success',true,'idempotent',true,'cash_register_id',v_register.id,'opening_amount',v_register.opening_amount);
END $$;

CREATE OR REPLACE FUNCTION public.close_cash_register_direct(_cash_register_id uuid,_counts jsonb,_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_user_id uuid:=auth.uid(); v_register public.cash_registers%ROWTYPE; v_cash public.company_cash%ROWTYPE;
v_expected numeric; v_counted numeric; v_difference numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Authentication required'; END IF;
  SELECT * INTO v_register FROM public.cash_registers WHERE id=_cash_register_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Cash register not found'; END IF;
  IF NOT public.user_belongs_to_company(v_user_id,v_register.company_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Forbidden company scope'; END IF;
  IF v_register.status='closed' THEN RETURN jsonb_build_object('success',true,'idempotent',true,'expected_amount',v_register.closing_amount,
    'total_counted',v_register.actual_amount,'difference',v_register.difference); END IF;
  IF v_register.status<>'open' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Cash register cannot be closed'; END IF;
  SELECT v_register.opening_amount+COALESCE(sum(CASE WHEN type='entrada' THEN amount ELSE -amount END),0)
  INTO v_expected FROM public.cash_movements WHERE cash_register_id=v_register.id;
  SELECT COALESCE(sum((value->>'amount')::numeric),0) INTO v_counted FROM jsonb_array_elements(_counts);
  v_difference:=v_counted-v_expected;
  DELETE FROM public.cash_counts WHERE cash_register_id=v_register.id;
  INSERT INTO public.cash_counts(cash_register_id,user_id,payment_method,valor_informado)
  SELECT v_register.id,v_user_id,value->>'payment_method',(value->>'amount')::numeric FROM jsonb_array_elements(_counts);
  UPDATE public.cash_registers SET status='closed',closed_at=now(),closed_by=v_user_id,operator_id=COALESCE(operator_id,v_user_id),
    closing_requested_at=now(),closing_amount=v_expected,actual_amount=v_counted,difference=v_difference,notes=_notes,audit_status='approved',updated_at=now()
  WHERE id=v_register.id;
  SELECT * INTO v_cash FROM public.company_cash WHERE company_id=v_register.company_id FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO public.company_cash(company_id,current_balance,fixed_fund) VALUES(v_register.company_id,0,v_register.opening_amount) RETURNING * INTO v_cash; END IF;
  IF v_counted>0 THEN
    UPDATE public.company_cash SET current_balance=current_balance+v_counted,last_movement_at=now(),updated_at=now() WHERE id=v_cash.id;
    INSERT INTO public.company_cash_movements(company_id,type,category,amount,balance_before,balance_after,description,cash_register_id,created_by)
    VALUES(v_register.company_id,'entrada','fechamento_caixa',v_counted,v_cash.current_balance,v_cash.current_balance+v_counted,
      'Retorno do fechamento do caixa',v_register.id,v_user_id);
  END IF;
  RETURN jsonb_build_object('success',true,'idempotent',false,'expected_amount',v_expected,'total_counted',v_counted,'difference',v_difference);
END $$;

CREATE OR REPLACE FUNCTION public.close_daily_cash(_cash_register_id uuid,_actual_amount numeric,_notes text DEFAULT NULL,_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  RETURN public.close_cash_register_direct(_cash_register_id,
    jsonb_build_array(jsonb_build_object('payment_method','total','amount',_actual_amount)),_notes);
END $$;

CREATE OR REPLACE FUNCTION public.calculate_sale_commission(_sale_id uuid,_employee_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_user_id uuid:=auth.uid(); v_sale public.sales%ROWTYPE; v_employee public.employees%ROWTYPE; v_amount numeric;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='28000',MESSAGE='Authentication required'; END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id=_sale_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF NOT public.user_belongs_to_company(v_user_id,v_sale.company_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Forbidden company scope'; END IF;
  SELECT * INTO v_employee FROM public.employees WHERE id=_employee_id AND company_id=v_sale.company_id AND commission_enabled=true;
  IF NOT FOUND OR v_sale.payment_status='cancelled' OR (v_employee.commission_trigger='payment' AND v_sale.payment_status<>'paid') THEN RETURN 0; END IF;
  v_amount:=round(v_sale.total_amount*COALESCE(v_employee.commission_percent,0)/100,2);
  INSERT INTO public.employee_commissions(company_id,employee_id,sale_id,sale_amount,commission_percent,commission_amount,status)
  VALUES(v_sale.company_id,v_employee.id,v_sale.id,v_sale.total_amount,v_employee.commission_percent,v_amount,'pending')
  ON CONFLICT(employee_id,sale_id) DO UPDATE SET sale_amount=excluded.sale_amount,commission_percent=excluded.commission_percent,
    commission_amount=excluded.commission_amount,updated_at=now() WHERE public.employee_commissions.status<>'paid';
  RETURN v_amount;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_financial_records_on_sale_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.payment_status='cancelled' AND OLD.payment_status IS DISTINCT FROM 'cancelled' THEN
    UPDATE public.accounts_receivable SET status='cancelled',updated_at=now()
    WHERE (sale_id=NEW.id OR (NEW.quote_id IS NOT NULL AND quote_id=NEW.quote_id) OR
      (NEW.ordem_servico_id IS NOT NULL AND ordem_servico_id=NEW.ordem_servico_id)) AND status<>'cancelled';
    UPDATE public.employee_commissions SET status='cancelled',updated_at=now()
    WHERE sale_id=NEW.id AND status<>'cancelled';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_cancel_receivables ON public.sales;
CREATE TRIGGER trg_auto_cancel_financial_records AFTER UPDATE OF payment_status ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.cancel_financial_records_on_sale_cancel();

CREATE OR REPLACE FUNCTION public.get_dre_report(p_company_id uuid,p_start date,p_end date)
RETURNS TABLE(kind text,dre_group text,category_id uuid,category_name text,category_color text,amount numeric,count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  SELECT 'receita'::text,COALESCE(fc.dre_group,'receita_bruta'),fc.id,COALESCE(fc.name,'Sem categoria'),COALESCE(fc.color,'#10b981'),
    sum(cm.amount)::numeric,count(*)::bigint
  FROM public.cash_movements cm
  LEFT JOIN public.accounts_receivable ar ON ar.id=cm.receivable_id
  LEFT JOIN public.financial_categories fc ON fc.id=ar.category_id
  WHERE cm.company_id=p_company_id AND public.user_belongs_to_company(auth.uid(),p_company_id)
    AND cm.type='entrada' AND cm.receivable_id IS NOT NULL AND cm.created_at::date BETWEEN p_start AND p_end
  GROUP BY fc.id,fc.dre_group,fc.name,fc.color
  UNION ALL
  SELECT 'despesa'::text,COALESCE(fc.dre_group,'outras_despesas'),fc.id,COALESCE(fc.name,'Sem categoria'),COALESCE(fc.color,'#ef4444'),
    sum(cm.amount)::numeric,count(*)::bigint
  FROM public.cash_movements cm
  LEFT JOIN public.expenses e ON e.id=cm.expense_id
  LEFT JOIN public.financial_categories fc ON fc.id=e.category_id
  WHERE cm.company_id=p_company_id AND public.user_belongs_to_company(auth.uid(),p_company_id)
    AND cm.type='saida' AND (cm.expense_id IS NOT NULL OR cm.category='comissao') AND cm.created_at::date BETWEEN p_start AND p_end
  GROUP BY fc.id,fc.dre_group,fc.name,fc.color;
$$;

CREATE OR REPLACE FUNCTION public.get_cash_flow_projection(p_company_id uuid,p_start date,p_end date)
RETURNS TABLE(date date,realized_in numeric,realized_out numeric,projected_in numeric,projected_out numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
  WITH days AS (SELECT generate_series(p_start,p_end,'1 day')::date d),
  realized AS (
    SELECT created_at::date d,sum(amount) FILTER(WHERE type='entrada') realized_in,
      sum(amount) FILTER(WHERE type='saida') realized_out
    FROM public.cash_movements WHERE company_id=p_company_id AND created_at::date BETWEEN p_start AND p_end GROUP BY created_at::date
  ), projected_in_rows AS (
    SELECT due_date d,sum(total_amount-COALESCE(paid_amount,0)) v FROM public.accounts_receivable
    WHERE company_id=p_company_id AND status IN('pending','partial','overdue') AND due_date BETWEEN p_start AND p_end GROUP BY due_date
  ), projected_out_rows AS (
    SELECT due_date d,sum(amount-COALESCE(paid_amount,0)) v FROM public.expenses
    WHERE company_id=p_company_id AND status IN('pending','overdue') AND due_date BETWEEN p_start AND p_end GROUP BY due_date
  )
  SELECT days.d,COALESCE(realized.realized_in,0)::numeric,COALESCE(realized.realized_out,0)::numeric,
    COALESCE(projected_in_rows.v,0)::numeric,COALESCE(projected_out_rows.v,0)::numeric
  FROM days LEFT JOIN realized ON realized.d=days.d LEFT JOIN projected_in_rows ON projected_in_rows.d=days.d
  LEFT JOIN projected_out_rows ON projected_out_rows.d=days.d
  WHERE public.user_belongs_to_company(auth.uid(),p_company_id) ORDER BY days.d;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts_receivable','expenses','cash_registers','cash_movements','company_cash',
    'company_cash_movements','employee_commissions','quote_deposits'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_phase2c_changes ON public.%I',t);
    EXECUTE format('CREATE TRIGGER audit_phase2c_changes AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func()',t);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.receive_receivable_payment(uuid,numeric,text,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.receive_quote_deposit_transactional(uuid,text,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pay_expense_transactional(uuid,numeric,text,uuid,uuid,uuid,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.pay_employee_commissions_transactional(uuid[],uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.register_cash_movement_transactional(uuid,text,text,numeric,text,text,uuid,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.open_daily_cash(uuid,numeric,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.close_cash_register_direct(uuid,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.close_daily_cash(uuid,numeric,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.calculate_sale_commission(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_dre_report(uuid,date,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_cash_flow_projection(uuid,date,date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.cancel_sale(uuid,uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_user_open_cash_register(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_all_open_cash_registers(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.initialize_company_cash(uuid,numeric,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.register_company_cash_movement(uuid,text,text,numeric,text,uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.register_cash_exit_with_reinforcement(uuid,numeric,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_pending_advances_summary(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.can_open_daily_cash(uuid,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.can_user_open_cash(uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.request_cash_reinforcement(uuid,uuid,numeric,numeric,text) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.receive_receivable_payment(uuid,numeric,text,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.receive_quote_deposit_transactional(uuid,text,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.pay_expense_transactional(uuid,numeric,text,uuid,uuid,uuid,date) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.pay_employee_commissions_transactional(uuid[],uuid,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_cash_movement_transactional(uuid,text,text,numeric,text,text,uuid,uuid,uuid,uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.open_daily_cash(uuid,numeric,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.close_cash_register_direct(uuid,jsonb,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.close_daily_cash(uuid,numeric,text,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.calculate_sale_commission(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_dre_report(uuid,date,date) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_cash_flow_projection(uuid,date,date) TO authenticated,service_role;

COMMENT ON TABLE public.financial_operation_keys IS 'Idempotency ledger only; not a monetary source of truth.';
