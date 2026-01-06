-- Add linha column to item_templates
ALTER TABLE public.item_templates 
ADD COLUMN linha text DEFAULT 'Sem Linha';

-- Create index for better filtering performance
CREATE INDEX idx_item_templates_linha ON public.item_templates(linha);