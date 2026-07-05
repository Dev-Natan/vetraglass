
-- Global master lists managed by SaaS admins
CREATE TABLE public.admin_glass_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  hex_color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_glass_colors TO anon, authenticated;
GRANT ALL ON public.admin_glass_colors TO service_role;
ALTER TABLE public.admin_glass_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view admin glass colors" ON public.admin_glass_colors FOR SELECT USING (true);
CREATE POLICY "SaaS admins manage admin glass colors" ON public.admin_glass_colors FOR ALL USING (is_saas_admin(auth.uid())) WITH CHECK (is_saas_admin(auth.uid()));

CREATE TABLE public.admin_glass_thicknesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thickness_mm INTEGER NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_glass_thicknesses TO anon, authenticated;
GRANT ALL ON public.admin_glass_thicknesses TO service_role;
ALTER TABLE public.admin_glass_thicknesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view admin glass thicknesses" ON public.admin_glass_thicknesses FOR SELECT USING (true);
CREATE POLICY "SaaS admins manage admin glass thicknesses" ON public.admin_glass_thicknesses FOR ALL USING (is_saas_admin(auth.uid())) WITH CHECK (is_saas_admin(auth.uid()));

CREATE TABLE public.admin_aluminum_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  hex_color TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_aluminum_colors TO anon, authenticated;
GRANT ALL ON public.admin_aluminum_colors TO service_role;
ALTER TABLE public.admin_aluminum_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view admin aluminum colors" ON public.admin_aluminum_colors FOR SELECT USING (true);
CREATE POLICY "SaaS admins manage admin aluminum colors" ON public.admin_aluminum_colors FOR ALL USING (is_saas_admin(auth.uid())) WITH CHECK (is_saas_admin(auth.uid()));

-- Suggested prices (fallback) — global reference values from SaaS admin
CREATE TABLE public.admin_suggested_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('glass','aluminum')),
  glass_color TEXT,
  thickness_mm INTEGER,
  aluminum_color TEXT,
  cost_per_sqm NUMERIC(12,2),
  price_per_sqm NUMERIC(12,2),
  cost_per_meter NUMERIC(12,2),
  price_per_meter NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX admin_suggested_glass_key ON public.admin_suggested_prices (glass_color, thickness_mm) WHERE kind='glass';
CREATE UNIQUE INDEX admin_suggested_aluminum_key ON public.admin_suggested_prices (aluminum_color) WHERE kind='aluminum';
GRANT SELECT ON public.admin_suggested_prices TO anon, authenticated;
GRANT ALL ON public.admin_suggested_prices TO service_role;
ALTER TABLE public.admin_suggested_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view admin suggested prices" ON public.admin_suggested_prices FOR SELECT USING (true);
CREATE POLICY "SaaS admins manage admin suggested prices" ON public.admin_suggested_prices FOR ALL USING (is_saas_admin(auth.uid())) WITH CHECK (is_saas_admin(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_admin_glass_colors_updated BEFORE UPDATE ON public.admin_glass_colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_admin_glass_thicknesses_updated BEFORE UPDATE ON public.admin_glass_thicknesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_admin_aluminum_colors_updated BEFORE UPDATE ON public.admin_aluminum_colors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_admin_suggested_prices_updated BEFORE UPDATE ON public.admin_suggested_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed common defaults
INSERT INTO public.admin_glass_colors (name, slug, sort_order) VALUES
  ('Incolor','incolor',1),('Verde','verde',2),('Fumê','fume',3),('Bronze','bronze',4),('Jateado','jateado',5)
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.admin_glass_thicknesses (thickness_mm, label, sort_order) VALUES
  (4,'4mm',1),(6,'6mm',2),(8,'8mm',3),(10,'10mm',4),(12,'12mm',5)
ON CONFLICT (thickness_mm) DO NOTHING;
INSERT INTO public.admin_aluminum_colors (name, slug, sort_order) VALUES
  ('Branco','branco',1),('Preto','preto',2),('Fosco','fosco',3),('Bronze','bronze-al',4),('Natural','natural',5)
ON CONFLICT (slug) DO NOTHING;
