-- 1. Adicionar valor 'sheet' ao ENUM item_type
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'sheet';

-- 2. Criar categorias de vidro para Chaparia (glass_types usados para precificação)
INSERT INTO glass_types (slug, name, description, sort_order, is_active)
VALUES 
  ('espelho', 'Espelho', 'Espelho comum', 100, true),
  ('espelho-bronze', 'Espelho Bronze', 'Espelho na cor bronze', 101, true),
  ('espelho-fume', 'Espelho Fumê', 'Espelho na cor fumê', 102, true),
  ('acrilico', 'Acrílico', 'Chapa de acrílico', 110, true),
  ('policarbonato', 'Policarbonato', 'Chapa de policarbonato', 111, true)
ON CONFLICT (slug) DO NOTHING;