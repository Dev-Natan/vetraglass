
-- 1. company_notification_settings: replace broken policies
DROP POLICY IF EXISTS "Users can view own company notification settings" ON public.company_notification_settings;
DROP POLICY IF EXISTS "Users can update own company notification settings" ON public.company_notification_settings;
DROP POLICY IF EXISTS "Users can insert own company notification settings" ON public.company_notification_settings;

CREATE POLICY "Company members can view notification settings"
  ON public.company_notification_settings FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can insert notification settings"
  ON public.company_notification_settings FOR INSERT
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can update notification settings"
  ON public.company_notification_settings FOR UPDATE
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 2. pricing_policies: replace broken policies
DROP POLICY IF EXISTS "Users can view own company pricing policies" ON public.pricing_policies;
DROP POLICY IF EXISTS "Users can insert own company pricing policies" ON public.pricing_policies;
DROP POLICY IF EXISTS "Users can update own company pricing policies" ON public.pricing_policies;

CREATE POLICY "Company members can view pricing policies"
  ON public.pricing_policies FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can insert pricing policies"
  ON public.pricing_policies FOR INSERT
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can update pricing policies"
  ON public.pricing_policies FOR UPDATE
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can delete pricing policies"
  ON public.pricing_policies FOR DELETE
  USING (public.user_belongs_to_company(auth.uid(), company_id));

-- 3. employee-photos: make private + company-scoped SELECT
UPDATE storage.buckets SET public = false WHERE id = 'employee-photos';

DROP POLICY IF EXISTS "Anyone can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Company members can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Company members can upload employee photos" ON storage.objects;

CREATE POLICY "Company members can view employee photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'employee-photos'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can upload employee photos (scoped)"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can update employee photos (scoped)"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'employee-photos'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

-- 4. os-photos: make private + drop public SELECT (scoped policies already exist)
UPDATE storage.buckets SET public = false WHERE id = 'os-photos';

DROP POLICY IF EXISTS "Anyone can view OS photos" ON storage.objects;

-- 5. measurements: drop weak policies, replace with company-scoped
DROP POLICY IF EXISTS "Users can delete measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload measurement files" ON storage.objects;

CREATE POLICY "Company members can view measurement files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'measurements'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can upload measurement files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'measurements'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can update measurement files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'measurements'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can delete measurement files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'measurements'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

-- 6. company-logos: drop overly permissive auth.uid() IS NOT NULL policies
DROP POLICY IF EXISTS "Users can delete company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload company logos" ON storage.objects;

-- 7. company-product-images: drop weak duplicate policies
DROP POLICY IF EXISTS "Public read access for company product images" ON storage.objects;
DROP POLICY IF EXISTS "Company users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Company users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Company users can upload product images" ON storage.objects;
