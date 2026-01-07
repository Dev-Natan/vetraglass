-- Add base_price field to product_templates table
ALTER TABLE public.product_templates 
ADD COLUMN base_price numeric DEFAULT 0;