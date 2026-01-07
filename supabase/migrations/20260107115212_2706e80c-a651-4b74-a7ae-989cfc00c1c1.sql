-- Adicionar coluna is_active na tabela company_stock
ALTER TABLE public.company_stock 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;