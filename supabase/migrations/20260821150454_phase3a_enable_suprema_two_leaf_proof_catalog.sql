-- Enable only the approved Phase 3A proof catalog already present in Vetra.
-- No company stock, costs or prices are synthesized here.
UPDATE public.item_templates it
SET is_active = true,
    updated_at = now()
WHERE it.id IN (
  SELECT DISTINCT r.item_template_id
  FROM public.product_parametric_rules r
  WHERE r.product_template_id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
    AND r.is_active
    AND r.item_template_id IS NOT NULL
);

UPDATE public.product_templates
SET is_active = true,
    updated_at = now()
WHERE id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
  AND composition_mode = 'parametric'
  AND lower(btrim(name)) = 'janela de correr 2 folhas'
  AND lower(btrim(linha)) = 'suprema';

UPDATE public.company_products
SET is_active = true,
    updated_at = now()
WHERE product_template_id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
  AND lower(btrim(commercial_name)) = 'janela de correr 2 folhas';
