-- Phase 01A: dynamic, read-only material availability for service orders.
-- Existing Phase 3G requirements remain the need authority; physical stock
-- balances remain the physical authority. No reservation is created here.

CREATE OR REPLACE FUNCTION public.get_os_dynamic_material_availability(
  _ordem_servico_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_items jsonb;
  v_sufficient boolean;
BEGIN
  SELECT os.company_id
  INTO v_company_id
  FROM public.ordens_servico os
  WHERE os.id = _ordem_servico_id;

  IF v_user_id IS NULL
     OR v_company_id IS NULL
     OR NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;

  WITH requirement_scope AS (
    SELECT
      s.id AS requirement_id,
      s.os_material_id,
      s.company_id,
      s.company_item_id,
      s.variant_id,
      s.item_name AS material_name,
      s.item_type,
      s.required_canonical_quantity AS required_quantity,
      s.canonical_unit,
      s.open_order_canonical_quantity AS purchase_coverage_open,
      COALESCE(
        NULLIF(btrim(civ.profile_color), ''),
        NULLIF(btrim(civ.glass_color), ''),
        NULLIF(btrim(civ.attribute_signature), '')
      ) AS variant_name
    FROM public.material_purchase_requirements_summary s
    LEFT JOIN public.company_item_variants civ
      ON civ.id = s.variant_id
     AND civ.company_id = s.company_id
     AND civ.company_item_id = s.company_item_id
    WHERE s.ordem_servico_id = _ordem_servico_id
      AND s.company_id = v_company_id
      AND s.lifecycle_status = 'ACTIVE'
  ), measured AS (
    SELECT
      r.*,
      COALESCE(stock.physical_on_hand, 0) AS physical_on_hand,
      COALESCE(reservations.reserved_total, 0) AS reserved_total,
      COALESCE(reservations.reserved_for_this_os, 0) AS reserved_for_this_os
    FROM requirement_scope r
    LEFT JOIN LATERAL (
      SELECT COALESCE(sum(pb.canonical_quantity), 0) AS physical_on_hand
      FROM public.physical_stock_balances pb
      JOIN public.stock_locations sl
        ON sl.id = pb.location_id
       AND sl.company_id = pb.company_id
       AND sl.is_active
       AND NOT sl.needs_review
      JOIN public.inventory_item_units iu
        ON iu.company_id = pb.company_id
       AND iu.company_item_id = pb.company_item_id
       AND iu.legacy_status = 'CONFIGURED'
       AND public.phase3f_normalize_unit(iu.canonical_unit)
           = public.phase3f_normalize_unit(r.canonical_unit)
      WHERE pb.company_id = r.company_id
        AND pb.company_item_id = r.company_item_id
        AND pb.variant_id IS NOT DISTINCT FROM r.variant_id
        AND pb.canonical_quantity > 0
        AND NOT pb.needs_review
    ) stock ON true
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(sum(sr.canonical_quantity), 0) AS reserved_total,
        COALESCE(sum(sr.canonical_quantity) FILTER (
          WHERE sr.ordem_servico_id = _ordem_servico_id
        ), 0) AS reserved_for_this_os
      FROM public.stock_reservations sr
      JOIN public.physical_stock_balances pb
        ON pb.id = sr.physical_stock_balance_id
       AND pb.company_id = sr.company_id
       AND pb.company_item_id = sr.company_item_id
       AND pb.variant_id IS NOT DISTINCT FROM sr.variant_id
       AND NOT pb.needs_review
      JOIN public.stock_locations sl
        ON sl.id = pb.location_id
       AND sl.company_id = pb.company_id
       AND sl.is_active
       AND NOT sl.needs_review
      JOIN public.inventory_item_units iu
        ON iu.company_id = pb.company_id
       AND iu.company_item_id = pb.company_item_id
       AND iu.legacy_status = 'CONFIGURED'
       AND public.phase3f_normalize_unit(iu.canonical_unit)
           = public.phase3f_normalize_unit(r.canonical_unit)
      WHERE sr.company_id = r.company_id
        AND sr.company_item_id = r.company_item_id
        AND sr.variant_id IS NOT DISTINCT FROM r.variant_id
        AND sr.status = 'reserved'
        AND sr.canonical_quantity > 0
    ) reservations ON true
  ), availability AS (
    SELECT
      measured.*,
      greatest(physical_on_hand - reserved_total, 0) AS available_free,
      greatest(
        physical_on_hand - greatest(reserved_total - reserved_for_this_os, 0),
        0
      ) AS aggregate_available_for_os,
      CASE
        WHEN lower(COALESCE(item_type, '')) IN ('glass', 'vidro', 'mirror', 'espelho')
          OR public.phase3f_normalize_unit(canonical_unit) = 'MM2'
          THEN 'UNSUPPORTED'
        WHEN lower(COALESCE(item_type, '')) IN ('profile', 'perfil') THEN 'ESTIMATED'
        ELSE 'EXACT'
      END AS availability_precision
    FROM measured
  ), result_rows AS (
    SELECT
      availability.*,
      CASE
        WHEN availability_precision = 'UNSUPPORTED' THEN NULL
        ELSE aggregate_available_for_os
      END AS available_for_os,
      CASE
        WHEN availability_precision = 'UNSUPPORTED' THEN NULL
        ELSE greatest(required_quantity - aggregate_available_for_os, 0)
      END AS missing_quantity,
      CASE
        WHEN availability_precision = 'UNSUPPORTED' THEN
          CASE WHEN aggregate_available_for_os > 0 THEN 'PARTIAL' ELSE 'TO_BUY' END
        WHEN aggregate_available_for_os >= required_quantity THEN 'AVAILABLE'
        WHEN aggregate_available_for_os > 0 THEN 'PARTIAL'
        ELSE 'TO_BUY'
      END AS status
    FROM availability
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'os_material_id', os_material_id,
      'requirement_id', requirement_id,
      'company_item_id', company_item_id,
      'company_item_variant_id', variant_id,
      'material_name', material_name,
      'variant_name', variant_name,
      'required_quantity', required_quantity,
      'canonical_unit', canonical_unit,
      'physical_on_hand', physical_on_hand,
      'reserved_total', reserved_total,
      'reserved_for_this_os', reserved_for_this_os,
      'available_free', available_free,
      'available_for_os', available_for_os,
      'missing_quantity', missing_quantity,
      'purchase_coverage_open', purchase_coverage_open,
      'status', status,
      'availability_precision', availability_precision,
      'dimension_validation_required', availability_precision = 'UNSUPPORTED'
    ) ORDER BY material_name, requirement_id), '[]'::jsonb),
    COALESCE(bool_and(status = 'AVAILABLE'), true)
  INTO v_items, v_sufficient
  FROM result_rows;

  RETURN jsonb_build_object(
    'success', true,
    'sufficient', v_sufficient,
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_os_dynamic_material_availability(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_os_dynamic_material_availability(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_os_dynamic_material_availability(uuid) IS
  'Read-only Phase 01A availability: current physical stock minus active reservations from other service orders. Custom-cut glass remains dimensionally unsupported.';

NOTIFY pgrst, 'reload schema';
