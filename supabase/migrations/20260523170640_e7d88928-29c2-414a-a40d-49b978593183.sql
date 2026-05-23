-- Update product_template_items for accessories
UPDATE public.product_template_items pti
SET side = 'Produto'
FROM public.item_templates it
WHERE pti.item_template_id = it.id
  AND it.type = 'accessory'
  AND (pti.side IS NULL OR pti.side = 'Ambos');

-- Update company_product_items for accessories
UPDATE public.company_product_items cpi
SET side = 'Produto'
FROM public.item_templates it
WHERE cpi.item_template_id = it.id
  AND it.type = 'accessory'
  AND (cpi.side IS NULL OR cpi.side = 'Ambos');

-- Update by name for common items like silicone (may be typed as profile/other)
UPDATE public.product_template_items pti
SET side = 'Produto'
FROM public.item_templates it
WHERE pti.item_template_id = it.id
  AND (it.name ILIKE '%silicone%' OR it.name ILIKE '%kit%')
  AND (pti.side IS NULL OR pti.side = 'Ambos');

UPDATE public.company_product_items cpi
SET side = 'Produto'
FROM public.item_templates it
WHERE cpi.item_template_id = it.id
  AND (it.name ILIKE '%silicone%' OR it.name ILIKE '%kit%')
  AND (cpi.side IS NULL OR cpi.side = 'Ambos');