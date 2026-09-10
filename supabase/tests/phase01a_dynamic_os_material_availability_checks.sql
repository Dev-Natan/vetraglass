-- Phase 01A dynamic OS material availability checks (DA01+).
-- Every fixture and physical movement is transaction-scoped and rolled back.

BEGIN;

CREATE TEMP TABLE phase01a_ctx AS
SELECT uc.company_id, uc.user_id
FROM public.user_companies uc
WHERE uc.is_active AND uc.role = 'admin'
ORDER BY uc.created_at
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM phase01a_ctx) THEN
    RAISE EXCEPTION 'DA_SETUP_ADMIN_CONTEXT_MISSING';
  END IF;
END;
$$;

SELECT set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', (SELECT user_id FROM phase01a_ctx),
    'role', 'authenticated'
  )::text,
  true
);

CREATE OR REPLACE FUNCTION pg_temp.da_make_requirement(
  _company_id uuid,
  _company_item_id uuid,
  _required_quantity numeric,
  _label text,
  _variant_id uuid DEFAULT NULL
)
RETURNS TABLE(requirement_id uuid, os_id uuid, os_material_id uuid)
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_id uuid;
  v_os_id uuid;
  v_material_id uuid;
  v_item public.company_items;
  v_units public.inventory_item_units;
BEGIN
  SELECT * INTO v_item
  FROM public.company_items
  WHERE id = _company_item_id AND company_id = _company_id AND is_active;

  SELECT * INTO v_units
  FROM public.inventory_item_units
  WHERE company_id = _company_id
    AND company_item_id = _company_item_id
    AND legacy_status = 'CONFIGURED';

  IF v_item.id IS NULL OR v_units.id IS NULL THEN
    RAISE EXCEPTION 'DA_SETUP_ITEM_CONTRACT_MISSING';
  END IF;

  INSERT INTO public.quotes(
    company_id, quote_number, customer_name, status, total_amount, final_amount
  ) VALUES (
    _company_id, -1, 'Phase 01A ' || _label, 'pending', 0, 0
  ) RETURNING id INTO v_quote_id;

  INSERT INTO public.ordens_servico(
    company_id, quote_id, customer_name, status,
    total_amount, paid_amount, pending_amount
  ) VALUES (
    _company_id, v_quote_id, 'Phase 01A ' || _label, 'pending', 0, 0, 0
  ) RETURNING id INTO v_os_id;

  INSERT INTO public.os_materials(
    ordem_servico_id, company_item_id, item_template_id, item_name, item_type,
    pieces_count, required_quantity, unit, snapshot_key, snapshot_payload
  ) VALUES (
    v_os_id, v_item.id, v_item.item_template_id, v_item.name, v_item.type,
    1, _required_quantity, v_units.consumption_unit,
    'phase01a-' || _label || '-' || gen_random_uuid()::text,
    jsonb_build_object('source', 'phase01a-test', 'variant_id', _variant_id)
  ) RETURNING id INTO v_material_id;

  INSERT INTO public.material_purchase_requirements(
    company_id, ordem_servico_id, os_material_id, company_item_id,
    item_template_id, variant_id, required_quantity, required_unit,
    required_canonical_quantity, canonical_unit, consumption_unit,
    purchase_unit, purchase_to_canonical_factor,
    consumption_to_canonical_factor, purchase_allows_fractional,
    priority, lifecycle_status, created_by
  ) VALUES (
    _company_id, v_os_id, v_material_id, v_item.id,
    v_item.item_template_id, _variant_id, _required_quantity,
    v_units.consumption_unit,
    _required_quantity * v_units.consumption_to_canonical_factor,
    v_units.canonical_unit, v_units.consumption_unit, v_units.purchase_unit,
    v_units.purchase_to_canonical_factor,
    v_units.consumption_to_canonical_factor,
    public.phase3f_normalize_unit(v_units.purchase_unit) NOT IN ('BAR', 'UNIT'),
    'NORMAL', 'ACTIVE', (SELECT user_id FROM phase01a_ctx)
  ) RETURNING id INTO requirement_id;

  os_id := v_os_id;
  os_material_id := v_material_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.da_item(_result jsonb, _requirement_id uuid)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT value
  FROM jsonb_array_elements(_result->'items')
  WHERE value->>'requirement_id' = _requirement_id::text
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION pg_temp.da_table_digest(_table regclass)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE v_digest text;
BEGIN
  EXECUTE format(
    'SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.id)::text, ''[]'')) FROM %s t',
    _table
  ) INTO v_digest;
  RETURN v_digest;
END;
$$;

DO $$
DECLARE
  v_company uuid;
  v_user uuid;
  v_company_b uuid;
  v_location uuid;
  v_unit_item uuid;
  v_profile_item uuid;
  v_glass_item uuid;
  v_variant_a uuid;
  v_variant_b uuid;
  v_req_main uuid;
  v_req_compete_a uuid;
  v_req_compete_b uuid;
  v_req_variant uuid;
  v_req_profile uuid;
  v_req_glass uuid;
  v_os_main uuid;
  v_os_compete_a uuid;
  v_os_compete_b uuid;
  v_os_foreign uuid;
  v_os_variant uuid;
  v_os_profile uuid;
  v_os_glass uuid;
  v_quote_foreign uuid;
  v_material_main uuid;
  v_balance uuid;
  v_po uuid;
  v_po_item uuid;
  v_result jsonb;
  v_row jsonb;
  v_before_reservations bigint;
  v_negative_rejected boolean := false;
  v_tables text[] := ARRAY[
    'material_purchase_requirements', 'stock_reservations',
    'purchase_orders', 'purchase_order_items',
    'purchase_order_item_requirement_allocations', 'stock_movements',
    'physical_stock_balances', 'material_consumption', 'os_materials',
    'os_glass_pieces', 'ordens_servico'
  ];
  v_table text;
  v_before text;
BEGIN
  SELECT company_id, user_id INTO v_company, v_user FROM phase01a_ctx;
  SELECT id INTO v_location
  FROM public.stock_locations
  WHERE company_id = v_company AND code = 'DEFAULT_STOCK'
    AND is_active AND NOT needs_review;
  IF v_location IS NULL THEN RAISE EXCEPTION 'DA_SETUP_LOCATION_MISSING'; END IF;

  INSERT INTO public.company_items(
    company_id, name, type, unit, pricing_unit, pricing_basis,
    is_custom, is_active
  ) VALUES (
    v_company, 'Phase 01A unit item', 'accessory', 'un', 'un', 'UNIT', true, true
  ) RETURNING id INTO v_unit_item;

  INSERT INTO public.company_items(
    company_id, name, type, unit, pricing_unit, pricing_basis,
    bar_length_mm, is_custom, is_active
  ) VALUES (
    v_company, 'Phase 01A profile item', 'profile', 'm', 'm', 'LENGTH',
    6000, true, true
  ) RETURNING id INTO v_profile_item;

  INSERT INTO public.company_items(
    company_id, name, type, unit, pricing_unit, pricing_basis,
    commercial_material_family, is_custom, is_active
  ) VALUES (
    v_company, 'Painel técnico sem heurística nominal', 'glass', 'm²', 'm²',
    'AREA', 'GLASS', true, true
  ) RETURNING id INTO v_glass_item;

  INSERT INTO public.company_item_variants(
    company_id, company_item_id, variant_type, profile_color, profile_finish,
    pricing_basis, pricing_mode, pricing_source
  ) VALUES (
    v_company, v_profile_item, 'PROFILE', 'DA-COLOR-A', 'DA-FINISH',
    'LENGTH', 'MANUAL', 'MANUAL'
  ) RETURNING id INTO v_variant_a;

  INSERT INTO public.company_item_variants(
    company_id, company_item_id, variant_type, profile_color, profile_finish,
    pricing_basis, pricing_mode, pricing_source
  ) VALUES (
    v_company, v_profile_item, 'PROFILE', 'DA-COLOR-B', 'DA-FINISH',
    'LENGTH', 'MANUAL', 'MANUAL'
  ) RETURNING id INTO v_variant_b;

  SELECT requirement_id, os_id, os_material_id
  INTO v_req_main, v_os_main, v_material_main
  FROM pg_temp.da_make_requirement(v_company, v_unit_item, 10, 'main');

  -- DA01, DA03, DA08, DA14 and DA20: tenant member, no stock, no reservation.
  SELECT count(*) INTO v_before_reservations FROM public.stock_reservations;
  v_result := public.get_os_dynamic_material_availability(v_os_main);
  v_row := pg_temp.da_item(v_result, v_req_main);
  IF v_row IS NULL OR (v_row->>'physical_on_hand')::numeric <> 0
     OR (v_row->>'available_for_os')::numeric <> 0
     OR (v_row->>'missing_quantity')::numeric <> 10
     OR v_row->>'status' <> 'TO_BUY' THEN
    RAISE EXCEPTION 'DA01_DA03_DA14_DA20_ZERO_STOCK';
  END IF;
  IF (SELECT count(*) FROM public.stock_reservations) <> v_before_reservations THEN
    RAISE EXCEPTION 'DA08_QUERY_CREATED_RESERVATION';
  END IF;

  -- DA04 and DA19: partial current physical stock.
  PERFORM public.record_physical_stock_movement(
    v_company, v_unit_item, 'IN', 4, 'UNIT', v_location,
    'DA04_PARTIAL', NULL, NULL, 0, gen_random_uuid()
  );
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_main), v_req_main
  );
  IF (v_row->>'physical_on_hand')::numeric <> 4
     OR (v_row->>'available_for_os')::numeric <> 4
     OR (v_row->>'missing_quantity')::numeric <> 6
     OR v_row->>'status' <> 'PARTIAL' THEN
    RAISE EXCEPTION 'DA04_DA19_PARTIAL_STOCK';
  END IF;

  -- DA05, DA06 and DA18: decisive +6 entry is visible without reconciliation.
  PERFORM public.record_physical_stock_movement(
    v_company, v_unit_item, 'IN', 6, 'UNIT', v_location,
    'DA06_DECISIVE_ENTRY', NULL, NULL, 0, gen_random_uuid()
  );
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_main), v_req_main
  );
  IF (v_row->>'required_quantity')::numeric <> 10
     OR (v_row->>'physical_on_hand')::numeric <> 10
     OR (v_row->>'available_for_os')::numeric <> 10
     OR (v_row->>'missing_quantity')::numeric <> 0
     OR v_row->>'status' <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'DA05_DA06_DA18_DECISIVE_ENTRY';
  END IF;

  -- DA07: canonical physical exit is visible on the next query.
  PERFORM public.record_physical_stock_movement(
    v_company, v_unit_item, 'OUT', 3, 'UNIT', v_location,
    'DA07_EXIT', NULL, NULL, NULL, gen_random_uuid()
  );
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_main), v_req_main
  );
  IF (v_row->>'available_for_os')::numeric <> 7
     OR (v_row->>'missing_quantity')::numeric <> 3 THEN
    RAISE EXCEPTION 'DA07_EXIT_NOT_VISIBLE';
  END IF;
  PERFORM public.record_physical_stock_movement(
    v_company, v_unit_item, 'IN', 3, 'UNIT', v_location,
    'DA_RESTORE_FOR_CONCURRENCY', NULL, NULL, 0, gen_random_uuid()
  );

  -- DA09 and DA10: two OS compete for 10 UNIT; A owns a reservation of 6.
  SELECT requirement_id, os_id INTO v_req_compete_a, v_os_compete_a
  FROM pg_temp.da_make_requirement(v_company, v_unit_item, 6, 'compete-a');
  SELECT requirement_id, os_id INTO v_req_compete_b, v_os_compete_b
  FROM pg_temp.da_make_requirement(v_company, v_unit_item, 6, 'compete-b');
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_compete_a), v_req_compete_a
  );
  IF (v_row->>'reserved_total')::numeric <> 0
     OR (v_row->>'available_for_os')::numeric <> 10 THEN
    RAISE EXCEPTION 'DA09_UNRESERVED_OS_A_PHYSICAL_VIEW';
  END IF;
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_compete_b), v_req_compete_b
  );
  IF (v_row->>'reserved_total')::numeric <> 0
     OR (v_row->>'available_for_os')::numeric <> 10 THEN
    RAISE EXCEPTION 'DA10_UNRESERVED_OS_B_PHYSICAL_VIEW';
  END IF;
  SELECT id INTO v_balance
  FROM public.physical_stock_balances
  WHERE company_id = v_company AND company_item_id = v_unit_item
    AND variant_id IS NULL AND location_id = v_location;
  INSERT INTO public.stock_reservations(
    company_id, company_item_id, ordem_servico_id, quantity_reserved, unit,
    status, created_by, canonical_quantity, canonical_unit, conversion_factor,
    variant_id, location_id, material_requirement_id, physical_stock_balance_id
  ) VALUES (
    v_company, v_unit_item, v_os_compete_a, 6, 'UNIT', 'reserved', v_user,
    6, 'UNIT', 1, NULL, v_location, v_req_compete_a, v_balance
  );

  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_compete_a), v_req_compete_a
  );
  IF (v_row->>'reserved_total')::numeric <> 6
     OR (v_row->>'reserved_for_this_os')::numeric <> 6
     OR (v_row->>'available_free')::numeric <> 4
     OR (v_row->>'available_for_os')::numeric <> 10
     OR (v_row->>'missing_quantity')::numeric <> 0 THEN
    RAISE EXCEPTION 'DA09_OWN_RESERVATION_MATH';
  END IF;
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_compete_b), v_req_compete_b
  );
  IF (v_row->>'reserved_total')::numeric <> 6
     OR (v_row->>'reserved_for_this_os')::numeric <> 0
     OR (v_row->>'available_for_os')::numeric <> 4
     OR (v_row->>'missing_quantity')::numeric <> 2 THEN
    RAISE EXCEPTION 'DA10_OTHER_OS_RESERVATION_MATH';
  END IF;

  -- DA11: an open purchase is reported separately and never added to stock.
  INSERT INTO public.purchase_orders(company_id, supplier_name, status, created_by)
  VALUES(v_company, 'DA supplier', 'pending', v_user) RETURNING id INTO v_po;
  INSERT INTO public.purchase_order_items(
    purchase_order_id, description, quantity, unit, estimated_cost, status,
    company_item_id, purchase_unit, purchase_to_canonical_factor,
    ordered_canonical_quantity, received_canonical_quantity,
    purchase_allows_fractional
  ) VALUES (
    v_po, 'DA open coverage', 6, 'UNIT', 0, 'pending', v_unit_item,
    'UNIT', 1, 6, 0, false
  ) RETURNING id INTO v_po_item;
  INSERT INTO public.purchase_order_item_requirement_allocations(
    company_id, purchase_order_item_id, material_requirement_id,
    allocated_canonical_quantity, received_canonical_quantity, status, created_by
  ) VALUES(v_company, v_po_item, v_req_main, 6, 0, 'OPEN', v_user);
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_main), v_req_main
  );
  IF (v_row->>'purchase_coverage_open')::numeric <> 6
     OR (v_row->>'physical_on_hand')::numeric <> 10
     OR (v_row->>'available_for_os')::numeric <> 4 THEN
    RAISE EXCEPTION 'DA11_PURCHASE_IS_NOT_PHYSICAL_STOCK';
  END IF;

  -- DA12: a different variant never satisfies the requirement.
  PERFORM public.record_physical_stock_movement(
    v_company, v_profile_item, 'IN', 2, 'M', v_location,
    'DA12_WRONG_VARIANT', v_variant_b, NULL, 0, gen_random_uuid()
  );
  SELECT requirement_id, os_id INTO v_req_variant, v_os_variant
  FROM pg_temp.da_make_requirement(
    v_company, v_profile_item, 1, 'variant-a', v_variant_a
  );
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_variant), v_req_variant
  );
  IF (v_row->>'physical_on_hand')::numeric <> 0
     OR (v_row->>'missing_quantity')::numeric <> 1000
     OR v_row->>'company_item_variant_id' <> v_variant_a::text THEN
    RAISE EXCEPTION 'DA12_INCOMPATIBLE_VARIANT';
  END IF;

  -- DA13 and DA21: canonical units/hotfix aliases and estimated profile length.
  SELECT requirement_id, os_id INTO v_req_profile, v_os_profile
  FROM pg_temp.da_make_requirement(
    v_company, v_profile_item, 1, 'profile-linear', v_variant_a
  );
  PERFORM public.record_physical_stock_movement(
    v_company, v_profile_item, 'IN', 2, 'M', v_location,
    'DA13_PROFILE', v_variant_a, NULL, 0, gen_random_uuid()
  );
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_profile), v_req_profile
  );
  IF v_row->>'canonical_unit' <> 'MM'
     OR (v_row->>'required_quantity')::numeric <> 1000
     OR (v_row->>'available_for_os')::numeric <> 2000
     OR v_row->>'availability_precision' <> 'ESTIMATED'
     OR public.phase3f_normalize_unit('BAR') <> 'BAR'
     OR public.phase3f_normalize_unit('M') <> 'M'
     OR public.phase3f_normalize_unit('MM') <> 'MM'
     OR public.phase3f_normalize_unit('m²') <> 'M2'
     OR public.phase3f_normalize_unit('mm²') <> 'MM2'
     OR public.phase3f_normalize_unit('UN') <> 'UNIT' THEN
    RAISE EXCEPTION 'DA13_DA21_CANONICAL_UNITS_OR_PROFILE_PRECISION';
  END IF;

  -- DA22: glass is identified by metadata, not its name; area cannot prove fit.
  SELECT requirement_id, os_id INTO v_req_glass, v_os_glass
  FROM pg_temp.da_make_requirement(v_company, v_glass_item, 1, 'glass-dimensional');
  PERFORM public.record_physical_stock_movement(
    v_company, v_glass_item, 'IN', 2, 'M2', v_location,
    'DA22_GLASS_AREA', NULL, NULL, 0, gen_random_uuid()
  );
  v_row := pg_temp.da_item(
    public.get_os_dynamic_material_availability(v_os_glass), v_req_glass
  );
  IF v_row->>'canonical_unit' <> 'MM2'
     OR (v_row->>'physical_on_hand')::numeric <> 2000000
     OR v_row->>'availability_precision' <> 'UNSUPPORTED'
     OR (v_row->>'dimension_validation_required')::boolean IS NOT TRUE
     OR v_row->>'available_for_os' IS NOT NULL
     OR v_row->>'missing_quantity' IS NOT NULL
     OR v_row->>'status' = 'AVAILABLE' THEN
    RAISE EXCEPTION 'DA22_GLASS_DIMENSIONAL_LIMIT';
  END IF;

  -- DA02: a user cannot query another tenant's service order.
  INSERT INTO public.companies(name)
  VALUES('Phase 01A foreign tenant ' || gen_random_uuid()::text)
  RETURNING id INTO v_company_b;
  INSERT INTO public.quotes(
    company_id, quote_number, customer_name, status, total_amount, final_amount
  ) VALUES (
    v_company_b, -2, 'Phase 01A foreign quote', 'pending', 0, 0
  ) RETURNING id INTO v_quote_foreign;
  INSERT INTO public.ordens_servico(
    company_id, quote_id, customer_name, status,
    total_amount, paid_amount, pending_amount
  ) VALUES(v_company_b, v_quote_foreign, 'DA foreign OS', 'pending', 0, 0, 0)
  RETURNING id INTO v_os_foreign;
  BEGIN
    PERFORM public.get_os_dynamic_material_availability(v_os_foreign);
    RAISE EXCEPTION 'DA02_EXPECTED_UNAUTHORIZED_NOT_RAISED';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'UNAUTHORIZED' THEN RAISE; END IF;
  END;

  -- DA15: canonical storage rejects negative physical balances.
  BEGIN
    UPDATE public.physical_stock_balances
    SET canonical_quantity = -1
    WHERE id = v_balance;
  EXCEPTION WHEN check_violation THEN
    v_negative_rejected := true;
  END;
  IF NOT v_negative_rejected THEN
    RAISE EXCEPTION 'DA15_NEGATIVE_BALANCE_ACCEPTED';
  END IF;

  -- DA16 and DA17: replay returns the same result and mutates none of the
  -- authoritative/operational tables named in the Phase 01A contract.
  CREATE TEMP TABLE da_side_effect_snapshot(
    table_name text PRIMARY KEY,
    digest text NOT NULL
  ) ON COMMIT DROP;
  FOREACH v_table IN ARRAY v_tables LOOP
    INSERT INTO da_side_effect_snapshot(table_name, digest)
    VALUES(v_table, pg_temp.da_table_digest(('public.' || v_table)::regclass));
  END LOOP;

  v_result := public.get_os_dynamic_material_availability(v_os_main);
  IF v_result IS DISTINCT FROM public.get_os_dynamic_material_availability(v_os_main) THEN
    RAISE EXCEPTION 'DA16_NON_DETERMINISTIC_REPLAY';
  END IF;
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT digest INTO v_before
    FROM da_side_effect_snapshot WHERE table_name = v_table;
    IF v_before IS DISTINCT FROM pg_temp.da_table_digest(('public.' || v_table)::regclass) THEN
      RAISE EXCEPTION 'DA17_SIDE_EFFECT_%', upper(v_table);
    END IF;
  END LOOP;

  IF has_function_privilege(
       'anon', 'public.get_os_dynamic_material_availability(uuid)', 'execute'
     ) OR NOT has_function_privilege(
       'authenticated', 'public.get_os_dynamic_material_availability(uuid)', 'execute'
     ) THEN
    RAISE EXCEPTION 'DA01_FUNCTION_PRIVILEGES';
  END IF;
END;
$$;

SELECT 'GREEN' AS phase01a_da01_da22;
ROLLBACK;
