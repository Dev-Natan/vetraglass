DROP POLICY IF EXISTS employees_company_access ON public.employees;

CREATE POLICY "employees_select_members"
  ON public.employees FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()));

CREATE POLICY "employees_insert_admin_manager"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager')
  );

CREATE POLICY "employees_update_admin_manager"
  ON public.employees FOR UPDATE TO authenticated
  USING (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager')
  )
  WITH CHECK (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager')
  );

CREATE POLICY "employees_delete_admin_manager"
  ON public.employees FOR DELETE TO authenticated
  USING (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager')
  );