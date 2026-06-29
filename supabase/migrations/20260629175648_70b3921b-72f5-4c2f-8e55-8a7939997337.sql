-- Reforça políticas de Storage para o bucket product-templates
-- Garante INSERT/UPDATE com USING e WITH CHECK para o upsert funcionar
DROP POLICY IF EXISTS "SaaS admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "SaaS admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "SaaS admins can delete product images" ON storage.objects;

CREATE POLICY "SaaS admins can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-templates' AND public.is_saas_admin(auth.uid()));

CREATE POLICY "SaaS admins can update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-templates' AND public.is_saas_admin(auth.uid()))
WITH CHECK (bucket_id = 'product-templates' AND public.is_saas_admin(auth.uid()));

CREATE POLICY "SaaS admins can delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-templates' AND public.is_saas_admin(auth.uid()));