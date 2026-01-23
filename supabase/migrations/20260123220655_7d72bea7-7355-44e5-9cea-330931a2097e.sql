-- Create product_categories table
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) DEFAULT 'gray',
  icon VARCHAR(50),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create item_types table
CREATE TABLE public.item_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(50) DEFAULT 'gray',
  icon VARCHAR(50),
  unit_default VARCHAR(10) DEFAULT 'un',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_types ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - Read access for all authenticated users
CREATE POLICY "Anyone can read product categories"
ON public.product_categories FOR SELECT
USING (true);

CREATE POLICY "Anyone can read item types"
ON public.item_types FOR SELECT
USING (true);

-- Admin-only write access (using saas_admins table)
CREATE POLICY "Admins can manage product categories"
ON public.product_categories FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.saas_admins
    WHERE saas_admins.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage item types"
ON public.item_types FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.saas_admins
    WHERE saas_admins.user_id = auth.uid()
  )
);

-- Insert default product categories
INSERT INTO public.product_categories (slug, name, color, sort_order) VALUES
  ('window', 'Janela', 'blue', 1),
  ('door', 'Porta', 'green', 2),
  ('shower', 'Box', 'cyan', 3),
  ('mirror', 'Espelho', 'purple', 4),
  ('partition', 'Divisória', 'orange', 5),
  ('facade', 'Fachada', 'indigo', 6),
  ('guarda_corpo', 'Guarda Corpo', 'rose', 7),
  ('other', 'Outro', 'gray', 8);

-- Insert default item types
INSERT INTO public.item_types (slug, name, color, unit_default, sort_order) VALUES
  ('glass', 'Vidro', 'blue', 'm²', 1),
  ('profile', 'Perfil', 'amber', 'm', 2),
  ('accessory', 'Acessório', 'violet', 'un', 3),
  ('service', 'Serviço', 'emerald', 'un', 4);