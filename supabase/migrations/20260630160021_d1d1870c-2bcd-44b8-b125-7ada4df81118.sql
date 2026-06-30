CREATE OR REPLACE FUNCTION public.is_saas_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.saas_admins sa ON sa.user_id = u.id
    WHERE u.id = _user_id
      AND lower(u.email) = 'natanjk7@gmail.com'
  )
$$;

REVOKE ALL ON FUNCTION public.is_saas_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO supabase_storage_admin;

DROP POLICY IF EXISTS "Public can view product template images" ON storage.objects;
DROP POLICY IF EXISTS "SaaS admins can view product images" ON storage.objects;
DROP POLICY IF EXISTS "SaaS admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "SaaS admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "SaaS admins can delete product images" ON storage.objects;

CREATE POLICY "Public can view product template images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-templates');

CREATE POLICY "SaaS admins can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-templates'
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-templates'
  AND public.is_saas_admin(auth.uid())
)
WITH CHECK (
  bucket_id = 'product-templates'
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-templates'
  AND public.is_saas_admin(auth.uid())
);