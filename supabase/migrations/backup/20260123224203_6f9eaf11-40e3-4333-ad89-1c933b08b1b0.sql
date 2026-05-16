
-- Create product_linhas table for SaaS admin to manage global product lines
CREATE TABLE public.product_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  color TEXT DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_linhas ENABLE ROW LEVEL SECURITY;

-- Anyone can read product linhas
CREATE POLICY "Anyone can read product linhas"
ON public.product_linhas
FOR SELECT
USING (true);

-- Only SaaS admins can manage product linhas
CREATE POLICY "Admins can manage product linhas"
ON public.product_linhas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM saas_admins WHERE user_id = auth.uid()
  )
);

-- Create index for sorting
CREATE INDEX idx_product_linhas_sort ON public.product_linhas(sort_order);
CREATE INDEX idx_product_linhas_active ON public.product_linhas(is_active);

-- Insert existing linhas from product_templates
INSERT INTO public.product_linhas (slug, name, sort_order)
SELECT DISTINCT 
  LOWER(REPLACE(REPLACE(linha, ' ', '_'), '-', '_')) as slug,
  linha as name,
  ROW_NUMBER() OVER (ORDER BY linha) as sort_order
FROM public.product_templates
WHERE linha IS NOT NULL AND linha != ''
ON CONFLICT (slug) DO NOTHING;
