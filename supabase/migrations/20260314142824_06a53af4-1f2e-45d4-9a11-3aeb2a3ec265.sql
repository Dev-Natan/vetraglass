-- Change product_templates.category from enum to text
ALTER TABLE product_templates ALTER COLUMN category TYPE text USING category::text;

-- Change company_products.category from enum to text  
ALTER TABLE company_products ALTER COLUMN category TYPE text USING category::text;

-- Drop the old enum
DROP TYPE IF EXISTS product_category;