-- Create glass_types table for glass subtypes
CREATE TABLE public.glass_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.glass_types ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "glass_types_public_read" ON public.glass_types
  FOR SELECT USING (true);

-- Admin write access
CREATE POLICY "glass_types_admin_write" ON public.glass_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM saas_admins WHERE user_id = auth.uid())
  );

-- Insert the 4 glass types requested
INSERT INTO public.glass_types (slug, name, sort_order) VALUES
  ('comum', 'Vidro Comum', 1),
  ('temperado', 'Vidro Temperado', 2),
  ('laminado', 'Vidro Laminado', 3),
  ('temperado_laminado', 'Vidro Temperado e Laminado', 4);