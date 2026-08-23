-- Phase 3C read-only contract checks.
-- Transactional fixture/E2E scenarios T01-T45 are executed separately with
-- forced rollback; this file guards the durable schema/API invariants.
DO $phase3c$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_templates'
      AND column_name = 'fulfillment_mode'
  ) THEN RAISE EXCEPTION 'T33-T36: fulfillment_mode missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sale_items'
      AND column_name = 'engineering_snapshot'
  ) THEN RAISE EXCEPTION 'T08-T10/T21/T37-T39: sale snapshot missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_template_items'
      AND column_name = 'component_role'
  ) THEN RAISE EXCEPTION 'T01/T22: fixed component role missing'; END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint constraint_row
    JOIN pg_catalog.pg_class table_row ON table_row.oid = constraint_row.conrelid
    JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
    WHERE schema_row.nspname = 'public'
      AND table_row.relname = 'product_template_items'
      AND constraint_row.contype = 'u'
      AND pg_catalog.pg_get_constraintdef(constraint_row.oid)
          = 'UNIQUE (product_template_id, item_template_id)'
  ) THEN RAISE EXCEPTION 'T01: duplicate component roles are blocked'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class table_row JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = table_row.relnamespace WHERE schema_row.nspname = 'public' AND table_row.relname = 'os_glass_pieces')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class table_row JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = table_row.relnamespace WHERE schema_row.nspname = 'public' AND table_row.relname = 'purchase_order_item_glass_pieces')
  THEN RAISE EXCEPTION 'T17-T20/T40-T44: dedicated glass tables missing'; END IF;

  IF public.phase2a_eval_formula('(L - 132) / 2', 2000, 1200) <> 934
  THEN RAISE EXCEPTION 'T26-T28: safe formula evaluator mismatch'; END IF;

  IF pg_catalog.has_function_privilege('anon', 'public.create_product_parametric_rule_version(uuid,uuid,jsonb,text,boolean)', 'EXECUTE')
     OR pg_catalog.has_table_privilege('anon', 'public.product_parametric_rules', 'INSERT,UPDATE,DELETE')
  THEN RAISE EXCEPTION 'T25: anon can write engineering'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc function_row
    JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = function_row.pronamespace
    WHERE schema_row.nspname = 'public'
      AND function_row.proname = 'create_direct_sale_transactional'
  ) THEN RAISE EXCEPTION 'T10/T45: direct sale RPC missing'; END IF;
END;
$phase3c$;
