-- Atualizar constraint de category para incluir novas categorias de venda
ALTER TABLE public.cash_movements 
DROP CONSTRAINT IF EXISTS cash_movements_category_check;

ALTER TABLE public.cash_movements 
ADD CONSTRAINT cash_movements_category_check 
CHECK (category = ANY (ARRAY[
  'venda'::text,
  'servico'::text, 
  'recebimento'::text,
  'recebimento_parcela'::text,
  'troco'::text,
  'sangria'::text,
  'suprimento'::text,
  'reforco'::text,
  'despesa'::text,
  'outros'::text,
  'entrada_orcamento'::text,
  'entrada_venda'::text,
  'adiantamento'::text,
  'compensacao_adiantamento'::text,
  'faturamento_final'::text
]));

-- Adicionar coluna origem para rastreabilidade (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'origem'
  ) THEN
    ALTER TABLE public.cash_movements ADD COLUMN origem text;
  END IF;
END $$;