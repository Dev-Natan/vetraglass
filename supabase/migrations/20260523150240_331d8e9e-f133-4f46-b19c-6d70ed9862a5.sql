-- Update existing product_template_items based on typology configuration and item type
UPDATE product_template_items pti
SET side = CASE 
    WHEN pt.has_multiple_sides = false THEN 'Produto'
    WHEN it.type IN ('profile', 'glass') THEN 'Ambos'
    ELSE 'Produto'
END
FROM product_templates pt
JOIN item_templates it ON true -- This will be joined correctly in the WHERE clause
WHERE pti.product_template_id = pt.id 
AND pti.item_template_id = it.id;

-- Ensure future items have a sensible default
ALTER TABLE product_template_items 
ALTER COLUMN side SET DEFAULT 'Ambos';
