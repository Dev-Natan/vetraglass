-- A material snapshot is canonically identified by either its global template
-- origin or its tenant-scoped company item. Private items intentionally have no
-- item_template_id and must not be rejected by the shared validator.
DO $migration$
DECLARE
  v_definition text;
  v_updated text;
  v_old constant text := $old$OR NULLIF(material->>'item_template_id', '') IS NULL$old$;
  v_new constant text := $new$OR (
         NULLIF(material->>'item_template_id', '') IS NULL
         AND NULLIF(material->>'company_item_id', '') IS NULL
       )$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.phase3c_validate_engineering_snapshot(jsonb,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'PHASE4B1B_VALIDATOR_ANCHOR_NOT_FOUND';
  END IF;

  v_updated := replace(v_definition, v_old, v_new);
  EXECUTE v_updated;
END;
$migration$;

COMMENT ON FUNCTION public.phase3c_validate_engineering_snapshot(jsonb, text) IS
  'Validates frozen engineering snapshots. Materials require a global item_template_id or a tenant-scoped company_item_id.';
