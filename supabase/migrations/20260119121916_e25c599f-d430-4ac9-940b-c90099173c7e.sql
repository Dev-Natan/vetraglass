-- =============================================
-- HYBRID PRODUCT MODEL IMPLEMENTATION
-- =============================================

-- 1. Modify company_products to support custom products
ALTER TABLE public.company_products 
  ALTER COLUMN product_template_id DROP NOT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS linha TEXT DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS min_width NUMERIC DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS max_width NUMERIC DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS min_height NUMERIC DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS max_height NUMERIC DEFAULT NULL;

-- 2. Create company_product_items table for custom product composition
CREATE TABLE IF NOT EXISTS public.company_product_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_id UUID NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  quantity_formula TEXT NOT NULL DEFAULT '1',
  width_formula TEXT,
  height_formula TEXT,
  is_optional BOOLEAN DEFAULT FALSE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_product_items_company_product 
  ON public.company_product_items(company_product_id);

CREATE INDEX IF NOT EXISTS idx_company_product_items_item_template 
  ON public.company_product_items(item_template_id);

CREATE INDEX IF NOT EXISTS idx_company_products_is_custom 
  ON public.company_products(company_id, is_custom) WHERE is_custom = TRUE;

-- 4. Enable RLS on company_product_items
ALTER TABLE public.company_product_items ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for company_product_items
CREATE POLICY "company_product_items_select" 
  ON public.company_product_items 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id = company_product_id
      AND user_belongs_to_company(auth.uid(), cp.company_id)
    )
  );

CREATE POLICY "company_product_items_insert" 
  ON public.company_product_items 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id = company_product_id
      AND user_belongs_to_company(auth.uid(), cp.company_id)
    )
  );

CREATE POLICY "company_product_items_update" 
  ON public.company_product_items 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id = company_product_id
      AND user_belongs_to_company(auth.uid(), cp.company_id)
    )
  );

CREATE POLICY "company_product_items_delete" 
  ON public.company_product_items 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id = company_product_id
      AND user_belongs_to_company(auth.uid(), cp.company_id)
    )
  );

-- 6. Create trigger for updated_at
CREATE TRIGGER update_company_product_items_updated_at
  BEFORE UPDATE ON public.company_product_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Create function to create custom product
CREATE OR REPLACE FUNCTION public.create_custom_product(
  _company_id UUID,
  _name TEXT,
  _category TEXT DEFAULT 'other',
  _base_price NUMERIC DEFAULT 0,
  _linha TEXT DEFAULT 'Personalizado',
  _description TEXT DEFAULT NULL,
  _image_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id UUID;
BEGIN
  -- Verify user belongs to company
  IF NOT user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'User does not belong to this company';
  END IF;

  INSERT INTO company_products (
    company_id, 
    commercial_name, 
    category, 
    linha, 
    base_price, 
    description,
    image_url,
    is_custom, 
    is_active
  ) VALUES (
    _company_id, 
    _name, 
    _category, 
    _linha,
    _base_price,
    _description,
    _image_url,
    TRUE, 
    TRUE
  )
  RETURNING id INTO _new_id;
  
  RETURN _new_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_custom_product TO authenticated;