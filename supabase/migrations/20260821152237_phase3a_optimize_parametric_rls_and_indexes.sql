CREATE INDEX company_parametric_overrides_company_item_company_idx
  ON public.company_parametric_rule_overrides(company_item_id, company_id)
  WHERE company_item_id IS NOT NULL;

GRANT INSERT, UPDATE, DELETE ON TABLE public.product_parametric_rules TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.product_variant_definitions TO authenticated;

DROP POLICY product_parametric_rules_saas_admin_write ON public.product_parametric_rules;
CREATE POLICY product_parametric_rules_saas_admin_insert
  ON public.product_parametric_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_saas_admin((SELECT auth.uid())));
CREATE POLICY product_parametric_rules_saas_admin_update
  ON public.product_parametric_rules FOR UPDATE TO authenticated
  USING (public.is_saas_admin((SELECT auth.uid())))
  WITH CHECK (public.is_saas_admin((SELECT auth.uid())));
CREATE POLICY product_parametric_rules_saas_admin_delete
  ON public.product_parametric_rules FOR DELETE TO authenticated
  USING (public.is_saas_admin((SELECT auth.uid())));

DROP POLICY product_variant_definitions_saas_admin_write ON public.product_variant_definitions;
CREATE POLICY product_variant_definitions_saas_admin_insert
  ON public.product_variant_definitions FOR INSERT TO authenticated
  WITH CHECK (public.is_saas_admin((SELECT auth.uid())));
CREATE POLICY product_variant_definitions_saas_admin_update
  ON public.product_variant_definitions FOR UPDATE TO authenticated
  USING (public.is_saas_admin((SELECT auth.uid())))
  WITH CHECK (public.is_saas_admin((SELECT auth.uid())));
CREATE POLICY product_variant_definitions_saas_admin_delete
  ON public.product_variant_definitions FOR DELETE TO authenticated
  USING (public.is_saas_admin((SELECT auth.uid())));

DROP POLICY company_parametric_overrides_company_read ON public.company_parametric_rule_overrides;
DROP POLICY company_parametric_overrides_company_insert ON public.company_parametric_rule_overrides;
DROP POLICY company_parametric_overrides_company_update ON public.company_parametric_rule_overrides;
DROP POLICY company_parametric_overrides_company_delete ON public.company_parametric_rule_overrides;

CREATE POLICY company_parametric_overrides_company_read
  ON public.company_parametric_rule_overrides FOR SELECT TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY company_parametric_overrides_company_insert
  ON public.company_parametric_rule_overrides FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY company_parametric_overrides_company_update
  ON public.company_parametric_rule_overrides FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
  WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY company_parametric_overrides_company_delete
  ON public.company_parametric_rule_overrides FOR DELETE TO authenticated
  USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));
