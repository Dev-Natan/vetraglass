-- Create municipalities table with IBGE codes
CREATE TABLE public.municipios_ibge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_ibge VARCHAR(7) NOT NULL UNIQUE,
  nome_municipio VARCHAR(255) NOT NULL,
  uf_codigo VARCHAR(2) NOT NULL,
  uf_nome VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.municipios_ibge ENABLE ROW LEVEL SECURITY;

-- Public read policy (municipalities are public data)
CREATE POLICY "Municípios são públicos para leitura" 
ON public.municipios_ibge 
FOR SELECT 
USING (true);

-- Create index for fast search
CREATE INDEX idx_municipios_ibge_nome ON public.municipios_ibge USING gin(to_tsvector('portuguese', nome_municipio));
CREATE INDEX idx_municipios_ibge_uf ON public.municipios_ibge (uf_codigo);
CREATE INDEX idx_municipios_ibge_codigo ON public.municipios_ibge (codigo_ibge);