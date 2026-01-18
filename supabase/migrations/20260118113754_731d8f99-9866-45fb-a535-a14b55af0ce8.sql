-- Remove the unique constraint on (linha, formula_name) since we want to allow 
-- same formula names for different products within the same linha
ALTER TABLE public.glass_line_formulas 
DROP CONSTRAINT IF EXISTS glass_line_formulas_linha_formula_name_key;

-- Add a new unique constraint that includes product_template_id
-- This allows the same formula name for different products, but prevents duplicates within a product
ALTER TABLE public.glass_line_formulas 
ADD CONSTRAINT glass_line_formulas_product_formula_unique 
UNIQUE (product_template_id, formula_name, panel_index);