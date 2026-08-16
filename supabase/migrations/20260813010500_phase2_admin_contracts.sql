-- Phase 2: restore the admin migration-history RPC expected by the frontend.
-- The historical chain is reference-only; this migration targets the official baseline.

CREATE OR REPLACE FUNCTION public.list_schema_migrations()
RETURNS TABLE (
  version text,
  name text,
  applied_at timestamptz,
  statements_count integer,
  preview text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, supabase_migrations
AS $$
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.version,
    m.name,
    CASE
      WHEN m.version ~ '^\d{14}'
        THEN to_timestamp(substring(m.version FROM 1 FOR 14), 'YYYYMMDDHH24MISS')
      ELSE NULL
    END AS applied_at,
    COALESCE(array_length(m.statements, 1), 0) AS statements_count,
    left(array_to_string(m.statements, E'\n\n'), 4000) AS preview
  FROM supabase_migrations.schema_migrations AS m
  ORDER BY m.version DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_schema_migrations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_schema_migrations() FROM anon;
GRANT EXECUTE ON FUNCTION public.list_schema_migrations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_schema_migrations() TO service_role;

COMMENT ON FUNCTION public.list_schema_migrations() IS
  'SaaS-admin-only read view of the official Supabase migration history.';
