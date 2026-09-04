-- LINE_BAND quote snapshots must carry the complete commercial selection.
-- The core engineering resolver intentionally strips profile-only fields while
-- calculating cost, but the final resolver is the snapshot authority and must
-- restore the original tenant-scoped variants before validation/persistence.
BEGIN;

DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old_anchor constant text := $old$
  RETURN v_core || jsonb_build_object(
    'engine_version',6,'snapshot_version',5,'pricing_mode','LINE_PRICE_PER_M2',$old$;
  v_new_anchor constant text := $new$
  RETURN v_core || jsonb_build_object(
    'engine_version',6,'snapshot_version',5,'pricing_mode','LINE_PRICE_PER_M2',
    'variants',_variants,$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.resolve_company_final_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb)'::regprocedure
  ) INTO v_definition;

  IF position(v_new_anchor IN v_definition) > 0 THEN
    RETURN;
  END IF;
  IF position(v_old_anchor IN v_definition) = 0 THEN
    RAISE EXCEPTION 'LINE_BAND_SNAPSHOT_VARIANTS_ANCHOR_NOT_FOUND';
  END IF;

  v_updated := replace(v_definition, v_old_anchor, v_new_anchor);
  EXECUTE v_updated;
END;
$migration$;

REVOKE ALL ON FUNCTION public.resolve_company_final_product_pricing(
  uuid,uuid,numeric,numeric,integer,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_company_final_product_pricing(
  uuid,uuid,numeric,numeric,integer,jsonb
) TO authenticated,service_role;

COMMENT ON FUNCTION public.resolve_company_final_product_pricing(
  uuid,uuid,numeric,numeric,integer,jsonb
) IS 'Canonical final-product pricing authority. LINE_BAND results preserve the complete tenant-scoped commercial variant selection for immutable quote snapshots.';

COMMIT;
