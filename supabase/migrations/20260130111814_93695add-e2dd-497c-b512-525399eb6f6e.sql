-- Adicionar campos de rastreabilidade à tabela stock_movements
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS company_item_id UUID REFERENCES public.company_items(id),
ADD COLUMN IF NOT EXISTS reference_id UUID,
ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- Índices para melhor performance em buscas por referência
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference 
ON public.stock_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_company_item 
ON public.stock_movements(company_item_id);

-- Comentários para documentação
COMMENT ON COLUMN public.stock_movements.company_item_id IS 'Referência ao item da empresa para rastreabilidade';
COMMENT ON COLUMN public.stock_movements.reference_id IS 'ID do documento de origem (purchase_order, sale, ordem_servico)';
COMMENT ON COLUMN public.stock_movements.reference_type IS 'Tipo do documento: purchase_order, sale, ordem_servico, manual';