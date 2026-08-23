-- Phase 3D
-- Harmonize quote persistence and make immediate fulfillment safely replayable.

DROP INDEX IF EXISTS public.stock_movements_phase3c_sale_material_unique;

CREATE UNIQUE INDEX IF NOT EXISTS stock_movements_phase3d_sale_item_material_unique
  ON public.stock_movements (reference_id, company_item_id)
  WHERE reference_type = 'sale_item'
    AND type = 'saida'
    AND category = 'venda';

CREATE OR REPLACE FUNCTION public.save_quote_transactional(
  _company_id uuid,
  _quote_id uuid,
  _quote jsonb,
  _items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quote_id uuid;
  v_quote record;
  v_item jsonb;
  v_item_id uuid;
  v_existing public.quote_items%ROWTYPE;
  v_kept_ids uuid[] := ARRAY[]::uuid[];
  v_total numeric;
  v_discount numeric;
  v_final numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'AUTHENTICATION_REQUIRED';
  END IF;
  IF NOT public.user_belongs_to_company(v_user_id, _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN_COMPANY_SCOPE';
  END IF;
  IF _quote IS NULL OR jsonb_typeof(_quote) <> 'object'
     OR _items IS NULL OR jsonb_typeof(_items) <> 'array'
     OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'QUOTE_ITEMS_REQUIRED';
  END IF;
  IF NULLIF(_quote->>'customer_name', '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'CUSTOMER_REQUIRED';
  END IF;
  IF NULLIF(_quote->>'client_id', '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = (_quote->>'client_id')::uuid AND c.company_id = _company_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'CLIENT_COMPANY_MISMATCH';
  END IF;

  v_total := COALESCE((_quote->>'total_amount')::numeric, 0);
  v_discount := COALESCE((_quote->>'discount_amount')::numeric, 0);
  v_final := COALESCE((_quote->>'final_amount')::numeric, 0);
  IF v_total < 0 OR v_discount < 0 OR v_final < 0
     OR abs((v_total - v_discount) - v_final) > 0.01 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'QUOTE_TOTALS_MISMATCH';
  END IF;

  IF _quote_id IS NULL THEN
    INSERT INTO public.quotes (
      company_id, client_id, customer_name, customer_phone, customer_email,
      customer_address, customer_document, customer_document_type,
      customer_profession, customer_marital_status, payment_terms, valid_until,
      notes, total_amount, discount_percent, discount_amount, final_amount,
      show_measures_column, show_m2_column
    ) VALUES (
      _company_id, NULLIF(_quote->>'client_id', '')::uuid, _quote->>'customer_name',
      NULLIF(_quote->>'customer_phone', ''), NULLIF(_quote->>'customer_email', ''),
      NULLIF(_quote->>'customer_address', ''), NULLIF(_quote->>'customer_document', ''),
      COALESCE(NULLIF(_quote->>'customer_document_type', ''), 'fisica'),
      NULLIF(_quote->>'customer_profession', ''), NULLIF(_quote->>'customer_marital_status', ''),
      NULLIF(_quote->>'payment_terms', ''), NULLIF(_quote->>'valid_until', '')::date,
      NULLIF(_quote->>'notes', ''), v_total,
      COALESCE((_quote->>'discount_percent')::numeric, 0), v_discount, v_final,
      COALESCE((_quote->>'show_measures_column')::boolean, true),
      COALESCE((_quote->>'show_m2_column')::boolean, true)
    ) RETURNING id INTO v_quote_id;
  ELSE
    SELECT q.* INTO v_quote FROM public.quotes q WHERE q.id = _quote_id FOR UPDATE;
    IF v_quote.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'QUOTE_NOT_FOUND';
    END IF;
    IF v_quote.company_id <> _company_id THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN_COMPANY_SCOPE';
    END IF;
    IF v_quote.status <> 'pending' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'APPROVED_QUOTE_IS_IMMUTABLE';
    END IF;
    v_quote_id := v_quote.id;
    UPDATE public.quotes SET
      client_id = NULLIF(_quote->>'client_id', '')::uuid,
      customer_name = _quote->>'customer_name',
      customer_phone = NULLIF(_quote->>'customer_phone', ''),
      customer_email = NULLIF(_quote->>'customer_email', ''),
      customer_address = NULLIF(_quote->>'customer_address', ''),
      customer_document = NULLIF(_quote->>'customer_document', ''),
      customer_document_type = COALESCE(NULLIF(_quote->>'customer_document_type', ''), 'fisica'),
      customer_profession = NULLIF(_quote->>'customer_profession', ''),
      customer_marital_status = NULLIF(_quote->>'customer_marital_status', ''),
      payment_terms = NULLIF(_quote->>'payment_terms', ''),
      valid_until = NULLIF(_quote->>'valid_until', '')::date,
      notes = NULLIF(_quote->>'notes', ''), total_amount = v_total,
      discount_percent = COALESCE((_quote->>'discount_percent')::numeric, 0),
      discount_amount = v_discount, final_amount = v_final,
      show_measures_column = COALESCE((_quote->>'show_measures_column')::boolean, true),
      show_m2_column = COALESCE((_quote->>'show_m2_column')::boolean, true),
      updated_at = now()
    WHERE id = v_quote_id;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    IF COALESCE((v_item->>'quantity')::integer, 0) <= 0
       OR COALESCE((v_item->>'unit_price')::numeric, -1) < 0
       OR COALESCE((v_item->>'total_price')::numeric, -1) < 0
       OR NULLIF(v_item->>'description', '') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_QUOTE_ITEM';
    END IF;
    v_item_id := NULLIF(v_item->>'id', '')::uuid;
    IF v_item_id IS NOT NULL THEN
      SELECT qi.* INTO v_existing FROM public.quote_items qi
      WHERE qi.id = v_item_id AND qi.quote_id = v_quote_id FOR UPDATE;
      IF v_existing.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'QUOTE_ITEM_MISMATCH';
      END IF;

      IF v_existing.company_product_id IS NOT DISTINCT FROM NULLIF(v_item->>'company_product_id', '')::uuid
         AND v_existing.product_template_id IS NOT DISTINCT FROM NULLIF(v_item->>'product_template_id', '')::uuid
         AND v_existing.company_item_id IS NOT DISTINCT FROM NULLIF(v_item->>'company_item_id', '')::uuid
         AND v_existing.width IS NOT DISTINCT FROM NULLIF(v_item->>'width', '')::numeric
         AND v_existing.height IS NOT DISTINCT FROM NULLIF(v_item->>'height', '')::numeric
         AND v_existing.quantity IS NOT DISTINCT FROM (v_item->>'quantity')::integer
         AND v_existing.opening_width IS NOT DISTINCT FROM NULLIF(v_item->>'opening_width', '')::numeric
         AND v_existing.opening_height IS NOT DISTINCT FROM NULLIF(v_item->>'opening_height', '')::numeric
         AND v_existing.composition_snapshot IS NOT DISTINCT FROM NULLIF(v_item->>'composition_snapshot', '')::jsonb THEN
        UPDATE public.quote_items SET
          description = v_item->>'description', unit_price = (v_item->>'unit_price')::numeric,
          total_price = (v_item->>'total_price')::numeric, unit = NULLIF(v_item->>'unit', ''),
          notes = NULLIF(v_item->>'notes', ''), has_glass = COALESCE((v_item->>'has_glass')::boolean, false),
          glass_color = NULLIF(v_item->>'glass_color', ''), glass_thickness = NULLIF(v_item->>'glass_thickness', ''),
          aluminum_color = NULLIF(v_item->>'aluminum_color', ''),
          include_contramarco = COALESCE((v_item->>'include_contramarco')::boolean, true),
          excluded_optional_ids = COALESCE(v_item->'excluded_optional_ids', '[]'::jsonb)
        WHERE id = v_item_id;
      ELSE
        UPDATE public.quote_items SET
          company_product_id = NULLIF(v_item->>'company_product_id', '')::uuid,
          product_template_id = NULLIF(v_item->>'product_template_id', '')::uuid,
          company_item_id = NULLIF(v_item->>'company_item_id', '')::uuid,
          item_type = COALESCE(NULLIF(v_item->>'item_type', ''), 'product'),
          description = v_item->>'description', width = NULLIF(v_item->>'width', '')::numeric,
          height = NULLIF(v_item->>'height', '')::numeric, quantity = (v_item->>'quantity')::integer,
          opening_width = NULLIF(v_item->>'opening_width', '')::numeric,
          opening_height = NULLIF(v_item->>'opening_height', '')::numeric,
          width_b = NULLIF(v_item->>'width_b', '')::numeric, height_b = NULLIF(v_item->>'height_b', '')::numeric,
          opening_width_b = NULLIF(v_item->>'opening_width_b', '')::numeric,
          opening_height_b = NULLIF(v_item->>'opening_height_b', '')::numeric,
          width_c = NULLIF(v_item->>'width_c', '')::numeric, height_c = NULLIF(v_item->>'height_c', '')::numeric,
          opening_width_c = NULLIF(v_item->>'opening_width_c', '')::numeric,
          opening_height_c = NULLIF(v_item->>'opening_height_c', '')::numeric,
          leaves_count = COALESCE((v_item->>'leaves_count')::integer, 1),
          glasses_count = COALESCE((v_item->>'glasses_count')::integer, 1),
          panels_count = COALESCE((v_item->>'panels_count')::integer, 1),
          sides_count = COALESCE((v_item->>'sides_count')::integer, 1),
          unit_price = (v_item->>'unit_price')::numeric, total_price = (v_item->>'total_price')::numeric,
          unit = NULLIF(v_item->>'unit', ''), has_glass = COALESCE((v_item->>'has_glass')::boolean, false),
          glass_color = NULLIF(v_item->>'glass_color', ''), glass_thickness = NULLIF(v_item->>'glass_thickness', ''),
          aluminum_color = NULLIF(v_item->>'aluminum_color', ''),
          include_contramarco = COALESCE((v_item->>'include_contramarco')::boolean, true),
          excluded_optional_ids = COALESCE(v_item->'excluded_optional_ids', '[]'::jsonb),
          notes = NULLIF(v_item->>'notes', ''),
          composition_snapshot = v_item->'composition_snapshot'
        WHERE id = v_item_id;
      END IF;
    ELSE
      INSERT INTO public.quote_items (
        quote_id, company_product_id, product_template_id, company_item_id, item_type,
        description, width, height, quantity, opening_width, opening_height,
        width_b, height_b, opening_width_b, opening_height_b, width_c, height_c,
        opening_width_c, opening_height_c, leaves_count, glasses_count, panels_count,
        sides_count, unit_price, total_price, unit, has_glass, glass_color,
        glass_thickness, aluminum_color, include_contramarco, excluded_optional_ids,
        notes, composition_snapshot
      ) VALUES (
        v_quote_id, NULLIF(v_item->>'company_product_id', '')::uuid,
        NULLIF(v_item->>'product_template_id', '')::uuid, NULLIF(v_item->>'company_item_id', '')::uuid,
        COALESCE(NULLIF(v_item->>'item_type', ''), 'product'), v_item->>'description',
        NULLIF(v_item->>'width', '')::numeric, NULLIF(v_item->>'height', '')::numeric,
        (v_item->>'quantity')::integer, NULLIF(v_item->>'opening_width', '')::numeric,
        NULLIF(v_item->>'opening_height', '')::numeric, NULLIF(v_item->>'width_b', '')::numeric,
        NULLIF(v_item->>'height_b', '')::numeric, NULLIF(v_item->>'opening_width_b', '')::numeric,
        NULLIF(v_item->>'opening_height_b', '')::numeric, NULLIF(v_item->>'width_c', '')::numeric,
        NULLIF(v_item->>'height_c', '')::numeric, NULLIF(v_item->>'opening_width_c', '')::numeric,
        NULLIF(v_item->>'opening_height_c', '')::numeric, COALESCE((v_item->>'leaves_count')::integer, 1),
        COALESCE((v_item->>'glasses_count')::integer, 1), COALESCE((v_item->>'panels_count')::integer, 1),
        COALESCE((v_item->>'sides_count')::integer, 1), (v_item->>'unit_price')::numeric,
        (v_item->>'total_price')::numeric, NULLIF(v_item->>'unit', ''),
        COALESCE((v_item->>'has_glass')::boolean, false), NULLIF(v_item->>'glass_color', ''),
        NULLIF(v_item->>'glass_thickness', ''), NULLIF(v_item->>'aluminum_color', ''),
        COALESCE((v_item->>'include_contramarco')::boolean, true),
        COALESCE(v_item->'excluded_optional_ids', '[]'::jsonb), NULLIF(v_item->>'notes', ''),
        v_item->'composition_snapshot'
      ) RETURNING id INTO v_item_id;
    END IF;
    v_kept_ids := array_append(v_kept_ids, v_item_id);
  END LOOP;

  DELETE FROM public.quote_items qi
  WHERE qi.quote_id = v_quote_id AND NOT (qi.id = ANY(v_kept_ids));

  SELECT COALESCE(sum(qi.total_price), 0) INTO v_total
  FROM public.quote_items qi WHERE qi.quote_id = v_quote_id;
  IF abs(v_total - COALESCE((_quote->>'total_amount')::numeric, 0)) > 0.01 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'QUOTE_ITEMS_TOTAL_MISMATCH';
  END IF;

  RETURN jsonb_build_object('success', true, 'quote_id', v_quote_id,
    'item_count', cardinality(v_kept_ids));
END;
$$;

REVOKE ALL ON FUNCTION public.save_quote_transactional(uuid, uuid, jsonb, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_quote_transactional(uuid, uuid, jsonb, jsonb)
  TO authenticated, service_role;

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
        SELECT jsonb_build_object(
          'company_item_id', material->>'company_item_id',
          'item_template_id', max(material->>'item_template_id'),
          'item_name', max(material->>'item_name'),
          'quantity', sum((material->>'quantity')::numeric),
          'cost', sum(COALESCE((material->>'cost')::numeric, 0)),
          'supply_mode', max(COALESCE(material->>'supply_mode', 'INTERNAL_STOCK'))
        )
        FROM jsonb_array_elements(v_sale_item.engineering_snapshot->'materials') AS source(material)
        GROUP BY material->>'company_item_id'
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

        IF EXISTS (
          SELECT 1 FROM public.stock_movements sm
          WHERE sm.reference_type = 'sale_item' AND sm.reference_id = v_sale_item.id
            AND sm.company_item_id = v_company_item_id
            AND sm.type = 'saida' AND sm.category = 'venda'
        ) THEN
          CONTINUE;
        END IF;

        SELECT cs.* INTO v_stock
        FROM public.company_stock cs
        WHERE cs.company_id = v_sale.company_id
          AND cs.company_item_id = v_company_item_id AND cs.is_active = true
        FOR UPDATE;
        IF v_stock.id IS NULL THEN
          RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_STOCK';
        END IF;
        IF v_stock.quantity < v_quantity THEN
          RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INSUFFICIENT_STOCK',
            DETAIL = jsonb_build_object('company_item_id', v_company_item_id,
              'required', v_quantity, 'available', v_stock.quantity)::text;
        END IF;

        UPDATE public.company_stock SET quantity = quantity - v_quantity, updated_at = now()
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
          'saida', 'venda', v_quantity,
          COALESCE(NULLIF(v_material->>'cost', '')::numeric / NULLIF(v_quantity, 0), 0),
          COALESCE(NULLIF(v_material->>'cost', '')::numeric, 0),
          'Venda imediata - ' || COALESCE(v_material->>'item_name', v_sale_item.item_name),
          v_sale_item.id, 'sale_item', v_user_id
        ) ON CONFLICT (reference_id, company_item_id)
          WHERE reference_type = 'sale_item' AND type = 'saida' AND category = 'venda'
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

REVOKE ALL ON FUNCTION public.phase3c_fulfill_sale(uuid, text, date, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase3c_fulfill_sale(uuid, text, date, text)
  TO authenticated, service_role;
