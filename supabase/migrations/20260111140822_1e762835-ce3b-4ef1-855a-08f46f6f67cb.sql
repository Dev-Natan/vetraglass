-- Remove the strict check constraint
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_item_or_product_check;

-- Add a comment explaining why we allow null references
COMMENT ON TABLE public.sale_items IS 'Sale items can have: item_template_id (for materials), company_product_id (for products), or neither (for manual/quote items)';