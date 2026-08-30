-- Phase 4B.1B: make company_product_id the canonical commercial identity.
-- product_template_id remains nullable origin metadata for global products.

ALTER TABLE public.company_products
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS catalog_origin text
    GENERATED ALWAYS AS (
      CASE WHEN product_template_id IS NULL THEN 'PRIVATE' ELSE 'GLOBAL' END
    ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_products_private_code
  ON public.company_products (company_id, upper(btrim(code)))
  WHERE product_template_id IS NULL AND NULLIF(btrim(code), '') IS NOT NULL;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_private_branch constant text := $branch$

  -- A private company product uses the same canonical pricing resolver as a
  -- product activated from the global catalog. The template is optional.
  IF NEW.company_product_id IS NOT NULL AND v_template_id IS NULL THEN
    SELECT jsonb_build_object(
      'product_name', cp.commercial_name,
      'product_code', cp.code,
      'product_origin', cp.catalog_origin
    )
    INTO v_supplied
    FROM public.company_products cp
    WHERE cp.id = NEW.company_product_id
      AND cp.company_id = v_company_id
      AND cp.is_active = true;

    IF v_supplied IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'PRODUCT_NOT_FOUND';
    END IF;
    IF COALESCE(NEW.width, 0) <= 0 OR COALESCE(NEW.height, 0) <= 0
       OR COALESCE(NEW.quantity, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_SNAPSHOT',
        DETAIL = 'invalid_dimensions_or_quantity';
    END IF;

    v_expected := public.resolve_company_product_pricing(
      v_company_id,
      NEW.company_product_id,
      NEW.width,
      NEW.height,
      NEW.quantity,
      CASE
        WHEN jsonb_typeof(NEW.composition_snapshot->'variants') = 'object'
          THEN NEW.composition_snapshot->'variants'
        ELSE '{}'::jsonb
      END
    );

    -- Freeze the exact formulas and tenant-scoped component identity used by
    -- the resolver. Historical rows therefore never need to query live setup.
    SELECT jsonb_set(
      v_expected,
      '{materials}',
      COALESCE(jsonb_agg(
        material || jsonb_strip_nulls(jsonb_build_object(
          'quantity_formula', component.quantity_formula,
          'width_formula', component.width_formula,
          'height_formula', component.height_formula,
          'pieces_formula', component.pieces_formula,
          'pieces_quantity', component.pieces_quantity,
          'loss_percent', component.loss_percent,
          'component_company_id', component.company_id
        ))
        ORDER BY material_ordinality
      ), '[]'::jsonb),
      true
    )
    INTO v_expected
    FROM jsonb_array_elements(v_expected->'materials')
      WITH ORDINALITY AS resolved(material, material_ordinality)
    LEFT JOIN public.company_product_items component
      ON component.id = NULLIF(resolved.material->>'key', '')::uuid
     AND component.company_product_id = NEW.company_product_id
     AND component.company_id = v_company_id;

    NEW.product_template_id := NULL;
    NEW.composition_mode := 'fixed';
    NEW.fulfillment_mode := COALESCE(v_expected->>'fulfillment_mode', 'PRODUCTION');
    NEW.composition_snapshot := v_expected || v_supplied || jsonb_build_object(
      'product_template_id', NULL,
      'frozen_at', now(),
      'validated_at', now()
    );

    PERFORM public.phase3c_validate_engineering_snapshot(
      NEW.composition_snapshot,
      NEW.fulfillment_mode
    );
    NEW.snapshot_version := COALESCE(
      (NEW.composition_snapshot->>'snapshot_version')::integer,
      4
    );
    NEW.parametric_snapshot_version := NULL;
    RETURN NEW;
  END IF;
$branch$;
  v_metadata_branch constant text := $metadata$

  -- Global and private products expose the same immutable commercial metadata.
  IF NEW.company_product_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'product_origin', cp.catalog_origin,
      'product_name', cp.commercial_name,
      'product_code', cp.code
    )
    INTO v_supplied
    FROM public.company_products cp
    WHERE cp.id = NEW.company_product_id
      AND cp.company_id = v_company_id;

    IF v_supplied IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'PRODUCT_NOT_FOUND';
    END IF;
    NEW.composition_snapshot := NEW.composition_snapshot || v_supplied;
  END IF;
$metadata$;
  v_anchor constant text := $anchor$
  IF v_template_id IS NOT NULL THEN
$anchor$;
  v_final_anchor constant text := $final_anchor$
  PERFORM public.phase3c_validate_engineering_snapshot(NEW.composition_snapshot, NEW.fulfillment_mode);
$final_anchor$;
BEGIN
  SELECT pg_get_functiondef(
    'public.trg_freeze_quote_item_composition()'::regprocedure
  ) INTO v_definition;

  IF position(v_anchor IN v_definition) = 0 THEN
    RAISE EXCEPTION 'PHASE4B1B_TRIGGER_ANCHOR_NOT_FOUND';
  END IF;
  v_updated := replace(
    v_definition,
    v_anchor,
    v_private_branch || E'\n' || v_anchor
  );

  IF position(v_final_anchor IN v_updated) = 0 THEN
    RAISE EXCEPTION 'PHASE4B1B_TRIGGER_FINAL_ANCHOR_NOT_FOUND';
  END IF;
  v_updated := replace(
    v_updated,
    v_final_anchor,
    v_metadata_branch || E'\n' || v_final_anchor
  );

  EXECUTE v_updated;
END;
$migration$;

REVOKE ALL ON FUNCTION public.trg_freeze_quote_item_composition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_freeze_quote_item_composition() FROM anon;
REVOKE ALL ON FUNCTION public.trg_freeze_quote_item_composition() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.trg_freeze_quote_item_composition() TO service_role;

COMMENT ON COLUMN public.company_products.product_template_id IS
  'Nullable global-catalog origin metadata. company_id + company_product_id is the canonical tenant identity.';
COMMENT ON COLUMN public.company_products.catalog_origin IS
  'Derived origin metadata: GLOBAL when backed by a product template, otherwise PRIVATE.';
COMMENT ON FUNCTION public.resolve_company_product_pricing(uuid, uuid, numeric, numeric, integer, jsonb) IS
  'Canonical tenant pricing and composition resolver. Identifies products by company_id + company_product_id; product_template_id is optional metadata.';

NOTIFY pgrst, 'reload schema';
