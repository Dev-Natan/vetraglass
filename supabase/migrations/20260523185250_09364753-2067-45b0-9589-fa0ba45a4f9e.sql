ALTER TABLE public.os_items 
ADD COLUMN IF NOT EXISTS largura_venda_b DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS altura_venda_b DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS largura_venda_c DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS altura_venda_c DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS largura_producao_b DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS altura_producao_b DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS largura_producao_c DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS altura_producao_c DECIMAL(10,2);

-- Update existing records if multi-side data was in original columns
UPDATE public.os_items 
SET largura_venda_b = width_sold_b,
    altura_venda_b = height_sold_b,
    largura_producao_b = width_production_b,
    altura_producao_b = height_production_b
WHERE largura_venda_b IS NULL AND width_sold_b IS NOT NULL;
