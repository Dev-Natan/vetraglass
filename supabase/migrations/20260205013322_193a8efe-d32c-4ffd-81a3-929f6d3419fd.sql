-- Adicionar coluna para vincular itens avulsos em quote_items
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL;

-- Adicionar coluna para identificar se é um item avulso (não um produto)
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'product' CHECK (item_type IN ('product', 'item'));

-- Adicionar coluna para unidade do item (quando for item avulso)
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS unit TEXT;

-- Criar índice para busca de itens avulsos
CREATE INDEX IF NOT EXISTS idx_quote_items_company_item_id ON public.quote_items(company_item_id);

-- Comentário explicativo
COMMENT ON COLUMN public.quote_items.company_item_id IS 'Referência ao item avulso quando item_type = item';
COMMENT ON COLUMN public.quote_items.item_type IS 'Tipo: product (produto completo) ou item (material avulso)';