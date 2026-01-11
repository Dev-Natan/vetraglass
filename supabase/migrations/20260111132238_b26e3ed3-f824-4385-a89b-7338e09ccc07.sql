-- Add support for selling products (not just raw materials) in sales
ALTER TABLE public.sale_items
ADD COLUMN company_product_id uuid REFERENCES public.company_products(id),
ADD COLUMN width numeric,
ADD COLUMN height numeric;

-- Make item_template_id optional (can sell either item or product)
ALTER TABLE public.sale_items
ALTER COLUMN item_template_id DROP NOT NULL;

-- Add constraint: must have either item_template_id OR company_product_id
ALTER TABLE public.sale_items
ADD CONSTRAINT sale_items_item_or_product_check 
CHECK (item_template_id IS NOT NULL OR company_product_id IS NOT NULL);

-- Add index for product sales queries
CREATE INDEX idx_sale_items_company_product_id ON public.sale_items(company_product_id);