ALTER TABLE public.os_items 
ADD COLUMN IF NOT EXISTS largura_venda DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS altura_venda DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS largura_producao DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS altura_producao DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS product_id UUID,
ADD COLUMN IF NOT EXISTS recalculation_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_recalculated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS technical_notes TEXT;

-- Update os_items with initial values from quote_items (if not already set)
UPDATE public.os_items 
SET largura_venda = width_sold,
    altura_venda = height_sold,
    largura_producao = width_production,
    altura_producao = height_production
WHERE largura_venda IS NULL;
