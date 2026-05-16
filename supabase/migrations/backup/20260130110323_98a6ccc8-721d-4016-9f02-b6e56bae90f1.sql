-- Adicionar policy de UPDATE para SaaS Admin na tabela system_module_settings
CREATE POLICY "SaaS admins can update module settings"
ON public.system_module_settings
FOR UPDATE
TO authenticated
USING (public.is_saas_admin(auth.uid()))
WITH CHECK (public.is_saas_admin(auth.uid()));