-- Add bar_length_mm to item_templates for profile optimization
ALTER TABLE public.item_templates 
ADD COLUMN IF NOT EXISTS bar_length_mm INTEGER DEFAULT 6000;

-- Create os_materials table for optimized materials list
CREATE TABLE public.os_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id),
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('profile', 'glass', 'accessory', 'service')),
  cut_length_mm INTEGER,
  pieces_count INTEGER NOT NULL DEFAULT 1,
  total_length_mm INTEGER,
  bar_length_mm INTEGER DEFAULT 6000,
  bars_needed NUMERIC(10,2),
  waste_mm INTEGER,
  waste_percent NUMERIC(5,2),
  unit TEXT DEFAULT 'un',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create os_cutting_plan table for cutting plans per quote item
CREATE TABLE public.os_cutting_plan (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES public.quote_items(id),
  product_name TEXT NOT NULL,
  product_template_id UUID REFERENCES public.product_templates(id),
  vao_width INTEGER NOT NULL,
  vao_height INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cuts_data JSONB NOT NULL DEFAULT '[]',
  glass_cuts_data JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create os_glass_projects table for glass projects
CREATE TABLE public.os_glass_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES public.quote_items(id),
  product_name TEXT NOT NULL,
  product_template_id UUID REFERENCES public.product_templates(id),
  vao_width INTEGER NOT NULL,
  vao_height INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  panels_data JSONB NOT NULL DEFAULT '[]',
  total_area_m2 NUMERIC(10,4),
  glass_type TEXT,
  glass_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.os_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_cutting_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.os_glass_projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for os_materials
CREATE POLICY "Users can view os_materials for their company orders"
ON public.os_materials FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = os_materials.ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert os_materials for their company orders"
ON public.os_materials FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete os_materials for their company orders"
ON public.os_materials FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = os_materials.ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

-- Create RLS policies for os_cutting_plan
CREATE POLICY "Users can view os_cutting_plan for their company orders"
ON public.os_cutting_plan FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = os_cutting_plan.ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert os_cutting_plan for their company orders"
ON public.os_cutting_plan FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete os_cutting_plan for their company orders"
ON public.os_cutting_plan FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = os_cutting_plan.ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

-- Create RLS policies for os_glass_projects
CREATE POLICY "Users can view os_glass_projects for their company orders"
ON public.os_glass_projects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = os_glass_projects.ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert os_glass_projects for their company orders"
ON public.os_glass_projects FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete os_glass_projects for their company orders"
ON public.os_glass_projects FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON os.company_id = uc.company_id
    WHERE os.id = os_glass_projects.ordem_servico_id
    AND uc.user_id = auth.uid()
  )
);

-- Create indexes for better performance
CREATE INDEX idx_os_materials_ordem_servico ON public.os_materials(ordem_servico_id);
CREATE INDEX idx_os_cutting_plan_ordem_servico ON public.os_cutting_plan(ordem_servico_id);
CREATE INDEX idx_os_glass_projects_ordem_servico ON public.os_glass_projects(ordem_servico_id);