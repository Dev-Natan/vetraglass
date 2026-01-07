-- Remover a constraint unique que impede o mesmo item de ser usado múltiplas vezes no mesmo produto
ALTER TABLE public.product_template_items 
DROP CONSTRAINT IF EXISTS product_template_items_product_template_id_item_template_id_key;