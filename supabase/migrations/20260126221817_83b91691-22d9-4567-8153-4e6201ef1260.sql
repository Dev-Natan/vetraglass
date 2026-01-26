-- =============================================
-- Segurança: Restringir tabelas de catálogo para usuários autenticados
-- Evita que concorrentes acessem dados de produtos sem login
-- =============================================

-- 1. glass_types - Restringir leitura para usuários autenticados
DROP POLICY IF EXISTS "Allow public read access" ON public.glass_types;
DROP POLICY IF EXISTS "Public read access" ON public.glass_types;
DROP POLICY IF EXISTS "glass_types_public_read" ON public.glass_types;

CREATE POLICY "Authenticated users can read glass_types" 
ON public.glass_types 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. product_categories - Restringir leitura para usuários autenticados
DROP POLICY IF EXISTS "Allow public read access" ON public.product_categories;
DROP POLICY IF EXISTS "Public read access" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_public_read" ON public.product_categories;

CREATE POLICY "Authenticated users can read product_categories" 
ON public.product_categories 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 3. product_linhas - Restringir leitura para usuários autenticados
DROP POLICY IF EXISTS "Allow public read access" ON public.product_linhas;
DROP POLICY IF EXISTS "Public read access" ON public.product_linhas;
DROP POLICY IF EXISTS "product_linhas_public_read" ON public.product_linhas;

CREATE POLICY "Authenticated users can read product_linhas" 
ON public.product_linhas 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 4. item_types - Restringir leitura para usuários autenticados
DROP POLICY IF EXISTS "Allow public read access" ON public.item_types;
DROP POLICY IF EXISTS "Public read access" ON public.item_types;
DROP POLICY IF EXISTS "item_types_public_read" ON public.item_types;

CREATE POLICY "Authenticated users can read item_types" 
ON public.item_types 
FOR SELECT 
USING (auth.uid() IS NOT NULL);