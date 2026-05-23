
-- 1. audit_logs: remove client-side INSERT policy
DROP POLICY IF EXISTS "Authenticated users can insert audit logs via functions" ON public.audit_logs;

-- 2. user_companies: remove self-insert escalation
DROP POLICY IF EXISTS "Users can insert their own membership" ON public.user_companies;

-- 3. storage company-item-images: scope UPDATE to owning company
DROP POLICY IF EXISTS "Authenticated users can update company item images" ON storage.objects;
CREATE POLICY "Company members can update their company item images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-item-images'
  AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'company-item-images'
  AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
);

-- 4. company_notifications: standardize on user_belongs_to_company
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='company_notifications' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.company_notifications', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Company members can view notifications"
ON public.company_notifications FOR SELECT TO authenticated
USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can insert notifications"
ON public.company_notifications FOR INSERT TO authenticated
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Elevated roles can update notifications"
ON public.company_notifications FOR UPDATE TO authenticated
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id))
WITH CHECK (public.user_has_elevated_role_in_company(auth.uid(), company_id));

CREATE POLICY "Elevated roles can delete notifications"
ON public.company_notifications FOR DELETE TO authenticated
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id));

-- 5. glass_line_formulas: require auth
DROP POLICY IF EXISTS "Anyone can view glass formulas" ON public.glass_line_formulas;
CREATE POLICY "Authenticated users can view glass formulas"
ON public.glass_line_formulas FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- 6. pricing_policies: restrict DELETE to elevated roles
DROP POLICY IF EXISTS "Users can delete pricing policies" ON public.pricing_policies;
DROP POLICY IF EXISTS "Company members can delete pricing policies" ON public.pricing_policies;
CREATE POLICY "Elevated roles can delete pricing policies"
ON public.pricing_policies FOR DELETE TO authenticated
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id));

-- 7. product_template_items: restrict INSERT/UPDATE on company-scoped rows to admins
DROP POLICY IF EXISTS "Users can insert product template items" ON public.product_template_items;
DROP POLICY IF EXISTS "Users can update product template items" ON public.product_template_items;

CREATE POLICY "Admins can insert company product template items"
ON public.product_template_items FOR INSERT TO authenticated
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role)
);

CREATE POLICY "Admins can update company product template items"
ON public.product_template_items FOR UPDATE TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role)
);
