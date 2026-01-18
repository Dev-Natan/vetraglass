-- Add is_movable column to glass_line_formulas to identify movable panels
ALTER TABLE public.glass_line_formulas 
ADD COLUMN IF NOT EXISTS is_movable BOOLEAN DEFAULT false;

-- Update existing formulas - mark as movable based on name patterns
UPDATE public.glass_line_formulas 
SET is_movable = true 
WHERE LOWER(formula_name) LIKE '%móvel%' 
   OR LOWER(formula_name) LIKE '%movel%'
   OR LOWER(description) LIKE '%móvel%'
   OR LOWER(description) LIKE '%movel%'
   OR LOWER(formula_name) LIKE '%folha%';

-- Mark fixed panels as not movable
UPDATE public.glass_line_formulas 
SET is_movable = false 
WHERE LOWER(formula_name) LIKE '%fixo%' 
   OR LOWER(formula_name) LIKE '%fixa%'
   OR LOWER(description) LIKE '%fixo%'
   OR LOWER(description) LIKE '%fixa%';