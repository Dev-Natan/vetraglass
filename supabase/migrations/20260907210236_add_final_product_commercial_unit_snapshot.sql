-- Add an explicit commercial unit for final products and freeze unit-aware quote
-- pricing metadata. This migration is intentionally additive: historical quote
-- snapshots and their established total-price fields are not rewritten.
BEGIN;

ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS commercial_unit text NOT NULL DEFAULT 'M2';

ALTER TABLE public.company_products
  ADD COLUMN IF NOT EXISTS commercial_unit text;

-- Existing products behaved as area-priced products before the unit became
-- explicit. Persist that compatibility once, but require future global
-- templates to choose their unit instead of silently inheriting a default.
ALTER TABLE public.product_templates
  ALTER COLUMN commercial_unit DROP DEFAULT;

-- Private products have no global template from which to inherit. Materialize
-- the previous area behavior for existing private rows; future private rows
-- must state their unit explicitly.
UPDATE public.company_products
SET commercial_unit = 'M2'
WHERE product_template_id IS NULL
  AND commercial_unit IS NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.product_templates'::regclass
      AND conname = 'product_templates_commercial_unit_check'
  ) THEN
    ALTER TABLE public.product_templates
      ADD CONSTRAINT product_templates_commercial_unit_check
      CHECK (commercial_unit IN ('M2', 'UNIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_products'::regclass
      AND conname = 'company_products_commercial_unit_check'
  ) THEN
    ALTER TABLE public.company_products
      ADD CONSTRAINT company_products_commercial_unit_check
      CHECK (commercial_unit IS NULL OR commercial_unit IN ('M2', 'UNIT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.company_products'::regclass
      AND conname = 'company_products_private_commercial_unit_check'
  ) THEN
    ALTER TABLE public.company_products
      ADD CONSTRAINT company_products_private_commercial_unit_check
      CHECK (product_template_id IS NOT NULL OR commercial_unit IS NOT NULL);
  END IF;
END;
$migration$;

COMMENT ON COLUMN public.product_templates.commercial_unit IS
  'Global default commercial unit for the final product. M2 and UNIT are supported; tenant configuration may override it.';
COMMENT ON COLUMN public.company_products.commercial_unit IS
  'Optional tenant-scoped override of the product commercial unit. NULL inherits the global template default.';

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(
    'public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb)'::regprocedure
  ) INTO v_definition;
  v_updated := v_definition;

  v_old := $old$  v_cost numeric;
BEGIN$old$;
  v_new := $new$  v_cost numeric;
  v_commercial_unit text;
  v_commercial_measure numeric;
  v_suggested_unit_price numeric;
BEGIN$new$;
  IF position(v_old IN v_updated) = 0 THEN
    RAISE EXCEPTION 'FINAL_PRICING_COMMERCIAL_UNIT_DECLARATION_ANCHOR_NOT_FOUND';
  END IF;
  v_updated := replace(v_updated, v_old, v_new);

  v_old := $old$  IF v_product.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='PRODUCT_NOT_FOUND';
  END IF;

  BEGIN$old$;
  v_new := $new$  IF v_product.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='PRODUCT_NOT_FOUND';
  END IF;

  SELECT COALESCE(v_product.commercial_unit, pt.commercial_unit)
  INTO v_commercial_unit
  FROM public.product_templates pt
  WHERE pt.id = v_product.product_template_id;
  v_commercial_unit := COALESCE(v_commercial_unit, v_product.commercial_unit);
  IF v_commercial_unit IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MISSING_COMMERCIAL_UNIT';
  END IF;

  BEGIN$new$;
  IF position(v_old IN v_updated) = 0 THEN
    RAISE EXCEPTION 'FINAL_PRICING_COMMERCIAL_UNIT_LOOKUP_ANCHOR_NOT_FOUND';
  END IF;
  v_updated := replace(v_updated, v_old, v_new);

  v_old := $old$  IF v_status='UNAVAILABLE' OR v_component_subtotal IS NULL THEN
    v_labor_amount := 0;
    v_total := NULL;
  ELSE
    v_labor_amount := round(v_component_subtotal*v_labor_percent/100,2);
    v_total := round(v_component_subtotal+v_labor_amount,2);
  END IF;

  v_core := jsonb_set$old$;
  v_new := $new$  IF v_status='UNAVAILABLE' OR v_component_subtotal IS NULL THEN
    v_labor_amount := 0;
    v_total := NULL;
  ELSE
    v_labor_amount := round(v_component_subtotal*v_labor_percent/100,2);
    v_total := round(v_component_subtotal+v_labor_amount,2);
  END IF;

  v_commercial_measure := CASE v_commercial_unit
    WHEN 'M2' THEN NULLIF((v_core#>>'{totals,area_m2}')::numeric, 0)
    WHEN 'UNIT' THEN NULLIF(_quantity::numeric, 0)
    ELSE NULL
  END;
  v_suggested_unit_price := CASE
    WHEN v_total IS NOT NULL AND v_commercial_measure IS NOT NULL
      THEN round(v_total / v_commercial_measure, 4)
    ELSE NULL
  END;

  v_core := jsonb_set$new$;
  IF position(v_old IN v_updated) = 0 THEN
    RAISE EXCEPTION 'FINAL_PRICING_COMMERCIAL_MEASURE_ANCHOR_NOT_FOUND';
  END IF;
  v_updated := replace(v_updated, v_old, v_new);

  v_old := $old$    'component_commercial_subtotal',v_component_subtotal,
    'labor_percent',v_labor_percent,'labor_amount',v_labor_amount,$old$;
  v_new := $new$    'component_commercial_subtotal',v_component_subtotal,
    'composition_total',v_total,
    'commercial_unit',v_commercial_unit,
    'commercial_measure',v_commercial_measure,
    'suggested_unit_price',v_suggested_unit_price,
    'labor_percent',v_labor_percent,'labor_amount',v_labor_amount,$new$;
  IF position(v_old IN v_updated) = 0 THEN
    RAISE EXCEPTION 'FINAL_PRICING_TOTALS_COMMERCIAL_UNIT_ANCHOR_NOT_FOUND';
  END IF;
  v_updated := replace(v_updated, v_old, v_new);

  v_old := $old$    'suggestion_status',v_status,'suggested_price',v_total,
    'commercial_pricing_decision',jsonb_build_object(
      'method','COMPOSITION','status',v_status,$old$;
  v_new := $new$    'suggestion_status',v_status,'suggested_price',v_total,
    'commercial_unit',v_commercial_unit,
    'commercial_measure',v_commercial_measure,
    'composition_total',v_total,
    'suggested_unit_price',v_suggested_unit_price,
    'commercial_pricing_decision',jsonb_build_object(
      'method','COMPOSITION','status',v_status,
      'commercial_unit',v_commercial_unit,
      'commercial_measure',v_commercial_measure,
      'composition_total',v_total,
      'suggested_unit_price',v_suggested_unit_price,$new$;
  IF position(v_old IN v_updated) = 0 THEN
    RAISE EXCEPTION 'FINAL_PRICING_RESULT_COMMERCIAL_UNIT_ANCHOR_NOT_FOUND';
  END IF;
  v_updated := replace(v_updated, v_old, v_new);

  EXECUTE v_updated;
END;
$migration$;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old_declaration constant text := $old$  v_fixed jsonb;$old$;
  v_new_declaration constant text := $new$  v_fixed jsonb;
  v_commercial_unit text;
  v_measure_per_item numeric;
  v_commercial_measure numeric;
  v_applied_unit_price numeric;
  v_suggested_unit_price numeric;$new$;
  v_old_private_snapshot constant text := $old$      'applied_price', NEW.total_price,
      'totals', (v_expected->'totals') || jsonb_build_object(
        'suggested_price', v_expected->'suggested_price',
        'quote_unit_price', NEW.unit_price,
        'quote_total', NEW.total_price
      ),$old$;
  v_new_private_snapshot constant text := $new$      'commercial_unit', v_expected->'commercial_unit',
      'commercial_measure', v_expected->'commercial_measure',
      'area_m2', v_expected#>'{totals,area_m2}',
      'quantity', NEW.quantity,
      'suggested_unit_price', v_expected->'suggested_unit_price',
      'applied_unit_price', round(
        NEW.unit_price / NULLIF(
          CASE v_expected->>'commercial_unit'
            WHEN 'M2' THEN (NEW.width * NEW.height) / 1000000
            WHEN 'UNIT' THEN 1
            ELSE NULL
          END,
          0
        ),
        4
      ),
      'applied_price', NEW.total_price,
      'item_total', NEW.total_price,
      'totals', (v_expected->'totals') || jsonb_strip_nulls(jsonb_build_object(
        'commercial_unit', v_expected->'commercial_unit',
        'commercial_measure', v_expected->'commercial_measure',
        'quantity', NEW.quantity,
        'suggested_unit_price', v_expected->'suggested_unit_price',
        'applied_unit_price', round(
          NEW.unit_price / NULLIF(
            CASE v_expected->>'commercial_unit'
              WHEN 'M2' THEN (NEW.width * NEW.height) / 1000000
              WHEN 'UNIT' THEN 1
              ELSE NULL
            END,
            0
          ),
          4
        ),
        'quote_unit_price', NEW.unit_price,
        'quote_total', NEW.total_price
      )),$new$;
  v_old_finalize constant text := $old$  PERFORM public.phase3c_validate_engineering_snapshot(NEW.composition_snapshot, NEW.fulfillment_mode);$old$;
  v_new_finalize constant text := $new$  IF NEW.company_product_id IS NOT NULL THEN
    v_commercial_unit := NULLIF(v_expected->>'commercial_unit', '');
    IF v_commercial_unit IS NULL THEN
      SELECT COALESCE(cp.commercial_unit, pt.commercial_unit)
      INTO v_commercial_unit
      FROM public.company_products cp
      LEFT JOIN public.product_templates pt ON pt.id = cp.product_template_id
      WHERE cp.id = NEW.company_product_id
        AND cp.company_id = v_company_id;
    END IF;
    IF v_commercial_unit IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MISSING_COMMERCIAL_UNIT';
    END IF;
    v_measure_per_item := CASE v_commercial_unit
      WHEN 'M2' THEN NULLIF((NEW.width * NEW.height) / 1000000, 0)
      WHEN 'UNIT' THEN 1
      ELSE NULL
    END;
    v_commercial_measure := CASE
      WHEN v_measure_per_item IS NOT NULL
        THEN round(v_measure_per_item * NEW.quantity, 6)
      ELSE NULL
    END;
    v_applied_unit_price := CASE
      WHEN v_measure_per_item IS NOT NULL
        THEN round(NEW.unit_price / v_measure_per_item, 4)
      ELSE NULL
    END;
    v_suggested_unit_price := NULLIF(v_expected->>'suggested_unit_price', '')::numeric;

    NEW.composition_snapshot := NEW.composition_snapshot || jsonb_strip_nulls(jsonb_build_object(
      'commercial_unit', v_commercial_unit,
      'commercial_measure', v_commercial_measure,
      'area_m2', NULLIF(v_expected#>>'{totals,area_m2}', '')::numeric,
      'quantity', NEW.quantity,
      'suggested_unit_price', v_suggested_unit_price,
      'applied_unit_price', v_applied_unit_price,
      'applied_price', NEW.total_price,
      'item_total', NEW.total_price,
      'totals', COALESCE(NEW.composition_snapshot->'totals', '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'commercial_unit', v_commercial_unit,
          'commercial_measure', v_commercial_measure,
          'quantity', NEW.quantity,
          'suggested_unit_price', v_suggested_unit_price,
          'applied_unit_price', v_applied_unit_price,
          'quote_unit_price', NEW.unit_price,
          'quote_total', NEW.total_price
        ))
    ));
  END IF;

  PERFORM public.phase3c_validate_engineering_snapshot(NEW.composition_snapshot, NEW.fulfillment_mode);$new$;
BEGIN
  SELECT pg_get_functiondef('public.trg_freeze_quote_item_composition()'::regprocedure)
  INTO v_definition;

  IF position(v_old_declaration IN v_definition) = 0
     OR position(v_old_private_snapshot IN v_definition) = 0
     OR position(v_old_finalize IN v_definition) = 0 THEN
    RAISE EXCEPTION 'QUOTE_COMMERCIAL_UNIT_SNAPSHOT_ANCHOR_NOT_FOUND';
  END IF;

  v_updated := replace(v_definition, v_old_declaration, v_new_declaration);
  v_updated := replace(v_updated, v_old_private_snapshot, v_new_private_snapshot);
  v_updated := replace(v_updated, v_old_finalize, v_new_finalize);
  EXECUTE v_updated;
END;
$migration$;

REVOKE ALL ON FUNCTION public.resolve_company_final_product_pricing(
  uuid,uuid,numeric,numeric,integer,jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_final_product_pricing(
  uuid,uuid,numeric,numeric,integer,jsonb
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.trg_freeze_quote_item_composition()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_freeze_quote_item_composition()
  TO service_role;

COMMENT ON FUNCTION public.resolve_company_final_product_pricing(
  uuid,uuid,numeric,numeric,integer,jsonb
) IS 'Canonical composition pricing authority with explicit M2/UNIT commercial units and backward-compatible total-price fields.';

COMMENT ON FUNCTION public.trg_freeze_quote_item_composition() IS
  'Freezes server-validated composition pricing with explicit commercial unit, measure, suggested unit price, and quote-specific applied unit price.';

NOTIFY pgrst, 'reload schema';
COMMIT;
