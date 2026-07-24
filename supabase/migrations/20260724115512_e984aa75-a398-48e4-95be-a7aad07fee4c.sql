CREATE OR REPLACE FUNCTION public.list_schema_migrations()
RETURNS TABLE (
  version text,
  name text,
  applied_at timestamptz,
  statements_count int,
  preview text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, supabase_migrations
AS $$
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    m.version,
    m.name,
    CASE
      WHEN m.version ~ '^\d{14}' THEN
        to_timestamp(substring(m.version from 1 for 14), 'YYYYMMDDHH24MISS')
      ELSE NULL
    END AS applied_at,
    COALESCE(array_length(m.statements, 1), 0) AS statements_count,
    LEFT(array_to_string(m.statements, E'\n\n'), 4000) AS preview
  FROM supabase_migrations.schema_migrations m
  ORDER BY m.version DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_schema_migrations() TO authenticated;