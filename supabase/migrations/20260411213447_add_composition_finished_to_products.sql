ALTER TABLE company_products ADD COLUMN IF NOT EXISTS composition_finished BOOLEAN DEFAULT false;
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS composition_finished BOOLEAN DEFAULT false;
