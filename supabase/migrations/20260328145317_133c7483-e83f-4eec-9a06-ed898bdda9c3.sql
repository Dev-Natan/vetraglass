
-- Fix 1: company_security_settings - Replace broken RLS policies
DROP POLICY IF EXISTS "Users can view own company security settings" ON company_security_settings;
DROP POLICY IF EXISTS "Users can insert own company security settings" ON company_security_settings;
DROP POLICY IF EXISTS "Users can update own company security settings" ON company_security_settings;
DROP POLICY IF EXISTS "company_security_settings_select" ON company_security_settings;
DROP POLICY IF EXISTS "company_security_settings_insert" ON company_security_settings;
DROP POLICY IF EXISTS "company_security_settings_update" ON company_security_settings;

CREATE POLICY "Members can view company security settings"
  ON company_security_settings FOR SELECT TO authenticated
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can insert company security settings"
  ON company_security_settings FOR INSERT TO authenticated
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can update company security settings"
  ON company_security_settings FOR UPDATE TO authenticated
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'))
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Fix 2: Storage policies - Add company-level authorization

-- os-photos: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload OS photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete OS photos" ON storage.objects;

CREATE POLICY "Users can upload OS photos for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'os-photos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can delete OS photos from their company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'os-photos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

-- company-product-images: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload company product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company product images" ON storage.objects;

CREATE POLICY "Users can upload company product images for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-product-images'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can update company product images for their company"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-product-images'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

-- company-item-images: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload company item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company item images" ON storage.objects;

CREATE POLICY "Users can upload company item images for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-item-images'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can delete company item images from their company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-item-images'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

-- employee-photos: add company-level policies (companyId is first path segment)
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete employee photos" ON storage.objects;

CREATE POLICY "Users can upload employee photos for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can delete employee photos from their company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

-- company-logos: add company-level policies
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;

CREATE POLICY "Users can upload company logos for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can delete company logos from their company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );
