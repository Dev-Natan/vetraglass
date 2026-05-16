-- Fix overly permissive storage policies for product-templates bucket
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated upload access for product templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update access for product templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete access for product templates" ON storage.objects;

-- Create restrictive policies that only allow SaaS admins
CREATE POLICY "SaaS admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-templates' 
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-templates' 
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-templates' 
  AND public.is_saas_admin(auth.uid())
);