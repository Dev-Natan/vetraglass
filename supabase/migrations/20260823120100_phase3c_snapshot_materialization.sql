-- Phase 3C / Etapa B
-- Freeze FIXED and PARAMETRIC authorship into one realized snapshot, then
-- materialize OS documents only from that snapshot.

CREATE OR REPLACE FUNCTION public.phase3c_build_fixed_snapshot(
  _product_template_id uuid,
  _company_id uuid,
  _width numeric,
  _height numeric,
  _quantity integer,
  _opening_width numeric DEFAULT NULL,
  _opening_height numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_template record;
  v_component record;
  v_company_item record;
  v_price record;
  v_materials jsonb := '[]'::jsonb;
  v_cuts jsonb := '[]'::jsonb;
  v_glass_pieces jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_width numeric;
  v_height numeric;
  v_pieces numeric;
  v_multiplier numeric;
  v_cut_length numeric;
  v_stock_quantity numeric;
  v_bar_length numeric;
  v_material_key text;
  v_supply_mode text;
  v_total_cost numeric := 0;
  v_total_price numeric := 0;
BEGIN
  IF _company_id IS NULL OR _product_template_id IS NULL
     OR COALESCE(_width, 0) <= 0 OR COALESCE(_height, 0) <= 0 OR COALESCE(_quantity, 0) <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;

  SELECT pt.* INTO v_template
  FROM public.product_templates pt
  WHERE pt.id = _product_template_id AND pt.is_active = true;
  IF v_template.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;

  FOR v_component IN
    SELECT pti.*, it.name AS template_name, it.type::text AS template_type,
           it.unit AS template_unit, it.bar_length_mm AS template_bar_length,
           it.glass_thickness, it.glass_color
    FROM public.product_template_items pti
    JOIN public.item_templates it ON it.id = pti.item_template_id AND it.is_active = true
    WHERE pti.product_template_id = _product_template_id
      AND pti.company_id IS NULL
    ORDER BY pti.created_at, pti.id
  LOOP
    SELECT ci.* INTO v_company_item
    FROM public.company_items ci
    WHERE ci.company_id = _company_id
      AND ci.item_template_id = v_component.item_template_id
      AND ci.is_active = true
    ORDER BY ci.id LIMIT 1;
    IF v_company_item.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM',
        DETAIL = v_component.item_template_id::text;
    END IF;

    SELECT cip.* INTO v_price
    FROM public.company_item_prices cip
    WHERE cip.company_id = _company_id
      AND cip.item_template_id = v_component.item_template_id;
    IF v_price.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE',
        DETAIL = v_component.item_template_id::text;
    END IF;

    IF NULLIF(btrim(COALESCE(v_component.condition_expression, '')), '') IS NOT NULL
       AND public.phase2a_eval_formula(v_component.condition_expression, _width, _height) = 0 THEN
      CONTINUE;
    END IF;

    v_width := CASE
      WHEN NULLIF(btrim(COALESCE(v_component.piece_width_formula, v_component.width_formula, '')), '') IS NULL THEN NULL
      ELSE public.phase2a_eval_formula(COALESCE(v_component.piece_width_formula, v_component.width_formula), _width, _height)
    END;
    v_height := CASE
      WHEN NULLIF(btrim(COALESCE(v_component.piece_height_formula, v_component.height_formula, '')), '') IS NULL THEN NULL
      ELSE public.phase2a_eval_formula(COALESCE(v_component.piece_height_formula, v_component.height_formula), _width, _height)
    END;
    IF (v_width IS NOT NULL AND v_width <= 0) OR (v_height IS NOT NULL AND v_height <= 0) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE',
        DETAIL = v_component.id::text;
    END IF;

    v_pieces := GREATEST(COALESCE(v_component.pieces_quantity, 1), 1);
    IF NULLIF(btrim(COALESCE(v_component.pieces_formula, '')), '') IS NOT NULL THEN
      v_pieces := GREATEST(ceil(public.phase2a_eval_formula(v_component.pieces_formula, _width, _height)), 0);
    END IF;
    v_multiplier := 1;
    IF NULLIF(btrim(COALESCE(v_component.quantity_formula, '')), '') IS NOT NULL
       AND btrim(v_component.quantity_formula) <> '1' THEN
      v_multiplier := GREATEST(public.phase2a_eval_formula(v_component.quantity_formula, _width, _height), 0);
    END IF;
    v_pieces := round(v_pieces * v_multiplier * _quantity, 3);
    IF v_pieces <= 0 THEN CONTINUE; END IF;

    v_cut_length := COALESCE(v_width, v_height);
    v_bar_length := COALESCE(v_company_item.bar_length_mm, v_component.template_bar_length, 6000);
    v_stock_quantity := CASE
      WHEN v_component.template_type = 'profile' AND v_cut_length IS NOT NULL
        THEN ceil((v_cut_length * v_pieces) / NULLIF(v_bar_length, 0))
      WHEN lower(COALESCE(v_component.template_unit, 'un')) IN ('m2', 'm²')
           AND v_width IS NOT NULL AND v_height IS NOT NULL
        THEN round((v_width * v_height * v_pieces) / 1000000, 3)
      WHEN lower(COALESCE(v_component.template_unit, 'un')) IN ('m', 'ml', 'metro', 'metros')
           AND v_cut_length IS NOT NULL
        THEN round((v_cut_length * v_pieces) / 1000, 3)
      ELSE v_pieces
    END;
    v_material_key := v_component.id::text;
    v_supply_mode := COALESCE(
      v_component.supply_mode,
      CASE WHEN v_component.template_type = 'glass' THEN 'INTERNAL_STOCK' ELSE 'INTERNAL_STOCK' END
    );

    v_materials := v_materials || jsonb_build_array(jsonb_build_object(
      'key', v_material_key,
      'item_template_id', v_component.item_template_id,
      'company_item_id', v_company_item.id,
      'item_name', v_company_item.name,
      'material_type', v_component.template_type,
      'unit', COALESCE(v_component.template_unit, 'un'),
      'quantity', v_stock_quantity,
      'engineering_quantity', v_pieces,
      'cut_length_mm', v_cut_length,
      'bar_length_mm', v_bar_length,
      'cost', round(v_stock_quantity * COALESCE(v_price.cost, 0), 2),
      'sale_price', round(v_stock_quantity * v_price.price, 2),
      'component_role', v_component.component_role,
      'technical_status', v_component.technical_status,
      'source_item_id', v_component.id,
      'supply_mode', v_supply_mode
    ));

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'id', v_component.id,
      'item_template_id', v_component.item_template_id,
      'component_role', v_component.component_role,
      'technical_status', v_component.technical_status,
      'source_type', v_component.source_type,
      'source_name', v_component.source_name,
      'source_page', v_component.source_page,
      'source_reference', v_component.source_reference
    ));

    IF v_component.template_type = 'profile' AND v_cut_length IS NOT NULL THEN
      v_cuts := v_cuts || jsonb_build_array(jsonb_build_object(
        'key', v_material_key,
        'item_template_id', v_component.item_template_id,
        'company_item_id', v_company_item.id,
        'item_name', v_company_item.name,
        'length_mm', v_cut_length,
        'quantity', v_pieces,
        'angle_start', v_component.cut_angle_start,
        'angle_end', v_component.cut_angle_end,
        'source_item_id', v_component.id
      ));
    END IF;

    IF v_component.template_type = 'glass' THEN
      IF v_width IS NULL OR v_height IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_GLASS_PIECE',
          DETAIL = v_component.id::text;
      END IF;
      v_glass_pieces := v_glass_pieces || jsonb_build_array(jsonb_build_object(
        'key', v_material_key,
        'item_template_id', v_component.item_template_id,
        'company_item_id', v_company_item.id,
        'piece_role', v_component.component_role,
        'width_mm', v_width,
        'height_mm', v_height,
        'quantity', v_pieces,
        'thickness', COALESCE(v_company_item.glass_thickness, v_component.glass_thickness),
        'color', COALESCE(v_company_item.glass_color, v_component.glass_color),
        'supply_mode', v_supply_mode,
        'source_item_id', v_component.id
      ));
    END IF;

    v_total_cost := v_total_cost + round(v_stock_quantity * COALESCE(v_price.cost, 0), 2);
    v_total_price := v_total_price + round(v_stock_quantity * v_price.price, 2);
  END LOOP;

  RETURN jsonb_build_object(
    'composition_mode', 'fixed',
    'fulfillment_mode', v_template.fulfillment_mode,
    'engine_version', 2,
    'snapshot_version', 2,
    'product_template_id', _product_template_id,
    'inputs', jsonb_build_object(
      'VW', COALESCE(_opening_width, _width + v_template.installation_gap_width_mm),
      'VH', COALESCE(_opening_height, _height + v_template.installation_gap_height_mm),
      'L', _width,
      'A', _height,
      'width_mm', _width,
      'height_mm', _height,
      'quantity', _quantity,
      'installation_gap_width_mm', v_template.installation_gap_width_mm,
      'installation_gap_height_mm', v_template.installation_gap_height_mm,
      'variants', '{}'::jsonb
    ),
    'variants', '{}'::jsonb,
    'materials', v_materials,
    'glass_pieces', v_glass_pieces,
    'cuts', v_cuts,
    'rules', '[]'::jsonb,
    'rule_versions', '[]'::jsonb,
    'items', v_items,
    'totals', jsonb_build_object(
      'cost', round(v_total_cost, 2),
      'sale_price', round(v_total_price, 2),
      'margin', round(v_total_price - v_total_cost, 2),
      'missing_cost_items', 0,
      'missing_price_items', 0
    ),
    'warnings', '[]'::jsonb,
    'frozen_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.phase3c_build_fixed_snapshot(uuid, uuid, numeric, numeric, integer, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase3c_build_fixed_snapshot(uuid, uuid, numeric, numeric, integer, numeric, numeric)
  TO service_role;

CREATE OR REPLACE FUNCTION public.build_fixed_engineering_snapshot(
  _company_id uuid,
  _product_template_id uuid,
  _width numeric,
  _height numeric,
  _quantity integer,
  _opening_width numeric DEFAULT NULL,
  _opening_height numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  IF NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;
  RETURN public.phase3c_build_fixed_snapshot(
    _product_template_id, _company_id, _width, _height, _quantity,
    _opening_width, _opening_height
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_fixed_engineering_snapshot(uuid, uuid, numeric, numeric, integer, numeric, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.build_fixed_engineering_snapshot(uuid, uuid, numeric, numeric, integer, numeric, numeric)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_freeze_quote_item_composition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mode text := 'fixed';
  v_fulfillment text := 'IMMEDIATE';
  v_template_id uuid;
  v_company_id uuid;
  v_quote_status text;
  v_company_item record;
  v_price record;
BEGIN
  SELECT q.company_id, q.status INTO v_company_id, v_quote_status
  FROM public.quotes q WHERE q.id = NEW.quote_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'QUOTE_NOT_FOUND';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.composition_snapshot IS DISTINCT FROM OLD.composition_snapshot
     AND v_quote_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'approved_quote_composition_is_immutable';
  END IF;

  v_template_id := NEW.product_template_id;
  IF v_template_id IS NULL AND NEW.company_product_id IS NOT NULL THEN
    SELECT cp.product_template_id INTO v_template_id
    FROM public.company_products cp
    WHERE cp.id = NEW.company_product_id AND cp.company_id = v_company_id;
  END IF;

  IF v_template_id IS NOT NULL THEN
    SELECT pt.composition_mode, pt.fulfillment_mode INTO v_mode, v_fulfillment
    FROM public.product_templates pt WHERE pt.id = v_template_id AND pt.is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_ENGINEERING_RULE';
    END IF;
    NEW.product_template_id := v_template_id;
    NEW.composition_mode := v_mode;
    NEW.fulfillment_mode := v_fulfillment;

    IF v_mode = 'parametric' THEN
      NEW.composition_snapshot := COALESCE(NEW.composition_snapshot, '{}'::jsonb)
        || jsonb_build_object('fulfillment_mode', v_fulfillment);
      PERFORM public.phase3c_validate_engineering_snapshot(NEW.composition_snapshot, v_fulfillment);
      IF round(COALESCE((NEW.composition_snapshot#>>'{inputs,width_mm}')::numeric, -1), 3)
           <> round(COALESCE(NEW.width, -1), 3)
         OR round(COALESCE((NEW.composition_snapshot#>>'{inputs,height_mm}')::numeric, -1), 3)
           <> round(COALESCE(NEW.height, -1), 3)
         OR COALESCE((NEW.composition_snapshot#>>'{inputs,quantity}')::integer, -1)
           <> COALESCE(NEW.quantity, -1) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SNAPSHOT_INPUTS_MISMATCH';
      END IF;
    ELSE
      NEW.composition_snapshot := public.phase3c_build_fixed_snapshot(
        v_template_id, v_company_id, NEW.width, NEW.height, NEW.quantity,
        NEW.opening_width, NEW.opening_height
      );
    END IF;
  ELSIF NEW.company_item_id IS NOT NULL THEN
    SELECT ci.* INTO v_company_item
    FROM public.company_items ci
    WHERE ci.id = NEW.company_item_id AND ci.company_id = v_company_id AND ci.is_active = true;
    IF v_company_item.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
    END IF;
    SELECT cip.* INTO v_price
    FROM public.company_item_prices cip
    WHERE cip.company_id = v_company_id AND cip.item_template_id = v_company_item.item_template_id;
    IF v_price.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE';
    END IF;
    NEW.composition_mode := 'fixed';
    NEW.fulfillment_mode := CASE WHEN v_company_item.type = 'service' THEN 'SERVICE' ELSE 'IMMEDIATE' END;
    NEW.composition_snapshot := jsonb_build_object(
      'composition_mode', 'fixed', 'fulfillment_mode', NEW.fulfillment_mode,
      'engine_version', 2, 'snapshot_version', 2,
      'inputs', jsonb_build_object(
        'VW', COALESCE(NEW.opening_width, NEW.width), 'VH', COALESCE(NEW.opening_height, NEW.height),
        'L', NEW.width, 'A', NEW.height, 'width_mm', NEW.width, 'height_mm', NEW.height,
        'quantity', NEW.quantity, 'variants', '{}'::jsonb
      ),
      'variants', '{}'::jsonb,
      'materials', CASE WHEN NEW.fulfillment_mode = 'SERVICE' THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
        'key', NEW.company_item_id, 'item_template_id', v_company_item.item_template_id,
        'company_item_id', v_company_item.id, 'item_name', v_company_item.name,
        'material_type', v_company_item.type, 'unit', v_company_item.unit,
        'quantity', NEW.quantity, 'cost', NEW.quantity * COALESCE(v_price.cost, 0),
        'sale_price', NEW.quantity * v_price.price, 'supply_mode', 'INTERNAL_STOCK'
      )) END,
      'glass_pieces', '[]'::jsonb, 'cuts', '[]'::jsonb, 'rules', '[]'::jsonb,
      'rule_versions', '[]'::jsonb, 'items', '[]'::jsonb,
      'totals', jsonb_build_object('cost', NEW.quantity * COALESCE(v_price.cost, 0),
        'sale_price', NEW.quantity * v_price.price, 'margin', NEW.quantity * (v_price.price - COALESCE(v_price.cost, 0)),
        'missing_cost_items', 0, 'missing_price_items', 0),
      'warnings', '[]'::jsonb, 'frozen_at', now()
    );
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SNAPSHOT_MISSING';
  END IF;

  PERFORM public.phase3c_validate_engineering_snapshot(NEW.composition_snapshot, NEW.fulfillment_mode);
  NEW.snapshot_version := COALESCE((NEW.composition_snapshot->>'snapshot_version')::integer, 2);
  NEW.parametric_snapshot_version := CASE WHEN NEW.composition_mode = 'parametric' THEN NEW.snapshot_version ELSE NULL END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_quote_item_composition ON public.quote_items;
CREATE TRIGGER trg_freeze_quote_item_composition
BEFORE INSERT OR UPDATE OF product_template_id, company_product_id, company_item_id,
  composition_snapshot, width, height, quantity, opening_width, opening_height
ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_freeze_quote_item_composition();

REVOKE ALL ON FUNCTION public.trg_freeze_quote_item_composition() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_freeze_quote_item_composition() TO service_role;

CREATE OR REPLACE FUNCTION public.rebuild_os_documents_from_snapshot(
  _ordem_servico_id uuid,
  _os_item_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_item record;
  v_material jsonb;
  v_piece jsonb;
  v_snapshot jsonb;
  v_key text;
  v_material_count integer := 0;
  v_piece_count integer := 0;
  v_plan_count integer := 0;
BEGIN
  SELECT os.company_id INTO v_company_id
  FROM public.ordens_servico os
  WHERE os.id = _ordem_servico_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;
  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  FOR v_item IN
    SELECT oi.*, si.source_quote_item_id
    FROM public.os_items oi
    LEFT JOIN public.sale_items si ON si.id = oi.sale_item_id
    WHERE oi.os_id = _ordem_servico_id
      AND (_os_item_id IS NULL OR oi.id = _os_item_id)
    ORDER BY oi.id
  LOOP
    v_snapshot := v_item.engineering_snapshot;
    PERFORM public.phase3c_validate_engineering_snapshot(v_snapshot, v_item.fulfillment_mode);

    IF v_item.fulfillment_mode = 'PRODUCTION' THEN
      FOR v_material IN SELECT value FROM jsonb_array_elements(v_snapshot->'materials')
      LOOP
        v_key := COALESCE(NULLIF(v_material->>'key', ''), NULLIF(v_material->>'source_rule_id', ''), md5(v_material::text));
        INSERT INTO public.os_materials (
          ordem_servico_id, os_item_id, snapshot_key, item_template_id, company_item_id,
          item_name, item_type, cut_length_mm, pieces_count, total_length_mm,
          bar_length_mm, bars_needed, required_quantity, unit, notes,
          procurement_status, snapshot_payload
        ) VALUES (
          _ordem_servico_id, v_item.id, v_key,
          NULLIF(v_material->>'item_template_id', '')::uuid,
          NULLIF(v_material->>'company_item_id', '')::uuid,
          v_material->>'item_name', COALESCE(v_material->>'material_type', 'accessory'),
          NULLIF(v_material->>'cut_length_mm', '')::numeric::integer,
          GREATEST(ceil(COALESCE(NULLIF(v_material->>'engineering_quantity', '')::numeric,
            NULLIF(v_material->>'quantity', '')::numeric, 1)), 1)::integer,
          CASE WHEN NULLIF(v_material->>'cut_length_mm', '') IS NULL THEN NULL
            ELSE round((v_material->>'cut_length_mm')::numeric * COALESCE(
              NULLIF(v_material->>'engineering_quantity', '')::numeric,
              NULLIF(v_material->>'quantity', '')::numeric, 1))::integer END,
          COALESCE(NULLIF(v_material->>'bar_length_mm', '')::numeric, 6000)::integer,
          CASE WHEN v_material->>'material_type' = 'profile'
            THEN NULLIF(v_material->>'quantity', '')::numeric ELSE NULL END,
          (v_material->>'quantity')::numeric,
          COALESCE(v_material->>'unit', 'un'),
          'Derivado do snapshot comercial imutável',
          CASE WHEN v_material->>'supply_mode' = 'DEDICATED_PURCHASE' THEN 'pending_purchase' ELSE 'pending_purchase' END,
          v_material
        )
        ON CONFLICT (ordem_servico_id, os_item_id, snapshot_key)
          WHERE snapshot_key IS NOT NULL
        DO UPDATE SET snapshot_payload = EXCLUDED.snapshot_payload,
          required_quantity = EXCLUDED.required_quantity;

        IF COALESCE(v_material->>'supply_mode', 'INTERNAL_STOCK') <> 'DEDICATED_PURCHASE' THEN
          INSERT INTO public.material_consumption (
            company_id, ordem_servico_id, quote_item_id, os_item_id, snapshot_key,
            company_item_id, item_template_id, item_name, item_type, unit,
            quantity_calculated, formula_used, input_width, input_height,
            input_quantity, status, snapshot_payload
          ) VALUES (
            v_company_id, _ordem_servico_id, v_item.source_quote_item_id, v_item.id, v_key,
            NULLIF(v_material->>'company_item_id', '')::uuid,
            NULLIF(v_material->>'item_template_id', '')::uuid,
            v_material->>'item_name', COALESCE(v_material->>'material_type', 'accessory'),
            COALESCE(v_material->>'unit', 'un'), (v_material->>'quantity')::numeric,
            NULL, v_item.width_production, v_item.height_production, v_item.quantity,
            'pending', v_material
          )
          ON CONFLICT (ordem_servico_id, os_item_id, snapshot_key)
            WHERE snapshot_key IS NOT NULL
          DO UPDATE SET snapshot_payload = EXCLUDED.snapshot_payload,
            quantity_calculated = EXCLUDED.quantity_calculated
          WHERE public.material_consumption.status IN ('pending', 'available');
        END IF;
        v_material_count := v_material_count + 1;
      END LOOP;

      INSERT INTO public.os_cutting_plan (
        ordem_servico_id, os_item_id, sale_item_id, quote_item_id, product_name,
        product_template_id, vao_width, vao_height, quantity, cuts_data,
        glass_cuts_data, status, engineering_snapshot, snapshot_version
      ) VALUES (
        _ordem_servico_id, v_item.id, v_item.sale_item_id, v_item.source_quote_item_id,
        v_item.product_name, v_item.product_id, v_item.width_production::integer,
        v_item.height_production::integer, v_item.quantity,
        v_snapshot->'cuts', v_snapshot->'glass_pieces', 'pending', v_snapshot,
        COALESCE((v_snapshot->>'snapshot_version')::integer, 2)
      )
      ON CONFLICT (os_item_id) WHERE os_item_id IS NOT NULL
      DO UPDATE SET cuts_data = EXCLUDED.cuts_data,
        glass_cuts_data = EXCLUDED.glass_cuts_data,
        engineering_snapshot = EXCLUDED.engineering_snapshot,
        snapshot_version = EXCLUDED.snapshot_version;
      v_plan_count := v_plan_count + 1;

      FOR v_piece IN SELECT value FROM jsonb_array_elements(v_snapshot->'glass_pieces') WITH ORDINALITY
      LOOP
        v_key := COALESCE(NULLIF(v_piece->>'key', ''), NULLIF(v_piece->>'source_rule_id', ''), md5(v_piece::text));
        INSERT INTO public.os_glass_pieces (
          company_id, ordem_servico_id, os_item_id, sale_item_id, quote_item_id,
          item_template_id, company_item_id, snapshot_key, snapshot_version,
          snapshot_payload, piece_code, piece_role, width_mm, height_mm,
          thickness_mm, color, quantity, supply_mode, status
        ) VALUES (
          v_company_id, _ordem_servico_id, v_item.id, v_item.sale_item_id,
          v_item.source_quote_item_id, NULLIF(v_piece->>'item_template_id', '')::uuid,
          NULLIF(v_piece->>'company_item_id', '')::uuid, v_key,
          COALESCE((v_snapshot->>'snapshot_version')::integer, 2), v_piece,
          v_item.id::text || ':' || v_key,
          v_piece->>'piece_role', (v_piece->>'width_mm')::numeric,
          (v_piece->>'height_mm')::numeric,
          NULLIF(regexp_replace(COALESCE(v_piece->>'thickness', ''), '[^0-9.,-]', '', 'g'), '')::numeric,
          v_piece->>'color', (v_piece->>'quantity')::numeric,
          COALESCE(v_piece->>'supply_mode', 'INTERNAL_STOCK'), 'PENDING'
        )
        ON CONFLICT (ordem_servico_id, piece_code)
        DO UPDATE SET snapshot_payload = EXCLUDED.snapshot_payload,
          snapshot_version = EXCLUDED.snapshot_version;
        v_piece_count := v_piece_count + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 'materials', v_material_count,
    'glass_pieces', v_piece_count, 'cutting_plans', v_plan_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rebuild_os_documents_from_snapshot(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_os_documents_from_snapshot(uuid, uuid) TO authenticated, service_role;
