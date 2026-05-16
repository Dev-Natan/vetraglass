-- Adicionar cores padrão para chaparia/espelhos se não existirem
INSERT INTO glass_colors (company_id, slug, name, hex_color, sort_order)
SELECT c.id, color_slug, color_name, color_hex, color_order
FROM companies c
CROSS JOIN (VALUES 
  ('prata', 'Prata', '#C0C0C0', 1),
  ('incolor', 'Incolor', '#FFFFFF', 2),
  ('fume', 'Fumê', '#4A4A4A', 3),
  ('bronze', 'Bronze', '#CD7F32', 4),
  ('verde', 'Verde', '#228B22', 5),
  ('preto', 'Preto', '#000000', 6),
  ('branco', 'Branco', '#FAFAFA', 7)
) AS colors(color_slug, color_name, color_hex, color_order)
WHERE NOT EXISTS (
  SELECT 1 FROM glass_colors gc 
  WHERE gc.company_id = c.id AND gc.slug = color_slug
);

-- Adicionar espessuras padrão para chaparia se não existirem
INSERT INTO glass_thicknesses (company_id, thickness, thickness_mm, sort_order)
SELECT c.id, thickness_label, thickness_val, thickness_order
FROM companies c
CROSS JOIN (VALUES 
  ('2mm', 2, 1),
  ('3mm', 3, 2),
  ('4mm', 4, 3),
  ('5mm', 5, 4),
  ('6mm', 6, 5),
  ('8mm', 8, 6),
  ('10mm', 10, 7)
) AS thicknesses(thickness_label, thickness_val, thickness_order)
WHERE NOT EXISTS (
  SELECT 1 FROM glass_thicknesses gt 
  WHERE gt.company_id = c.id AND gt.thickness = thickness_label
);