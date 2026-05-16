-- Add company_id to product_template_items for company-specific customizations
ALTER TABLE public.product_template_items 
ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_product_template_items_company_id ON public.product_template_items(company_id);

-- Update RLS policies to allow company users to add their own items

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated can view product template items" ON public.product_template_items;
DROP POLICY IF EXISTS "SaaS admins can manage product template items" ON public.product_template_items;

-- SELECT: Users can view global items (company_id IS NULL) and their company's items
CREATE POLICY "Users can view product template items"
ON public.product_template_items
FOR SELECT
TO authenticated
USING (
  company_id IS NULL 
  OR user_belongs_to_company(auth.uid(), company_id)
);

-- INSERT: SaaS admins can add global items, company users can add company-specific items
CREATE POLICY "Users can insert product template items"
ON public.product_template_items
FOR INSERT
TO authenticated
WITH CHECK (
  -- SaaS admins can insert global items (company_id IS NULL)
  (company_id IS NULL AND is_saas_admin(auth.uid()))
  OR
  -- Company users can insert items for their company
  (company_id IS NOT NULL AND user_belongs_to_company(auth.uid(), company_id))
);

-- UPDATE: SaaS admins can update global items, company users can update their company's items
CREATE POLICY "Users can update product template items"
ON public.product_template_items
FOR UPDATE
TO authenticated
USING (
  (company_id IS NULL AND is_saas_admin(auth.uid()))
  OR
  (company_id IS NOT NULL AND user_belongs_to_company(auth.uid(), company_id))
);

-- DELETE: Only SaaS admins can delete global items, company admins can delete their company's items
CREATE POLICY "Users can delete product template items"
ON public.product_template_items
FOR DELETE
TO authenticated
USING (
  (company_id IS NULL AND is_saas_admin(auth.uid()))
  OR
  (company_id IS NOT NULL AND user_has_role_in_company(auth.uid(), company_id, 'admin'))
);