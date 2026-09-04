-- Pricing follow-up: a missing legacy component price must not prevent the
-- server from freezing the technical FIXED snapshot for a manually priced quote.
-- Missing commercial values remain explicit (NULL + warning/count), never zero.
BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old_declaration constant text := $old$
  v_total_cost numeric := 0;
  v_total_price numeric := 0;$old$;
  v_new_declaration constant text := $new$
  v_total_cost numeric := 0;
  v_total_price numeric := 0;
  v_missing_cost_items integer := 0;
  v_missing_price_items integer := 0;
  v_warnings jsonb := '[]'::jsonb;$new$;
  v_old_price_lookup constant text := $old$
    SELECT cip.* INTO v_price
    FROM public.company_item_prices cip
    WHERE cip.company_id = _company_id
      AND cip.item_template_id = v_component.item_template_id;
    IF v_price.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE',
        DETAIL = v_component.item_template_id::text;
    END IF;$old$;
  v_new_price_lookup constant text := $new$
    SELECT cip.* INTO v_price
    FROM public.company_item_prices cip
    WHERE cip.company_id = _company_id
      AND cip.item_template_id = v_component.item_template_id;

    -- company_item_prices is legacy compatibility data, not a prerequisite for
    -- a technical snapshot. Preserve known cost, but keep an absent commercial
    -- price NULL so a manual quote never disguises it as a valid zero price.
    IF v_price.id IS NULL THEN
      SELECT NULL::uuid AS id,
             v_company_item.cost::numeric AS cost,
             NULL::numeric AS price
      INTO v_price;
    END IF;
    IF v_price.cost IS NULL THEN
      v_missing_cost_items := v_missing_cost_items + 1;
    END IF;
    IF v_price.price IS NULL THEN
      v_missing_price_items := v_missing_price_items + 1;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'MISSING_PRICE',
        'item_template_id', v_component.item_template_id,
        'company_item_id', v_company_item.id,
        'item_name', v_company_item.name
      ));
    END IF;$new$;
  v_old_total_accumulator constant text := $old$
    v_total_price := v_total_price + round(v_stock_quantity * v_price.price, 2);$old$;
  v_new_total_accumulator constant text := $new$
    v_total_price := v_total_price
      + COALESCE(round(v_stock_quantity * v_price.price, 2), 0);$new$;
  v_old_summary constant text := $old$
      'missing_cost_items', 0,
      'missing_price_items', 0
    ),
    'warnings', '[]'::jsonb,$old$;
  v_new_summary constant text := $new$
      'missing_cost_items', v_missing_cost_items,
      'missing_price_items', v_missing_price_items
    ),
    'warnings', v_warnings,$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.phase3c_build_fixed_snapshot(uuid,uuid,numeric,numeric,integer,numeric,numeric)'::regprocedure
  ) INTO v_definition;

  IF position(v_old_declaration IN v_definition) = 0
     OR position(v_old_price_lookup IN v_definition) = 0
     OR position(v_old_total_accumulator IN v_definition) = 0
     OR position(v_old_summary IN v_definition) = 0 THEN
    RAISE EXCEPTION 'FIXED_SNAPSHOT_MANUAL_FALLBACK_ANCHOR_NOT_FOUND';
  END IF;

  v_updated := replace(v_definition, v_old_declaration, v_new_declaration);
  v_updated := replace(v_updated, v_old_price_lookup, v_new_price_lookup);
  v_updated := replace(v_updated, v_old_total_accumulator, v_new_total_accumulator);
  v_updated := replace(v_updated, v_old_summary, v_new_summary);
  EXECUTE v_updated;
END;
$migration$;

COMMENT ON FUNCTION public.phase3c_build_fixed_snapshot(
  uuid, uuid, numeric, numeric, integer, numeric, numeric
) IS
  'Builds a server-derived FIXED engineering snapshot; missing legacy prices remain explicit warnings so quote-specific manual pricing can proceed safely.';

COMMIT;
