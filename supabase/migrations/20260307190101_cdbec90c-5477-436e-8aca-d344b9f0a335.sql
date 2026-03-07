
ALTER TABLE public.item_templates
  ADD COLUMN IF NOT EXISTS weight_per_meter numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_per_bar numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_cost numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_sale_price numeric DEFAULT NULL;

COMMENT ON COLUMN public.item_templates.weight_per_meter IS 'Peso por metro linear em kg (para perfis)';
COMMENT ON COLUMN public.item_templates.weight_per_bar IS 'Peso por barra em kg (para perfis)';
COMMENT ON COLUMN public.item_templates.default_cost IS 'Custo sugestivo padrão em R$';
COMMENT ON COLUMN public.item_templates.default_sale_price IS 'Preço de venda sugestivo padrão em R$';
