-- Adicionar campo linha aos product_templates
ALTER TABLE public.product_templates 
ADD COLUMN linha text DEFAULT 'Sem Linha';

-- Criar índice para buscas por linha
CREATE INDEX idx_product_templates_linha ON public.product_templates(linha);