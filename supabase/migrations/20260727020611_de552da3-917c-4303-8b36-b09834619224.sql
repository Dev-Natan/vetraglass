
-- 1. Tighten login_attempts INSERT (was WITH CHECK true)
DROP POLICY IF EXISTS login_attempts_insert_all ON public.login_attempts;
CREATE POLICY login_attempts_insert_all ON public.login_attempts
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 3 AND 320
    AND success IS NOT NULL
  );

-- 2. Storage: per-company buckets require company_id folder ownership
--    Path convention: '<company_id>/...' (see project memory)
DO $$
DECLARE
  b TEXT;
  company_buckets TEXT[] := ARRAY[
    'company-logos',
    'company-product-images',
    'company-item-images',
    'product-images',
    'os-photos',
    'employee-photos',
    'support-attachments'
  ];
BEGIN
  FOREACH b IN ARRAY company_buckets LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_insert');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_delete');

    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = %L
        AND (
          public.is_saas_admin(auth.uid())
          OR public.user_belongs_to_company(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
        )
      )
    $p$, b || '_auth_read', b);

    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = %L
        AND (
          public.is_saas_admin(auth.uid())
          OR public.user_belongs_to_company(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
        )
      )
    $p$, b || '_auth_insert', b);

    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = %L
        AND (
          public.is_saas_admin(auth.uid())
          OR public.user_belongs_to_company(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
        )
      )
      WITH CHECK (
        bucket_id = %L
        AND (
          public.is_saas_admin(auth.uid())
          OR public.user_belongs_to_company(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
        )
      )
    $p$, b || '_auth_update', b, b);

    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = %L
        AND (
          public.is_saas_admin(auth.uid())
          OR public.user_belongs_to_company(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
        )
      )
    $p$, b || '_auth_delete', b);
  END LOOP;
END $$;

-- 3. Admin/global buckets: authenticated read, admin-only write
DO $$
DECLARE
  b TEXT;
  admin_buckets TEXT[] := ARRAY['product-templates', 'item-templates'];
BEGIN
  FOREACH b IN ARRAY admin_buckets LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_read');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_insert');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_update');
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_auth_delete');

    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = %L)
    $p$, b || '_auth_read', b);

    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = %L AND public.is_saas_admin(auth.uid()))
    $p$, b || '_auth_insert', b);

    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = %L AND public.is_saas_admin(auth.uid()))
      WITH CHECK (bucket_id = %L AND public.is_saas_admin(auth.uid()))
    $p$, b || '_auth_update', b, b);

    EXECUTE format($p$
      CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = %L AND public.is_saas_admin(auth.uid()))
    $p$, b || '_auth_delete', b);
  END LOOP;
END $$;
