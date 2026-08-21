-- "Ambos" is a legacy multi-side marker. The approved proof product has no
-- side B, so carrying that marker into the frozen snapshot would duplicate
-- every OS material. Keep the correction scoped to single-side templates.
UPDATE public.product_parametric_rules ppr
SET side = 'A',
    validation_source = COALESCE(ppr.validation_source, 'existing_product_template_items_estimated')
      || '_single_side_normalized',
    updated_at = now()
FROM public.product_templates pt
WHERE pt.id = ppr.product_template_id
  AND ppr.product_template_id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
  AND COALESCE(pt.has_multiple_sides, false) = false
  AND lower(ppr.side) IN ('ambos', 'both');
