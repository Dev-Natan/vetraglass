-- Add fiscal fields to companies table for NFS-e emission
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
ADD COLUMN IF NOT EXISTS codigo_municipio_ibge TEXT,
ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
ADD COLUMN IF NOT EXISTS regime_tributario TEXT DEFAULT 'simples_nacional',
ADD COLUMN IF NOT EXISTS ambiente_fiscal TEXT DEFAULT 'homologacao';