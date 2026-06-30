
-- 1) Ajustar lista canônica em product_categories
UPDATE public.product_categories SET slug = 'espelho', name = 'Espelho' WHERE slug = 'espelhos';

INSERT INTO public.product_categories (slug, name, color, sort_order, is_active)
VALUES
  ('divisoria', 'Divisória', 'gray', 50, true),
  ('tampo', 'Tampo', 'gray', 60, true)
ON CONFLICT (slug) DO NOTHING;

-- 2) Normalizar valores existentes em company_products
UPDATE public.company_products SET category = 'janelas'      WHERE category = 'janela';
UPDATE public.company_products SET category = 'portas'       WHERE category = 'porta';
UPDATE public.company_products SET category = 'guarda-corpo' WHERE category = 'guarda_corpo';

-- 3) Normalizar valores existentes em product_templates
UPDATE public.product_templates SET category = 'janelas'      WHERE category = 'janela';
UPDATE public.product_templates SET category = 'portas'       WHERE category = 'porta';
UPDATE public.product_templates SET category = 'guarda-corpo' WHERE category = 'guarda_corpo';

-- 4) Sanidade: qualquer remanescente fora da lista canônica vira NULL
UPDATE public.company_products
   SET category = NULL
 WHERE category IS NOT NULL
   AND category NOT IN (SELECT slug FROM public.product_categories);

UPDATE public.product_templates
   SET category = NULL
 WHERE category IS NOT NULL
   AND category NOT IN (SELECT slug FROM public.product_categories);

-- 5) Chaves estrangeiras (prevenção de novas duplicidades)
ALTER TABLE public.company_products
  DROP CONSTRAINT IF EXISTS company_products_category_fkey;
ALTER TABLE public.company_products
  ADD CONSTRAINT company_products_category_fkey
  FOREIGN KEY (category) REFERENCES public.product_categories(slug)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.product_templates
  DROP CONSTRAINT IF EXISTS product_templates_category_fkey;
ALTER TABLE public.product_templates
  ADD CONSTRAINT product_templates_category_fkey
  FOREIGN KEY (category) REFERENCES public.product_categories(slug)
  ON UPDATE CASCADE ON DELETE SET NULL;
