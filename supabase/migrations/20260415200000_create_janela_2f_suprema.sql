-- =============================================
-- 1. Recreate item_templates for Suprema profiles
-- =============================================

-- Perfis do Marco
INSERT INTO public.item_templates (id, name, type, unit, linha, description, weight_per_meter, weight_per_bar, bar_length_mm, is_active)
VALUES
  (gen_random_uuid(), 'SU-001', 'profile', 'bar', 'Suprema', 'Marco Superior Correr 2 Folhas', 0.738, 4.428, 6000, true),
  (gen_random_uuid(), 'SU-002', 'profile', 'bar', 'Suprema', 'Marco Inferior Correr 2 Folhas', 0.683, 4.098, 6000, true),
  (gen_random_uuid(), 'SU-003', 'profile', 'bar', 'Suprema', 'Marco Lateral Correr', 0.509, 3.054, 6000, true)
ON CONFLICT DO NOTHING;

-- Perfis da Folha
INSERT INTO public.item_templates (id, name, type, unit, linha, description, weight_per_meter, weight_per_bar, bar_length_mm, is_active)
VALUES
  (gen_random_uuid(), 'SU-039', 'profile', 'bar', 'Suprema', 'Montante da Folha', 0.506, 3.036, 6000, true),
  (gen_random_uuid(), 'SU-040', 'profile', 'bar', 'Suprema', 'Montante Fecho', 0.458, 2.748, 6000, true),
  (gen_random_uuid(), 'SU-041', 'profile', 'bar', 'Suprema', 'Montante Encontro', 0.485, 2.910, 6000, true),
  (gen_random_uuid(), 'SU-053', 'profile', 'bar', 'Suprema', 'Travessa da Folha', 0.500, 3.000, 6000, true),
  (gen_random_uuid(), 'SU-102', 'profile', 'bar', 'Suprema', 'Baguete', 0.111, 0.666, 6000, true)
ON CONFLICT DO NOTHING;

-- Contramarco
INSERT INTO public.item_templates (id, name, type, unit, linha, description, weight_per_meter, weight_per_bar, bar_length_mm, is_active)
VALUES
  (gen_random_uuid(), 'MP-347', 'profile', 'bar', 'Universal', 'Contramarco Suprema', 0.300, 1.800, 6000, true),
  (gen_random_uuid(), 'CM-063', 'profile', 'bar', 'Universal', 'Guarnição Contramarco', 0.200, 1.200, 6000, true)
ON CONFLICT DO NOTHING;

-- Vidro genérico
INSERT INTO public.item_templates (id, name, type, unit, linha, description, is_active)
VALUES
  (gen_random_uuid(), 'Vidro', 'glass', 'm2', 'Universal', 'Vidro genérico para composição', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- 2. Create the Product Template
-- =============================================
INSERT INTO public.product_templates (id, name, category, linha, description, is_active, has_multiple_sides)
VALUES (
  gen_random_uuid(),
  'Janela de Correr 02 Folhas',
  'janela',
  'Suprema',
  'Janela de correr com 2 folhas - Linha Suprema',
  true,
  false
);

-- =============================================
-- 3. Create Composition (product_template_items)
-- =============================================
DO $$
DECLARE
  v_product_id uuid;
  v_su001 uuid; v_su002 uuid; v_su003 uuid;
  v_su039 uuid; v_su040 uuid; v_su041 uuid;
  v_su053 uuid; v_su102 uuid;
  v_mp347 uuid; v_cm063 uuid;
  v_vidro uuid;
BEGIN
  -- Get product template ID
  SELECT id INTO v_product_id FROM product_templates WHERE name = 'Janela de Correr 02 Folhas' AND linha = 'Suprema' LIMIT 1;

  -- Get item template IDs
  SELECT id INTO v_su001 FROM item_templates WHERE name = 'SU-001' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su002 FROM item_templates WHERE name = 'SU-002' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su003 FROM item_templates WHERE name = 'SU-003' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su039 FROM item_templates WHERE name = 'SU-039' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su040 FROM item_templates WHERE name = 'SU-040' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su041 FROM item_templates WHERE name = 'SU-041' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su053 FROM item_templates WHERE name = 'SU-053' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su102 FROM item_templates WHERE name = 'SU-102' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_mp347 FROM item_templates WHERE name = 'MP-347' LIMIT 1;
  SELECT id INTO v_cm063 FROM item_templates WHERE name = 'CM-063' LIMIT 1;
  SELECT id INTO v_vidro FROM item_templates WHERE name = 'Vidro' AND type = 'glass' LIMIT 1;

  -- Marco (Frame) profiles
  INSERT INTO product_template_items (product_template_id, item_template_id, width_formula, height_formula, quantity_formula, pieces_quantity, cut_angle, section, sort_order)
  VALUES
    -- SU-001: Marco Superior - L - 26, 1 peça, corte 90°
    (v_product_id, v_su001, 'L - 26', NULL, '1', 1, 90, 'Perfis', 1),
    -- SU-002: Marco Inferior - L - 26, 1 peça, corte 90°
    (v_product_id, v_su002, 'L - 26', NULL, '1', 1, 90, 'Perfis', 2),
    -- SU-003: Montantes do Marco - A, 2 peças, corte 90°
    (v_product_id, v_su003, NULL, 'A', '1', 2, 90, 'Perfis', 3);

  -- Folha (Sash) profiles
  INSERT INTO product_template_items (product_template_id, item_template_id, width_formula, height_formula, quantity_formula, pieces_quantity, cut_angle, section, sort_order)
  VALUES
    -- SU-053: Travessas da Folha (horizontais) - (L - 26) / 2 - 53, 4 peças
    (v_product_id, v_su053, '(L - 26) / 2 - 53', NULL, '1', 4, 90, 'Perfis', 4),
    -- SU-102: Baguete horizontal - (L - 26) / 2 - 53, 4 peças
    (v_product_id, v_su102, '(L - 26) / 2 - 53', NULL, '1', 4, 90, 'Perfis', 5),
    -- SU-041: Montante Encontro - A - 50, 1 peça
    (v_product_id, v_su041, NULL, 'A - 50', '1', 1, 90, 'Perfis', 6),
    -- SU-040: Montante Fecho - A - 50, 1 peça
    (v_product_id, v_su040, NULL, 'A - 50', '1', 1, 90, 'Perfis', 7),
    -- SU-039: Montante da Folha - A - 50, 2 peças
    (v_product_id, v_su039, NULL, 'A - 50', '1', 2, 90, 'Perfis', 8),
    -- SU-102: Baguete vertical - A - 152, 4 peças
    (v_product_id, v_su102, NULL, 'A - 152', '1', 4, 90, 'Perfis', 9);

  -- Contramarco
  INSERT INTO product_template_items (product_template_id, item_template_id, width_formula, height_formula, quantity_formula, pieces_quantity, cut_angle, section, sort_order, is_optional)
  VALUES
    -- MP-347: Contramarco horizontal - L + 48, 2 peças, corte 45°
    (v_product_id, v_mp347, 'L + 48', NULL, '1', 2, 45, 'Contramarco', 10, true),
    -- MP-347: Contramarco vertical - A + 48, 2 peças, corte 45°
    (v_product_id, v_mp347, NULL, 'A + 48', '1', 2, 45, 'Contramarco', 11, true),
    -- CM-063: Guarnição horizontal - L + 27, 2 peças, corte 45°
    (v_product_id, v_cm063, 'L + 27', NULL, '1', 2, 45, 'Contramarco', 12, true),
    -- CM-063: Guarnição vertical - A + 27, 2 peças, corte 45°
    (v_product_id, v_cm063, NULL, 'A + 27', '1', 2, 45, 'Contramarco', 13, true);

  -- Vidro
  INSERT INTO product_template_items (product_template_id, item_template_id, width_formula, height_formula, quantity_formula, pieces_quantity, cut_angle, section, sort_order)
  VALUES
    (v_product_id, v_vidro, '(L - 26) / 2 - 30', 'A - 80', '1', 2, 90, 'Vidros', 14);

END $$;
