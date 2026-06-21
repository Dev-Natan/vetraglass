
CREATE POLICY "Users can update os_glass_projects for their company orders"
ON public.os_glass_projects FOR UPDATE
USING (EXISTS (SELECT 1 FROM ordens_servico os JOIN user_companies uc ON os.company_id = uc.company_id WHERE os.id = os_glass_projects.ordem_servico_id AND uc.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM ordens_servico os JOIN user_companies uc ON os.company_id = uc.company_id WHERE os.id = os_glass_projects.ordem_servico_id AND uc.user_id = auth.uid()));

CREATE POLICY "Users can update os_materials for their company orders"
ON public.os_materials FOR UPDATE
USING (EXISTS (SELECT 1 FROM ordens_servico os JOIN user_companies uc ON os.company_id = uc.company_id WHERE os.id = os_materials.ordem_servico_id AND uc.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM ordens_servico os JOIN user_companies uc ON os.company_id = uc.company_id WHERE os.id = os_materials.ordem_servico_id AND uc.user_id = auth.uid()));

CREATE POLICY "Block client inserts to audit_logs"
ON public.audit_logs FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block client inserts to company_member_audit"
ON public.company_member_audit FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block client inserts to login_attempts"
ON public.login_attempts FOR INSERT TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block deletes on company_cash"
ON public.company_cash FOR DELETE
USING (false);
