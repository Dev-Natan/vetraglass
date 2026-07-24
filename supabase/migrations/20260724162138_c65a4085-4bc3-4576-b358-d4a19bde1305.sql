
-- Storage RLS policies for newly created buckets
DO $$
DECLARE
  b text;
  buckets text[] := ARRAY[
    'company-logos','product-templates','product-images','item-templates',
    'company-product-images','company-item-images','os-photos',
    'employee-photos','support-attachments'
  ];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L);
    $p$, b || '_auth_read', b);
    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L);
    $p$, b || '_auth_insert', b);
    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = %L) WITH CHECK (bucket_id = %L);
    $p$, b || '_auth_update', b, b);
    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L);
    $p$, b || '_auth_delete', b);
  END LOOP;
END $$;
