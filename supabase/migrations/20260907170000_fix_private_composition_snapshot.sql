-- Fix the private-product branch of the existing snapshot trigger.
-- No historical snapshot is updated.
BEGIN;
DO $migration$
DECLARE
  definition text;
  old_resolver text := $old$    v_expected := public.resolve_company_product_pricing(
      v_company_id,
      NEW.company_product_id,$old$;
  new_resolver text := $new$    v_expected := public.resolve_company_final_product_pricing(
      v_company_id,
      NEW.company_product_id,$new$;
  old_snapshot text := $old$      'product_template_id', NULL,
      'frozen_at', now(),
      'validated_at', now()$old$;
  new_snapshot text := $new$      'product_template_id', NULL,
      'pricing_source', 'COMPOSITION',
      'suggested_price', v_expected->'suggested_price',
      'suggestion_status', v_expected->'suggestion_status',
      'applied_price', NEW.total_price,
      'totals', (v_expected->'totals') || jsonb_build_object(
        'suggested_price', v_expected->'suggested_price',
        'quote_unit_price', NEW.unit_price,
        'quote_total', NEW.total_price
      ),
      'frozen_at', now(),
      'validated_at', now()$new$;
BEGIN
  SELECT pg_get_functiondef('public.trg_freeze_quote_item_composition()'::regprocedure) INTO definition;
  IF md5(definition) <> '13aee0a804f78cdd4af1f5cc1b3d9216'
     OR position(old_resolver IN definition)=0
     OR position(old_snapshot IN definition)=0 THEN
    RAISE EXCEPTION 'PRIVATE_COMPOSITION_SNAPSHOT_DEFINITION_DRIFT';
  END IF;
  EXECUTE replace(replace(definition,old_resolver,new_resolver),old_snapshot,new_snapshot);
END;
$migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
