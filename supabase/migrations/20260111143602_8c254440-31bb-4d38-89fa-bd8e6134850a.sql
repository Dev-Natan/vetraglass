-- Add product_template_id column to quote_items for proper component tracking
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS product_template_id uuid REFERENCES public.product_templates(id);

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.quote_items.product_template_id IS 'Reference to product template for component-based inventory deduction during invoicing';