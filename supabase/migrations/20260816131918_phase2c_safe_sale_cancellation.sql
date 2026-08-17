-- Phase 2C: make sale cancellation auditable, reversible and idempotent.

CREATE OR REPLACE FUNCTION public.cancel_sale(
  p_sale_id uuid,
  p_company_id uuid,
  p_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale public.sales%ROWTYPE;
  v_cash public.cash_movements%ROWTYPE;
  v_stock public.stock_movements%ROWTYPE;
  v_reversal_ids jsonb := '[]'::jsonb;
  v_stock_reversal_ids jsonb := '[]'::jsonb;
  v_reversal_id uuid;
  v_updated integer;
  v_quote_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  IF p_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Authenticated user mismatch';
  END IF;

  SELECT * INTO v_sale
    FROM public.sales
   WHERE id = p_sale_id AND company_id = p_company_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Sale not found';
  END IF;
  IF NOT public.user_has_elevated_role_in_company(v_user_id, v_sale.company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Elevated company role required';
  END IF;
  IF v_sale.payment_status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'sale_id', v_sale.id,
      'sale_number', v_sale.sale_number
    );
  END IF;

  -- Approved quotes have their own canonical reversal, including OS materials and deposits.
  IF v_sale.quote_id IS NOT NULL THEN
    v_quote_result := public.cancel_approved_quote(v_sale.quote_id);
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', COALESCE((v_quote_result->>'idempotent_replay')::boolean, false),
      'sale_id', v_sale.id,
      'sale_number', v_sale.sale_number,
      'quote_cancellation', v_quote_result
    );
  END IF;

  IF v_sale.ordem_servico_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.material_consumption
       WHERE ordem_servico_id = v_sale.ordem_servico_id AND status = 'consumed'
    ) OR EXISTS (
      SELECT 1 FROM public.stock_reservations
       WHERE ordem_servico_id = v_sale.ordem_servico_id AND status = 'consumed'
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Cannot cancel a sale with consumed production materials';
  END IF;

  IF COALESCE(v_sale.paid_amount, 0) > 0 AND NOT EXISTS (
    SELECT 1 FROM public.cash_movements
     WHERE sale_id = v_sale.id AND type = 'entrada'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Financial reversal source not found';
  END IF;

  -- Preserve the original ledger and append one explicit refund for every receipt.
  FOR v_cash IN
    SELECT * FROM public.cash_movements
     WHERE sale_id = v_sale.id AND type = 'entrada'
     ORDER BY created_at, id
     FOR UPDATE
  LOOP
    IF v_cash.cash_register_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.cash_registers
       WHERE id = v_cash.cash_register_id AND status = 'open'
       FOR UPDATE
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Open original cash register required for refund';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.cash_movements
       WHERE company_id = v_sale.company_id
         AND origem = 'estorno_venda:' || v_cash.id::text
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.cash_movements (
      company_id, cash_register_id, type, category, amount, description,
      payment_method, receivable_id, sale_id, created_by, origem,
      cliente_id, party_type, party_id, party_name
    ) VALUES (
      v_sale.company_id, v_cash.cash_register_id, 'saida', 'estorno', v_cash.amount,
      format('Estorno - Venda #%s', v_sale.sale_number), v_cash.payment_method,
      v_cash.receivable_id, v_sale.id, v_user_id, 'estorno_venda:' || v_cash.id::text,
      v_cash.cliente_id, v_cash.party_type, v_cash.party_id, v_cash.party_name
    ) RETURNING id INTO v_reversal_id;
    v_reversal_ids := v_reversal_ids || to_jsonb(v_reversal_id);
  END LOOP;

  -- Restore only stock that has a traceable canonical outgoing movement.
  FOR v_stock IN
    SELECT * FROM public.stock_movements
     WHERE company_id = v_sale.company_id
       AND type = 'saida'
       AND (sale_id = v_sale.id OR (reference_id = v_sale.id AND reference_type = 'sale'))
     ORDER BY created_at, id
     FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.stock_movements
       WHERE reference_id = v_stock.id AND reference_type = 'sale_cancellation'
    ) THEN
      CONTINUE;
    END IF;

    UPDATE public.company_stock
       SET quantity = quantity + v_stock.quantity, updated_at = now()
     WHERE company_id = v_sale.company_id
       AND (v_stock.company_item_id IS NULL OR company_item_id = v_stock.company_item_id)
       AND (v_stock.item_template_id IS NULL OR item_template_id = v_stock.item_template_id);
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Canonical stock row not found for sale reversal';
    END IF;

    INSERT INTO public.stock_movements (
      company_id, type, category, quantity, unit_cost, description,
      created_by, company_item_id, item_template_id, sale_id,
      reference_id, reference_type
    ) VALUES (
      v_sale.company_id, 'entrada', 'devolucao', v_stock.quantity, v_stock.unit_cost,
      format('Estorno - Venda #%s', v_sale.sale_number), v_user_id,
      v_stock.company_item_id, v_stock.item_template_id, v_sale.id,
      v_stock.id, 'sale_cancellation'
    ) RETURNING id INTO v_reversal_id;
    v_stock_reversal_ids := v_stock_reversal_ids || to_jsonb(v_reversal_id);
  END LOOP;

  UPDATE public.stock_reservations
     SET status = 'cancelled', quantity_reserved = 0, cancelled_at = now(), updated_at = now()
   WHERE ordem_servico_id = v_sale.ordem_servico_id AND status = 'reserved';
  UPDATE public.material_consumption
     SET status = 'cancelled', updated_at = now()
   WHERE ordem_servico_id = v_sale.ordem_servico_id AND status IN ('pending', 'available');
  UPDATE public.ordens_servico
     SET status = 'cancelled', updated_at = now()
   WHERE id = v_sale.ordem_servico_id;
  UPDATE public.accounts_receivable
     SET status = 'cancelled', updated_at = now()
   WHERE sale_id = v_sale.id AND status <> 'cancelled';
  UPDATE public.employee_commissions
     SET status = 'cancelled', updated_at = now()
   WHERE sale_id = v_sale.id AND status <> 'cancelled';
  UPDATE public.sales
     SET payment_status = 'cancelled',
         notes = concat_ws(E'\n', NULLIF(notes, ''),
           'Cancelado: ' || COALESCE(NULLIF(p_reason, ''), 'sem motivo informado')),
         updated_at = now()
   WHERE id = v_sale.id;

  INSERT INTO public.audit_logs (company_id, user_id, action, table_name, record_id, metadata)
  VALUES (
    v_sale.company_id, v_user_id, 'update', 'sales', v_sale.id,
    jsonb_build_object(
      'operation', 'CANCEL_SALE', 'reason', p_reason,
      'sale_number', v_sale.sale_number, 'cash_reversals', v_reversal_ids,
      'stock_reversals', v_stock_reversal_ids
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'sale_id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'cash_reversal_ids', v_reversal_ids,
    'stock_reversal_ids', v_stock_reversal_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_sale(uuid, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid, uuid, uuid, text) TO authenticated, service_role;
