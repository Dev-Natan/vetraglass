-- Phase 3G / pricing integration
-- Use the tenant-scoped physical material identity frozen by pricing snapshots.
-- The technical component identity remains preserved inside snapshot_payload.

DO $$
DECLARE
  v_definition_hash text;
BEGIN
  SELECT md5(pg_get_functiondef(
    'public.rebuild_os_documents_from_snapshot(uuid,uuid)'::regprocedure
  ))
  INTO v_definition_hash;

  IF v_definition_hash <> '84f4eb6e68060136ddc4cdad86d9abf6' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'MIGRATION_PRECONDITION_FAILED',
      DETAIL = format(
        'rebuild_os_documents_from_snapshot changed unexpectedly (md5=%s)',
        COALESCE(v_definition_hash, '<missing>')
      );
  END IF;
END;
$$;

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
  v_operational_company_item_id uuid;
  v_operational_item_template_id uuid;
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
        v_key := COALESCE(
          NULLIF(v_material->>'key', ''),
          NULLIF(v_material->>'source_rule_id', ''),
          md5(v_material::text)
        );
        v_operational_company_item_id := COALESCE(
          NULLIF(v_material->>'pricing_company_item_id', '')::uuid,
          NULLIF(v_material->>'company_item_id', '')::uuid
        );
        v_operational_item_template_id := NULLIF(v_material->>'item_template_id', '')::uuid;

        IF NULLIF(v_material->>'pricing_company_item_id', '') IS NOT NULL THEN
          SELECT ci.item_template_id
          INTO v_operational_item_template_id
          FROM public.company_items ci
          WHERE ci.id = v_operational_company_item_id
            AND ci.company_id = v_company_id
            AND ci.is_active = true;

          IF NOT FOUND THEN
            RAISE EXCEPTION USING
              ERRCODE = '23503',
              MESSAGE = 'MISSING_COMPANY_ITEM',
              DETAIL = 'The frozen operational pricing item is not active in the OS company';
          END IF;
        END IF;

        INSERT INTO public.os_materials (
          ordem_servico_id, os_item_id, snapshot_key, item_template_id, company_item_id,
          item_name, item_type, cut_length_mm, pieces_count, total_length_mm,
          bar_length_mm, bars_needed, required_quantity, unit, notes,
          procurement_status, snapshot_payload
        ) VALUES (
          _ordem_servico_id, v_item.id, v_key,
          v_operational_item_template_id,
          v_operational_company_item_id,
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
          'pending_purchase',
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
            v_operational_company_item_id,
            v_operational_item_template_id,
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
        v_key := COALESCE(
          NULLIF(v_piece->>'key', ''),
          NULLIF(v_piece->>'source_rule_id', ''),
          md5(v_piece::text)
        );
        v_operational_company_item_id := COALESCE(
          NULLIF(v_piece->>'pricing_company_item_id', '')::uuid,
          NULLIF(v_piece->>'company_item_id', '')::uuid
        );
        v_operational_item_template_id := NULLIF(v_piece->>'item_template_id', '')::uuid;

        IF NULLIF(v_piece->>'pricing_company_item_id', '') IS NOT NULL THEN
          SELECT ci.item_template_id
          INTO v_operational_item_template_id
          FROM public.company_items ci
          WHERE ci.id = v_operational_company_item_id
            AND ci.company_id = v_company_id
            AND ci.is_active = true;

          IF NOT FOUND THEN
            RAISE EXCEPTION USING
              ERRCODE = '23503',
              MESSAGE = 'MISSING_COMPANY_ITEM',
              DETAIL = 'The frozen operational pricing item is not active in the OS company';
          END IF;
        END IF;

        INSERT INTO public.os_glass_pieces (
          company_id, ordem_servico_id, os_item_id, sale_item_id, quote_item_id,
          item_template_id, company_item_id, snapshot_key, snapshot_version,
          snapshot_payload, piece_code, piece_role, width_mm, height_mm,
          thickness_mm, color, quantity, supply_mode, status
        ) VALUES (
          v_company_id, _ordem_servico_id, v_item.id, v_item.sale_item_id,
          v_item.source_quote_item_id, v_operational_item_template_id,
          v_operational_company_item_id, v_key,
          COALESCE((v_snapshot->>'snapshot_version')::integer, 2), v_piece,
          v_item.id::text || ':' || v_key,
          v_piece->>'piece_role', (v_piece->>'width_mm')::numeric,
          (v_piece->>'height_mm')::numeric,
          NULLIF(regexp_replace(COALESCE(
            v_piece#>>'{specification,thickness_mm}',
            v_piece->>'thickness', ''
          ), '[^0-9.,-]', '', 'g'), '')::numeric,
          COALESCE(v_piece#>>'{specification,color}', v_piece->>'color'),
          COALESCE(
            NULLIF(v_piece->>'piece_quantity', '')::numeric,
            NULLIF(v_piece->>'quantity', '')::numeric
          ),
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

REVOKE ALL ON FUNCTION public.rebuild_os_documents_from_snapshot(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rebuild_os_documents_from_snapshot(uuid, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.rebuild_os_documents_from_snapshot(uuid, uuid) IS
  'Materializes immutable OS documents using the frozen tenant operational item identity; technical component identity remains in snapshot_payload.';
