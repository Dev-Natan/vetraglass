-- admin_suggested_prices
DROP POLICY IF EXISTS "asp read" ON public.admin_suggested_prices;
REVOKE SELECT ON public.admin_suggested_prices FROM anon;
GRANT SELECT ON public.admin_suggested_prices TO authenticated;
CREATE POLICY "asp read" ON public.admin_suggested_prices
FOR SELECT TO authenticated
USING (
  company_id IS NULL
  OR public.user_belongs_to_company(auth.uid(), company_id)
  OR public.is_saas_admin(auth.uid())
);

-- glass_line_formulas
DROP POLICY IF EXISTS "glf read" ON public.glass_line_formulas;
REVOKE SELECT ON public.glass_line_formulas FROM anon;
GRANT SELECT ON public.glass_line_formulas TO authenticated;
CREATE POLICY "glf read" ON public.glass_line_formulas
FOR SELECT TO authenticated
USING (true);

-- item_template_color_prices
DROP POLICY IF EXISTS "itcp read" ON public.item_template_color_prices;
REVOKE SELECT ON public.item_template_color_prices FROM anon;
GRANT SELECT ON public.item_template_color_prices TO authenticated;
CREATE POLICY "itcp read" ON public.item_template_color_prices
FOR SELECT TO authenticated
USING (
  company_id IS NULL
  OR public.user_belongs_to_company(auth.uid(), company_id)
  OR public.is_saas_admin(auth.uid())
);

-- item_templates
DROP POLICY IF EXISTS "item_templates read" ON public.item_templates;
REVOKE SELECT ON public.item_templates FROM anon;
GRANT SELECT ON public.item_templates TO authenticated;
CREATE POLICY "item_templates read" ON public.item_templates
FOR SELECT TO authenticated
USING (
  company_id IS NULL
  OR public.user_belongs_to_company(auth.uid(), company_id)
  OR public.is_saas_admin(auth.uid())
);

-- product_template_items
DROP POLICY IF EXISTS "pti read" ON public.product_template_items;
REVOKE SELECT ON public.product_template_items FROM anon;
GRANT SELECT ON public.product_template_items TO authenticated;
CREATE POLICY "pti read" ON public.product_template_items
FOR SELECT TO authenticated
USING (
  company_id IS NULL
  OR public.user_belongs_to_company(auth.uid(), company_id)
  OR public.is_saas_admin(auth.uid())
);

-- product_templates
DROP POLICY IF EXISTS "product_templates read" ON public.product_templates;
REVOKE SELECT ON public.product_templates FROM anon;
GRANT SELECT ON public.product_templates TO authenticated;
CREATE POLICY "product_templates read" ON public.product_templates
FOR SELECT TO authenticated
USING (
  company_id IS NULL
  OR public.user_belongs_to_company(auth.uid(), company_id)
  OR public.is_saas_admin(auth.uid())
);

NOTIFY pgrst, 'reload schema';