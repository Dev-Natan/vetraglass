-- Phase 3C / Etapa B
-- Quote approval copies the realized snapshot and never evaluates formulas.

CREATE OR REPLACE FUNCTION public.approve_quote_transactional(
  p_quote_id uuid,
  p_company_id uuid,
  p_total_amount numeric,
  p_entry_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT NULL,
  p_card_net_amount numeric DEFAULT NULL,
  p_balance_due_date date DEFAULT NULL,
  p_estimated_end date DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_notes text DEFAULT NULL,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_condicao_pagamento_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quote public.quotes%ROWTYPE;
  v_forma record;
  v_condicao record;
  v_existing_sale record;
  v_expected_total numeric;
  v_items_total numeric;
  v_item_count integer;
  v_entry numeric := round(COALESCE(p_entry_amount, 0), 2);
  v_pending numeric;
  v_cash_amount numeric;
  v_cash_register_id uuid;
  v_open_cash_count integer;
  v_sale_id uuid;
  v_sale_number integer;
  v_sale_payment_method text;
  v_os_id uuid;
  v_os_number integer;
  v_deposit_id uuid;
  v_entry_receivable_id uuid;
  v_cash_movement_id uuid;
  v_first_balance_receivable_id uuid;
  v_installment_ids jsonb := '[]'::jsonb;
  v_installments integer := 1;
  v_days_between integer := 30;
  v_installment_amount numeric;
  v_allocated numeric := 0;
  v_current_amount numeric;
  v_due_date date;
  v_receivable_id uuid;
  v_fulfillment jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'unauthenticated';
  END IF;
  IF p_company_id IS NULL OR NOT public.user_belongs_to_company(v_user_id, p_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'unauthorized';
  END IF;
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'quote_id_required';
  END IF;

  SELECT q.* INTO v_quote FROM public.quotes q WHERE q.id = p_quote_id FOR UPDATE;
  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'quote_not_found';
  END IF;
  IF v_quote.company_id <> p_company_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'quote_company_mismatch';
  END IF;

  SELECT s.id, s.ordem_servico_id INTO v_existing_sale
  FROM public.sales s
  WHERE s.quote_id = p_quote_id AND s.sale_type = 'full'
  ORDER BY s.created_at LIMIT 1;
  IF v_existing_sale.id IS NOT NULL THEN
    SELECT os.os_number INTO v_os_number
    FROM public.ordens_servico os WHERE os.id = v_existing_sale.ordem_servico_id;
    RETURN jsonb_build_object(
      'success', true, 'idempotent_replay', true, 'quote_id', p_quote_id,
      'sale_id', v_existing_sale.id, 'ordem_servico_id', v_existing_sale.ordem_servico_id,
      'os_number', v_os_number
    );
  END IF;

  IF v_quote.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'quote_not_approvable';
  END IF;
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_priority';
  END IF;
  IF v_quote.client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = v_quote.client_id AND c.company_id = p_company_id AND c.is_active = true
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'invalid_quote_client';
  END IF;

  SELECT fp.id, fp.tipo, fp.nome INTO v_forma
  FROM public.formas_pagamento fp
  WHERE fp.id = p_forma_pagamento_id AND fp.company_id = p_company_id AND fp.is_active = true;
  IF v_forma.id IS NULL OR v_forma.tipo NOT IN ('avista', 'parcelado', 'misto') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_payment_option';
  END IF;
  IF p_condicao_pagamento_id IS NOT NULL THEN
    SELECT cp.* INTO v_condicao FROM public.condicoes_pagamento cp
    WHERE cp.id = p_condicao_pagamento_id AND cp.company_id = p_company_id
      AND cp.is_active = true
      AND (cp.forma_pagamento_id IS NULL OR cp.forma_pagamento_id = p_forma_pagamento_id);
    IF v_condicao.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_payment_condition';
    END IF;
    v_installments := GREATEST(v_condicao.parcelas, 1);
    v_days_between := GREATEST(v_condicao.dias_entre_parcelas, 0);
  ELSIF v_forma.tipo = 'parcelado' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'payment_condition_required';
  END IF;

  v_expected_total := round(CASE WHEN v_forma.tipo = 'avista'
    THEN v_quote.final_amount ELSE v_quote.total_amount END, 2);
  IF round(COALESCE(p_total_amount, 0), 2) <> v_expected_total OR v_expected_total <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'quote_total_mismatch';
  END IF;
  SELECT round(COALESCE(sum(qi.total_price), 0), 2), count(*)
  INTO v_items_total, v_item_count
  FROM public.quote_items qi WHERE qi.quote_id = p_quote_id;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'quote_items_required';
  END IF;
  IF v_items_total <> round(v_quote.total_amount, 2) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'quote_items_total_mismatch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND NOT public.phase3c_validate_engineering_snapshot(qi.composition_snapshot, qi.fulfillment_mode)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SNAPSHOT_MISSING';
  END IF;

  IF v_entry < 0 OR v_entry > v_expected_total THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_entry_amount';
  END IF;
  v_pending := round(v_expected_total - v_entry, 2);
  IF v_pending > 0 AND p_balance_due_date IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'balance_due_date_required';
  END IF;
  IF v_entry > 0 THEN
    IF p_payment_method NOT IN ('dinheiro', 'cartao', 'pix') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_entry_payment_method';
    END IF;
    v_cash_amount := CASE WHEN p_payment_method = 'cartao'
      THEN round(COALESCE(p_card_net_amount, v_entry), 2) ELSE v_entry END;
    IF v_cash_amount <= 0 OR v_cash_amount > v_entry THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_card_net_amount';
    END IF;
    PERFORM cr.id FROM public.cash_registers cr
    WHERE cr.company_id = p_company_id AND cr.status = 'open'
      AND (cr.opened_by = v_user_id OR cr.operator_id = v_user_id)
    ORDER BY cr.id FOR UPDATE;
    SELECT count(*) INTO v_open_cash_count
    FROM public.cash_registers cr
    WHERE cr.company_id = p_company_id AND cr.status = 'open'
      AND (cr.opened_by = v_user_id OR cr.operator_id = v_user_id);
    SELECT cr.id INTO v_cash_register_id
    FROM public.cash_registers cr
    WHERE cr.company_id = p_company_id AND cr.status = 'open'
      AND (cr.opened_by = v_user_id OR cr.operator_id = v_user_id)
    ORDER BY cr.id LIMIT 1;
    IF v_open_cash_count = 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'open_cash_register_required';
    END IF;
    IF v_open_cash_count > 1 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'multiple_open_cash_registers';
    END IF;
  END IF;

  v_sale_payment_method := CASE
    WHEN v_forma.tipo = 'parcelado' THEN 'cartao'
    WHEN lower(v_forma.nome) LIKE '%dinheiro%' THEN 'dinheiro'
    WHEN lower(v_forma.nome) LIKE '%cart%' THEN 'cartao'
    ELSE 'pix' END;
  v_sale_number := public.get_next_document_number(p_company_id, 'SALE');
  INSERT INTO public.sales (
    company_id, cash_register_id, sale_number, client_id, customer_name,
    subtotal, discount_percent, discount_amount, total_amount,
    payment_method, payment_status, sale_type, payment_type,
    paid_amount, pending_amount, remaining_amount, installments_count,
    quote_id, sold_by, notes
  ) VALUES (
    p_company_id, v_cash_register_id, v_sale_number, v_quote.client_id, v_quote.customer_name,
    v_quote.total_amount,
    CASE WHEN v_forma.tipo = 'avista' THEN COALESCE(v_quote.discount_percent, 0) ELSE 0 END,
    CASE WHEN v_forma.tipo = 'avista' THEN COALESCE(v_quote.discount_amount, 0) ELSE 0 END,
    v_expected_total, v_sale_payment_method,
    CASE WHEN v_pending = 0 THEN 'paid' ELSE 'pending' END,
    'full', CASE WHEN v_pending = 0 THEN 'full' WHEN v_entry > 0 THEN 'partial' ELSE 'installment' END,
    v_entry, v_pending, v_pending, CASE WHEN v_pending > 0 THEN v_installments ELSE 0 END,
    p_quote_id, v_user_id, format('Aprovação do orçamento #%s', v_quote.quote_number)
  ) RETURNING id INTO v_sale_id;

  INSERT INTO public.sale_items (
    sale_id, item_template_id, company_product_id, product_template_id,
    source_quote_item_id, item_name, item_unit, quantity, unit_price,
    total_price, notes, width, height, composition_mode, fulfillment_mode,
    engineering_snapshot, snapshot_version
  )
  SELECT v_sale_id, ci.item_template_id, qi.company_product_id, qi.product_template_id,
    qi.id, qi.description, COALESCE(qi.unit, ci.unit, 'un'), qi.quantity,
    qi.unit_price, qi.total_price, qi.notes, qi.width, qi.height,
    qi.composition_mode, qi.fulfillment_mode, qi.composition_snapshot, qi.snapshot_version
  FROM public.quote_items qi
  LEFT JOIN public.company_items ci ON ci.id = qi.company_item_id
  WHERE qi.quote_id = p_quote_id
  ORDER BY qi.created_at, qi.id;

  v_fulfillment := public.phase3c_fulfill_sale(v_sale_id, p_priority, p_estimated_end, p_notes);
  v_os_id := NULLIF(v_fulfillment->>'ordem_servico_id', '')::uuid;
  v_os_number := NULLIF(v_fulfillment->>'os_number', '')::integer;

  IF v_entry > 0 THEN
    INSERT INTO public.quote_deposits (
      company_id, quote_id, ordem_servico_id, customer_name, customer_phone,
      amount, payment_method, status, received_at, cash_register_id, created_by
    ) VALUES (
      p_company_id, p_quote_id, v_os_id, v_quote.customer_name, v_quote.customer_phone,
      v_entry, p_payment_method, 'received', now(), v_cash_register_id, v_user_id
    ) RETURNING id INTO v_deposit_id;

    INSERT INTO public.accounts_receivable (
      company_id, sale_id, quote_id, ordem_servico_id, client_id, customer_name,
      description, total_amount, installment_number, total_installments, due_date,
      paid_date, paid_amount, status, payment_method, receivable_type, created_by
    ) VALUES (
      p_company_id, v_sale_id, p_quote_id, v_os_id, v_quote.client_id, v_quote.customer_name,
      format('Entrada - Orçamento #%s', v_quote.quote_number), v_entry, 0, 0,
      current_date, current_date, v_entry, 'paid', p_payment_method,
      'entrada_orcamento', v_user_id
    ) RETURNING id INTO v_entry_receivable_id;

    INSERT INTO public.cash_movements (
      company_id, cash_register_id, type, category, amount, description,
      payment_method, receivable_id, sale_id, created_by, origem, quote_id, ordem_servico_id
    ) VALUES (
      p_company_id, v_cash_register_id, 'entrada', 'entrada_orcamento', v_cash_amount,
      format('Entrada - Orçamento #%s - %s', v_quote.quote_number, v_quote.customer_name),
      p_payment_method, v_entry_receivable_id, v_sale_id, v_user_id,
      'orcamento', p_quote_id, v_os_id
    ) RETURNING id INTO v_cash_movement_id;
    UPDATE public.quote_deposits SET cash_movement_id = v_cash_movement_id WHERE id = v_deposit_id;
  END IF;

  IF v_pending > 0 THEN
    v_installment_amount := round(v_pending / v_installments, 2);
    FOR i IN 1..v_installments LOOP
      v_current_amount := CASE WHEN i = v_installments
        THEN round(v_pending - v_allocated, 2) ELSE v_installment_amount END;
      v_due_date := p_balance_due_date + ((i - 1) * v_days_between);
      INSERT INTO public.accounts_receivable (
        company_id, sale_id, quote_id, ordem_servico_id, client_id, customer_name,
        description, total_amount, installment_number, total_installments,
        due_date, paid_amount, status, payment_method, receivable_type, created_by
      ) VALUES (
        p_company_id, v_sale_id, p_quote_id, v_os_id, v_quote.client_id,
        v_quote.customer_name, format('Venda #%s - Parcela (%s/%s)', v_sale_number, i, v_installments),
        v_current_amount, i, v_installments, v_due_date, 0, 'pending',
        v_sale_payment_method, 'saldo_final', v_user_id
      ) RETURNING id INTO v_receivable_id;
      IF i = 1 THEN v_first_balance_receivable_id := v_receivable_id; END IF;
      v_installment_ids := v_installment_ids || jsonb_build_array(v_receivable_id);
      v_allocated := v_allocated + v_current_amount;
    END LOOP;
    IF v_allocated <> v_pending THEN
      RAISE EXCEPTION USING ERRCODE = '22003', MESSAGE = 'installment_rounding_mismatch';
    END IF;
  END IF;

  UPDATE public.quotes SET status = 'approved', forma_pagamento_id = p_forma_pagamento_id,
    condicao_pagamento_id = p_condicao_pagamento_id, valor_original = v_quote.total_amount,
    valor_final_aprovado = v_expected_total, approved_at = now(), approved_by = v_user_id
  WHERE id = p_quote_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'quote_approval_update_failed';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent_replay', false, 'quote_id', p_quote_id,
    'sale_id', v_sale_id, 'ordem_servico_id', v_os_id, 'os_number', v_os_number,
    'quote_deposit_id', v_deposit_id, 'entry_receivable_id', v_entry_receivable_id,
    'balance_receivable_id', v_first_balance_receivable_id,
    'installment_ids', v_installment_ids, 'cash_register_id', v_cash_register_id,
    'cash_movement_id', v_cash_movement_id, 'fulfillment', v_fulfillment
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_quote_transactional(
  uuid, uuid, numeric, numeric, text, numeric, date, date, text, text, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_quote_transactional(
  uuid, uuid, numeric, numeric, text, numeric, date, date, text, text, uuid, uuid
) TO authenticated, service_role;
