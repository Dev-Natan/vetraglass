-- Add pieces_formula column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_template_items' AND column_name = 'pieces_formula') THEN
        ALTER TABLE public.product_template_items ADD COLUMN pieces_formula TEXT;
    END IF;
END $$;

-- Update INSERT policy to allow SaaS admins to insert system-wide items
DROP POLICY IF EXISTS "Admins can insert company product template items" ON public.product_template_items;
CREATE POLICY "Admins can insert product template items" ON public.product_template_items 
FOR INSERT TO authenticated 
WITH CHECK (
    (company_id IS NULL AND is_saas_admin(auth.uid())) OR 
    (company_id IS NOT NULL AND user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role))
);

-- Update UPDATE policy to allow SaaS admins to update system-wide items
DROP POLICY IF EXISTS "Admins can update company product template items" ON public.product_template_items;
CREATE POLICY "Admins can update product template items" ON public.product_template_items 
FOR UPDATE TO authenticated 
USING (
    (company_id IS NULL AND is_saas_admin(auth.uid())) OR 
    (company_id IS NOT NULL AND user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role))
)
WITH CHECK (
    (company_id IS NULL AND is_saas_admin(auth.uid())) OR 
    (company_id IS NOT NULL AND user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role))
);

-- Grant permissions (standard procedure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_template_items TO authenticated;
GRANT ALL ON public.product_template_items TO service_role;
