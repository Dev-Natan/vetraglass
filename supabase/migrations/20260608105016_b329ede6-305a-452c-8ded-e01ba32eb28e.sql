
-- Backfill width_formula / height_formula for existing profile composition items
-- Only acts on items where both width_formula and height_formula are NULL/empty
-- and quantity_formula contains a dimensional variable

WITH profile_items AS (
  SELECT pti.id, pti.quantity_formula
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  WHERE it.type = 'profile'
    AND (pti.width_formula IS NULL OR pti.width_formula = '')
    AND (pti.height_formula IS NULL OR pti.height_formula = '')
    AND pti.quantity_formula IS NOT NULL
    AND pti.quantity_formula !~ '^\s*\d+(\.\d+)?\s*$'  -- not a pure number
),
classified AS (
  SELECT 
    id,
    quantity_formula,
    CASE
      -- Height: contains 'altura', or standalone A/H/HA/HB/HC, but NOT largura/L/W
      WHEN (
        quantity_formula ~* 'altura' OR
        quantity_formula ~ '\yA\y' OR
        quantity_formula ~* '\yh[abc]?\y'
      ) AND NOT (
        quantity_formula ~* 'largura' OR
        quantity_formula ~ '\yL\y' OR
        quantity_formula ~* '\yw[abc]?\y'
      ) THEN 'height'
      -- Width: contains largura/L/W (priority, even if FA appears)
      WHEN (
        quantity_formula ~* 'largura' OR
        quantity_formula ~ '\yL\y' OR
        quantity_formula ~* '\yw[abc]?\y'
      ) THEN 'width'
      ELSE NULL
    END AS position
  FROM profile_items
)
UPDATE public.product_template_items pti
SET 
  width_formula = CASE WHEN c.position = 'width' THEN c.quantity_formula ELSE pti.width_formula END,
  height_formula = CASE WHEN c.position = 'height' THEN c.quantity_formula ELSE pti.height_formula END,
  quantity_formula = CASE WHEN c.position IS NOT NULL THEN '1' ELSE pti.quantity_formula END
FROM classified c
WHERE pti.id = c.id
  AND c.position IS NOT NULL;
