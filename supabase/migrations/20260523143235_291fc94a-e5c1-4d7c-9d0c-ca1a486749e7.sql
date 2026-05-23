
-- 1. company_folga_settings: restrict ALL policy to elevated roles
DROP POLICY IF EXISTS "Admins can manage their company folga settings" ON public.company_folga_settings;
CREATE POLICY "Admins can manage their company folga settings"
ON public.company_folga_settings
FOR ALL
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id))
WITH CHECK (public.user_has_elevated_role_in_company(auth.uid(), company_id));

-- 2. company_notifications: use user_companies role system
DROP POLICY IF EXISTS "Admins can update notifications" ON public.company_notifications;
CREATE POLICY "Admins can update notifications"
ON public.company_notifications
FOR UPDATE
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id))
WITH CHECK (public.user_has_elevated_role_in_company(auth.uid(), company_id));

-- 3. feedbacks: scope SELECT to user's company
DROP POLICY IF EXISTS "Authenticated users can view all feedbacks" ON public.feedbacks;
CREATE POLICY "Users can view feedbacks of their company"
ON public.feedbacks
FOR SELECT
USING (public.user_belongs_to_company(auth.uid(), company_id));

-- 4. is_financial_admin: rewrite to use user_companies + set search_path
CREATE OR REPLACE FUNCTION public.is_financial_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- 5. storage 'product-images' bucket: scope writes to company (first path segment)
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

CREATE POLICY "Users can upload product images for their company"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid() IS NOT NULL
  AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
);

CREATE POLICY "Users can update product images of their company"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
);

CREATE POLICY "Users can delete product images of their company"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'product-images'
  AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
);
