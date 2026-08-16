-- Phase 2B: canonical OS -> reservation -> purchase receipt -> consumption flow.
-- Physical stock is changed only by the transactional receipt/consumption RPCs below.

-- One active stock row is the physical source of truth for a company item.
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_stock_company_item
  ON public.company_stock (company_id, company_item_id)
  WHERE company_item_id IS NOT NULL;

-- A material consumption can produce at most one canonical production exit.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_movement_material_consumption
  ON public.stock_movements (reference_id)
  WHERE reference_type = 'material_consumption'
    AND type = 'saida'
    AND category = 'consumo_producao';

-- Active zero reservations are misleading and must not participate in availability.
UPDATE public.stock_reservations
SET status = 'cancelled',
    cancelled_at = COALESCE(cancelled_at, now()),
    updated_at = now()
WHERE status = 'reserved'
  AND quantity_reserved <= 0;

ALTER TABLE public.stock_reservations
  DROP CONSTRAINT IF EXISTS stock_reservations_active_quantity_check;

ALTER TABLE public.stock_reservations
  ADD CONSTRAINT stock_reservations_active_quantity_check
  CHECK (status <> 'reserved' OR quantity_reserved > 0);

-- Purchase orders linked to an OS must use an OS from the same company.
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_id_company_id_key;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_id_company_id_key UNIQUE (id, company_id);

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_os_company_fkey;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_os_company_fkey
  FOREIGN KEY (ordem_servico_id, company_id)
  REFERENCES public.ordens_servico (id, company_id);

ALTER TABLE public.purchase_order_items
  DROP CONSTRAINT IF EXISTS purchase_order_items_os_material_id_fkey;

ALTER TABLE public.purchase_order_items
  ADD CONSTRAINT purchase_order_items_os_material_id_fkey
  FOREIGN KEY (os_material_id)
  REFERENCES public.os_materials (id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_purchase_order_item_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_po_os_id uuid;
  v_material_os_id uuid;
BEGIN
  IF NEW.os_material_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT po.ordem_servico_id
  INTO v_po_os_id
  FROM public.purchase_orders AS po
  WHERE po.id = NEW.purchase_order_id;

  SELECT om.ordem_servico_id
  INTO v_material_os_id
  FROM public.os_materials AS om
  WHERE om.id = NEW.os_material_id;

  IF v_po_os_id IS NULL OR v_material_os_id IS NULL OR v_po_os_id <> v_material_os_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Purchase order item material must belong to the purchase order service order';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_purchase_order_item_scope
  ON public.purchase_order_items;

CREATE TRIGGER trg_validate_purchase_order_item_scope
BEFORE INSERT OR UPDATE OF purchase_order_id, os_material_id
ON public.purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_purchase_order_item_scope();

-- Operational requirements are material_consumption rows. os_materials remains
-- the immutable production snapshot/reference used to generate those rows.
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
  v_reservation_id uuid;
  v_reserved_rows integer := 0;
  v_reserved_quantity numeric := 0;
  v_shortages jsonb := '[]'::jsonb;
  requirement record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  SELECT os.company_id
  INTO v_company_id
  FROM public.ordens_servico AS os
  WHERE os.id = _ordem_servico_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;

  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  -- Requirements that cannot resolve to a company item are explicit shortages.
  FOR requirement IN
    SELECT mc.item_template_id, mc.item_name,
           SUM(mc.quantity_calculated) AS required_quantity
    FROM public.material_consumption AS mc
    WHERE mc.ordem_servico_id = _ordem_servico_id
      AND mc.company_id = v_company_id
      AND mc.status IN ('pending', 'available')
      AND mc.quantity_calculated > 0
      AND mc.company_item_id IS NULL
    GROUP BY mc.item_template_id, mc.item_name
  LOOP
    v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
      'company_item_id', NULL,
      'item_template_id', requirement.item_template_id,
      'item_name', requirement.item_name,
      'required', requirement.required_quantity,
      'reserved', 0,
      'missing', requirement.required_quantity,
      'reason', 'company_item_missing'
    ));
  END LOOP;

  FOR requirement IN
    SELECT mc.company_item_id,
           MIN(mc.item_name) AS item_name,
           MIN(mc.unit) AS unit,
           SUM(mc.quantity_calculated) AS required_quantity
    FROM public.material_consumption AS mc
    WHERE mc.ordem_servico_id = _ordem_servico_id
      AND mc.company_id = v_company_id
      AND mc.status IN ('pending', 'available')
      AND mc.quantity_calculated > 0
      AND mc.company_item_id IS NOT NULL
    GROUP BY mc.company_item_id
    ORDER BY mc.company_item_id
  LOOP
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
          cancelled_at = COALESCE(sr.cancelled_at, now()),
          updated_at = now()
      WHERE sr.company_id = v_company_id
        AND sr.ordem_servico_id = _ordem_servico_id
        AND sr.company_item_id = requirement.company_item_id
        AND sr.status = 'reserved';

      v_shortages := v_shortages || jsonb_build_array(jsonb_build_object(
        'company_item_id', requirement.company_item_id,
        'item_name', requirement.item_name,
        'required', requirement.required_quantity,
        'reserved', 0,
        'missing', requirement.required_quantity,
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

    IF v_target > 0 THEN
      INSERT INTO public.stock_reservations (
        company_id, company_item_id, ordem_servico_id, quantity_reserved,
        unit, status, created_by, updated_at
      ) VALUES (
        v_company_id, requirement.company_item_id, _ordem_servico_id,
        v_target, COALESCE(requirement.unit, 'un'), 'reserved', v_user_id, now()
      )
      ON CONFLICT (ordem_servico_id, company_item_id)
        WHERE status = 'reserved'
      DO UPDATE SET
        quantity_reserved = EXCLUDED.quantity_reserved,
        unit = EXCLUDED.unit,
        cancelled_at = NULL,
        updated_at = now()
      RETURNING id INTO v_reservation_id;

      UPDATE public.material_consumption AS mc
      SET stock_reservation_id = v_reservation_id
      WHERE mc.ordem_servico_id = _ordem_servico_id
        AND mc.company_id = v_company_id
        AND mc.company_item_id = requirement.company_item_id
        AND mc.status IN ('pending', 'available');

      v_reserved_rows := v_reserved_rows + 1;
      v_reserved_quantity := v_reserved_quantity + v_target;
    ELSE
      UPDATE public.stock_reservations AS sr
      SET status = 'cancelled',
          cancelled_at = COALESCE(sr.cancelled_at, now()),
          updated_at = now()
      WHERE sr.company_id = v_company_id
        AND sr.ordem_servico_id = _ordem_servico_id
        AND sr.company_item_id = requirement.company_item_id
        AND sr.status = 'reserved';

      UPDATE public.material_consumption AS mc
      SET stock_reservation_id = NULL
      WHERE mc.ordem_servico_id = _ordem_servico_id
        AND mc.company_id = v_company_id
        AND mc.company_item_id = requirement.company_item_id
        AND mc.status IN ('pending', 'available');
    END IF;

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

  -- Removed/cancelled requirements cannot retain active reservations.
  UPDATE public.stock_reservations AS sr
  SET status = 'cancelled',
      cancelled_at = COALESCE(sr.cancelled_at, now()),
      updated_at = now()
  WHERE sr.company_id = v_company_id
    AND sr.ordem_servico_id = _ordem_servico_id
    AND sr.status = 'reserved'
    AND NOT EXISTS (
      SELECT 1
      FROM public.material_consumption AS mc
      WHERE mc.ordem_servico_id = _ordem_servico_id
        AND mc.company_id = v_company_id
        AND mc.company_item_id = sr.company_item_id
        AND mc.status IN ('pending', 'available')
        AND mc.quantity_calculated > 0
    );

  RETURN jsonb_build_object(
    'success', true,
    'reserved', v_reserved_rows,
    'reserved_quantity', v_reserved_quantity,
    'shortages', v_shortages,
    'sufficient', jsonb_array_length(v_shortages) = 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_os_material_availability(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_items jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  SELECT os.company_id INTO v_company_id
  FROM public.ordens_servico AS os
  WHERE os.id = _ordem_servico_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;

  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  WITH requirements AS (
    SELECT mc.company_item_id,
           mc.item_template_id,
           MIN(mc.item_name) AS item_name,
           MIN(mc.unit) AS unit,
           SUM(mc.quantity_calculated) AS required_quantity
    FROM public.material_consumption AS mc
    WHERE mc.ordem_servico_id = _ordem_servico_id
      AND mc.company_id = v_company_id
      AND mc.status IN ('pending', 'available')
      AND mc.quantity_calculated > 0
    GROUP BY mc.company_item_id, mc.item_template_id
  ), availability AS (
    SELECT r.*,
           COALESCE((
             SELECT SUM(cs.quantity)
             FROM public.company_stock AS cs
             WHERE cs.company_id = v_company_id
               AND cs.company_item_id = r.company_item_id
               AND cs.is_active = true
           ), 0) AS physical_quantity,
           COALESCE((
             SELECT SUM(sr.quantity_reserved)
             FROM public.stock_reservations AS sr
             WHERE sr.company_id = v_company_id
               AND sr.company_item_id = r.company_item_id
               AND sr.status = 'reserved'
           ), 0) AS total_reserved,
           COALESCE((
             SELECT SUM(sr.quantity_reserved)
             FROM public.stock_reservations AS sr
             WHERE sr.company_id = v_company_id
               AND sr.company_item_id = r.company_item_id
               AND sr.ordem_servico_id = _ordem_servico_id
               AND sr.status = 'reserved'
           ), 0) AS os_reserved
    FROM requirements AS r
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'company_item_id', a.company_item_id,
    'item_template_id', a.item_template_id,
    'item_name', a.item_name,
    'unit', a.unit,
    'required', a.required_quantity,
    'physical', a.physical_quantity,
    'reserved_total', a.total_reserved,
    'reserved_for_os', a.os_reserved,
    'missing', GREATEST(a.required_quantity - a.os_reserved, 0),
    'sufficient', a.company_item_id IS NOT NULL AND a.os_reserved >= a.required_quantity
  ) ORDER BY a.item_name), '[]'::jsonb)
  INTO v_items
  FROM availability AS a;

  RETURN jsonb_build_object(
    'success', true,
    'sufficient', NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_items) AS element
      WHERE NOT COALESCE((element->>'sufficient')::boolean, false)
    ),
    'items', v_items
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.release_materials_for_production(_ordem_servico_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reservation jsonb;
  v_released integer;
BEGIN
  v_reservation := public.reserve_os_materials(_ordem_servico_id);

  IF NOT COALESCE((v_reservation->>'sufficient')::boolean, false) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Insufficient materials for production',
      DETAIL = COALESCE(v_reservation->'shortages', '[]'::jsonb)::text;
  END IF;

  UPDATE public.material_consumption
  SET status = 'available',
      released_at = COALESCE(released_at, now())
  WHERE ordem_servico_id = _ordem_servico_id
    AND status = 'pending';

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_os_production(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_status text;
  v_release integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  SELECT os.company_id, os.status
  INTO v_company_id, v_status
  FROM public.ordens_servico AS os
  WHERE os.id = _ordem_servico_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;

  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  IF v_status = 'in_progress' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', v_status);
  END IF;

  IF v_status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Only pending service orders can start production';
  END IF;

  v_release := public.release_materials_for_production(_ordem_servico_id);

  UPDATE public.ordens_servico
  SET status = 'in_progress',
      actual_start = COALESCE(actual_start, current_date),
      current_stage = 'Em produção',
      updated_at = now()
  WHERE id = _ordem_servico_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'status', 'in_progress',
    'released', COALESCE(v_release, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_os_production(
  _ordem_servico_id uuid,
  _lines jsonb,
  _cancelled_consumption_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_status text;
  v_seen_ids uuid[] := '{}'::uuid[];
  v_line jsonb;
  v_consumption_id uuid;
  v_company_item_id uuid;
  v_quantity numeric;
  v_item record;
  v_reservation jsonb;
  v_movement_id uuid;
  v_processed integer := 0;
  requirement record;
  consumption record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  IF _lines IS NULL OR jsonb_typeof(_lines) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Production lines must be a JSON array';
  END IF;

  SELECT os.company_id, os.status
  INTO v_company_id, v_status
  FROM public.ordens_servico AS os
  WHERE os.id = _ordem_servico_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;

  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  IF v_status = 'completed' THEN
    SELECT count(*) INTO v_processed
    FROM public.stock_movements
    WHERE company_id = v_company_id
      AND reference_type = 'material_consumption'
      AND type = 'saida'
      AND category = 'consumo_producao'
      AND reference_id IN (
        SELECT id FROM public.material_consumption
        WHERE ordem_servico_id = _ordem_servico_id
      );

    RETURN jsonb_build_object(
      'success', true, 'idempotent', true,
      'status', v_status, 'consumed', v_processed
    );
  END IF;

  IF v_status <> 'in_progress' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Only service orders in production can be completed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(_cancelled_consumption_ids) AS cancelled_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.material_consumption AS mc
      WHERE mc.id = cancelled_id
        AND mc.ordem_servico_id = _ordem_servico_id
        AND mc.company_id = v_company_id
        AND mc.status IN ('pending', 'available')
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid cancelled material consumption id';
  END IF;

  UPDATE public.material_consumption
  SET status = 'cancelled',
      stock_reservation_id = NULL
  WHERE ordem_servico_id = _ordem_servico_id
    AND company_id = v_company_id
    AND id = ANY(_cancelled_consumption_ids)
    AND status IN ('pending', 'available');

  FOR v_line IN SELECT value FROM jsonb_array_elements(_lines)
  LOOP
    v_consumption_id := NULLIF(v_line->>'consumption_id', '')::uuid;
    v_company_item_id := NULLIF(v_line->>'company_item_id', '')::uuid;
    v_quantity := NULLIF(v_line->>'quantity', '')::numeric;

    IF v_company_item_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each production line requires a company item and positive quantity';
    END IF;

    SELECT ci.id, ci.item_template_id, ci.name, ci.type, ci.unit, COALESCE(ci.cost, 0) AS cost
    INTO v_item
    FROM public.company_items AS ci
    WHERE ci.id = v_company_item_id
      AND ci.company_id = v_company_id
      AND ci.is_active = true;

    IF v_item.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Production item does not belong to the service order company';
    END IF;

    IF v_consumption_id IS NULL THEN
      INSERT INTO public.material_consumption (
        company_id, ordem_servico_id, company_item_id, item_template_id,
        item_name, item_type, unit, quantity_calculated, status, released_at
      ) VALUES (
        v_company_id, _ordem_servico_id, v_item.id, v_item.item_template_id,
        v_item.name, COALESCE(v_item.type, 'extra'), COALESCE(v_item.unit, 'un'),
        v_quantity, 'available', now()
      )
      RETURNING id INTO v_consumption_id;
    ELSE
      IF v_consumption_id = ANY(v_seen_ids) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Duplicate material consumption line';
      END IF;

      UPDATE public.material_consumption AS mc
      SET company_item_id = v_item.id,
          item_template_id = v_item.item_template_id,
          item_name = v_item.name,
          item_type = COALESCE(v_item.type, mc.item_type),
          unit = COALESCE(v_item.unit, mc.unit),
          quantity_calculated = v_quantity,
          status = 'available',
          released_at = COALESCE(mc.released_at, now()),
          stock_reservation_id = NULL
      WHERE mc.id = v_consumption_id
        AND mc.ordem_servico_id = _ordem_servico_id
        AND mc.company_id = v_company_id
        AND mc.status IN ('pending', 'available');

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Material consumption is invalid or already consumed';
      END IF;
    END IF;

    v_seen_ids := array_append(v_seen_ids, v_consumption_id);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.material_consumption AS mc
    WHERE mc.ordem_servico_id = _ordem_servico_id
      AND mc.company_id = v_company_id
      AND mc.status IN ('pending', 'available')
      AND NOT (mc.id = ANY(v_seen_ids))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Every active material must be confirmed or cancelled';
  END IF;

  v_reservation := public.reserve_os_materials(_ordem_servico_id);
  IF NOT COALESCE((v_reservation->>'sufficient')::boolean, false) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Insufficient materials to complete production',
      DETAIL = COALESCE(v_reservation->'shortages', '[]'::jsonb)::text;
  END IF;

  -- Lock and validate every physical stock source before changing any row.
  PERFORM cs.id
  FROM public.company_stock AS cs
  WHERE cs.company_id = v_company_id
    AND cs.company_item_id IN (
      SELECT DISTINCT mc.company_item_id
      FROM public.material_consumption AS mc
      WHERE mc.ordem_servico_id = _ordem_servico_id
        AND mc.company_id = v_company_id
        AND mc.status = 'available'
    )
  ORDER BY cs.id
  FOR UPDATE;

  FOR requirement IN
    SELECT mc.company_item_id, SUM(mc.quantity_calculated) AS required_quantity
    FROM public.material_consumption AS mc
    WHERE mc.ordem_servico_id = _ordem_servico_id
      AND mc.company_id = v_company_id
      AND mc.status = 'available'
    GROUP BY mc.company_item_id
    ORDER BY mc.company_item_id
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.stock_reservations AS sr
      WHERE sr.company_id = v_company_id
        AND sr.ordem_servico_id = _ordem_servico_id
        AND sr.company_item_id = requirement.company_item_id
        AND sr.status = 'reserved'
        AND sr.quantity_reserved >= requirement.required_quantity
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Active reservation does not cover production consumption';
    END IF;

    UPDATE public.company_stock AS cs
    SET quantity = cs.quantity - requirement.required_quantity,
        updated_at = now()
    WHERE cs.company_id = v_company_id
      AND cs.company_item_id = requirement.company_item_id
      AND cs.is_active = true
      AND cs.quantity >= requirement.required_quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Physical stock cannot become negative';
    END IF;
  END LOOP;

  FOR consumption IN
    SELECT mc.id, mc.company_item_id, mc.item_template_id, mc.item_name,
           mc.quantity_calculated, COALESCE(ci.cost, 0) AS unit_cost
    FROM public.material_consumption AS mc
    JOIN public.company_items AS ci ON ci.id = mc.company_item_id
    WHERE mc.ordem_servico_id = _ordem_servico_id
      AND mc.company_id = v_company_id
      AND mc.status = 'available'
    ORDER BY mc.id
  LOOP
    INSERT INTO public.stock_movements (
      company_id, company_item_id, item_template_id, type, category,
      quantity, unit_cost, valor_financeiro, description,
      reference_id, reference_type, created_by
    ) VALUES (
      v_company_id, consumption.company_item_id, consumption.item_template_id,
      'saida', 'consumo_producao', consumption.quantity_calculated,
      consumption.unit_cost,
      consumption.quantity_calculated * consumption.unit_cost,
      'Consumo de produção - ' || consumption.item_name,
      consumption.id, 'material_consumption', v_user_id
    )
    RETURNING id INTO v_movement_id;

    UPDATE public.material_consumption
    SET status = 'consumed',
        consumed_at = now(),
        stock_movement_id = v_movement_id
    WHERE id = consumption.id;

    v_processed := v_processed + 1;
  END LOOP;

  UPDATE public.stock_reservations
  SET status = 'consumed',
      consumed_at = COALESCE(consumed_at, now()),
      updated_at = now()
  WHERE company_id = v_company_id
    AND ordem_servico_id = _ordem_servico_id
    AND status = 'reserved';

  UPDATE public.ordens_servico
  SET status = 'completed',
      actual_end = COALESCE(actual_end, current_date),
      current_stage = 'Finalizado',
      updated_at = now()
  WHERE id = _ordem_servico_id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false,
    'status', 'completed', 'consumed', v_processed
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_status text;
  v_cancelled integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  SELECT os.company_id, os.status
  INTO v_company_id, v_status
  FROM public.ordens_servico AS os
  WHERE os.id = _ordem_servico_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Service order not found';
  END IF;

  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  IF v_status = 'cancelled' THEN
    RETURN 0;
  END IF;

  IF v_status = 'completed' OR EXISTS (
    SELECT 1 FROM public.material_consumption
    WHERE ordem_servico_id = _ordem_servico_id
      AND company_id = v_company_id
      AND status = 'consumed'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Cancellation blocked: materials already consumed; use an audited manual reversal';
  END IF;

  UPDATE public.material_consumption
  SET status = 'cancelled',
      stock_reservation_id = NULL
  WHERE ordem_servico_id = _ordem_servico_id
    AND company_id = v_company_id
    AND status IN ('pending', 'available');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.stock_reservations
  SET status = 'cancelled',
      cancelled_at = COALESCE(cancelled_at, now()),
      updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND company_id = v_company_id
    AND status = 'reserved';

  UPDATE public.ordens_servico
  SET status = 'cancelled',
      current_stage = 'Cancelado',
      updated_at = now()
  WHERE id = _ordem_servico_id;

  RETURN v_cancelled;
END;
$$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order_items(
  _purchase_order_id uuid,
  _items jsonb,
  _total_actual numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_os_id uuid;
  v_po_status text;
  v_line jsonb;
  v_item_id uuid;
  v_requested_quantity numeric;
  v_actual_cost numeric;
  v_old_received numeric;
  v_delta numeric;
  v_item record;
  v_company_item_id uuid;
  v_received_lines integer := 0;
  v_movement_id uuid;
  v_all_received boolean;
  v_any_received boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Received items must be a JSON array';
  END IF;

  SELECT po.company_id, po.ordem_servico_id, po.status
  INTO v_company_id, v_os_id, v_po_status
  FROM public.purchase_orders AS po
  WHERE po.id = _purchase_order_id
  FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Purchase order not found';
  END IF;

  IF NOT public.user_belongs_to_company(v_user_id, v_company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  IF v_po_status = 'cancelled' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Cancelled purchase orders cannot be received';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    v_item_id := NULLIF(v_line->>'id', '')::uuid;
    v_requested_quantity := NULLIF(v_line->>'received_quantity', '')::numeric;
    v_actual_cost := COALESCE(NULLIF(v_line->>'actual_cost', '')::numeric, 0);

    SELECT poi.*, po.company_id
    INTO v_item
    FROM public.purchase_order_items AS poi
    JOIN public.purchase_orders AS po ON po.id = poi.purchase_order_id
    WHERE poi.id = v_item_id
      AND poi.purchase_order_id = _purchase_order_id
    FOR UPDATE OF poi;

    IF v_item.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Purchase order item not found in this order';
    END IF;

    IF v_requested_quantity IS NULL OR v_requested_quantity <= 0 OR v_requested_quantity > v_item.quantity THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Received quantity must be positive and cannot exceed ordered quantity';
    END IF;

    v_old_received := COALESCE(v_item.received_quantity, 0);
    IF v_requested_quantity < v_old_received THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cumulative received quantity cannot decrease';
    END IF;

    v_delta := v_requested_quantity - v_old_received;
    IF v_delta = 0 THEN
      IF COALESCE(v_item.actual_cost, 0) <> v_actual_cost THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Idempotent replay must keep the original actual cost';
      END IF;
      CONTINUE;
    END IF;

    IF v_item.item_template_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Purchase item is not linked to a stock template';
    END IF;

    SELECT ci.id
    INTO v_company_item_id
    FROM public.company_items AS ci
    WHERE ci.company_id = v_company_id
      AND ci.item_template_id = v_item.item_template_id
      AND ci.is_active = true
    ORDER BY ci.id
    LIMIT 1;

    IF v_company_item_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Item must be registered in company stock before receipt';
    END IF;

    PERFORM cs.id
    FROM public.company_stock AS cs
    WHERE cs.company_id = v_company_id
      AND cs.company_item_id = v_company_item_id
      AND cs.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'Item must be registered in company stock before receipt';
    END IF;

    UPDATE public.company_stock
    SET quantity = quantity + v_delta,
        updated_at = now()
    WHERE company_id = v_company_id
      AND company_item_id = v_company_item_id
      AND is_active = true;

    INSERT INTO public.stock_movements (
      company_id, company_item_id, item_template_id, type, category,
      quantity, unit_cost, valor_financeiro, description,
      reference_id, reference_type, created_by
    ) VALUES (
      v_company_id, v_company_item_id, v_item.item_template_id,
      'entrada', 'compra_fornecedor', v_delta,
      CASE WHEN v_requested_quantity > 0 THEN v_actual_cost / v_requested_quantity ELSE 0 END,
      CASE WHEN v_requested_quantity > 0 THEN (v_actual_cost / v_requested_quantity) * v_delta ELSE 0 END,
      'Recebimento de compra - ' || v_item.description,
      v_item.id, 'purchase_order_item', v_user_id
    )
    RETURNING id INTO v_movement_id;

    UPDATE public.purchase_order_items
    SET received_quantity = v_requested_quantity,
        actual_cost = v_actual_cost,
        status = CASE WHEN v_requested_quantity >= quantity THEN 'received' ELSE 'pending' END,
        received_at = CASE WHEN v_requested_quantity >= quantity THEN COALESCE(received_at, now()) ELSE NULL END,
        updated_at = now()
    WHERE id = v_item.id;

    UPDATE public.os_materials
    SET procurement_status = CASE WHEN v_requested_quantity >= v_item.quantity THEN 'received' ELSE 'ordered' END,
        purchase_order_item_id = v_item.id
    WHERE id = v_item.os_material_id;

    UPDATE public.material_consumption AS mc
    SET purchase_order_item_id = v_item.id
    WHERE v_os_id IS NOT NULL
      AND mc.ordem_servico_id = v_os_id
      AND mc.company_id = v_company_id
      AND mc.item_template_id = v_item.item_template_id
      AND mc.status IN ('pending', 'available');

    v_received_lines := v_received_lines + 1;
  END LOOP;

  SELECT
    COALESCE(bool_and(COALESCE(poi.received_quantity, 0) >= poi.quantity), false),
    COALESCE(bool_or(COALESCE(poi.received_quantity, 0) > 0), false)
  INTO v_all_received, v_any_received
  FROM public.purchase_order_items AS poi
  WHERE poi.purchase_order_id = _purchase_order_id;

  UPDATE public.purchase_orders
  SET status = CASE
        WHEN v_all_received THEN 'received'
        WHEN v_any_received THEN 'partial'
        WHEN status = 'pending' THEN 'pending'
        ELSE 'ordered'
      END,
      total_actual = COALESCE(_total_actual, total_actual),
      received_at = CASE WHEN v_all_received THEN COALESCE(received_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE id = _purchase_order_id;

  IF v_os_id IS NOT NULL THEN
    PERFORM public.reserve_os_materials(v_os_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'received_lines', v_received_lines,
    'idempotent', v_received_lines = 0,
    'status', CASE WHEN v_all_received THEN 'received' WHEN v_any_received THEN 'partial' ELSE v_po_status END
  );
END;
$$;

-- Trigger-backed audit is backend generated; clients still cannot insert audit rows.
DROP TRIGGER IF EXISTS audit_company_stock_changes ON public.company_stock;
CREATE TRIGGER audit_company_stock_changes
AFTER INSERT OR UPDATE OR DELETE ON public.company_stock
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_stock_movements_changes ON public.stock_movements;
CREATE TRIGGER audit_stock_movements_changes
AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_stock_reservations_changes ON public.stock_reservations;
CREATE TRIGGER audit_stock_reservations_changes
AFTER INSERT OR UPDATE OR DELETE ON public.stock_reservations
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_material_consumption_changes ON public.material_consumption;
CREATE TRIGGER audit_material_consumption_changes
AFTER INSERT OR UPDATE OR DELETE ON public.material_consumption
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_purchase_orders_changes ON public.purchase_orders;
CREATE TRIGGER audit_purchase_orders_changes
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

REVOKE ALL ON FUNCTION public.validate_purchase_order_item_scope() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_purchase_order_item_scope() TO service_role;

REVOKE ALL ON FUNCTION public.reserve_os_materials(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_os_material_availability(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_materials_for_production(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_os_production(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_os_production(uuid, jsonb, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_os_materials(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.receive_purchase_order_items(uuid, jsonb, numeric) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.reserve_os_materials(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_os_material_availability(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_materials_for_production(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_os_production(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_os_production(uuid, jsonb, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_os_materials(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order_items(uuid, jsonb, numeric) TO authenticated, service_role;

COMMENT ON FUNCTION public.reserve_os_materials(uuid) IS
  'Idempotently reserves physical stock for active material_consumption requirements without decrementing stock.';
COMMENT ON FUNCTION public.start_os_production(uuid) IS
  'Atomically validates full material reservation and transitions a pending OS into production.';
COMMENT ON FUNCTION public.complete_os_production(uuid, jsonb, uuid[]) IS
  'Atomically consumes reserved stock exactly once and completes the OS.';
COMMENT ON FUNCTION public.receive_purchase_order_items(uuid, jsonb, numeric) IS
  'Idempotently receives cumulative purchase quantities, increments physical stock, and retries OS reservation.';
