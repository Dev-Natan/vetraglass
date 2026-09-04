-- Pricing follow-up: quote snapshots must validate the final commercial suggestion,
-- while preserving a quote-only applied price and an explicit manual fallback.
BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old_resolver constant text := $old$
      v_expected := public.resolve_company_product_pricing(
        v_company_id, NEW.company_product_id, NEW.width, NEW.height, NEW.quantity,
        COALESCE(v_supplied->'variants', '{}'::jsonb)
      );$old$;
  v_new_resolver constant text := $new$
      v_expected := public.resolve_company_final_product_pricing(
        v_company_id, NEW.company_product_id, NEW.width, NEW.height, NEW.quantity,
        COALESCE(v_supplied->'variants', '{}'::jsonb)
      );$new$;
  v_old_totals constant text := $old$
          'totals', v_expected->'totals',$old$;
  v_new_totals constant text := $new$
          'totals', (v_expected->'totals') || jsonb_strip_nulls(jsonb_build_object(
            'suggested_price', v_supplied#>'{totals,suggested_price}',
            'applied_product_price', v_supplied#>'{totals,applied_product_price}',
            'additional_components_total', v_supplied#>'{totals,additional_components_total}',
            'quote_unit_price', v_supplied#>'{totals,quote_unit_price}',
            'quote_total', v_supplied#>'{totals,quote_total}'
          )),$new$;
  v_old_declaration constant text := $old$
  v_bad_material text;$old$;
  v_new_declaration constant text := $new$
  v_bad_material text;
  v_fixed jsonb;$new$;
  v_old_fixed constant text := $old$
      NEW.composition_snapshot := public.phase3c_build_fixed_snapshot(
        v_template_id, v_company_id, NEW.width, NEW.height, NEW.quantity,
        NEW.opening_width, NEW.opening_height
      );$old$;
  v_new_fixed constant text := $new$
      v_fixed := public.phase3c_build_fixed_snapshot(
        v_template_id, v_company_id, NEW.width, NEW.height, NEW.quantity,
        NEW.opening_width, NEW.opening_height
      );
      NEW.composition_snapshot := v_fixed || jsonb_strip_nulls(jsonb_build_object(
        'commercial_pricing_method', v_supplied->'commercial_pricing_method',
        'pricing_method', v_supplied->'pricing_method',
        'pricing_method_label', v_supplied->'pricing_method_label',
        'pricing_source', v_supplied->'pricing_source',
        'product_line', v_supplied->'product_line',
        'specification', v_supplied->'specification',
        'dimensions', v_supplied->'dimensions',
        'suggested_price', v_supplied->'suggested_price',
        'applied_product_price', v_supplied->'applied_product_price',
        'applied_price', v_supplied->'applied_price',
        'pricing_unavailable_reason', v_supplied->'pricing_unavailable_reason',
        'totals', (v_fixed->'totals') || jsonb_strip_nulls(jsonb_build_object(
          'suggested_price', v_supplied#>'{totals,suggested_price}',
          'applied_product_price', v_supplied#>'{totals,applied_product_price}',
          'additional_components_total', v_supplied#>'{totals,additional_components_total}',
          'quote_unit_price', v_supplied#>'{totals,quote_unit_price}',
          'quote_total', v_supplied#>'{totals,quote_total}'
        ))
      ));$new$;
BEGIN
  SELECT pg_get_functiondef('public.trg_freeze_quote_item_composition()'::regprocedure)
  INTO v_definition;

  IF position(v_old_resolver IN v_definition)=0
     OR position(v_old_totals IN v_definition)=0
     OR position(v_old_declaration IN v_definition)=0
     OR position(v_old_fixed IN v_definition)=0 THEN
    RAISE EXCEPTION 'QUOTE_SNAPSHOT_VALIDATOR_ANCHOR_NOT_FOUND';
  END IF;

  v_updated := replace(v_definition, v_old_declaration, v_new_declaration);
  v_updated := replace(v_updated, v_old_resolver, v_new_resolver);
  v_updated := replace(v_updated, v_old_totals, v_new_totals);
  v_updated := replace(v_updated, v_old_fixed, v_new_fixed);
  EXECUTE v_updated;
END;
$migration$;

COMMENT ON FUNCTION public.trg_freeze_quote_item_composition() IS
  'Freezes server-validated final pricing suggestions and preserves quote-only applied-price metadata, including manual fallback snapshots.';

COMMIT;
