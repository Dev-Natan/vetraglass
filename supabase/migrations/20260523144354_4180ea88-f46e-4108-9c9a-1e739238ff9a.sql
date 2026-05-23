-- Add side column to product_template_items if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_template_items' AND column_name = 'side') THEN
        ALTER TABLE public.product_template_items ADD COLUMN side TEXT;
    END IF;
END $$;

-- Add side column to company_product_items if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_product_items' AND column_name = 'side') THEN
        ALTER TABLE public.company_product_items ADD COLUMN side TEXT;
    END IF;
END $$;
