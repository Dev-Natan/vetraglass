-- Add default glass formulas for Gold line (Janela de Correr 2 Folhas)
INSERT INTO public.glass_line_formulas (linha, formula_name, width_formula, height_formula, panel_index, description, is_active, product_template_id)
VALUES 
  ('Gold', 'Folha 1', 'L / 2 - 25', 'A - 100', 1, 'Vidro da primeira folha - Janela de Correr 2 Folhas', true, NULL),
  ('Gold', 'Folha 2', 'L / 2 - 25', 'A - 100', 2, 'Vidro da segunda folha - Janela de Correr 2 Folhas', true, NULL)
ON CONFLICT DO NOTHING;