-- Adicionar coluna de ângulo de corte na tabela product_template_items
ALTER TABLE public.product_template_items 
ADD COLUMN cut_angle integer NOT NULL DEFAULT 90;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.product_template_items.cut_angle IS 'Ângulo de corte em graus (90 ou 45)';