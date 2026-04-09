-- Fix 1: company_notification_settings broken RLS policies
-- The existing policies use a self-referencing subquery that always returns true
DROP POLICY IF EXISTS "Users can view own company notification settings" ON public.company_notification_settings;
DROP POLICY IF EXISTS "Users can update own company notification settings" ON public.company_notification_settings;
DROP POLICY IF EXISTS "Users can insert own company notification settings" ON public.company_notification_settings;

CREATE POLICY "Users can view own company notification settings"
ON public.company_notification_settings FOR SELECT TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update own company notification settings"
ON public.company_notification_settings FOR UPDATE TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can insert own company notification settings"
ON public.company_notification_settings FOR INSERT TO authenticated
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- Fix 2: os-photos public SELECT policy - restrict to authenticated company members
DROP POLICY IF EXISTS "Anyone can view OS photos" ON storage.objects;

CREATE POLICY "Authenticated users can view OS photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'os-photos'
  AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
);
