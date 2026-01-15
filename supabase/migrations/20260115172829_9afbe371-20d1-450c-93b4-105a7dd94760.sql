-- Table for service appointments/schedule
CREATE TABLE public.service_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  appointment_type TEXT NOT NULL DEFAULT 'medicao', -- medicao, instalacao, manutencao, visita
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  all_day BOOLEAN DEFAULT false,
  
  -- Customer info
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  
  -- Related entities
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  
  -- Assignment
  assigned_to UUID,
  assigned_to_name TEXT,
  
  -- Notes
  notes TEXT,
  color TEXT DEFAULT '#3b82f6',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for site measurements
CREATE TABLE public.site_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.service_appointments(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  
  -- Basic info
  measurement_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, completed, approved, rejected
  measured_by UUID NOT NULL,
  measured_by_name TEXT,
  measured_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Location
  location_name TEXT,
  location_address TEXT,
  room_name TEXT,
  
  -- General notes
  notes TEXT,
  observations TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sequence for measurement numbers per company
CREATE SEQUENCE IF NOT EXISTS site_measurements_number_seq;

-- Table for individual measurement items (each window/door measured)
CREATE TABLE public.measurement_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id UUID NOT NULL REFERENCES public.site_measurements(id) ON DELETE CASCADE,
  
  -- Item identification
  item_name TEXT NOT NULL,
  item_type TEXT DEFAULT 'window', -- window, door, partition, mirror, shower, other
  room TEXT,
  position TEXT, -- e.g. "sala frente", "quarto 1"
  
  -- Dimensions (in mm)
  width NUMERIC,
  height NUMERIC,
  depth NUMERIC,
  
  -- Additional measurements
  vao_largura NUMERIC, -- vão da parede
  vao_altura NUMERIC,
  peitoril NUMERIC, -- altura do peitoril
  
  -- Product reference
  product_template_id UUID REFERENCES public.product_templates(id) ON DELETE SET NULL,
  suggested_product TEXT,
  
  -- Notes
  notes TEXT,
  quantity INTEGER DEFAULT 1,
  
  -- Order
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for measurement checklist items
CREATE TABLE public.measurement_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id UUID NOT NULL REFERENCES public.site_measurements(id) ON DELETE CASCADE,
  
  item_label TEXT NOT NULL,
  is_checked BOOLEAN DEFAULT false,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for measurement photos
CREATE TABLE public.measurement_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  measurement_id UUID NOT NULL REFERENCES public.site_measurements(id) ON DELETE CASCADE,
  measurement_item_id UUID REFERENCES public.measurement_items(id) ON DELETE CASCADE,
  
  photo_url TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT DEFAULT 'general', -- general, before, after, detail, croqui
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.service_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_appointments
CREATE POLICY "Users can view company appointments"
ON public.service_appointments FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company appointments"
ON public.service_appointments FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company appointments"
ON public.service_appointments FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company appointments"
ON public.service_appointments FOR DELETE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- RLS Policies for site_measurements
CREATE POLICY "Users can view company measurements"
ON public.site_measurements FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company measurements"
ON public.site_measurements FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company measurements"
ON public.site_measurements FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company measurements"
ON public.site_measurements FOR DELETE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- RLS Policies for measurement_items (via measurement)
CREATE POLICY "Users can view measurement items"
ON public.measurement_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_items.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can insert measurement items"
ON public.measurement_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_items.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can update measurement items"
ON public.measurement_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_items.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can delete measurement items"
ON public.measurement_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_items.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

-- RLS Policies for measurement_checklist
CREATE POLICY "Users can view measurement checklist"
ON public.measurement_checklist FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_checklist.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can insert measurement checklist"
ON public.measurement_checklist FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_checklist.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can update measurement checklist"
ON public.measurement_checklist FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_checklist.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can delete measurement checklist"
ON public.measurement_checklist FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_checklist.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

-- RLS Policies for measurement_photos
CREATE POLICY "Users can view measurement photos"
ON public.measurement_photos FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_photos.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can insert measurement photos"
ON public.measurement_photos FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_photos.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can update measurement photos"
ON public.measurement_photos FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_photos.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

CREATE POLICY "Users can delete measurement photos"
ON public.measurement_photos FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.site_measurements sm
  WHERE sm.id = measurement_photos.measurement_id
  AND user_belongs_to_company(auth.uid(), sm.company_id)
));

-- Create indexes for performance
CREATE INDEX idx_service_appointments_company ON public.service_appointments(company_id);
CREATE INDEX idx_service_appointments_date ON public.service_appointments(scheduled_date);
CREATE INDEX idx_service_appointments_status ON public.service_appointments(status);
CREATE INDEX idx_site_measurements_company ON public.site_measurements(company_id);
CREATE INDEX idx_measurement_items_measurement ON public.measurement_items(measurement_id);

-- Create storage bucket for measurement photos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('measurements', 'measurements', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for measurements bucket
CREATE POLICY "Users can view measurement files"
ON storage.objects FOR SELECT
USING (bucket_id = 'measurements' AND auth.role() = 'authenticated');

CREATE POLICY "Users can upload measurement files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'measurements' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update measurement files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'measurements' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete measurement files"
ON storage.objects FOR DELETE
USING (bucket_id = 'measurements' AND auth.role() = 'authenticated');