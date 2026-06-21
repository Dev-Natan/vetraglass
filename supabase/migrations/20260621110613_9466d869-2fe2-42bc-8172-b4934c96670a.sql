ALTER TABLE public.company_items
  ADD COLUMN IF NOT EXISTS altura_mm numeric,
  ADD COLUMN IF NOT EXISTS largura_mm numeric,
  ADD COLUMN IF NOT EXISTS comprimento_linear_mm numeric,
  ADD COLUMN IF NOT EXISTS preco_unitario numeric;

COMMENT ON COLUMN public.company_items.altura_mm IS 'Altura padrão da chapa (mm) para insumos m² (vidros)';
COMMENT ON COLUMN public.company_items.largura_mm IS 'Largura padrão da chapa (mm) para insumos m² (vidros)';
COMMENT ON COLUMN public.company_items.comprimento_linear_mm IS 'Comprimento da barra/perfil (mm) para insumos ml';
COMMENT ON COLUMN public.company_items.preco_unitario IS 'Preço unitário R$ para insumos un/kit';