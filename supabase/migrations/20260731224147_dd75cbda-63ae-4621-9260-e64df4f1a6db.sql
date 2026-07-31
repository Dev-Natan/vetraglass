-- bank_accounts
DROP POLICY IF EXISTS bank_accounts_access ON public.bank_accounts;
CREATE POLICY bank_accounts_select ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY bank_accounts_write ON public.bank_accounts FOR ALL TO authenticated
  USING (public.user_role_in_company(auth.uid(), company_id) = ANY (ARRAY['admin'::company_role,'manager'::company_role]))
  WITH CHECK (public.user_role_in_company(auth.uid(), company_id) = ANY (ARRAY['admin'::company_role,'manager'::company_role]));

-- financial_categories
DROP POLICY IF EXISTS financial_categories_access ON public.financial_categories;
CREATE POLICY financial_categories_select ON public.financial_categories FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY financial_categories_write ON public.financial_categories FOR ALL TO authenticated
  USING (public.user_role_in_company(auth.uid(), company_id) = ANY (ARRAY['admin'::company_role,'manager'::company_role]))
  WITH CHECK (public.user_role_in_company(auth.uid(), company_id) = ANY (ARRAY['admin'::company_role,'manager'::company_role]));

-- tax_categories
DROP POLICY IF EXISTS tax_categories_write ON public.tax_categories;
CREATE POLICY tax_categories_write ON public.tax_categories FOR ALL TO authenticated
  USING (company_id IS NOT NULL AND public.user_role_in_company(auth.uid(), company_id) = ANY (ARRAY['admin'::company_role,'manager'::company_role]))
  WITH CHECK (company_id IS NOT NULL AND public.user_role_in_company(auth.uid(), company_id) = ANY (ARRAY['admin'::company_role,'manager'::company_role]));

-- companies: remove blanket insert; creation happens via SECURITY DEFINER RPC
DROP POLICY IF EXISTS companies_insert_authenticated ON public.companies;
CREATE POLICY companies_insert_saas_admin ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.is_saas_admin(auth.uid()));