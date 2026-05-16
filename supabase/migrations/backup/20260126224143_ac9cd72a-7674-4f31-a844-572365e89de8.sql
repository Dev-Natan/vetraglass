-- Drop the old constraint and add a new one with the missing categories
ALTER TABLE public.company_cash_movements 
DROP CONSTRAINT company_cash_movements_category_check;

ALTER TABLE public.company_cash_movements 
ADD CONSTRAINT company_cash_movements_category_check 
CHECK (category = ANY (ARRAY[
  'abertura_caixa'::text, 
  'fechamento_caixa'::text, 
  'deposito'::text, 
  'retirada'::text, 
  'transferencia_banco'::text, 
  'ajuste_positivo'::text, 
  'ajuste_negativo'::text, 
  'reforco_caixa'::text, 
  'compensacao_adiantamento'::text,
  'retorno_fundo_fixo'::text,
  'lucro_caixa'::text
]));