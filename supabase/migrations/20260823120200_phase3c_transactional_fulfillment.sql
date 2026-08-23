-- Phase 3C / Etapa B
-- Transactional fulfillment for quote approval and direct sales.

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_phase3c_sale_material_unique
  ON public.stock_movements (reference_id, company_item_id, category)
  WHERE reference_type = 'sale_item' AND category = 'venda_direta';

CREATE OR REPLACE FUNCTION public.phase3c_fulfill_sale(
  _sale_id uuid,
  _priority text DEFAULT 'normal',
  _estimated_end date DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sale record;
  v_quote record;
  v_sale_item record;
  v_material jsonb;
  v_company_item_id uuid;
  v_quantity numeric;
  v_stock record;
  v_os_id uuid;
  v_os_number integer;
  v_os_item_id uuid;
  v_has_os boolean;
  v_reservations jsonb := NULL;
  v_immediate_movements integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  SELECT s.* INTO v_sale FROM public.sales s WHERE s.id = _sale_id FOR UPDATE;
  IF v_sale.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'SALE_NOT_FOUND';
  END IF;
  IF NOT public.user_belongs_to_company(v_user_id, v_sale.company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  SELECT q.* INTO v_quote FROM public.quotes q WHERE q.id = v_sale.quote_id;
  SELECT EXISTS (
    SELECT 1 FROM public.sale_items si
    WHERE si.sale_id = _sale_id AND si.fulfillment_mode IN ('PRODUCTION', 'SERVICE')
  ) INTO v_has_os;

  IF v_has_os THEN
    SELECT os.id, os.os_number INTO v_os_id, v_os_number
    FROM public.ordens_servico os
    WHERE os.sale_id = _sale_id AND os.status <> 'cancelled'
    ORDER BY os.created_at LIMIT 1;
    IF v_os_id IS NULL THEN
      v_os_number := public.get_next_document_number(v_sale.company_id, 'OS');
      INSERT INTO public.ordens_servico (
        company_id, quote_id, sale_id, os_number, customer_name, customer_phone,
        customer_email, customer_address, status, priority, estimated_end,
        total_amount, paid_amount, pending_amount, notes, current_stage
      ) VALUES (
        v_sale.company_id, v_sale.quote_id, v_sale.id, v_os_number,
        COALESCE(v_quote.customer_name, v_sale.customer_name, 'Consumidor'),
        v_quote.customer_phone, v_quote.customer_email, v_quote.customer_address,
        'pending', COALESCE(_priority, 'normal'), _estimated_end,
        v_sale.total_amount, v_sale.paid_amount, v_sale.pending_amount,
        _notes, 'Aguardando início'
      ) RETURNING id INTO v_os_id;
      UPDATE public.sales SET ordem_servico_id = v_os_id WHERE id = _sale_id;
    END IF;
  END IF;

  FOR v_sale_item IN
    SELECT si.* FROM public.sale_items si WHERE si.sale_id = _sale_id ORDER BY si.created_at, si.id
  LOOP
    PERFORM public.phase3c_validate_engineering_snapshot(
      v_sale_item.engineering_snapshot, v_sale_item.fulfillment_mode
    );

    IF v_sale_item.fulfillment_mode = 'IMMEDIATE' THEN
      FOR v_material IN
        SELECT value FROM jsonb_array_elements(v_sale_item.engineering_snapshot->'materials')
      LOOP
        IF COALESCE(v_material->>'supply_mode', 'INTERNAL_STOCK') = 'DEDICATED_PURCHASE' THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PURCHASE_REQUIRED';
        END IF;
        v_company_item_id := NULLIF(v_material->>'company_item_id', '')::uuid;
        v_quantity := NULLIF(v_material->>'quantity', '')::numeric;
        IF v_company_item_id IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
        END IF;
        IF v_quantity IS NULL OR v_quantity <= 0 THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
        END IF;

        SELECT cs.* INTO v_stock
        FROM public.company_stock cs
        WHERE cs.company_id = v_sale.company_id
          AND cs.company_item_id = v_company_item_id
          AND cs.is_active = true
        FOR UPDATE;
        IF v_stock.id IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_STOCK';
        END IF;
        IF v_stock.quantity < v_quantity THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INSUFFICIENT_STOCK',
            DETAIL = jsonb_build_object('company_item_id', v_company_item_id,
              'required', v_quantity, 'available', v_stock.quantity)::text;
        END IF;

        UPDATE public.company_stock
        SET quantity = quantity - v_quantity, updated_at = now()
        WHERE id = v_stock.id AND quantity >= v_quantity;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'INSUFFICIENT_STOCK';
        END IF;

        INSERT INTO public.stock_movements (
          company_id, company_item_id, item_template_id, type, category,
          quantity, unit_cost, valor_financeiro, description,
          reference_id, reference_type, created_by
        ) VALUES (
          v_sale.company_id, v_company_item_id,
          NULLIF(v_material->>'item_template_id', '')::uuid,
          'saida', 'venda_direta', v_quantity,
          COALESCE(NULLIF(v_material->>'cost', '')::numeric / NULLIF(v_quantity, 0), 0),
          COALESCE(NULLIF(v_material->>'cost', '')::numeric, 0),
          'Venda imediata - ' || COALESCE(v_material->>'item_name', v_sale_item.item_name),
          v_sale_item.id, 'sale_item', v_user_id
        ) ON CONFLICT (reference_id, company_item_id, category)
          WHERE reference_type = 'sale_item' AND category = 'venda_direta'
        DO NOTHING;
        IF FOUND THEN v_immediate_movements := v_immediate_movements + 1; END IF;
      END LOOP;
    ELSE
      INSERT INTO public.os_items (
        os_id, quote_item_id, sale_item_id, product_name, product_id, quantity,
        width_sold, height_sold, width_production, height_production,
        largura_venda, altura_venda, largura_producao, altura_producao,
        fulfillment_mode, engineering_snapshot, snapshot_version, technical_notes
      ) VALUES (
        v_os_id, v_sale_item.source_quote_item_id, v_sale_item.id,
        v_sale_item.item_name, v_sale_item.product_template_id,
        v_sale_item.quantity::integer,
        COALESCE(v_sale_item.width, (v_sale_item.engineering_snapshot#>>'{inputs,L}')::numeric, 0),
        COALESCE(v_sale_item.height, (v_sale_item.engineering_snapshot#>>'{inputs,A}')::numeric, 0),
        COALESCE((v_sale_item.engineering_snapshot#>>'{inputs,L}')::numeric, v_sale_item.width, 0),
        COALESCE((v_sale_item.engineering_snapshot#>>'{inputs,A}')::numeric, v_sale_item.height, 0),
        COALESCE(v_sale_item.width, 0), COALESCE(v_sale_item.height, 0),
        COALESCE((v_sale_item.engineering_snapshot#>>'{inputs,L}')::numeric, v_sale_item.width, 0),
        COALESCE((v_sale_item.engineering_snapshot#>>'{inputs,A}')::numeric, v_sale_item.height, 0),
        v_sale_item.fulfillment_mode, v_sale_item.engineering_snapshot,
        v_sale_item.snapshot_version, v_sale_item.notes
      )
      ON CONFLICT (sale_item_id) WHERE sale_item_id IS NOT NULL
      DO UPDATE SET engineering_snapshot = EXCLUDED.engineering_snapshot,
        snapshot_version = EXCLUDED.snapshot_version
      RETURNING id INTO v_os_item_id;
    END IF;
  END LOOP;

  IF v_os_id IS NOT NULL THEN
    PERFORM public.rebuild_os_documents_from_snapshot(v_os_id, NULL);
    IF EXISTS (
      SELECT 1 FROM public.os_items oi
      WHERE oi.os_id = v_os_id AND oi.fulfillment_mode = 'PRODUCTION'
    ) THEN
      v_reservations := public.reserve_os_materials(v_os_id);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'ordem_servico_id', v_os_id, 'os_number', v_os_number,
    'immediate_stock_movements', v_immediate_movements,
    'reservations', v_reservations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.phase3c_fulfill_sale(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase3c_fulfill_sale(uuid, text, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_dedicated_glass_purchase_order(
  _ordem_servico_id uuid,
  _supplier_name text,
  _lines jsonb,
  _expected_delivery date DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_order_id uuid;
  v_order_number integer;
  v_line jsonb;
  v_piece record;
  v_item_id uuid;
  v_allocation_id uuid;
  v_estimated numeric;
  v_total numeric := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PURCHASE_LINES_REQUIRED';
  END IF;
  SELECT os.company_id INTO v_company_id
  FROM public.ordens_servico os WHERE os.id = _ordem_servico_id FOR UPDATE;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;
  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  INSERT INTO public.purchase_orders (
    company_id, ordem_servico_id, supplier_name, status,
    total_estimated, expected_delivery, notes, created_by
  ) VALUES (
    v_company_id, _ordem_servico_id, NULLIF(btrim(_supplier_name), ''),
    'ordered', 0, _expected_delivery, _notes, v_user_id
  ) RETURNING id, order_number INTO v_order_id, v_order_number;

  FOR v_line IN SELECT value FROM jsonb_array_elements(_lines)
  LOOP
    SELECT gp.* INTO v_piece
    FROM public.os_glass_pieces gp
    WHERE gp.id = NULLIF(v_line->>'piece_id', '')::uuid
      AND gp.company_id = v_company_id
      AND gp.ordem_servico_id = _ordem_servico_id
      AND gp.supply_mode = 'DEDICATED_PURCHASE'
      AND gp.status = 'PENDING'
    FOR UPDATE;
    IF v_piece.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INVALID_GLASS_PIECE';
    END IF;
    v_estimated := COALESCE(NULLIF(v_line->>'estimated_cost', '')::numeric, 0);
    IF v_estimated < 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PURCHASE_COST';
    END IF;

    INSERT INTO public.purchase_order_items (
      purchase_order_id, item_template_id, description, quantity, unit,
      width_mm, height_mm, estimated_cost, status
    ) VALUES (
      v_order_id, v_piece.item_template_id,
      format('%s - %sx%smm - %s', v_piece.piece_code, v_piece.width_mm,
        v_piece.height_mm, COALESCE(v_piece.color, 'sem cor')),
      v_piece.quantity, 'un', v_piece.width_mm, v_piece.height_mm,
      v_estimated, 'pending'
    ) RETURNING id INTO v_item_id;

    INSERT INTO public.purchase_order_item_glass_pieces (
      company_id, purchase_order_item_id, os_glass_piece_id, allocated_quantity
    ) VALUES (v_company_id, v_item_id, v_piece.id, v_piece.quantity)
    RETURNING id INTO v_allocation_id;

    UPDATE public.os_glass_pieces SET status = 'ORDERED', updated_at = now()
    WHERE id = v_piece.id;
    v_total := v_total + v_estimated;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'purchase_order_item_id', v_item_id, 'allocation_id', v_allocation_id,
      'piece_id', v_piece.id
    ));
  END LOOP;

  UPDATE public.purchase_orders SET total_estimated = v_total WHERE id = v_order_id;
  RETURN jsonb_build_object('success', true, 'purchase_order_id', v_order_id,
    'order_number', v_order_number, 'items', v_items, 'total_estimated', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.create_dedicated_glass_purchase_order(uuid, text, jsonb, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_dedicated_glass_purchase_order(uuid, text, jsonb, date, text)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.receive_dedicated_glass_pieces(
  _purchase_order_id uuid,
  _receipts jsonb,
  _total_actual numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order record;
  v_receipt jsonb;
  v_allocation record;
  v_requested numeric;
  v_delta numeric;
  v_actual_cost numeric;
  v_changed integer := 0;
  v_all_received boolean;
  v_any_received boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  IF _receipts IS NULL OR jsonb_typeof(_receipts) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'RECEIPTS_REQUIRED';
  END IF;
  SELECT po.* INTO v_order FROM public.purchase_orders po
  WHERE po.id = _purchase_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Purchase order not found';
  END IF;
  IF NOT public.user_belongs_to_company(v_user_id, v_order.company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Cancelled purchase orders cannot be received';
  END IF;

  FOR v_receipt IN SELECT value FROM jsonb_array_elements(_receipts)
  LOOP
    SELECT a.*, gp.ordem_servico_id, gp.status AS piece_status
    INTO v_allocation
    FROM public.purchase_order_item_glass_pieces a
    JOIN public.purchase_order_items poi ON poi.id = a.purchase_order_item_id
    JOIN public.os_glass_pieces gp ON gp.id = a.os_glass_piece_id
    WHERE a.id = NULLIF(v_receipt->>'allocation_id', '')::uuid
      AND poi.purchase_order_id = _purchase_order_id
      AND a.company_id = v_order.company_id
    FOR UPDATE OF a, gp, poi;
    IF v_allocation.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_GLASS_PIECE';
    END IF;
    v_requested := NULLIF(v_receipt->>'received_quantity', '')::numeric;
    v_actual_cost := COALESCE(NULLIF(v_receipt->>'actual_cost', '')::numeric, 0);
    IF v_requested IS NULL OR v_requested < v_allocation.received_quantity
       OR v_requested > v_allocation.allocated_quantity THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_RECEIVED_QUANTITY';
    END IF;
    v_delta := v_requested - v_allocation.received_quantity;
    IF v_delta = 0 THEN CONTINUE; END IF;

    UPDATE public.purchase_order_item_glass_pieces
    SET received_quantity = v_requested, updated_at = now()
    WHERE id = v_allocation.id;

    UPDATE public.os_glass_pieces gp
    SET received_quantity = totals.received,
        status = CASE WHEN totals.received >= gp.quantity THEN 'RECEIVED'
          WHEN totals.received > 0 THEN 'PARTIAL' ELSE 'ORDERED' END,
        updated_at = now()
    FROM (
      SELECT os_glass_piece_id, sum(received_quantity) AS received
      FROM public.purchase_order_item_glass_pieces
      WHERE os_glass_piece_id = v_allocation.os_glass_piece_id
      GROUP BY os_glass_piece_id
    ) totals
    WHERE gp.id = totals.os_glass_piece_id;

    UPDATE public.purchase_order_items poi
    SET received_quantity = totals.received,
        actual_cost = v_actual_cost,
        status = CASE WHEN totals.received >= poi.quantity THEN 'received' ELSE 'pending' END,
        received_at = CASE WHEN totals.received >= poi.quantity THEN COALESCE(poi.received_at, now()) ELSE NULL END,
        updated_at = now()
    FROM (
      SELECT purchase_order_item_id, sum(received_quantity) AS received
      FROM public.purchase_order_item_glass_pieces
      WHERE purchase_order_item_id = v_allocation.purchase_order_item_id
      GROUP BY purchase_order_item_id
    ) totals
    WHERE poi.id = totals.purchase_order_item_id;
    v_changed := v_changed + 1;
  END LOOP;

  SELECT COALESCE(bool_and(poi.received_quantity >= poi.quantity), false),
         COALESCE(bool_or(poi.received_quantity > 0), false)
  INTO v_all_received, v_any_received
  FROM public.purchase_order_items poi WHERE poi.purchase_order_id = _purchase_order_id;

  UPDATE public.purchase_orders
  SET status = CASE WHEN v_all_received THEN 'received'
      WHEN v_any_received THEN 'partial' ELSE 'ordered' END,
      total_actual = COALESCE(_total_actual, total_actual),
      received_at = CASE WHEN v_all_received THEN COALESCE(received_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = _purchase_order_id;

  RETURN jsonb_build_object('success', true, 'changed', v_changed,
    'idempotent', v_changed = 0,
    'status', CASE WHEN v_all_received THEN 'received' WHEN v_any_received THEN 'partial' ELSE 'ordered' END);
END;
$$;

REVOKE ALL ON FUNCTION public.receive_dedicated_glass_pieces(uuid, jsonb, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_dedicated_glass_pieces(uuid, jsonb, numeric)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.phase3c_guard_dedicated_glass_production()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('in_progress', 'completed') AND OLD.status IS DISTINCT FROM NEW.status
     AND EXISTS (
       SELECT 1 FROM public.os_glass_pieces gp
       WHERE gp.ordem_servico_id = NEW.id
         AND gp.supply_mode = 'DEDICATED_PURCHASE'
         AND gp.status NOT IN ('RECEIVED', 'CONSUMED', 'CANCELLED')
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PURCHASE_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase3c_consume_dedicated_glass()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.os_glass_pieces
    SET status = 'CONSUMED', updated_at = now()
    WHERE ordem_servico_id = NEW.id AND status = 'RECEIVED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase3c_guard_dedicated_glass_production ON public.ordens_servico;
CREATE TRIGGER trg_phase3c_guard_dedicated_glass_production
BEFORE UPDATE OF status ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.phase3c_guard_dedicated_glass_production();

DROP TRIGGER IF EXISTS trg_phase3c_consume_dedicated_glass ON public.ordens_servico;
CREATE TRIGGER trg_phase3c_consume_dedicated_glass
AFTER UPDATE OF status ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.phase3c_consume_dedicated_glass();

REVOKE ALL ON FUNCTION public.phase3c_guard_dedicated_glass_production() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase3c_consume_dedicated_glass() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase3c_guard_dedicated_glass_production() TO service_role;
GRANT EXECUTE ON FUNCTION public.phase3c_consume_dedicated_glass() TO service_role;
