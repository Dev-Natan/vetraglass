
-- LIMPEZA: Remover campos de preço dos templates
-- Templates são apenas referência técnica, não devem ter preço

-- 1. Remover default_price de item_templates (mantendo compatibilidade por enquanto)
COMMENT ON COLUMN public.item_templates.default_price IS 'DEPRECATED: Use company_items.sale_price instead. Will be removed in future version.';

-- 2. Remover base_price de product_templates
COMMENT ON COLUMN public.product_templates.base_price IS 'DEPRECATED: Use company_products.base_price instead. Will be removed in future version.';

-- 3. Tornar item_template_id em company_product_items opcional (para suportar company_item_id)
ALTER TABLE public.company_product_items 
  ALTER COLUMN item_template_id DROP NOT NULL;

-- 4. Tornar item_template_id em company_stock opcional (para suportar company_item_id)  
ALTER TABLE public.company_stock 
  ALTER COLUMN item_template_id DROP NOT NULL;
