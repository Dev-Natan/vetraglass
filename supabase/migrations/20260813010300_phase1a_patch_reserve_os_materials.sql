-- Phase 1A.3: record the final reserve_os_materials() contract already validated remotely.
-- This function reserves stock logically; it never decrements physical stock.

CREATE OR REPLACE FUNCTION public.reserve_os_materials(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_physical numeric;
  v_other_reserved numeric;
  v_target numeric;
  v_reserved_rows integer := 0;
  v_reserved_quantity numeric := 0;
  v_shortages jsonb := '[]'::jsonb;
  v_skipped integer := 0;
  requirement record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  SELECT os.company_id
  INTO v_company_id
  FROM public.ordens_servico AS os
  WHERE os.id = _ordem_servico_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;

  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'User is not an active member of the service order company';
  END IF;

  FOR requirement IN
    SELECT
      ci.id AS company_item_id,
      ci.name AS item_name,
      ci.unit AS stock_unit,
      SUM(
        CASE
          WHEN om.item_type = 'profile' AND COALESCE(om.bars_needed, 0) > 0
            THEN om.bars_needed
          WHEN lower(COALESCE(om.unit, ci.unit, 'un')) IN ('m', 'ml', 'metro', 'metros')
            THEN COALESCE(om.total_length_mm, 0)::numeric / 1000
          WHEN lower(COALESCE(om.unit, ci.unit, 'un')) IN ('m2', 'm²')
            THEN (
              COALESCE(oi.width_production, oi.largura_producao, 0)
              * COALESCE(oi.height_production, oi.altura_producao, 0)
              * GREATEST(COALESCE(om.pieces_count, 1), 1)
            )::numeric / 1000000
          ELSE GREATEST(COALESCE(om.pieces_count, 0), 0)::numeric
        END
      ) AS required_quantity
    FROM public.os_materials AS om
    JOIN public.company_items AS ci
      ON ci.company_id = v_company_id
     AND ci.item_template_id = om.item_template_id
     AND ci.is_active = true
    LEFT JOIN public.os_items AS oi
      ON oi.id = om.os_item_id
     AND oi.os_id = om.ordem_servico_id
    WHERE om.ordem_servico_id = _ordem_servico_id
      AND om.item_template_id IS NOT NULL
    GROUP BY ci.id, ci.name, ci.unit
    ORDER BY ci.id
  LOOP
    IF requirement.required_quantity <= 0 THEN
      UPDATE public.stock_reservations AS sr
      SET status = 'cancelled',
          quantity_reserved = 0,
          cancelled_at = COALESCE(sr.cancelled_at, now()),
          updated_at = now()
      WHERE sr.company_id = v_company_id
        AND sr.ordem_servico_id = _ordem_servico_id
        AND sr.company_item_id = requirement.company_item_id
        AND sr.status = 'reserved';
      CONTINUE;
    END IF;

    -- Serialize reservations for the same physical stock item. More than one
    -- active stock row is tolerated and summed deterministically.
    PERFORM cs.id
    FROM public.company_stock AS cs
    WHERE cs.company_id = v_company_id
      AND cs.company_item_id = requirement.company_item_id
      AND cs.is_active = true
    ORDER BY cs.id
    FOR UPDATE;

    IF NOT FOUND THEN
      UPDATE public.stock_reservations AS sr
      SET status = 'cancelled',
          quantity_reserved = 0,
          cancelled_at = COALESCE(sr.cancelled_at, now()),
          updated_at = now()
      WHERE sr.company_id = v_company_id
        AND sr.ordem_servico_id = _ordem_servico_id
        AND sr.company_item_id = requirement.company_item_id
        AND sr.status = 'reserved';

      v_skipped := v_skipped + 1;
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'company_item_id', requirement.company_item_id,
        'item_name', requirement.item_name,
        'required', requirement.required_quantity,
        'reserved', 0,
        'reason', 'stock_record_missing'
      ));
      CONTINUE;
    END IF;

    SELECT COALESCE(SUM(cs.quantity), 0)
    INTO v_physical
    FROM public.company_stock AS cs
    WHERE cs.company_id = v_company_id
      AND cs.company_item_id = requirement.company_item_id
      AND cs.is_active = true;

    SELECT COALESCE(SUM(sr.quantity_reserved), 0)
    INTO v_other_reserved
    FROM public.stock_reservations AS sr
    WHERE sr.company_id = v_company_id
      AND sr.company_item_id = requirement.company_item_id
      AND sr.status = 'reserved'
      AND sr.ordem_servico_id <> _ordem_servico_id;

    v_target := LEAST(
      requirement.required_quantity,
      GREATEST(v_physical - v_other_reserved, 0)
    );

    INSERT INTO public.stock_reservations (
      company_id,
      company_item_id,
      ordem_servico_id,
      quantity_reserved,
      unit,
      status,
      created_by,
      updated_at
    )
    VALUES (
      v_company_id,
      requirement.company_item_id,
      _ordem_servico_id,
      v_target,
      COALESCE(requirement.stock_unit, 'un'),
      'reserved',
      v_user_id,
      now()
    )
    ON CONFLICT (ordem_servico_id, company_item_id)
      WHERE status = 'reserved'
    DO UPDATE SET
      quantity_reserved = EXCLUDED.quantity_reserved,
      unit = EXCLUDED.unit,
      updated_at = now();

    v_reserved_rows := v_reserved_rows + 1;
    v_reserved_quantity := v_reserved_quantity + v_target;

    IF v_target < requirement.required_quantity THEN
      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'company_item_id', requirement.company_item_id,
        'item_name', requirement.item_name,
        'required', requirement.required_quantity,
        'reserved', v_target,
        'missing', requirement.required_quantity - v_target,
        'reason', 'insufficient_available_stock'
      ));
    END IF;
  END LOOP;

  -- Requirements removed from the OS must not leave stale active reservations.
  UPDATE public.stock_reservations AS sr
  SET status = 'cancelled',
      quantity_reserved = 0,
      cancelled_at = COALESCE(sr.cancelled_at, now()),
      updated_at = now()
  WHERE sr.company_id = v_company_id
    AND sr.ordem_servico_id = _ordem_servico_id
    AND sr.status = 'reserved'
    AND NOT EXISTS (
      SELECT 1
      FROM public.os_materials AS om
      JOIN public.company_items AS ci
        ON ci.company_id = v_company_id
       AND ci.item_template_id = om.item_template_id
       AND ci.is_active = true
      WHERE om.ordem_servico_id = _ordem_servico_id
        AND ci.id = sr.company_item_id
    );

  RETURN jsonb_build_object(
    'success', true,
    'reserved', v_reserved_rows,
    'reserved_quantity', v_reserved_quantity,
    'skipped', v_skipped,
    'shortages', v_shortages
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_os_materials(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_os_materials(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_os_materials(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.reserve_os_materials(uuid) IS
  'Idempotently reserves available OS material requirements without decrementing physical stock.';
