-- Criar linha Chaparia
INSERT INTO product_linhas (slug, name, description, color, sort_order, is_active)
VALUES ('chaparia', 'Chaparia', 'Espelhos, vidros comuns, acrílicos e outros materiais por m²', '#06b6d4', 100, true)
ON CONFLICT (slug) DO NOTHING;

-- Adicionar categorias de chaparia como glass_types
INSERT INTO glass_types (slug, name, description, sort_order, is_active)
VALUES 
  ('espelho', 'Espelho', 'Espelhos comuns e decorativos', 10, true),
  ('vidro_comum', 'Vidro Comum', 'Vidros float não temperados', 11, true),
  ('acrilico', 'Acrílico', 'Chapas de acrílico/PMMA', 12, true),
  ('policarbonato', 'Policarbonato', 'Chapas de policarbonato', 13, true),
  ('espelho_organico', 'Espelho Orgânico', 'Espelhos de acrílico', 14, true)
ON CONFLICT (slug) DO NOTHING;

-- Adicionar tipo de item "Chaparia" para estoque
INSERT INTO item_types (slug, name, color, icon, unit_default, sort_order, is_active)
VALUES ('sheet', 'Chaparia', '#06b6d4', 'square', 'm²', 5, true)
ON CONFLICT (slug) DO NOTHING;