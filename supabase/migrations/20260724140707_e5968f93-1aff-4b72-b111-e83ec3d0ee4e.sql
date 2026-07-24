
-- =====================================================================
-- FASE 2: CATÁLOGO & ESTOQUE
-- =====================================================================

-- ---------- LOOKUPS ---------------------------------------------------

CREATE TABLE public.item_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  unit_default TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.item_types TO anon, authenticated;
GRANT ALL ON public.item_types TO authenticated, service_role;
ALTER TABLE public.item_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_types read" ON public.item_types FOR SELECT USING (true);
CREATE POLICY "item_types admin write" ON public.item_types FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_categories TO anon, authenticated;
GRANT ALL ON public.product_categories TO authenticated, service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_categories read" ON public.product_categories FOR SELECT USING (true);
CREATE POLICY "product_categories admin write" ON public.product_categories FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TABLE public.product_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#64748b',
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_linhas TO anon, authenticated;
GRANT ALL ON public.product_linhas TO authenticated, service_role;
ALTER TABLE public.product_linhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_linhas read" ON public.product_linhas FOR SELECT USING (true);
CREATE POLICY "product_linhas admin write" ON public.product_linhas FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TABLE public.company_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);
CREATE INDEX ON public.company_linhas(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_linhas TO authenticated;
GRANT ALL ON public.company_linhas TO service_role;
ALTER TABLE public.company_linhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_linhas member" ON public.company_linhas FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.glass_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.glass_types TO anon, authenticated;
GRANT ALL ON public.glass_types TO authenticated, service_role;
ALTER TABLE public.glass_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glass_types read" ON public.glass_types FOR SELECT USING (true);
CREATE POLICY "glass_types admin write" ON public.glass_types FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TABLE public.admin_glass_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE,
  name TEXT NOT NULL,
  label TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_glass_colors TO anon, authenticated;
GRANT ALL ON public.admin_glass_colors TO authenticated, service_role;
ALTER TABLE public.admin_glass_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_glass_colors read" ON public.admin_glass_colors FOR SELECT USING (true);
CREATE POLICY "admin_glass_colors admin write" ON public.admin_glass_colors FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TABLE public.admin_glass_thicknesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thickness_mm NUMERIC NOT NULL UNIQUE,
  label TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_glass_thicknesses TO anon, authenticated;
GRANT ALL ON public.admin_glass_thicknesses TO authenticated, service_role;
ALTER TABLE public.admin_glass_thicknesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_glass_thicknesses read" ON public.admin_glass_thicknesses FOR SELECT USING (true);
CREATE POLICY "admin_glass_thicknesses admin write" ON public.admin_glass_thicknesses FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TABLE public.system_module_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_module_settings TO anon, authenticated;
GRANT ALL ON public.system_module_settings TO authenticated, service_role;
ALTER TABLE public.system_module_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sms read" ON public.system_module_settings FOR SELECT USING (true);
CREATE POLICY "sms admin" ON public.system_module_settings FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

-- ---------- TEMPLATES GLOBAIS ----------------------------------------

CREATE TABLE public.item_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE, -- NULL = global
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL, -- COW ref
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'perfil',
  unit TEXT DEFAULT 'un',
  linha TEXT,
  image_url TEXT,
  bar_length_mm NUMERIC,
  weight_per_meter NUMERIC,
  weight_per_bar NUMERIC,
  default_price NUMERIC,
  default_cost NUMERIC,
  default_sale_price NUMERIC,
  price NUMERIC,
  cost NUMERIC,
  default_formulas JSONB NOT NULL DEFAULT '[]'::jsonb,
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  ncm TEXT, cest TEXT, cfop_venda TEXT, cfop_venda_interestadual TEXT,
  codigo_servico TEXT, origem TEXT,
  aliquota_iss NUMERIC, aliquota_ibs NUMERIC, aliquota_cbs NUMERIC, aliquota_is NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.item_templates(company_id);
CREATE INDEX ON public.item_templates(linha);
CREATE INDEX ON public.item_templates(type);
GRANT SELECT ON public.item_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.item_templates TO authenticated;
GRANT ALL ON public.item_templates TO service_role;
ALTER TABLE public.item_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "item_templates read" ON public.item_templates FOR SELECT USING (true);
CREATE POLICY "item_templates admin all" ON public.item_templates FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid()) OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id)))
  WITH CHECK (public.is_saas_admin(auth.uid()) OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id)));

CREATE TABLE public.product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_template_id UUID REFERENCES public.product_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  linha TEXT,
  type TEXT,
  unit TEXT DEFAULT 'un',
  image_url TEXT,
  side TEXT,
  has_multiple_sides BOOLEAN NOT NULL DEFAULT false,
  has_cutting_plan BOOLEAN NOT NULL DEFAULT false,
  default_leaves_count INT,
  default_panels_count INT,
  default_glasses_count INT,
  default_sides_count INT,
  pieces_quantity INT,
  pieces_formula TEXT,
  width_formula TEXT,
  height_formula TEXT,
  quantity_formula TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.product_templates(company_id);
CREATE INDEX ON public.product_templates(linha);
GRANT SELECT ON public.product_templates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_templates TO authenticated;
GRANT ALL ON public.product_templates TO service_role;
ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_templates read" ON public.product_templates FOR SELECT USING (true);
CREATE POLICY "product_templates write" ON public.product_templates FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid()) OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id)))
  WITH CHECK (public.is_saas_admin(auth.uid()) OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id)));

CREATE TABLE public.product_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  product_template_id UUID NOT NULL REFERENCES public.product_templates(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  name TEXT,
  type TEXT,
  unit TEXT,
  image_url TEXT,
  section TEXT,
  side TEXT,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  bar_length_mm NUMERIC,
  cut_angle NUMERIC,
  cut_angle_start NUMERIC,
  cut_angle_end NUMERIC,
  pieces_quantity NUMERIC,
  pieces_formula TEXT,
  width_formula TEXT,
  height_formula TEXT,
  quantity_formula TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.product_template_items(product_template_id);
CREATE INDEX ON public.product_template_items(item_template_id);
GRANT SELECT ON public.product_template_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_template_items TO authenticated;
GRANT ALL ON public.product_template_items TO service_role;
ALTER TABLE public.product_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pti read" ON public.product_template_items FOR SELECT USING (true);
CREATE POLICY "pti write" ON public.product_template_items FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid()) OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id)))
  WITH CHECK (public.is_saas_admin(auth.uid()) OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id)));

CREATE TABLE public.glass_line_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_template_id UUID REFERENCES public.product_templates(id) ON DELETE CASCADE,
  linha TEXT,
  category TEXT,
  name TEXT,
  formula_name TEXT,
  has_multiple_sides BOOLEAN NOT NULL DEFAULT false,
  panel_index INT,
  width_formula TEXT,
  height_formula TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.glass_line_formulas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.glass_line_formulas TO authenticated;
GRANT ALL ON public.glass_line_formulas TO service_role;
ALTER TABLE public.glass_line_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "glf read" ON public.glass_line_formulas FOR SELECT USING (true);
CREATE POLICY "glf admin" ON public.glass_line_formulas FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

-- ---------- PREÇOS DE COR --------------------------------------------

CREATE TABLE public.item_template_color_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  color_name TEXT NOT NULL,
  cost_per_meter NUMERIC,
  sale_price_per_meter NUMERIC,
  cost NUMERIC,
  price NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_template_id, company_id, color_name)
);
CREATE INDEX ON public.item_template_color_prices(item_template_id);
GRANT SELECT ON public.item_template_color_prices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.item_template_color_prices TO authenticated;
GRANT ALL ON public.item_template_color_prices TO service_role;
ALTER TABLE public.item_template_color_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itcp read" ON public.item_template_color_prices FOR SELECT USING (true);
CREATE POLICY "itcp write" ON public.item_template_color_prices FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid()) OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id)))
  WITH CHECK (public.is_saas_admin(auth.uid()) OR (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id)));

CREATE TABLE public.company_item_color_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE CASCADE,
  company_item_id UUID,
  color_name TEXT NOT NULL,
  cost_per_meter NUMERIC,
  sale_price_per_meter NUMERIC,
  cost NUMERIC,
  price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.company_item_color_prices(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_item_color_prices TO authenticated;
GRANT ALL ON public.company_item_color_prices TO service_role;
ALTER TABLE public.company_item_color_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cicp member" ON public.company_item_color_prices FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.company_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE CASCADE,
  cost NUMERIC,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, item_template_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_item_prices TO authenticated;
GRANT ALL ON public.company_item_prices TO service_role;
ALTER TABLE public.company_item_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cip member" ON public.company_item_prices FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- ---------- CATÁLOGO DA EMPRESA --------------------------------------

CREATE TABLE public.company_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  reference_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'perfil',
  unit TEXT DEFAULT 'un',
  linha TEXT,
  image_url TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  bar_length_mm NUMERIC,
  weight_per_meter NUMERIC,
  weight_kg NUMERIC,
  altura_mm NUMERIC,
  largura_mm NUMERIC,
  comprimento_linear_mm NUMERIC,
  thickness_mm NUMERIC,
  glass_color TEXT,
  glass_thickness NUMERIC,
  cost NUMERIC,
  cost_per_meter NUMERIC,
  cost_per_bar NUMERIC,
  cost_per_kg NUMERIC,
  sale_price NUMERIC,
  sale_price_per_meter NUMERIC,
  sale_price_per_bar NUMERIC,
  sale_price_per_kg NUMERIC,
  sale_margin_percent NUMERIC DEFAULT 30,
  price NUMERIC,
  preco_unitario NUMERIC,
  default_price NUMERIC,
  quantity NUMERIC,
  specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.company_items(company_id);
CREATE INDEX ON public.company_items(item_template_id);
CREATE INDEX ON public.company_items(type);
CREATE INDEX ON public.company_items(linha);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_items TO authenticated;
GRANT ALL ON public.company_items TO service_role;
ALTER TABLE public.company_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_items member" ON public.company_items FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.company_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_template_id UUID REFERENCES public.product_templates(id) ON DELETE SET NULL,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  commercial_name TEXT,
  description TEXT,
  category TEXT,
  linha TEXT,
  type TEXT,
  unit TEXT DEFAULT 'un',
  image_url TEXT,
  side TEXT,
  has_multiple_sides BOOLEAN NOT NULL DEFAULT false,
  uses_glass BOOLEAN NOT NULL DEFAULT false,
  pricing_type TEXT DEFAULT 'composition',
  base_price NUMERIC,
  price_per_sqm NUMERIC,
  cost_per_sqm NUMERIC,
  margin_percent NUMERIC,
  pending_amount NUMERIC,
  pieces_quantity INT,
  pieces_formula TEXT,
  width_formula TEXT,
  height_formula TEXT,
  quantity_formula TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.company_products(company_id);
CREATE INDEX ON public.company_products(product_template_id);
CREATE INDEX ON public.company_products(linha);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_products TO authenticated;
GRANT ALL ON public.company_products TO service_role;
ALTER TABLE public.company_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_products member" ON public.company_products FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.company_product_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_product_id UUID NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  name TEXT,
  type TEXT,
  unit TEXT,
  image_url TEXT,
  linha TEXT,
  section TEXT,
  side TEXT,
  applies_to TEXT,
  calculation_type TEXT,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  bar_length_mm NUMERIC,
  weight_per_meter NUMERIC,
  weight_per_bar NUMERIC,
  weight_kg NUMERIC,
  altura_mm NUMERIC,
  largura_mm NUMERIC,
  comprimento_linear_mm NUMERIC,
  thickness_mm NUMERIC,
  glass_color TEXT,
  cut_angle NUMERIC,
  pieces_quantity NUMERIC,
  width_formula TEXT,
  height_formula TEXT,
  quantity_formula TEXT,
  cost NUMERIC,
  cost_per_meter NUMERIC,
  cost_per_bar NUMERIC,
  cost_per_kg NUMERIC,
  preco_unitario NUMERIC,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.company_product_items(company_id);
CREATE INDEX ON public.company_product_items(company_product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_product_items TO authenticated;
GRANT ALL ON public.company_product_items TO service_role;
ALTER TABLE public.company_product_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpi member" ON public.company_product_items FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- ---------- PREÇOS DE VIDRO ------------------------------------------

CREATE TABLE public.product_glass_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_id UUID NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  glass_type TEXT,
  glass_color TEXT,
  thickness_mm NUMERIC,
  cost_per_sqm NUMERIC,
  price_per_sqm NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.product_glass_prices(company_product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_glass_prices TO authenticated;
GRANT ALL ON public.product_glass_prices TO service_role;
ALTER TABLE public.product_glass_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pgp member" ON public.product_glass_prices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_products cp WHERE cp.id = company_product_id AND public.user_belongs_to_company(auth.uid(), cp.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_products cp WHERE cp.id = company_product_id AND public.user_belongs_to_company(auth.uid(), cp.company_id)));

CREATE TABLE public.admin_suggested_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT,
  glass_color TEXT,
  thickness_mm NUMERIC,
  cost_per_sqm NUMERIC,
  price_per_sqm NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_suggested_prices TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_suggested_prices TO authenticated;
GRANT ALL ON public.admin_suggested_prices TO service_role;
ALTER TABLE public.admin_suggested_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asp read" ON public.admin_suggested_prices FOR SELECT USING (true);
CREATE POLICY "asp admin" ON public.admin_suggested_prices FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TABLE public.company_suggested_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  kind TEXT,
  glass_color TEXT,
  thickness_mm NUMERIC,
  cost_per_sqm NUMERIC,
  price_per_sqm NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.company_suggested_prices(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_suggested_prices TO authenticated;
GRANT ALL ON public.company_suggested_prices TO service_role;
ALTER TABLE public.company_suggested_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "csp member" ON public.company_suggested_prices FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- ---------- ESTOQUE --------------------------------------------------

CREATE TABLE public.company_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  product_template_id UUID REFERENCES public.product_templates(id) ON DELETE SET NULL,
  name TEXT,
  type TEXT,
  unit TEXT,
  linha TEXT,
  image_url TEXT,
  location TEXT,
  status TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  allow_fractional BOOLEAN NOT NULL DEFAULT false,
  quantity NUMERIC NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC NOT NULL DEFAULT 0,
  min_quantity NUMERIC,
  bar_length_mm NUMERIC,
  weight_per_meter NUMERIC,
  weight_kg NUMERIC,
  cost NUMERIC,
  cost_per_meter NUMERIC,
  cost_per_bar NUMERIC,
  cost_per_kg NUMERIC,
  sale_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.company_stock(company_id);
CREATE INDEX ON public.company_stock(item_template_id);
CREATE INDEX ON public.company_stock(company_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_stock TO authenticated;
GRANT ALL ON public.company_stock TO service_role;
ALTER TABLE public.company_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs member" ON public.company_stock FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- entrada/saida/ajuste
  category TEXT,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_movements(company_id);
CREATE INDEX ON public.stock_movements(item_template_id);
CREATE INDEX ON public.stock_movements(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sm member" ON public.stock_movements FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  ordem_servico_id UUID,
  os_glass_project_id UUID,
  quantity_reserved NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  unit_cost NUMERIC,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.stock_reservations(company_id);
CREATE INDEX ON public.stock_reservations(ordem_servico_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_reservations TO authenticated;
GRANT ALL ON public.stock_reservations TO service_role;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sr member" ON public.stock_reservations FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem_servico_id UUID,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  stock_movement_id UUID REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  stock_reservation_id UUID REFERENCES public.stock_reservations(id) ON DELETE SET NULL,
  item_name TEXT,
  name TEXT,
  item_type TEXT,
  unit TEXT,
  quantity NUMERIC,
  quantity_calculated NUMERIC,
  cost NUMERIC,
  status TEXT,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.material_consumption(company_id);
CREATE INDEX ON public.material_consumption(ordem_servico_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_consumption TO authenticated;
GRANT ALL ON public.material_consumption TO service_role;
ALTER TABLE public.material_consumption ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mc member" ON public.material_consumption FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- ---------- COMPRAS ---------------------------------------------------

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem_servico_id UUID,
  order_number TEXT,
  os_number TEXT,
  supplier_name TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  description TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  quantity NUMERIC,
  unit TEXT,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  total_estimated NUMERIC,
  total_actual NUMERIC,
  expected_delivery TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.purchase_orders(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po member" ON public.purchase_orders FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  os_glass_project_id UUID,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  name TEXT,
  unit TEXT,
  quantity NUMERIC,
  received_quantity NUMERIC,
  unit_cost NUMERIC,
  actual_cost NUMERIC,
  total_actual NUMERIC,
  status TEXT,
  procurement_status TEXT,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.purchase_order_items(purchase_order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poi member" ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.user_belongs_to_company(auth.uid(), po.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_id AND public.user_belongs_to_company(auth.uid(), po.company_id)));

-- ---------- TRIGGERS updated_at --------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'item_types','product_categories','product_linhas','company_linhas','glass_types',
    'system_module_settings','item_templates','product_templates','product_template_items',
    'glass_line_formulas','item_template_color_prices','company_item_color_prices',
    'company_item_prices','company_items','company_products','company_product_items',
    'product_glass_prices','admin_suggested_prices','company_suggested_prices',
    'company_stock','stock_reservations','purchase_orders','purchase_order_items'
  ])
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- ---------- TRIGGER: recomputa preço final ---------------------------

CREATE OR REPLACE FUNCTION public.recompute_company_item_sale_price()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m NUMERIC;
BEGIN
  m := COALESCE(NEW.sale_margin_percent, 0);
  IF NEW.cost_per_meter IS NOT NULL THEN
    NEW.sale_price_per_meter := ROUND((NEW.cost_per_meter * (1 + m/100))::numeric, 4);
  END IF;
  IF NEW.cost IS NOT NULL THEN
    NEW.sale_price := ROUND((NEW.cost * (1 + m/100))::numeric, 4);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_recompute_company_item_sale_price
  BEFORE INSERT OR UPDATE OF cost, cost_per_meter, sale_margin_percent
  ON public.company_items
  FOR EACH ROW EXECUTE FUNCTION public.recompute_company_item_sale_price();

-- ---------- RPCs ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_effective_product_templates(_company_id UUID)
RETURNS SETOF public.product_templates
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (COALESCE(pt.product_template_id, pt.id)) pt.*
  FROM public.product_templates pt
  WHERE pt.is_active = true
    AND (pt.company_id IS NULL OR pt.company_id = _company_id)
  ORDER BY COALESCE(pt.product_template_id, pt.id),
           (pt.company_id = _company_id) DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(_template_id UUID, _company_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.company_products (
    company_id, product_template_id, name, description, category, linha, type, unit,
    image_url, side, has_multiple_sides, uses_glass, pieces_quantity, pieces_formula,
    width_formula, height_formula, quantity_formula
  )
  SELECT _company_id, pt.id, pt.name, pt.description, pt.category, pt.linha, pt.type, pt.unit,
    pt.image_url, pt.side, pt.has_multiple_sides, false, pt.pieces_quantity, pt.pieces_formula,
    pt.width_formula, pt.height_formula, pt.quantity_formula
  FROM public.product_templates pt WHERE pt.id = _template_id
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.bulk_adjust_item_cost(p_company_id UUID, p_percent NUMERIC, p_type TEXT DEFAULT NULL, p_linha TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected INT;
BEGIN
  UPDATE public.company_items SET
    cost = CASE WHEN cost IS NOT NULL THEN ROUND((cost * (1 + p_percent/100))::numeric, 4) ELSE cost END,
    cost_per_meter = CASE WHEN cost_per_meter IS NOT NULL THEN ROUND((cost_per_meter * (1 + p_percent/100))::numeric, 4) ELSE cost_per_meter END,
    updated_at = now()
  WHERE company_id = p_company_id
    AND is_active = true
    AND (p_type IS NULL OR type = p_type)
    AND (p_linha IS NULL OR linha = p_linha);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;

CREATE OR REPLACE FUNCTION public.create_custom_product(p_company_id UUID, p_name TEXT, p_category TEXT DEFAULT NULL, p_linha TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.company_products (company_id, name, category, linha, is_custom)
  VALUES (p_company_id, p_name, p_category, p_linha, true)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.reset_company_product_to_template(_company_product_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.company_product_items WHERE company_product_id = _company_product_id;
END $$;

CREATE OR REPLACE FUNCTION public.reset_company_product_item(_item_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.company_product_items WHERE id = _item_id;
END $$;

CREATE OR REPLACE FUNCTION public.reset_composition_item(_item_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.company_product_items WHERE id = _item_id;
END $$;

CREATE OR REPLACE FUNCTION public.save_composition_item(_data JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id UUID;
BEGIN
  INSERT INTO public.company_product_items (
    company_id, company_product_id, item_template_id, company_item_id, name, type, unit,
    section, side, is_optional, bar_length_mm, pieces_quantity, width_formula, height_formula, quantity_formula
  )
  VALUES (
    (_data->>'company_id')::uuid,
    (_data->>'company_product_id')::uuid,
    NULLIF(_data->>'item_template_id','')::uuid,
    NULLIF(_data->>'company_item_id','')::uuid,
    _data->>'name', _data->>'type', _data->>'unit',
    _data->>'section', _data->>'side',
    COALESCE((_data->>'is_optional')::boolean, false),
    NULLIF(_data->>'bar_length_mm','')::numeric,
    NULLIF(_data->>'pieces_quantity','')::numeric,
    _data->>'width_formula', _data->>'height_formula', _data->>'quantity_formula'
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
