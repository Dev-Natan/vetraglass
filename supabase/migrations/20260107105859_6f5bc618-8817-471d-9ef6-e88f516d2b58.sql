-- Allow SaaS admins to view all companies
CREATE POLICY "SaaS admins can view all companies"
ON public.companies
FOR SELECT
USING (is_saas_admin(auth.uid()));