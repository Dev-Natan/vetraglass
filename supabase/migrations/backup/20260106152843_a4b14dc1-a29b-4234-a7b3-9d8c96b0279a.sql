
-- =============================================
-- ENUMS
-- =============================================

-- Tipo de item (vidro, perfil, acessório)
CREATE TYPE public.item_type AS ENUM ('glass', 'profile', 'accessory', 'service');

-- Categoria de produto
CREATE TYPE public.product_category AS ENUM ('window', 'door', 'partition', 'mirror', 'shower', 'facade', 'other');

-- =============================================
-- TABELA: SaaS Admins (Super administradores)
-- =============================================
CREATE TABLE public.saas_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saas_admins ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário é SaaS admin
CREATE OR REPLACE FUNCTION public.is_saas_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.saas_admins WHERE user_id = _user_id
  )
$$;

-- RLS: Apenas SaaS admins podem ver outros admins
CREATE POLICY "SaaS admins can view admins"
  ON public.saas_admins FOR SELECT
  USING (is_saas_admin(auth.uid()));

-- =============================================
-- TABELA: Item Templates (Itens globais)
-- Vidros, perfis, acessórios - criados pelo SaaS admin
-- =============================================
CREATE TABLE public.item_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type item_type NOT NULL,
  unit TEXT NOT NULL DEFAULT 'm²', -- m², m, unidade
  default_price DECIMAL(12, 2) DEFAULT 0,
  specifications JSONB DEFAULT '{}', -- espessura, cor, etc
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.item_templates ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler templates
CREATE POLICY "Authenticated can view item templates"
  ON public.item_templates FOR SELECT
  TO authenticated
  USING (true);

-- Apenas SaaS admins podem gerenciar
CREATE POLICY "SaaS admins can manage item templates"
  ON public.item_templates FOR ALL
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));

-- =============================================
-- TABELA: Product Templates (Modelos de produtos globais)
-- Janelas, portas, box - criados pelo SaaS admin
-- =============================================
CREATE TABLE public.product_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category product_category NOT NULL,
  image_url TEXT,
  min_width DECIMAL(10, 2), -- largura mínima em mm
  max_width DECIMAL(10, 2), -- largura máxima em mm
  min_height DECIMAL(10, 2), -- altura mínima em mm
  max_height DECIMAL(10, 2), -- altura máxima em mm
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_templates ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler
CREATE POLICY "Authenticated can view product templates"
  ON public.product_templates FOR SELECT
  TO authenticated
  USING (true);

-- Apenas SaaS admins podem gerenciar
CREATE POLICY "SaaS admins can manage product templates"
  ON public.product_templates FOR ALL
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));

-- =============================================
-- TABELA: Product Template Items (Composição do produto)
-- Liga ProductTemplate + ItemTemplate + Fórmula
-- =============================================
CREATE TABLE public.product_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_template_id UUID NOT NULL REFERENCES public.product_templates(id) ON DELETE CASCADE,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  
  -- Fórmulas de cálculo (usando variáveis: W=largura, H=altura, Q=quantidade)
  -- Exemplo: "W * H / 1000000" para área em m²
  -- Exemplo: "(W + H) * 2 / 1000" para perímetro em metros
  quantity_formula TEXT NOT NULL DEFAULT '1', -- Fórmula para calcular quantidade
  
  is_optional BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(product_template_id, item_template_id)
);

ALTER TABLE public.product_template_items ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler
CREATE POLICY "Authenticated can view product template items"
  ON public.product_template_items FOR SELECT
  TO authenticated
  USING (true);

-- Apenas SaaS admins podem gerenciar
CREATE POLICY "SaaS admins can manage product template items"
  ON public.product_template_items FOR ALL
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));

-- =============================================
-- TABELA: Company Products (Produtos da empresa)
-- Cópia personalizada do template para cada empresa
-- =============================================
CREATE TABLE public.company_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_template_id UUID NOT NULL REFERENCES public.product_templates(id) ON DELETE RESTRICT,
  
  commercial_name TEXT NOT NULL, -- Nome comercial customizado
  description TEXT,
  base_price DECIMAL(12, 2) DEFAULT 0, -- Preço base
  margin_percent DECIMAL(5, 2) DEFAULT 0, -- Margem de lucro %
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, product_template_id)
);

ALTER TABLE public.company_products ENABLE ROW LEVEL SECURITY;

-- Empresa pode ver seus produtos
CREATE POLICY "Users can view company products"
  ON public.company_products FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

-- Admins da empresa podem gerenciar
CREATE POLICY "Company admins can manage products"
  ON public.company_products FOR ALL
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'))
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- =============================================
-- TABELA: Company Item Prices (Preços por empresa)
-- Cada empresa define seu preço para cada item
-- =============================================
CREATE TABLE public.company_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  cost DECIMAL(12, 2) DEFAULT 0, -- Custo de aquisição
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, item_template_id)
);

ALTER TABLE public.company_item_prices ENABLE ROW LEVEL SECURITY;

-- Empresa pode ver seus preços
CREATE POLICY "Users can view company item prices"
  ON public.company_item_prices FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

-- Admins podem gerenciar
CREATE POLICY "Company admins can manage item prices"
  ON public.company_item_prices FOR ALL
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'))
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- =============================================
-- TABELA: Company Stock (Estoque por empresa)
-- =============================================
CREATE TABLE public.company_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  
  quantity DECIMAL(12, 3) NOT NULL DEFAULT 0,
  min_quantity DECIMAL(12, 3) DEFAULT 0, -- Estoque mínimo
  location TEXT, -- Localização no estoque
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, item_template_id)
);

ALTER TABLE public.company_stock ENABLE ROW LEVEL SECURITY;

-- Empresa pode ver seu estoque
CREATE POLICY "Users can view company stock"
  ON public.company_stock FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

-- Admins e funcionários podem gerenciar estoque
CREATE POLICY "Company members can manage stock"
  ON public.company_stock FOR ALL
  USING (user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- =============================================
-- FUNÇÃO: Criar CompanyProduct automaticamente
-- Quando empresa escolhe usar um template
-- =============================================
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id UUID,
  _product_template_id UUID,
  _commercial_name TEXT DEFAULT NULL
)
RETURNS public.company_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.company_products;
  v_template public.product_templates;
BEGIN
  -- Verificar se usuário pertence à empresa como admin
  IF NOT user_has_role_in_company(auth.uid(), _company_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  
  -- Buscar template
  SELECT * INTO v_template FROM public.product_templates WHERE id = _product_template_id;
  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;
  
  -- Criar ou atualizar company_product
  INSERT INTO public.company_products (
    company_id,
    product_template_id,
    commercial_name,
    is_active
  ) VALUES (
    _company_id,
    _product_template_id,
    COALESCE(_commercial_name, v_template.name),
    true
  )
  ON CONFLICT (company_id, product_template_id) DO UPDATE
    SET is_active = true,
        updated_at = now()
  RETURNING * INTO v_product;
  
  RETURN v_product;
END;
$$;

-- =============================================
-- FUNÇÃO: Inicializar preços dos itens para empresa
-- Copia preços default quando empresa ativa template
-- =============================================
CREATE OR REPLACE FUNCTION public.initialize_company_item_prices(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar permissão
  IF NOT user_has_role_in_company(auth.uid(), _company_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  
  -- Inserir preços padrão para itens que ainda não têm preço
  INSERT INTO public.company_item_prices (company_id, item_template_id, price)
  SELECT _company_id, id, default_price
  FROM public.item_templates
  WHERE is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.company_item_prices 
      WHERE company_id = _company_id AND item_template_id = item_templates.id
    );
END;
$$;

-- =============================================
-- TRIGGERS para updated_at
-- =============================================
CREATE TRIGGER update_item_templates_updated_at
  BEFORE UPDATE ON public.item_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_templates_updated_at
  BEFORE UPDATE ON public.product_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_products_updated_at
  BEFORE UPDATE ON public.company_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_item_prices_updated_at
  BEFORE UPDATE ON public.company_item_prices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_stock_updated_at
  BEFORE UPDATE ON public.company_stock
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ÍNDICES para performance
-- =============================================
CREATE INDEX idx_item_templates_type ON public.item_templates(type);
CREATE INDEX idx_product_templates_category ON public.product_templates(category);
CREATE INDEX idx_company_products_company ON public.company_products(company_id);
CREATE INDEX idx_company_item_prices_company ON public.company_item_prices(company_id);
CREATE INDEX idx_company_stock_company ON public.company_stock(company_id);
CREATE INDEX idx_product_template_items_template ON public.product_template_items(product_template_id);
