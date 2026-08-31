-- A stock exit must consume the physical location that already owns the
-- selected item/variant balance. New entries continue to resolve DEFAULT_STOCK.
-- This compatibility path is intentionally restricted to OUT movements so a
-- review location can be drained without accepting new stock.

DO $migration$
DECLARE
  v_signature text :=
    'public.record_physical_stock_movement(uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb)';
  v_definition text;
  v_guard text := 'IF v_location.id IS NULL OR v_location.needs_review THEN';
BEGIN
  SELECT pg_catalog.pg_get_functiondef(v_signature::regprocedure)
    INTO v_definition;

  IF pg_catalog.strpos(v_definition,v_guard) = 0 THEN
    RAISE EXCEPTION 'Unexpected record_physical_stock_movement definition';
  END IF;

  v_definition := pg_catalog.replace(
    v_definition,
    v_guard,
    'IF v_location.id IS NULL OR (v_location.needs_review AND v_direction <> ''OUT'') THEN'
  );
  EXECUTE v_definition;
END;
$migration$;

DO $migration$
DECLARE
  v_signature text :=
    'public.record_tenant_stock_movement(uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb)';
  v_definition text;
  v_marker text := '  IF v_direction=''OUT'' AND _new_sale_price IS NOT NULL THEN';
  v_replacement text := $replacement$  IF v_direction='OUT' THEN
    -- Prefer DEFAULT_STOCK when it owns enough of the exact identity. If the
    -- only sufficient balance is legacy, consume it in place without asking a
    -- common user to choose a physical location.
    SELECT COALESCE((
      SELECT b.location_id
      FROM public.physical_stock_balances b
      JOIN public.stock_locations l
        ON l.id=b.location_id AND l.company_id=b.company_id AND l.is_active
      WHERE b.company_id=_company_id
        AND b.company_item_id=_company_item_id
        AND b.variant_id IS NOT DISTINCT FROM v_variant.id
        AND b.lot_code=COALESCE(btrim(_lot_code),'')
        AND b.width_mm IS NOT DISTINCT FROM _width_mm
        AND b.height_mm IS NOT DISTINCT FROM _height_mm
        AND b.canonical_quantity >= _original_quantity *
          public.phase3f_unit_factor(
            _company_item_id,_original_unit,_width_mm,_height_mm
          )
      ORDER BY
        CASE WHEN l.code='DEFAULT_STOCK' AND NOT l.needs_review THEN 0 ELSE 1 END,
        b.updated_at,
        b.id
      LIMIT 1
    ),v_location_id)
    INTO v_location_id;
  END IF;

  IF v_direction='OUT' AND _new_sale_price IS NOT NULL THEN$replacement$;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(v_signature::regprocedure)
    INTO v_definition;

  IF pg_catalog.strpos(v_definition,v_marker) = 0 THEN
    RAISE EXCEPTION 'Unexpected record_tenant_stock_movement definition';
  END IF;

  v_definition := pg_catalog.replace(v_definition,v_marker,v_replacement);
  EXECUTE v_definition;
END;
$migration$;

REVOKE ALL ON FUNCTION public.record_physical_stock_movement(
  uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_physical_stock_movement(
  uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) TO authenticated,service_role;

REVOKE ALL ON FUNCTION public.record_tenant_stock_movement(
  uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_tenant_stock_movement(
  uuid,uuid,text,numeric,text,text,uuid,uuid,numeric,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) TO authenticated,service_role;
