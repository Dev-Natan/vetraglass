-- Phase 3C / Etapa B
-- Direct sale: one RPC owns sale, items, snapshot, finance and fulfillment.

CREATE OR REPLACE FUNCTION public.create_direct_sale_transactional(
  _company_id uuid,
  _cash_register_id uuid,
  _customer_name text,
  _items jsonb,
  _payment jsonb,
  _subtotal numeric,
  _discount_percent numeric,
  _discount_amount numeric,
  _total numeric,
  _operation_key uuid,
  _quote_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing record;
  v_sale_id uuid;
  v_sale_number integer;
  v_item jsonb;
  v_snapshot jsonb;
  v_items_total numeric := 0;
  v_paid numeric;
  v_pending numeric;
  v_payment_type text;
  v_payment_method text;
  v_installments jsonb;
  v_installment jsonb;
  v_installments_total numeric := 0;
  v_installments_count integer := 0;
  v_receivable_id uuid;
  v_cash_movement_id uuid;
  v_fulfillment jsonb;
  v_sale_item_ids jsonb := '[]'::jsonb;
  v_sale_item_id uuid;
  v_company_item record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  IF _company_id IS NULL OR NOT public.user_belongs_to_company(v_user_id, _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;
  IF _operation_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'OPERATION_KEY_REQUIRED';
  END IF;

  SELECT s.id, s.sale_number, s.ordem_servico_id INTO v_existing
  FROM public.sales s
  WHERE s.company_id = _company_id AND s.operation_key = _operation_key;
  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true,
      'sale_id', v_existing.id, 'sale_number', v_existing.sale_number,
      'ordem_servico_id', v_existing.ordem_servico_id);
  END IF;
  IF _quote_id IS NOT NULL THEN
    SELECT s.id, s.sale_number, s.ordem_servico_id INTO v_existing
    FROM public.sales s WHERE s.quote_id = _quote_id AND s.sale_type = 'full'
    ORDER BY s.created_at LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'idempotent_replay', true,
        'sale_id', v_existing.id, 'sale_number', v_existing.sale_number,
        'ordem_servico_id', v_existing.ordem_servico_id);
    END IF;
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'QUOTE_MUST_BE_APPROVED_BY_APPROVAL_FLOW';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SALE_ITEMS_REQUIRED';
  END IF;
  IF COALESCE(_subtotal, 0) <= 0 OR COALESCE(_total, 0) <= 0
     OR COALESCE(_discount_percent, 0) < 0 OR COALESCE(_discount_amount, 0) < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SALE_TOTAL';
  END IF;
  IF round(_subtotal - COALESCE(_discount_amount, 0), 2) <> round(_total, 2) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SALE_TOTAL_MISMATCH';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    IF COALESCE(NULLIF(v_item->>'quantity', '')::numeric, 0) <= 0
       OR COALESCE(NULLIF(v_item->>'unit_price', '')::numeric, -1) < 0
       OR COALESCE(NULLIF(v_item->>'total_price', '')::numeric, -1) < 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_SALE_ITEM';
    END IF;
    IF round((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 2)
       <> round((v_item->>'total_price')::numeric, 2) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SALE_ITEM_TOTAL_MISMATCH';
    END IF;
    v_snapshot := v_item->'engineering_snapshot';
    PERFORM public.phase3c_validate_engineering_snapshot(v_snapshot, v_item->>'fulfillment_mode');
    v_items_total := v_items_total + (v_item->>'total_price')::numeric;
  END LOOP;
  IF round(v_items_total, 2) <> round(_subtotal, 2) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SALE_ITEMS_TOTAL_MISMATCH';
  END IF;

  v_payment_type := _payment->>'type';
  v_payment_method := _payment->>'method';
  v_paid := round(COALESCE(NULLIF(_payment->>'paid_amount', '')::numeric, 0), 2);
  v_pending := round(_total - v_paid, 2);
  v_installments := COALESCE(_payment->'installments', '[]'::jsonb);
  IF v_payment_type NOT IN ('full', 'partial', 'installment')
     OR v_payment_method NOT IN ('dinheiro', 'cartao', 'pix', 'boleto', 'transferencia')
     OR v_paid < 0 OR v_paid > _total OR v_pending < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PAYMENT';
  END IF;
  IF v_payment_type = 'full' AND v_pending <> 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYMENT_TOTAL_MISMATCH';
  END IF;
  IF v_pending > 0 THEN
    IF jsonb_typeof(v_installments) <> 'array' OR jsonb_array_length(v_installments) = 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INSTALLMENTS_REQUIRED';
    END IF;
    FOR v_installment IN SELECT value FROM jsonb_array_elements(v_installments)
    LOOP
      IF COALESCE(NULLIF(v_installment->>'amount', '')::numeric, 0) <= 0
         OR NULLIF(v_installment->>'due_date', '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_INSTALLMENT';
      END IF;
      v_installments_total := v_installments_total + (v_installment->>'amount')::numeric;
      v_installments_count := v_installments_count + 1;
    END LOOP;
    IF round(v_installments_total, 2) <> v_pending THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PAYMENT_TOTAL_MISMATCH';
    END IF;
  END IF;

  IF v_paid > 0 THEN
    PERFORM cr.id FROM public.cash_registers cr
    WHERE cr.id = _cash_register_id AND cr.company_id = _company_id
      AND cr.status = 'open' AND (cr.opened_by = v_user_id OR cr.operator_id = v_user_id)
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'open_cash_register_required';
    END IF;
  END IF;

  v_sale_number := public.get_next_document_number(_company_id, 'SALE');
  INSERT INTO public.sales (
    company_id, cash_register_id, sale_number, customer_name, subtotal,
    discount_percent, discount_amount, total_amount, payment_method,
    payment_status, sold_by, notes, sale_type, paid_amount, pending_amount,
    payment_type, remaining_amount, installments_count, operation_key
  ) VALUES (
    _company_id, CASE WHEN v_paid > 0 THEN _cash_register_id ELSE NULL END,
    v_sale_number, NULLIF(btrim(_customer_name), ''), _subtotal,
    COALESCE(_discount_percent, 0), COALESCE(_discount_amount, 0), _total,
    v_payment_method, CASE WHEN v_pending = 0 THEN 'paid' ELSE 'pending' END,
    v_user_id, _notes, 'full', v_paid, v_pending, v_payment_type, v_pending,
    v_installments_count, _operation_key
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    v_snapshot := v_item->'engineering_snapshot';
    IF NULLIF(v_item->>'company_item_id', '') IS NOT NULL THEN
      SELECT ci.* INTO v_company_item FROM public.company_items ci
      WHERE ci.id = (v_item->>'company_item_id')::uuid
        AND ci.company_id = _company_id AND ci.is_active = true;
      IF v_company_item.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
      END IF;
    END IF;

    INSERT INTO public.sale_items (
      sale_id, item_template_id, company_product_id, product_template_id,
      item_name, item_unit, quantity, unit_price, total_price, notes,
      width, height, composition_mode, fulfillment_mode,
      engineering_snapshot, snapshot_version
    ) VALUES (
      v_sale_id, NULLIF(v_item->>'item_template_id', '')::uuid,
      NULLIF(v_item->>'company_product_id', '')::uuid,
      NULLIF(v_item->>'product_template_id', '')::uuid,
      v_item->>'item_name', COALESCE(v_item->>'item_unit', 'un'),
      (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      (v_item->>'total_price')::numeric, v_item->>'notes',
      NULLIF(v_item->>'width', '')::numeric, NULLIF(v_item->>'height', '')::numeric,
      v_snapshot->>'composition_mode', v_snapshot->>'fulfillment_mode',
      v_snapshot, COALESCE((v_snapshot->>'snapshot_version')::integer, 2)
    ) RETURNING id INTO v_sale_item_id;
    v_sale_item_ids := v_sale_item_ids || jsonb_build_array(v_sale_item_id);
  END LOOP;

  v_fulfillment := public.phase3c_fulfill_sale(v_sale_id, 'normal', NULL, _notes);

  IF v_paid > 0 THEN
    INSERT INTO public.accounts_receivable (
      company_id, sale_id, customer_name, description, total_amount,
      installment_number, total_installments, due_date, paid_date,
      paid_amount, status, payment_method, receivable_type, created_by
    ) VALUES (
      _company_id, v_sale_id, COALESCE(NULLIF(btrim(_customer_name), ''), 'Consumidor'),
      format('Pagamento - Venda #%s', v_sale_number), v_paid, 0, 0,
      current_date, current_date, v_paid, 'paid', v_payment_method,
      'venda_direta', v_user_id
    ) RETURNING id INTO v_receivable_id;

    INSERT INTO public.cash_movements (
      company_id, cash_register_id, type, category, amount, description,
      payment_method, receivable_id, sale_id, created_by, origem, operation_key
    ) VALUES (
      _company_id, _cash_register_id, 'entrada', 'venda', v_paid,
      format('Venda #%s - %s', v_sale_number, COALESCE(NULLIF(btrim(_customer_name), ''), 'Consumidor')),
      v_payment_method, v_receivable_id, v_sale_id, v_user_id, 'venda', _operation_key
    ) RETURNING id INTO v_cash_movement_id;
  END IF;

  IF v_pending > 0 THEN
    FOR v_installment IN SELECT value FROM jsonb_array_elements(v_installments)
    LOOP
      INSERT INTO public.accounts_receivable (
        company_id, sale_id, customer_name, description, total_amount,
        installment_number, total_installments, due_date, paid_amount,
        status, payment_method, receivable_type, created_by
      ) VALUES (
        _company_id, v_sale_id, COALESCE(NULLIF(btrim(_customer_name), ''), 'Consumidor'),
        format('Venda #%s - Parcela %s/%s', v_sale_number,
          COALESCE((v_installment->>'number')::integer, 1), v_installments_count),
        (v_installment->>'amount')::numeric,
        COALESCE((v_installment->>'number')::integer, 1), v_installments_count,
        (v_installment->>'due_date')::date, 0, 'pending', v_payment_method,
        'venda_direta', v_user_id
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent_replay', false,
    'sale_id', v_sale_id, 'sale_number', v_sale_number,
    'sale_item_ids', v_sale_item_ids,
    'ordem_servico_id', v_fulfillment->'ordem_servico_id',
    'cash_movement_id', v_cash_movement_id,
    'paid_amount', v_paid, 'pending_amount', v_pending,
    'fulfillment', v_fulfillment
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_direct_sale_transactional(
  uuid, uuid, text, jsonb, jsonb, numeric, numeric, numeric, numeric, uuid, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_direct_sale_transactional(
  uuid, uuid, text, jsonb, jsonb, numeric, numeric, numeric, numeric, uuid, uuid, text
) TO authenticated, service_role;
