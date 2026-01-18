-- Create table for saving glass projects
CREATE TABLE public.glass_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_template_id UUID REFERENCES public.product_templates(id),
  name TEXT NOT NULL,
  vao_width INTEGER NOT NULL,
  vao_height INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  lock_height INTEGER DEFAULT 1000,
  panels JSONB NOT NULL DEFAULT '[]',
  -- Each panel: { id, letter, name, width, height, widthFormula, heightFormula, 
  --   holes: [{x, y, diameter}],
  --   cutouts: [{x, y, width, height}],
  --   roundedCorners: [{corner, radius}]
  -- }
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.glass_projects ENABLE ROW LEVEL SECURITY;

-- Create policies for company users
CREATE POLICY "Users can view their company glass projects"
ON public.glass_projects
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create glass projects for their company"
ON public.glass_projects
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company glass projects"
ON public.glass_projects
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company glass projects"
ON public.glass_projects
FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM public.employees WHERE user_id = auth.uid()
  )
);

-- Create index for better performance
CREATE INDEX idx_glass_projects_company_id ON public.glass_projects(company_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_glass_projects_updated_at
BEFORE UPDATE ON public.glass_projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();