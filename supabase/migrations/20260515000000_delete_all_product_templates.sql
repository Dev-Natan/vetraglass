-- 1. Itens de produtos da empresa (referencia company_products e item_templates)
DELETE FROM public.company_product_items;

-- 2. Produtos da empresa (referencia product_templates)
DELETE FROM public.company_products;

-- 3. Itens de templates de produtos (referencia product_templates e item_templates)
DELETE FROM public.product_template_items;

-- 4. Templates de produtos
DELETE FROM public.product_templates;

-- 5. Preços de itens da empresa (referencia item_templates)
DELETE FROM public.company_item_prices;

-- 6. Estoque da empresa (referencia item_templates e company_items)
DELETE FROM public.company_stock;

-- 7. Itens da empresa (referencia item_templates)
DELETE FROM public.company_items;

-- 8. Templates de itens
DELETE FROM public.item_templates;
