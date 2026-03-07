
-- =====================================================
-- INSERT MISSING SHARED PROFILES USED IN INOVA LINE
-- (CM, RM, MH, DS, VZ, US series)
-- =====================================================

INSERT INTO item_templates (name, description, type, unit, linha, weight_per_meter, weight_per_bar, default_price)
VALUES
  -- Contramarcos
  ('CM-093', 'Contramarco CM-093', 'profile', 'barra', 'Inova', 0.769, 4.614, 0),
  ('CM-099', 'Contramarco CM-099', 'profile', 'barra', 'Inova', 0.577, 3.462, 0),
  ('CM-173', 'Contramarco CM-173', 'profile', 'barra', 'Inova', 0.509, 3.054, 0),
  ('CM-174', 'Contramarco CM-174', 'profile', 'barra', 'Inova', 0.411, 2.466, 0),
  ('CM-175', 'Contramarco CM-175', 'profile', 'barra', 'Inova', 0.602, 3.612, 0),
  ('CM-207', 'Contramarco CM-207', 'profile', 'barra', 'Inova', 0.640, 3.840, 0),
  ('CM-208', 'Contramarco CM-208', 'profile', 'barra', 'Inova', 0.610, 3.660, 0),
  ('CM-209', 'Contramarco CM-209', 'profile', 'barra', 'Inova', 0.543, 3.258, 0),
  ('CM-210', 'Contramarco CM-210', 'profile', 'barra', 'Inova', 0.530, 3.180, 0),
  ('CM-211', 'Presilha CM-211', 'profile', 'barra', 'Inova', 0.137, 0.822, 0),
  -- Reforços/Marco
  ('RM-019', 'Reforço RM-019', 'profile', 'barra', 'Inova', 0.206, 1.236, 0),
  ('RM-020', 'Reforço RM-020', 'profile', 'barra', 'Inova', 0.232, 1.392, 0),
  ('RM-022', 'Reforço RM-022', 'profile', 'barra', 'Inova', 0.226, 1.356, 0),
  ('RM-023', 'Reforço RM-023', 'profile', 'barra', 'Inova', 0.233, 1.398, 0),
  ('RM-025', 'Reforço RM-025', 'profile', 'barra', 'Inova', 0.378, 2.268, 0),
  ('RM-026', 'Reforço RM-026', 'profile', 'barra', 'Inova', 0.383, 2.298, 0),
  ('RM-027', 'Reforço RM-027', 'profile', 'barra', 'Inova', 0.402, 2.412, 0),
  ('RM-028', 'Reforço RM-028', 'profile', 'barra', 'Inova', 0.407, 2.442, 0),
  -- Montantes horizontais
  ('MH-005', 'Montante Horizontal MH-005', 'profile', 'barra', 'Inova', 1.090, 6.540, 0),
  ('MH-095', 'Montante Horizontal MH-095', 'profile', 'barra', 'Inova', 0.181, 1.086, 0),
  ('MH-096', 'Montante Horizontal MH-096', 'profile', 'barra', 'Inova', 0.366, 2.196, 0),
  ('MH-104', 'Montante Horizontal MH-104', 'profile', 'barra', 'Inova', 0.598, 3.588, 0),
  ('MH-106', 'Montante Horizontal MH-106', 'profile', 'barra', 'Inova', 0.163, 0.978, 0),
  ('MH-125', 'Montante Horizontal MH-125', 'profile', 'barra', 'Inova', 0.154, 0.924, 0),
  -- Diversos
  ('DS-023', 'Perfil DS-023', 'profile', 'barra', 'Inova', 0.259, 1.554, 0),
  ('DS-238', 'Perfil DS-238', 'profile', 'barra', 'Inova', 0.480, 2.880, 0),
  ('VZ-075', 'Perfil VZ-075', 'profile', 'barra', 'Inova', 0.259, 1.554, 0),
  ('US-621', 'Perfil US-621', 'profile', 'barra', 'Inova', 0.130, 0.780, 0);

-- Also update existing shared profiles with correct Inova PDF weights
UPDATE item_templates SET weight_per_meter = 0.276, weight_per_bar = 1.656 WHERE name = 'CM-060' AND linha = 'Universal';
UPDATE item_templates SET weight_per_meter = 0.392, weight_per_bar = 2.352 WHERE name = 'CM-098' AND linha = 'Sem Linha';
UPDATE item_templates SET weight_per_meter = 0.309, weight_per_bar = 1.854 WHERE name = 'CM-151' AND linha = 'Sem Linha';
UPDATE item_templates SET weight_per_meter = 0.198, weight_per_bar = 1.188 WHERE name = 'CM-200' AND linha = 'Universal';
