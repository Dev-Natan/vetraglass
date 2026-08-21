-- In the legacy fixed rows, vertical profile dimensions were duplicated into
-- quantity_formula. The fixed approval evaluator consequently multiplies the
-- cut count by the dimension itself. Parametric rules separate geometry from
-- multiplicity, so imported dimension duplicates resolve to multiplier 1.
UPDATE public.product_parametric_rules
SET quantity_formula = '1',
    validation_source = 'existing_product_template_items_dimension_multiplier_normalized',
    updated_at = now()
WHERE product_template_id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
  AND rule_key LIKE 'legacy-%'
  AND material_type IN ('profile', 'glass')
  AND quantity_formula IS NOT NULL
  AND (
    quantity_formula = width_formula
    OR quantity_formula = height_formula
  );
