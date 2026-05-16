-- Remover políticas públicas e autenticadas existentes, recriar apenas para autenticados

-- 1. item_types
DROP POLICY IF EXISTS "Authenticated users can read item_types" ON public.item_types;
DROP POLICY IF EXISTS "Public read access for item_types" ON public.item_types;
DROP POLICY IF EXISTS "Anyone can read item_types" ON public.item_types;

CREATE POLICY "auth_read_item_types"
ON public.item_types FOR SELECT
TO authenticated
USING (true);

-- 2. product_categories
DROP POLICY IF EXISTS "Authenticated users can read product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Public read access for product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Anyone can read product_categories" ON public.product_categories;

CREATE POLICY "auth_read_product_categories"
ON public.product_categories FOR SELECT
TO authenticated
USING (true);

-- 3. product_linhas
DROP POLICY IF EXISTS "Authenticated users can read product_linhas" ON public.product_linhas;
DROP POLICY IF EXISTS "Public read access for product_linhas" ON public.product_linhas;
DROP POLICY IF EXISTS "Anyone can read product_linhas" ON public.product_linhas;

CREATE POLICY "auth_read_product_linhas"
ON public.product_linhas FOR SELECT
TO authenticated
USING (true);

-- 4. glass_line_formulas
DROP POLICY IF EXISTS "Authenticated users can read glass_line_formulas" ON public.glass_line_formulas;
DROP POLICY IF EXISTS "Public read access for glass_line_formulas" ON public.glass_line_formulas;
DROP POLICY IF EXISTS "Anyone can read glass_line_formulas" ON public.glass_line_formulas;

CREATE POLICY "auth_read_glass_line_formulas"
ON public.glass_line_formulas FOR SELECT
TO authenticated
USING (true);