-- Create table to store glass formulas per product line (linha)
CREATE TABLE public.glass_line_formulas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  linha TEXT NOT NULL,
  formula_name TEXT NOT NULL,
  description TEXT,
  width_formula TEXT NOT NULL DEFAULT 'Largura',
  height_formula TEXT NOT NULL DEFAULT 'Altura',
  panel_index INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(linha, formula_name)
);

-- Enable RLS
ALTER TABLE public.glass_line_formulas ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (needed for glass project calculations)
CREATE POLICY "Anyone can view glass formulas"
ON public.glass_line_formulas
FOR SELECT
USING (true);

-- Only saas admins can modify glass formulas
CREATE POLICY "Only admins can insert glass formulas"
ON public.glass_line_formulas
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.saas_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Only admins can update glass formulas"
ON public.glass_line_formulas
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.saas_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Only admins can delete glass formulas"
ON public.glass_line_formulas
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.saas_admins WHERE user_id = auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_glass_line_formulas_updated_at
BEFORE UPDATE ON public.glass_line_formulas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.glass_line_formulas IS 'Stores glass calculation formulas for each product line (linha). Used in glass projects to calculate panel dimensions.';