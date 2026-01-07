-- Adicionar coluna para permitir venda fracionada
ALTER TABLE public.company_stock 
ADD COLUMN IF NOT EXISTS allow_fractional boolean NOT NULL DEFAULT false;