-- 1. Create os_items table
CREATE TABLE IF NOT EXISTS public.os_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
    quote_item_id UUID REFERENCES public.quote_items(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    -- Sales dimensions (frozen)
    width_sold DECIMAL(10,2) NOT NULL,
    height_sold DECIMAL(10,2) NOT NULL,
    width_sold_b DECIMAL(10,2),
    height_sold_b DECIMAL(10,2),
    quantity INTEGER NOT NULL DEFAULT 1,
    -- Production dimensions (adjustable)
    width_production DECIMAL(10,2) NOT NULL,
    height_production DECIMAL(10,2) NOT NULL,
    width_production_b DECIMAL(10,2),
    height_production_b DECIMAL(10,2),
    technical_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for os_items
ALTER TABLE public.os_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view os_items of their company" 
ON public.os_items 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON uc.company_id = os.company_id
    WHERE os.id = os_items.os_id AND uc.user_id = auth.uid()
));

CREATE POLICY "Users can insert os_items of their company" 
ON public.os_items 
FOR INSERT 
WITH CHECK (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON uc.company_id = os.company_id
    WHERE os.id = os_items.os_id AND uc.user_id = auth.uid()
));

CREATE POLICY "Users can update os_items of their company" 
ON public.os_items 
FOR UPDATE 
USING (EXISTS (
    SELECT 1 FROM public.ordens_servico os
    JOIN public.user_companies uc ON uc.company_id = os.company_id
    WHERE os.id = os_items.os_id AND uc.user_id = auth.uid()
));

-- 2. Create os_dimension_history table
CREATE TABLE IF NOT EXISTS public.os_dimension_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    os_item_id UUID NOT NULL REFERENCES public.os_items(id) ON DELETE CASCADE,
    field TEXT NOT NULL, -- 'width_production', 'height_production', etc.
    previous_value DECIMAL(10,2),
    new_value DECIMAL(10,2) NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for os_dimension_history
ALTER TABLE public.os_dimension_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dimension history of their company" 
ON public.os_dimension_history 
FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM public.os_items oi
    JOIN public.ordens_servico os ON os.id = oi.os_id
    JOIN public.user_companies uc ON uc.company_id = os.company_id
    WHERE oi.id = os_dimension_history.os_item_id AND uc.user_id = auth.uid()
));

-- 3. Update existing tables to link to os_items
ALTER TABLE public.os_cutting_plan ADD COLUMN IF NOT EXISTS os_item_id UUID REFERENCES public.os_items(id) ON DELETE SET NULL;
ALTER TABLE public.os_glass_projects ADD COLUMN IF NOT EXISTS os_item_id UUID REFERENCES public.os_items(id) ON DELETE SET NULL;
ALTER TABLE public.os_materials ADD COLUMN IF NOT EXISTS os_item_id UUID REFERENCES public.os_items(id) ON DELETE SET NULL;

-- 4. Create trigger for timestamp updates
CREATE OR REPLACE FUNCTION public.update_os_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_os_items_timestamp
BEFORE UPDATE ON public.os_items
FOR EACH ROW
EXECUTE FUNCTION public.update_os_items_updated_at();

-- 5. Data Migration: Populate os_items for existing OS
INSERT INTO public.os_items (
    os_id, quote_item_id, product_name, 
    width_sold, height_sold, width_sold_b, height_sold_b, quantity,
    width_production, height_production, width_production_b, height_production_b
)
SELECT 
    os.id, qi.id, qi.description,
    qi.width, qi.height, qi.width_b, qi.height_b, qi.quantity,
    qi.width, qi.height, qi.width_b, qi.height_b
FROM public.ordens_servico os
JOIN public.quote_items qi ON qi.quote_id = os.quote_id;
