-- Read-only assertions for Phase 1A.
-- Run only after applying the migrations to an isolated temporary project.

DO $$
DECLARE
  missing_objects text[];
  insecure_objects text[];
BEGIN
  SELECT array_agg(expected.object_name ORDER BY expected.object_name)
  INTO missing_objects
  FROM (
    VALUES
      ('public.clients.client_type'),
      ('public.quotes.client_id'),
      ('public.material_consumption.os_item_id'),
      ('public.company_enabled_linhas'),
      ('public.company_product_price_lines'),
      ('public.investment_allocations'),
      ('public.stock_offcuts'),
      ('public.quote_financial_status'),
      ('public.reserve_os_materials(uuid)'),
      ('public.handle_new_user()')
  ) AS expected(object_name)
  WHERE CASE expected.object_name
    WHEN 'public.clients.client_type' THEN
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'client_type'
      )
    WHEN 'public.quotes.client_id' THEN
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'client_id'
      )
    WHEN 'public.material_consumption.os_item_id' THEN
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'material_consumption' AND column_name = 'os_item_id'
      )
    ELSE to_regclass(expected.object_name) IS NULL
      AND to_regprocedure(expected.object_name) IS NULL
  END;

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 1A objects missing: %', array_to_string(missing_objects, ', ');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.clients'::regclass
      AND conname = 'clients_client_type_check'
      AND contype = 'c'
  ) THEN
    RAISE EXCEPTION 'clients.client_type check constraint is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname = 'quotes_client_company_fkey'
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'tenant-compatible quotes -> clients FK is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.material_consumption'::regclass
      AND conname = 'material_consumption_os_item_id_fkey'
      AND contype = 'f'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.material_consumption'::regclass
      AND tgname = 'trg_validate_material_consumption_os_item'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'material_consumption.os_item_id FK/tenant trigger is incomplete';
  END IF;

  IF to_regclass('public.uq_stock_reservations_active_os_item') IS NULL THEN
    RAISE EXCEPTION 'active OS reservation uniqueness index is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'f'
      AND confrelid = 'auth.users'::regclass
  ) THEN
    RAISE EXCEPTION 'profiles.user_id -> auth.users FK is missing';
  END IF;

  SELECT array_agg(c.relname ORDER BY c.relname)
  INTO insecure_objects
  FROM pg_class AS c
  JOIN pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN (
      'company_enabled_linhas',
      'company_product_price_lines',
      'investment_allocations',
      'stock_offcuts'
    )
    AND c.relkind = 'r'
    AND NOT c.relrowsecurity;

  IF insecure_objects IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 1A tables without RLS: %', array_to_string(insecure_objects, ', ');
  END IF;

  IF has_function_privilege('anon', 'public.reserve_os_materials(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute reserve_os_materials(uuid)';
  END IF;

  IF has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute handle_new_user()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'quote_financial_status'
      AND 'security_invoker=true' = ANY (COALESCE(c.reloptions, ARRAY[]::text[]))
  ) THEN
    RAISE EXCEPTION 'quote_financial_status must use security_invoker=true';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_created'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Auth profile trigger is missing';
  END IF;
END
$$;
