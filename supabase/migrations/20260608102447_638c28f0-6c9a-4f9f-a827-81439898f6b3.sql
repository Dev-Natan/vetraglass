ALTER TABLE public.product_template_items 
ADD COLUMN IF NOT EXISTS cut_angle_start INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS cut_angle_end INTEGER DEFAULT 90;

-- Atualizar registros existentes para herdar o valor de cut_angle se necessário, 
-- embora o default 90 já cubra a maioria dos casos.
UPDATE public.product_template_items 
SET cut_angle_start = cut_angle, cut_angle_end = cut_angle 
WHERE cut_angle IS NOT NULL;