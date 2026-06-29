-- Reforça a função usada pelas regras de storage para administradores SaaS
CREATE OR REPLACE FUNCTION public.is_saas_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.saas_admins
    WHERE user_id = _user_id
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO service_role;

-- Garante acesso interno à tabela usada pela função SECURITY DEFINER.
GRANT SELECT ON public.saas_admins TO authenticated;
GRANT ALL ON public.saas_admins TO service_role;

-- Recria as policies do bucket product-templates com papéis explícitos e WITH CHECK no upsert.
DROP POLICY IF EXISTS "SaaS admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "SaaS admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "SaaS admins can delete product images" ON storage.objects;

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