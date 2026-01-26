-- Adicionar campo uses_glass em company_products se não existir
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS uses_glass BOOLEAN DEFAULT true;

-- Criar tabela de preços de vidro vinculada ao produto
CREATE TABLE IF NOT EXISTS public.product_glass_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_id UUID NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  glass_type TEXT NOT NULL,
  thickness_mm INTEGER NOT NULL,
  price_per_sqm NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_per_sqm NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Não permitir repetir combinação produto + tipo_vidro + espessura
  CONSTRAINT unique_product_glass_price UNIQUE (company_product_id, glass_type, thickness_mm)
);

-- Habilitar RLS
ALTER TABLE public.product_glass_prices ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view product glass prices from their company"
ON public.product_glass_prices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_glass_prices.company_product_id
    AND uc.user_id = auth.uid()
    AND uc.is_active = true
  )
);

CREATE POLICY "Users can insert product glass prices for their company"
ON public.product_glass_prices FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_glass_prices.company_product_id
    AND uc.user_id = auth.uid()
    AND uc.is_active = true
  )
);

CREATE POLICY "Users can update product glass prices from their company"
ON public.product_glass_prices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_glass_prices.company_product_id
    AND uc.user_id = auth.uid()
    AND uc.is_active = true
  )
);

CREATE POLICY "Users can delete product glass prices from their company"
ON public.product_glass_prices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_glass_prices.company_product_id
    AND uc.user_id = auth.uid()
    AND uc.is_active = true
  )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_product_glass_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_product_glass_prices_updated_at
BEFORE UPDATE ON public.product_glass_prices
FOR EACH ROW
EXECUTE FUNCTION update_product_glass_prices_updated_at();

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_product_glass_prices_product 
ON public.product_glass_prices(company_product_id);

-- Comentários
COMMENT ON TABLE public.product_glass_prices IS 'Preços de vidro específicos por produto';
COMMENT ON COLUMN public.product_glass_prices.glass_type IS 'Tipo do vidro: Comum, Temperado, Laminado, etc';
COMMENT ON COLUMN public.product_glass_prices.thickness_mm IS 'Espessura em mm: 4, 6, 8, 10';
COMMENT ON COLUMN public.product_glass_prices.price_per_sqm IS 'Preço de venda por m²';
COMMENT ON COLUMN public.product_glass_prices.cost_per_sqm IS 'Custo por m²';