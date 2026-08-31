-- Cover the category FK independently from the tenant/category uniqueness
-- index so category maintenance does not require a full policy-table scan.
CREATE INDEX IF NOT EXISTS company_pricing_policies_category_idx
  ON public.company_pricing_policies(category_id)
  WHERE category_id IS NOT NULL;
