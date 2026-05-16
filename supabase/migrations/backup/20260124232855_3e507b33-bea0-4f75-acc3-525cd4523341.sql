-- Create purchase_orders table for tracking material purchases
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  order_number SERIAL,
  supplier_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'partial', 'received', 'cancelled')),
  total_estimated NUMERIC NOT NULL DEFAULT 0,
  total_actual NUMERIC DEFAULT 0,
  expected_delivery DATE,
  received_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_order_items table for individual items
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id),
  os_material_id UUID,
  os_glass_project_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'un',
  width_mm NUMERIC,
  height_mm NUMERIC,
  estimated_cost NUMERIC NOT NULL DEFAULT 0,
  actual_cost NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  received_at TIMESTAMP WITH TIME ZONE,
  received_quantity NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add procurement tracking to os_materials
ALTER TABLE public.os_materials 
ADD COLUMN IF NOT EXISTS procurement_status TEXT DEFAULT 'pending_purchase' CHECK (procurement_status IN ('in_stock', 'pending_purchase', 'ordered', 'received')),
ADD COLUMN IF NOT EXISTS purchase_order_item_id UUID REFERENCES public.purchase_order_items(id);

-- Add procurement tracking to os_glass_projects
ALTER TABLE public.os_glass_projects 
ADD COLUMN IF NOT EXISTS procurement_status TEXT DEFAULT 'pending_purchase' CHECK (procurement_status IN ('pending_purchase', 'ordered', 'received')),
ADD COLUMN IF NOT EXISTS purchase_order_item_id UUID REFERENCES public.purchase_order_items(id);

-- Add procurement type to item_templates (stock vs on_demand)
ALTER TABLE public.item_templates 
ADD COLUMN IF NOT EXISTS procurement_type TEXT DEFAULT 'stock' CHECK (procurement_type IN ('stock', 'on_demand')),
ADD COLUMN IF NOT EXISTS default_supplier TEXT;

-- Enable RLS on new tables
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders
CREATE POLICY "Users can view company purchase orders"
ON public.purchase_orders FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company purchase orders"
ON public.purchase_orders FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company purchase orders"
ON public.purchase_orders FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company purchase orders"
ON public.purchase_orders FOR DELETE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- RLS Policies for purchase_order_items
CREATE POLICY "Users can view purchase order items"
ON public.purchase_order_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_items.purchase_order_id
  AND user_belongs_to_company(auth.uid(), po.company_id)
));

CREATE POLICY "Users can create purchase order items"
ON public.purchase_order_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_items.purchase_order_id
  AND user_belongs_to_company(auth.uid(), po.company_id)
));

CREATE POLICY "Users can update purchase order items"
ON public.purchase_order_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_items.purchase_order_id
  AND user_belongs_to_company(auth.uid(), po.company_id)
));

CREATE POLICY "Users can delete purchase order items"
ON public.purchase_order_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po
  WHERE po.id = purchase_order_items.purchase_order_id
  AND user_has_role_in_company(auth.uid(), po.company_id, 'admin')
));

-- Create indexes for performance
CREATE INDEX idx_purchase_orders_company ON public.purchase_orders(company_id);
CREATE INDEX idx_purchase_orders_os ON public.purchase_orders(ordem_servico_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(status);
CREATE INDEX idx_purchase_order_items_order ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_purchase_order_items_status ON public.purchase_order_items(status);
CREATE INDEX idx_os_materials_procurement ON public.os_materials(procurement_status);
CREATE INDEX idx_os_glass_projects_procurement ON public.os_glass_projects(procurement_status);