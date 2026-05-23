-- Add side to glass_line_formulas
ALTER TABLE public.glass_line_formulas ADD COLUMN side TEXT;

-- Add vao_width_b and vao_height_b to OS tables to store full dimensions
ALTER TABLE public.os_cutting_plan ADD COLUMN vao_width_b INTEGER;
ALTER TABLE public.os_cutting_plan ADD COLUMN vao_height_b INTEGER;

ALTER TABLE public.os_glass_projects ADD COLUMN vao_width_b INTEGER;
ALTER TABLE public.os_glass_projects ADD COLUMN vao_height_b INTEGER;

ALTER TABLE public.os_materials ADD COLUMN vao_width_b INTEGER;
ALTER TABLE public.os_materials ADD COLUMN vao_height_b INTEGER;

-- Update existing glass_line_formulas with default side if needed (usually null means both)
COMMENT ON COLUMN public.glass_line_formulas.side IS 'Lado do produto (A, B ou null para ambos)';
