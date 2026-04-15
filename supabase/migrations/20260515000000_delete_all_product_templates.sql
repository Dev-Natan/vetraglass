-- 1. Fórmulas de linhas de vidro (depende de product_templates)
DELETE FROM public.glass_line_formulas;

-- 2. Itens de produtos da empresa (referencia company_products e item_templates)
DELETE FROM public.company_product_items;

-- 3. Projetos de vidro (pode referenciar product_templates)
UPDATE public.glass_projects SET product_template_id = NULL;

-- 4. Itens de orçamentos (pode referenciar product_templates)
UPDATE public.quote_items SET product_template_id = NULL;

-- 5. Produtos da empresa (referencia product_templates)
DELETE FROM public.company_products;

-- 6. Itens de templates de produtos (referencia product_templates e item_templates)
DELETE FROM public.product_template_items;

-- 7. Templates de produtos
DELETE FROM public.product_templates;

-- 8. Preços de itens da empresa (referencia item_templates)
DELETE FROM public.company_item_prices;

-- 9. Estoque da empresa (referencia item_templates e company_items)
DELETE FROM public.company_stock;

-- 10. Movimentações de estoque (referencia item_templates)
UPDATE public.stock_movements SET item_template_id = NULL;

-- 11. Itens da empresa (referencia item_templates)
DELETE FROM public.company_items;

-- 12. Templates de itens
DELETE FROM public.item_templates;
