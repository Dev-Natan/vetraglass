-- Read-only assertions for the Phase 2 official baseline.
DO $$
DECLARE
  missing_buckets text[];
BEGIN
  SELECT array_agg(expected.id ORDER BY expected.id)
  INTO missing_buckets
  FROM unnest(ARRAY[
    'client-documents','company-item-images','company-logos','company-product-images',
    'employee-photos','item-templates','os-photos','product-images',
    'product-templates','support-attachments'
  ]) AS expected(id)
  WHERE NOT EXISTS (SELECT 1 FROM storage.buckets b WHERE b.id = expected.id);

  IF missing_buckets IS NOT NULL THEN
    RAISE EXCEPTION 'Missing Phase 2 buckets: %', missing_buckets;
  END IF;

  IF to_regprocedure('public.list_schema_migrations()') IS NULL THEN
    RAISE EXCEPTION 'Missing RPC public.list_schema_migrations()';
  END IF;
END;
$$;

SELECT
  (SELECT count(*) FROM storage.buckets WHERE id IN (
    'client-documents','company-item-images','company-logos','company-product-images',
    'employee-photos','item-templates','os-photos','product-images',
    'product-templates','support-attachments'
  )) AS expected_bucket_count,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') AS storage_policy_count,
  to_regprocedure('public.list_schema_migrations()')::text AS migration_rpc;
