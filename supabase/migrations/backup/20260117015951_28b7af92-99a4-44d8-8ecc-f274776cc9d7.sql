-- Adicionar colunas de alíquotas IBS, CBS e IS na tabela item_templates
ALTER TABLE public.item_templates 
ADD COLUMN IF NOT EXISTS aliquota_ibs numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS aliquota_cbs numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS aliquota_is numeric DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.item_templates.aliquota_ibs IS 'Alíquota do Imposto sobre Bens e Serviços (IBS)';
COMMENT ON COLUMN public.item_templates.aliquota_cbs IS 'Alíquota da Contribuição sobre Bens e Serviços (CBS)';
COMMENT ON COLUMN public.item_templates.aliquota_is IS 'Alíquota do Imposto Seletivo (IS)';