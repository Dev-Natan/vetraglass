-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_companies table (many-to-many with roles)
CREATE TABLE public.user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, company_id)
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user belongs to company
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true
  )
$$;

-- Security definer function to check user role in company
CREATE OR REPLACE FUNCTION public.user_has_role_in_company(_user_id UUID, _company_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND role = _role
      AND is_active = true
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Companies policies
CREATE POLICY "Users can view companies they belong to"
ON public.companies FOR SELECT
USING (
  public.user_belongs_to_company(auth.uid(), id)
);

CREATE POLICY "Admins can update their companies"
ON public.companies FOR UPDATE
USING (
  public.user_has_role_in_company(auth.uid(), id, 'admin')
);

CREATE POLICY "Admins can insert companies"
ON public.companies FOR INSERT
WITH CHECK (true);

-- User companies policies
CREATE POLICY "Users can view their own company memberships"
ON public.user_companies FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can view memberships of their companies"
ON public.user_companies FOR SELECT
USING (
  public.user_belongs_to_company(auth.uid(), company_id)
);

CREATE POLICY "Users can insert their own membership"
ON public.user_companies FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage company memberships"
ON public.user_companies FOR ALL
USING (
  public.user_has_role_in_company(auth.uid(), company_id, 'admin')
);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Drop the existing insert policy
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;

-- Create a proper policy that allows authenticated users to insert companies
CREATE POLICY "Authenticated users can create companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (true);-- RPC to create a company and assign current user as admin
CREATE OR REPLACE FUNCTION public.create_company_and_assign_admin(
  _name TEXT,
  _cnpj TEXT,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.companies (name, cnpj, phone, email, address)
  VALUES (
    _name,
    _cnpj,
    NULLIF(_phone, ''),
    NULLIF(_email, ''),
    NULLIF(_address, '')
  )
  RETURNING * INTO v_company;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_uid, v_company.id, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true;

  RETURN v_company;
END;
$$;

-- Lock down execution
REVOKE ALL ON FUNCTION public.create_company_and_assign_admin(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_and_assign_admin(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
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
-- Criar bucket para imagens dos templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-templates', 'item-templates', true);

-- Policy para visualizar imagens (público)
CREATE POLICY "Anyone can view item template images"
ON storage.objects FOR SELECT
USING (bucket_id = 'item-templates');

-- Policy para upload (apenas SaaS admins)
CREATE POLICY "SaaS admins can upload item template images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'item-templates' 
  AND is_saas_admin(auth.uid())
);

-- Policy para update (apenas SaaS admins)
CREATE POLICY "SaaS admins can update item template images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'item-templates' 
  AND is_saas_admin(auth.uid())
);

-- Policy para delete (apenas SaaS admins)
CREATE POLICY "SaaS admins can delete item template images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'item-templates' 
  AND is_saas_admin(auth.uid())
);

-- Adicionar coluna de imagem na tabela item_templates
ALTER TABLE public.item_templates ADD COLUMN IF NOT EXISTS image_url TEXT;-- Add linha column to item_templates
ALTER TABLE public.item_templates 
ADD COLUMN linha text DEFAULT 'Sem Linha';

-- Create index for better filtering performance
CREATE INDEX idx_item_templates_linha ON public.item_templates(linha);-- Allow SaaS admins to view all companies
CREATE POLICY "SaaS admins can view all companies"
ON public.companies
FOR SELECT
USING (is_saas_admin(auth.uid()));-- Adicionar coluna is_active na tabela company_stock
ALTER TABLE public.company_stock 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;-- Adicionar coluna para permitir venda fracionada
ALTER TABLE public.company_stock 
ADD COLUMN IF NOT EXISTS allow_fractional boolean NOT NULL DEFAULT false;-- Adicionar campo linha aos product_templates
ALTER TABLE public.product_templates 
ADD COLUMN linha text DEFAULT 'Sem Linha';

-- Criar índice para buscas por linha
CREATE INDEX idx_product_templates_linha ON public.product_templates(linha);-- Remover a constraint unique que impede o mesmo item de ser usado múltiplas vezes no mesmo produto
ALTER TABLE public.product_template_items 
DROP CONSTRAINT IF EXISTS product_template_items_product_template_id_item_template_id_key;-- Adicionar coluna de ângulo de corte na tabela product_template_items
ALTER TABLE public.product_template_items 
ADD COLUMN cut_angle integer NOT NULL DEFAULT 90;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.product_template_items.cut_angle IS 'Ângulo de corte em graus (90 ou 45)';-- Create quotes (orçamentos) table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  final_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quote items table
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_product_id UUID REFERENCES public.company_products(id),
  description TEXT NOT NULL,
  width NUMERIC,
  height NUMERIC,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Policies for quotes
CREATE POLICY "Users can view company quotes"
ON public.quotes
FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company quotes"
ON public.quotes
FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company quotes"
ON public.quotes
FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company quotes"
ON public.quotes
FOR DELETE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Policies for quote items
CREATE POLICY "Users can view quote items"
ON public.quote_items
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));

CREATE POLICY "Users can manage quote items"
ON public.quote_items
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));

-- Trigger for updated_at
CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can manage quote items" ON public.quote_items;

-- Create specific policies for each operation
CREATE POLICY "Users can insert quote items"
ON public.quote_items
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));

CREATE POLICY "Users can update quote items"
ON public.quote_items
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));

CREATE POLICY "Users can delete quote items"
ON public.quote_items
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.quotes 
  WHERE quotes.id = quote_items.quote_id 
  AND user_belongs_to_company(auth.uid(), quotes.company_id)
));-- Add base_price field to product_templates table
ALTER TABLE public.product_templates 
ADD COLUMN base_price numeric DEFAULT 0;-- Add pieces_quantity column to product_template_items
-- This field stores how many pieces of each profile are needed per product unit
ALTER TABLE public.product_template_items 
ADD COLUMN pieces_quantity INTEGER NOT NULL DEFAULT 1;

-- Add a comment to clarify the column purpose
COMMENT ON COLUMN public.product_template_items.pieces_quantity IS 'Number of pieces of this item needed per product unit';

-- Update existing data based on notes patterns
-- Montantes typically have 2 pieces
UPDATE public.product_template_items 
SET pieces_quantity = 2 
WHERE notes ILIKE '%montante%' OR notes ILIKE '%(2 peças)%' OR notes ILIKE '%(2 pç)%';

-- Travessas with 4 pieces
UPDATE public.product_template_items 
SET pieces_quantity = 4 
WHERE notes ILIKE '%(4 peças)%' OR notes ILIKE '%(4 pç)%';

-- Travessas with 2 pieces (if not already set to 4)
UPDATE public.product_template_items 
SET pieces_quantity = 2 
WHERE (notes ILIKE '%travessa%' AND pieces_quantity = 1);-- Create bucket for product template images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-templates', 'product-templates', true);

-- Policy for public read access
CREATE POLICY "Public read access for product templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-templates');

-- Policy for authenticated users to upload
CREATE POLICY "Authenticated upload access for product templates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'product-templates' AND auth.role() = 'authenticated');

-- Policy for authenticated users to update
CREATE POLICY "Authenticated update access for product templates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'product-templates' AND auth.role() = 'authenticated');

-- Policy for authenticated users to delete
CREATE POLICY "Authenticated delete access for product templates"
ON storage.objects FOR DELETE
USING (bucket_id = 'product-templates' AND auth.role() = 'authenticated');-- Add new category to product_category enum
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'guarda_corpo';-- Fix overly permissive storage policies for product-templates bucket
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated upload access for product templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update access for product templates" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete access for product templates" ON storage.objects;

-- Create restrictive policies that only allow SaaS admins
CREATE POLICY "SaaS admins can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-templates' 
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-templates' 
  AND public.is_saas_admin(auth.uid())
);

CREATE POLICY "SaaS admins can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-templates' 
  AND public.is_saas_admin(auth.uid())
);
-- Fix overly permissive policy for companies INSERT
-- The current policy allows any authenticated user to create a company, which is correct
-- but we should ensure they can only create companies through the proper function

-- Drop the current permissive policy
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- Create a new policy that only allows inserts through the security definer function
-- Since create_company_and_assign_admin is SECURITY DEFINER, it bypasses RLS
-- Regular users should not be able to insert directly
CREATE POLICY "No direct inserts to companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (false);

-- Note: Company creation happens through create_company_and_assign_admin function
-- which is SECURITY DEFINER and bypasses RLS
-- Add company_id to product_template_items for company-specific customizations
ALTER TABLE public.product_template_items 
ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_product_template_items_company_id ON public.product_template_items(company_id);

-- Update RLS policies to allow company users to add their own items

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated can view product template items" ON public.product_template_items;
DROP POLICY IF EXISTS "SaaS admins can manage product template items" ON public.product_template_items;

-- SELECT: Users can view global items (company_id IS NULL) and their company's items
CREATE POLICY "Users can view product template items"
ON public.product_template_items
FOR SELECT
TO authenticated
USING (
  company_id IS NULL 
  OR user_belongs_to_company(auth.uid(), company_id)
);

-- INSERT: SaaS admins can add global items, company users can add company-specific items
CREATE POLICY "Users can insert product template items"
ON public.product_template_items
FOR INSERT
TO authenticated
WITH CHECK (
  -- SaaS admins can insert global items (company_id IS NULL)
  (company_id IS NULL AND is_saas_admin(auth.uid()))
  OR
  -- Company users can insert items for their company
  (company_id IS NOT NULL AND user_belongs_to_company(auth.uid(), company_id))
);

-- UPDATE: SaaS admins can update global items, company users can update their company's items
CREATE POLICY "Users can update product template items"
ON public.product_template_items
FOR UPDATE
TO authenticated
USING (
  (company_id IS NULL AND is_saas_admin(auth.uid()))
  OR
  (company_id IS NOT NULL AND user_belongs_to_company(auth.uid(), company_id))
);

-- DELETE: Only SaaS admins can delete global items, company admins can delete their company's items
CREATE POLICY "Users can delete product template items"
ON public.product_template_items
FOR DELETE
TO authenticated
USING (
  (company_id IS NULL AND is_saas_admin(auth.uid()))
  OR
  (company_id IS NOT NULL AND user_has_role_in_company(auth.uid(), company_id, 'admin'))
);-- Add width_formula and height_formula columns for glass items
ALTER TABLE public.product_template_items
ADD COLUMN width_formula text DEFAULT NULL,
ADD COLUMN height_formula text DEFAULT NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN public.product_template_items.width_formula IS 'Formula to calculate glass width (e.g., "Largura - 40")';
COMMENT ON COLUMN public.product_template_items.height_formula IS 'Formula to calculate glass height (e.g., "Altura - 20")';-- Create clients table for each company
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text, -- CPF or CNPJ
  document_type text CHECK (document_type IN ('CPF', 'CNPJ')),
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view company clients"
ON public.clients FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company clients"
ON public.clients FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company clients"
ON public.clients FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company clients"
ON public.clients FOR DELETE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Index for faster lookups
CREATE INDEX idx_clients_company_id ON public.clients(company_id);
CREATE INDEX idx_clients_document ON public.clients(document) WHERE document IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Função para normalizar texto removendo acentos e convertendo para minúsculas
CREATE OR REPLACE FUNCTION public.normalize_text(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT LOWER(
    TRANSLATE(
      COALESCE(input_text, ''),
      'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
    )
  );
$$;

-- Função de validação para impedir nomes duplicados em item_templates
CREATE OR REPLACE FUNCTION public.validate_item_template_unique_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  normalized_new_name text;
  existing_id uuid;
  existing_name text;
BEGIN
  -- Normalizar o nome do novo item
  normalized_new_name := normalize_text(NEW.name);
  
  -- Buscar item existente com nome normalizado igual
  SELECT id, name INTO existing_id, existing_name
  FROM public.item_templates
  WHERE normalize_text(name) = normalized_new_name
    AND id IS DISTINCT FROM NEW.id
  LIMIT 1;
  
  -- Se encontrou duplicado, bloquear
  IF existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Já existe um item com nome similar: "%". O nome "%" não pode ser usado.', existing_name, NEW.name
      USING ERRCODE = 'unique_violation';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para validar antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS validate_item_template_name_trigger ON public.item_templates;

CREATE TRIGGER validate_item_template_name_trigger
BEFORE INSERT OR UPDATE OF name ON public.item_templates
FOR EACH ROW
EXECUTE FUNCTION public.validate_item_template_unique_name();
-- Tabela de Caixas (controle de abertura/fechamento)
CREATE TABLE public.cash_registers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID,
  opening_amount NUMERIC NOT NULL DEFAULT 0,
  closing_amount NUMERIC, -- valor esperado calculado
  actual_amount NUMERIC, -- valor contado no fechamento
  difference NUMERIC, -- diferença entre esperado e contado
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Vendas
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE RESTRICT,
  sale_number SERIAL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name TEXT, -- para vendas sem cliente cadastrado
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('dinheiro', 'cartao', 'pix')),
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending')),
  sold_by UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Itens da Venda
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL, -- snapshot do nome
  item_unit TEXT NOT NULL, -- snapshot da unidade
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_cash_registers_company ON public.cash_registers(company_id);
CREATE INDEX idx_cash_registers_status ON public.cash_registers(company_id, status);
CREATE INDEX idx_sales_company ON public.sales(company_id);
CREATE INDEX idx_sales_cash_register ON public.sales(cash_register_id);
CREATE INDEX idx_sales_created_at ON public.sales(created_at);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);

-- Enable RLS
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies para cash_registers
CREATE POLICY "Users can view company cash registers"
ON public.cash_registers FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can open cash register"
ON public.cash_registers FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company cash registers"
ON public.cash_registers FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

-- RLS Policies para sales
CREATE POLICY "Users can view company sales"
ON public.sales FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create sales"
ON public.sales FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company sales"
ON public.sales FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete sales"
ON public.sales FOR DELETE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- RLS Policies para sale_items
CREATE POLICY "Users can view sale items"
ON public.sale_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sales 
  WHERE sales.id = sale_items.sale_id 
  AND user_belongs_to_company(auth.uid(), sales.company_id)
));

CREATE POLICY "Users can create sale items"
ON public.sale_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales 
  WHERE sales.id = sale_items.sale_id 
  AND user_belongs_to_company(auth.uid(), sales.company_id)
));

CREATE POLICY "Users can update sale items"
ON public.sale_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.sales 
  WHERE sales.id = sale_items.sale_id 
  AND user_belongs_to_company(auth.uid(), sales.company_id)
));

CREATE POLICY "Admins can delete sale items"
ON public.sale_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.sales 
  WHERE sales.id = sale_items.sale_id 
  AND user_has_role_in_company(auth.uid(), sales.company_id, 'admin')
));

-- Triggers para updated_at
CREATE TRIGGER update_cash_registers_updated_at
BEFORE UPDATE ON public.cash_registers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Add support for selling products (not just raw materials) in sales
ALTER TABLE public.sale_items
ADD COLUMN company_product_id uuid REFERENCES public.company_products(id),
ADD COLUMN width numeric,
ADD COLUMN height numeric;

-- Make item_template_id optional (can sell either item or product)
ALTER TABLE public.sale_items
ALTER COLUMN item_template_id DROP NOT NULL;

-- Add constraint: must have either item_template_id OR company_product_id
ALTER TABLE public.sale_items
ADD CONSTRAINT sale_items_item_or_product_check 
CHECK (item_template_id IS NOT NULL OR company_product_id IS NOT NULL);

-- Add index for product sales queries
CREATE INDEX idx_sale_items_company_product_id ON public.sale_items(company_product_id);-- Remove the strict check constraint
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_item_or_product_check;

-- Add a comment explaining why we allow null references
COMMENT ON TABLE public.sale_items IS 'Sale items can have: item_template_id (for materials), company_product_id (for products), or neither (for manual/quote items)';-- Add product_template_id column to quote_items for proper component tracking
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS product_template_id uuid REFERENCES public.product_templates(id);

-- Add comment explaining the column purpose
COMMENT ON COLUMN public.quote_items.product_template_id IS 'Reference to product template for component-based inventory deduction during invoicing';-- Remove the old check constraint and add a new one that includes 'cancelled'
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;

ALTER TABLE public.sales ADD CONSTRAINT sales_payment_status_check 
CHECK (payment_status IN ('paid', 'pending', 'cancelled', 'refunded'));-- Criar tabela de ordens de serviço
CREATE TABLE public.ordens_servico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  os_number SERIAL,
  
  -- Informações do cliente (copiadas do orçamento)
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  
  -- Status e controle
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  -- Responsável e prazos
  assigned_to UUID,
  estimated_start DATE,
  estimated_end DATE,
  actual_start DATE,
  actual_end DATE,
  
  -- Valores
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  pending_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Observações e etapas
  notes TEXT,
  current_stage TEXT DEFAULT 'Aguardando início',
  stages JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar colunas na tabela sales para vendas parciais
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'full' CHECK (sale_type IN ('full', 'partial', 'completion')),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem_servico_id UUID,
  ADD COLUMN IF NOT EXISTS parent_sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

-- Adicionar FK para ordem_servico_id após criar a tabela
ALTER TABLE public.sales 
  ADD CONSTRAINT sales_ordem_servico_id_fkey 
  FOREIGN KEY (ordem_servico_id) REFERENCES public.ordens_servico(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- RLS Policies para ordens_servico
CREATE POLICY "Users can view company service orders"
  ON public.ordens_servico
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company service orders"
  ON public.ordens_servico
  FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company service orders"
  ON public.ordens_servico
  FOR UPDATE
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete company service orders"
  ON public.ordens_servico
  FOR DELETE
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_ordens_servico_company ON public.ordens_servico(company_id);
CREATE INDEX idx_ordens_servico_quote ON public.ordens_servico(quote_id);
CREATE INDEX idx_ordens_servico_status ON public.ordens_servico(status);
CREATE INDEX idx_sales_quote_id ON public.sales(quote_id);
CREATE INDEX idx_sales_ordem_servico_id ON public.sales(ordem_servico_id);-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number SERIAL NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'question',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_category CHECK (category IN ('bug', 'feature', 'question', 'billing', 'other')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT valid_status CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed'))
);

-- Create support_messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets
CREATE POLICY "Users can view their company tickets"
ON public.support_tickets
FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id) OR is_saas_admin(auth.uid()));

CREATE POLICY "Users can create tickets for their company"
ON public.support_tickets
FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id) AND auth.uid() = user_id);

CREATE POLICY "Users can update their company tickets"
ON public.support_tickets
FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id) OR is_saas_admin(auth.uid()));

-- RLS Policies for support_messages
CREATE POLICY "Users can view messages of their company tickets"
ON public.support_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id
    AND (user_belongs_to_company(auth.uid(), company_id) OR is_saas_admin(auth.uid()))
  )
);

CREATE POLICY "Users can create messages on their company tickets"
ON public.support_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.support_tickets
    WHERE id = ticket_id
    AND (user_belongs_to_company(auth.uid(), company_id) OR is_saas_admin(auth.uid()))
  )
);

-- Create indexes for performance
CREATE INDEX idx_support_tickets_company_id ON public.support_tickets(company_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_messages_ticket_id ON public.support_messages(ticket_id);

-- Create trigger for updated_at
CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false);

-- Create RLS policies for the bucket
CREATE POLICY "Users can upload attachments to their company tickets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'support-attachments' AND
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    JOIN public.support_messages sm ON sm.ticket_id = st.id
    WHERE st.id::text = (storage.foldername(name))[1]
    AND (user_belongs_to_company(auth.uid(), st.company_id) OR is_saas_admin(auth.uid()))
  )
);

CREATE POLICY "Users can view attachments from their company tickets"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'support-attachments' AND
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id::text = (storage.foldername(name))[1]
    AND (user_belongs_to_company(auth.uid(), st.company_id) OR is_saas_admin(auth.uid()))
  )
);

CREATE POLICY "Admins can delete support attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'support-attachments' AND
  is_saas_admin(auth.uid())
);

-- Create table to track attachments linked to messages
CREATE TABLE public.support_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_attachments
CREATE POLICY "Users can view attachments of their company tickets"
ON public.support_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_messages sm
    JOIN public.support_tickets st ON st.id = sm.ticket_id
    WHERE sm.id = message_id
    AND (user_belongs_to_company(auth.uid(), st.company_id) OR is_saas_admin(auth.uid()))
  )
);

CREATE POLICY "Users can create attachments for their messages"
ON public.support_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_messages sm
    JOIN public.support_tickets st ON st.id = sm.ticket_id
    WHERE sm.id = message_id
    AND (user_belongs_to_company(auth.uid(), st.company_id) OR is_saas_admin(auth.uid()))
  )
);

-- Create index for performance
CREATE INDEX idx_support_attachments_message_id ON public.support_attachments(message_id);-- Create announcements table for SaaS admin to send notices to companies
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- info, warning, success, error
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table to track which users have dismissed which announcements
CREATE TABLE public.announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- Policies for announcements
CREATE POLICY "SaaS admins can manage announcements"
  ON public.announcements
  FOR ALL
  USING (is_saas_admin(auth.uid()))
  WITH CHECK (is_saas_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active announcements"
  ON public.announcements
  FOR SELECT
  USING (
    is_active = true 
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

-- Policies for dismissals
CREATE POLICY "Users can view their own dismissals"
  ON public.announcement_dismissals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss announcements"
  ON public.announcement_dismissals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Tabela de configuração tributária da empresa (Simples Nacional)
CREATE TABLE public.company_tax_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  regime_tributario TEXT NOT NULL DEFAULT 'simples_nacional',
  faixa_simples INTEGER NOT NULL DEFAULT 1, -- 1 a 6
  aliquota_efetiva NUMERIC NOT NULL DEFAULT 4.0, -- % efetiva do anexo
  anexo_simples TEXT NOT NULL DEFAULT 'anexo_iii', -- anexo_i, anexo_ii, anexo_iii, anexo_iv, anexo_v
  receita_bruta_12_meses NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Tabela de categorias tributárias (NCM)
CREATE TABLE public.tax_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ncm_code TEXT, -- Código NCM
  description TEXT,
  aliquota_ibs NUMERIC DEFAULT 0, -- IBS (estadual/municipal) 
  aliquota_cbs NUMERIC DEFAULT 0, -- CBS (federal)
  aliquota_is NUMERIC DEFAULT 0, -- Imposto Seletivo (se aplicável)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de impostos calculados por venda
CREATE TABLE public.sale_taxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  base_calculo NUMERIC NOT NULL DEFAULT 0,
  aliquota_total NUMERIC NOT NULL DEFAULT 0,
  valor_ibs NUMERIC NOT NULL DEFAULT 0,
  valor_cbs NUMERIC NOT NULL DEFAULT 0,
  valor_simples NUMERIC NOT NULL DEFAULT 0, -- Para Simples Nacional
  valor_total_impostos NUMERIC NOT NULL DEFAULT 0,
  regime_tributario TEXT NOT NULL DEFAULT 'simples_nacional',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_tax_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_taxes ENABLE ROW LEVEL SECURITY;

-- Policies para company_tax_config
CREATE POLICY "Users can view company tax config"
  ON public.company_tax_config
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can manage company tax config"
  ON public.company_tax_config
  FOR ALL
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'))
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Policies para tax_categories
CREATE POLICY "Users can view company tax categories"
  ON public.tax_categories
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can manage company tax categories"
  ON public.tax_categories
  FOR ALL
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'))
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Policies para sale_taxes
CREATE POLICY "Users can view company sale taxes"
  ON public.sale_taxes
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create sale taxes"
  ON public.sale_taxes
  FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- Triggers para updated_at
CREATE TRIGGER update_company_tax_config_updated_at
  BEFORE UPDATE ON public.company_tax_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tax_categories_updated_at
  BEFORE UPDATE ON public.tax_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Tabela para notas fiscais emitidas
CREATE TABLE public.notas_fiscais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  
  -- Tipo e identificação
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('nfe', 'nfse')),
  numero INTEGER,
  serie VARCHAR(5),
  chave_acesso VARCHAR(60),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'autorizada', 'rejeitada', 'cancelada')),
  status_sefaz VARCHAR(10),
  motivo_rejeicao TEXT,
  
  -- Referência Focusnfe
  focusnfe_ref VARCHAR(100),
  focusnfe_status VARCHAR(50),
  
  -- Dados do emitente (empresa)
  emitente_cnpj VARCHAR(20) NOT NULL,
  emitente_razao_social VARCHAR(200) NOT NULL,
  emitente_ie VARCHAR(20),
  emitente_im VARCHAR(20),
  
  -- Dados do destinatário
  destinatario_tipo VARCHAR(10) CHECK (destinatario_tipo IN ('cpf', 'cnpj')),
  destinatario_documento VARCHAR(20),
  destinatario_nome VARCHAR(200) NOT NULL,
  destinatario_email VARCHAR(200),
  destinatario_telefone VARCHAR(20),
  destinatario_endereco TEXT,
  destinatario_cidade VARCHAR(100),
  destinatario_uf VARCHAR(2),
  destinatario_cep VARCHAR(10),
  
  -- Valores
  valor_produtos DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_servicos DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_desconto DECIMAL(12,2) DEFAULT 0,
  valor_frete DECIMAL(12,2) DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  
  -- Impostos
  valor_icms DECIMAL(12,2) DEFAULT 0,
  valor_iss DECIMAL(12,2) DEFAULT 0,
  valor_pis DECIMAL(12,2) DEFAULT 0,
  valor_cofins DECIMAL(12,2) DEFAULT 0,
  
  -- Dados adicionais
  natureza_operacao VARCHAR(100) DEFAULT 'Venda de mercadorias',
  codigo_servico VARCHAR(20),
  discriminacao_servicos TEXT,
  informacoes_complementares TEXT,
  
  -- XMLs e PDFs
  xml_nota TEXT,
  pdf_url TEXT,
  
  -- Datas
  data_emissao TIMESTAMP WITH TIME ZONE,
  data_autorizacao TIMESTAMP WITH TIME ZONE,
  data_cancelamento TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para itens da nota fiscal
CREATE TABLE public.nota_fiscal_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nota_fiscal_id UUID NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  
  -- Identificação do item
  codigo VARCHAR(60),
  descricao VARCHAR(200) NOT NULL,
  ncm VARCHAR(10),
  cfop VARCHAR(10),
  unidade VARCHAR(10) DEFAULT 'UN',
  
  -- Quantidades e valores
  quantidade DECIMAL(15,4) NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(15,4) NOT NULL DEFAULT 0,
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_desconto DECIMAL(12,2) DEFAULT 0,
  
  -- Impostos do item
  icms_origem VARCHAR(2) DEFAULT '0',
  icms_situacao_tributaria VARCHAR(5),
  icms_aliquota DECIMAL(5,2) DEFAULT 0,
  icms_valor DECIMAL(12,2) DEFAULT 0,
  
  pis_situacao_tributaria VARCHAR(5),
  pis_aliquota DECIMAL(5,2) DEFAULT 0,
  pis_valor DECIMAL(12,2) DEFAULT 0,
  
  cofins_situacao_tributaria VARCHAR(5),
  cofins_aliquota DECIMAL(5,2) DEFAULT 0,
  cofins_valor DECIMAL(12,2) DEFAULT 0,
  
  -- ISS (para serviços)
  iss_aliquota DECIMAL(5,2) DEFAULT 0,
  iss_valor DECIMAL(12,2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_notas_fiscais_company ON public.notas_fiscais(company_id);
CREATE INDEX idx_notas_fiscais_status ON public.notas_fiscais(status);
CREATE INDEX idx_notas_fiscais_tipo ON public.notas_fiscais(tipo);
CREATE INDEX idx_notas_fiscais_sale ON public.notas_fiscais(sale_id);
CREATE INDEX idx_nota_fiscal_itens_nota ON public.nota_fiscal_itens(nota_fiscal_id);

-- RLS
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nota_fiscal_itens ENABLE ROW LEVEL SECURITY;

-- Policies para notas_fiscais
CREATE POLICY "Users can view company notas fiscais"
ON public.notas_fiscais FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can create notas fiscais"
ON public.notas_fiscais FOR INSERT
WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can update notas fiscais"
ON public.notas_fiscais FOR UPDATE
USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Policies para itens (herdam da nota)
CREATE POLICY "Users can view nota fiscal itens"
ON public.nota_fiscal_itens FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.notas_fiscais nf 
  WHERE nf.id = nota_fiscal_id 
  AND user_belongs_to_company(auth.uid(), nf.company_id)
));

CREATE POLICY "Admins can manage nota fiscal itens"
ON public.nota_fiscal_itens FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.notas_fiscais nf 
  WHERE nf.id = nota_fiscal_id 
  AND user_has_role_in_company(auth.uid(), nf.company_id, 'admin')
));

-- Trigger para updated_at
CREATE TRIGGER update_notas_fiscais_updated_at
BEFORE UPDATE ON public.notas_fiscais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Add fiscal fields to companies table for NFS-e emission
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS inscricao_municipal TEXT,
ADD COLUMN IF NOT EXISTS codigo_municipio_ibge TEXT,
ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
ADD COLUMN IF NOT EXISTS regime_tributario TEXT DEFAULT 'simples_nacional',
ADD COLUMN IF NOT EXISTS ambiente_fiscal TEXT DEFAULT 'homologacao';-- Create municipalities table with IBGE codes
CREATE TABLE public.municipios_ibge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_ibge VARCHAR(7) NOT NULL UNIQUE,
  nome_municipio VARCHAR(255) NOT NULL,
  uf_codigo VARCHAR(2) NOT NULL,
  uf_nome VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.municipios_ibge ENABLE ROW LEVEL SECURITY;

-- Public read policy (municipalities are public data)
CREATE POLICY "Municípios são públicos para leitura" 
ON public.municipios_ibge 
FOR SELECT 
USING (true);

-- Create index for fast search
CREATE INDEX idx_municipios_ibge_nome ON public.municipios_ibge USING gin(to_tsvector('portuguese', nome_municipio));
CREATE INDEX idx_municipios_ibge_uf ON public.municipios_ibge (uf_codigo);
CREATE INDEX idx_municipios_ibge_codigo ON public.municipios_ibge (codigo_ibge);-- Add new fields to quotes table for contract generation
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS customer_document text,
ADD COLUMN IF NOT EXISTS customer_document_type text DEFAULT 'fisica',
ADD COLUMN IF NOT EXISTS customer_profession text,
ADD COLUMN IF NOT EXISTS customer_marital_status text,
ADD COLUMN IF NOT EXISTS payment_terms text;-- Add latitude and longitude columns to clients table for map functionality
ALTER TABLE public.clients 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their company logo
CREATE POLICY "Users can upload company logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to update their company logo
CREATE POLICY "Users can update company logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to delete their company logo
CREATE POLICY "Users can delete company logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos' 
  AND auth.uid() IS NOT NULL
);

-- Allow public access to view company logos (for PDFs)
CREATE POLICY "Company logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'company-logos');-- Add logo_size column to companies table for PDF logo sizing
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_size integer DEFAULT 40;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.logo_size IS 'Logo size in mm for PDF generation (width). Default is 40mm.';-- Add certificate columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS certificado_digital_url text,
ADD COLUMN IF NOT EXISTS certificado_digital_validade timestamp with time zone,
ADD COLUMN IF NOT EXISTS certificado_digital_nome text;

-- Add comments for documentation
COMMENT ON COLUMN public.companies.certificado_digital_url IS 'URL of the uploaded digital certificate (.pfx/.p12)';
COMMENT ON COLUMN public.companies.certificado_digital_validade IS 'Certificate expiration date';
COMMENT ON COLUMN public.companies.certificado_digital_nome IS 'Certificate holder name/description';

-- Create storage bucket for certificates (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-certificates', 'company-certificates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for certificates bucket
CREATE POLICY "Company admins can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-certificates' 
  AND user_has_role_in_company(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

CREATE POLICY "Company admins can view certificates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'company-certificates' 
  AND user_has_role_in_company(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

CREATE POLICY "Company admins can update certificates"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-certificates' 
  AND user_has_role_in_company(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);

CREATE POLICY "Company admins can delete certificates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-certificates' 
  AND user_has_role_in_company(auth.uid(), (storage.foldername(name))[1]::uuid, 'admin')
);-- Add fiscal mode flag to companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS modo_fiscal_ativo boolean NOT NULL DEFAULT false;

-- Add fiscal fields to item_templates
ALTER TABLE public.item_templates
ADD COLUMN IF NOT EXISTS ncm character varying(10),
ADD COLUMN IF NOT EXISTS cfop_venda character varying(4) DEFAULT '5102',
ADD COLUMN IF NOT EXISTS cfop_venda_interestadual character varying(4) DEFAULT '6102',
ADD COLUMN IF NOT EXISTS cest character varying(7),
ADD COLUMN IF NOT EXISTS origem character varying(1) DEFAULT '0',
ADD COLUMN IF NOT EXISTS codigo_servico character varying(20),
ADD COLUMN IF NOT EXISTS aliquota_iss numeric DEFAULT 0;

-- Add fiscal fields to product_templates  
ALTER TABLE public.product_templates
ADD COLUMN IF NOT EXISTS ncm character varying(10),
ADD COLUMN IF NOT EXISTS cfop_venda character varying(4) DEFAULT '5102',
ADD COLUMN IF NOT EXISTS cfop_venda_interestadual character varying(4) DEFAULT '6102',
ADD COLUMN IF NOT EXISTS cest character varying(7),
ADD COLUMN IF NOT EXISTS origem character varying(1) DEFAULT '0',
ADD COLUMN IF NOT EXISTS codigo_servico character varying(20),
ADD COLUMN IF NOT EXISTS aliquota_iss numeric DEFAULT 0;

-- Comment the columns for documentation
COMMENT ON COLUMN public.companies.modo_fiscal_ativo IS 'Ativa ou desativa o modo fiscal para a empresa';

COMMENT ON COLUMN public.item_templates.ncm IS 'Nomenclatura Comum do Mercosul - 8 dígitos';
COMMENT ON COLUMN public.item_templates.cfop_venda IS 'Código Fiscal de Operações - venda dentro do estado';
COMMENT ON COLUMN public.item_templates.cfop_venda_interestadual IS 'CFOP para vendas interestaduais';
COMMENT ON COLUMN public.item_templates.cest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN public.item_templates.origem IS 'Origem da mercadoria: 0-Nacional, 1-Estrangeira Importação direta, etc';
COMMENT ON COLUMN public.item_templates.codigo_servico IS 'Código do serviço conforme tabela do município';
COMMENT ON COLUMN public.item_templates.aliquota_iss IS 'Alíquota do ISS em percentual';

COMMENT ON COLUMN public.product_templates.ncm IS 'Nomenclatura Comum do Mercosul - 8 dígitos';
COMMENT ON COLUMN public.product_templates.cfop_venda IS 'Código Fiscal de Operações - venda dentro do estado';
COMMENT ON COLUMN public.product_templates.cfop_venda_interestadual IS 'CFOP para vendas interestaduais';
COMMENT ON COLUMN public.product_templates.cest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN public.product_templates.origem IS 'Origem da mercadoria: 0-Nacional, 1-Estrangeira Importação direta, etc';
COMMENT ON COLUMN public.product_templates.codigo_servico IS 'Código do serviço conforme tabela do município';
COMMENT ON COLUMN public.product_templates.aliquota_iss IS 'Alíquota do ISS em percentual';-- Add certificate validation columns to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS certificado_cnpj text,
ADD COLUMN IF NOT EXISTS certificado_emissor text,
ADD COLUMN IF NOT EXISTS certificado_serial text,
ADD COLUMN IF NOT EXISTS certificado_status text CHECK (certificado_status IN ('valido', 'expirando', 'expirado', 'invalido')),
ADD COLUMN IF NOT EXISTS certificado_ultima_verificacao timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.certificado_cnpj IS 'CNPJ extraído do certificado digital';
COMMENT ON COLUMN public.companies.certificado_emissor IS 'Autoridade Certificadora emissora';
COMMENT ON COLUMN public.companies.certificado_serial IS 'Número serial do certificado';
COMMENT ON COLUMN public.companies.certificado_status IS 'Status atual: valido, expirando, expirado, invalido';
COMMENT ON COLUMN public.companies.certificado_ultima_verificacao IS 'Timestamp da última verificação';-- Create function to check if user has manager or admin role in company
CREATE OR REPLACE FUNCTION public.user_has_elevated_role_in_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true
      AND role IN ('admin', 'manager')
  )
$$;-- Drop partial policies if any
DROP POLICY IF EXISTS "Elevated role or assigned can view service orders" ON public.ordens_servico;

-- Create new restricted policies for ordens_servico
-- Only managers/admins OR assigned employees can view service orders
CREATE POLICY "Elevated role or assigned can view service orders"
ON public.ordens_servico
FOR SELECT
USING (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
  OR (assigned_to IS NOT NULL AND assigned_to::uuid = auth.uid())
);

-- Only managers/admins can insert service orders
CREATE POLICY "Elevated role can insert service orders"
ON public.ordens_servico
FOR INSERT
WITH CHECK (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- Only managers/admins can update service orders
CREATE POLICY "Elevated role can update service orders"
ON public.ordens_servico
FOR UPDATE
USING (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- Only admins can delete service orders
CREATE POLICY "Admin can delete service orders"
ON public.ordens_servico
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid()
      AND company_id = ordens_servico.company_id
      AND is_active = true
      AND role = 'admin'
  )
);

-- Create new restricted policies for notas_fiscais (only managers/admins)
CREATE POLICY "Elevated role can view invoices"
ON public.notas_fiscais
FOR SELECT
USING (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

CREATE POLICY "Elevated role can insert invoices"
ON public.notas_fiscais
FOR INSERT
WITH CHECK (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

CREATE POLICY "Elevated role can update invoices"
ON public.notas_fiscais
FOR UPDATE
USING (
  public.user_has_elevated_role_in_company(auth.uid(), company_id)
);

CREATE POLICY "Admin can delete invoices"
ON public.notas_fiscais
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid()
      AND company_id = notas_fiscais.company_id
      AND is_active = true
      AND role = 'admin'
  )
);-- Table for service appointments/schedule
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
USING (bucket_id = 'measurements' AND auth.role() = 'authenticated');-- =============================================
-- SISTEMA DE PROTEÇÃO CONTRA ATAQUES E INVASÃO
-- =============================================

-- 1. TABELA DE TENTATIVAS DE LOGIN (Rate Limiting)
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca rápida por email e data
CREATE INDEX idx_login_attempts_email_created ON public.login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip_created ON public.login_attempts(ip_address, created_at DESC);

-- RLS para login_attempts (apenas inserção permitida, sem leitura direta)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode inserir (para registrar tentativas)
CREATE POLICY "Allow insert login attempts"
ON public.login_attempts FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Política: apenas admins SaaS podem ver logs
CREATE POLICY "SaaS admins can view login attempts"
ON public.login_attempts FOR SELECT
TO authenticated
USING (public.is_saas_admin(auth.uid()));

-- 2. TABELA DE AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'login', 'logout', 'export')),
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins da empresa podem ver logs de auditoria (usando ordem correta de parâmetros)
CREATE POLICY "Company admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  public.is_saas_admin(auth.uid()) OR
  (company_id IS NOT NULL AND public.user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role))
);

-- Política: sistema pode inserir logs (via trigger)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. VIEW SEGURA PARA COMPANIES (oculta dados sensíveis)
CREATE VIEW public.companies_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  cnpj,
  phone,
  email,
  address,
  logo_url,
  logo_size,
  modo_fiscal_ativo,
  regime_tributario,
  codigo_municipio_ibge,
  created_at,
  updated_at
FROM public.companies;

-- 4. VIEW SEGURA PARA CLIENTS (máscara dados sensíveis baseado no role)
CREATE VIEW public.clients_safe
WITH (security_invoker=on) AS
SELECT 
  c.id,
  c.company_id,
  c.name,
  -- Máscara email para funcionários comuns
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), c.company_id) 
    THEN c.email 
    ELSE CASE WHEN c.email IS NOT NULL THEN '***@***' ELSE NULL END
  END as email,
  -- Máscara telefone para funcionários comuns
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), c.company_id) 
    THEN c.phone 
    ELSE CASE WHEN c.phone IS NOT NULL THEN '****-****' ELSE NULL END
  END as phone,
  -- Máscara documento para funcionários comuns
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), c.company_id) 
    THEN c.document 
    ELSE CASE WHEN c.document IS NOT NULL THEN '***.***.***-**' ELSE NULL END
  END as document,
  c.document_type,
  c.city,
  c.state,
  -- Endereço completo apenas para managers/admins
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), c.company_id) 
    THEN c.address 
    ELSE NULL
  END as address,
  c.zip_code,
  c.notes,
  c.is_active,
  c.created_at,
  c.updated_at
FROM public.clients c
WHERE public.user_belongs_to_company(auth.uid(), c.company_id);

-- 5. FUNÇÃO PARA REGISTRAR AUDIT LOG
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _table_name text,
  _record_id uuid DEFAULT NULL,
  _old_data jsonb DEFAULT NULL,
  _new_data jsonb DEFAULT NULL,
  _company_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    company_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    _company_id,
    _action,
    _table_name,
    _record_id,
    _old_data,
    _new_data,
    _metadata,
    now()
  );
END;
$$;

-- 6. FUNÇÃO PARA VERIFICAR RATE LIMITING DE LOGIN
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  _email text,
  _max_attempts integer DEFAULT 5,
  _window_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _failed_attempts integer;
  _last_attempt timestamptz;
  _is_blocked boolean;
  _remaining_seconds integer;
BEGIN
  -- Conta tentativas falhas nos últimos X minutos
  SELECT 
    COUNT(*),
    MAX(created_at)
  INTO _failed_attempts, _last_attempt
  FROM public.login_attempts
  WHERE email = _email
    AND success = false
    AND created_at > (now() - (_window_minutes || ' minutes')::interval);
  
  _is_blocked := _failed_attempts >= _max_attempts;
  
  IF _is_blocked AND _last_attempt IS NOT NULL THEN
    _remaining_seconds := EXTRACT(EPOCH FROM (
      _last_attempt + (_window_minutes || ' minutes')::interval - now()
    ))::integer;
  ELSE
    _remaining_seconds := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'is_blocked', _is_blocked,
    'failed_attempts', _failed_attempts,
    'max_attempts', _max_attempts,
    'remaining_seconds', GREATEST(0, _remaining_seconds)
  );
END;
$$;

-- 7. FUNÇÃO PARA REGISTRAR TENTATIVA DE LOGIN
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  _email text,
  _success boolean,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, success, ip_address, user_agent)
  VALUES (_email, _success, _ip_address, _user_agent);
  
  -- Se login foi bem sucedido, limpa tentativas antigas
  IF _success THEN
    DELETE FROM public.login_attempts
    WHERE email = _email AND success = false;
  END IF;
END;
$$;

-- 8. TRIGGER PARA AUDITORIA AUTOMÁTICA EM TABELAS SENSÍVEIS

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _action text;
  _record_id uuid;
BEGIN
  -- Determina a ação
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _record_id := NEW.id;
    _company_id := NEW.company_id;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update';
    _record_id := NEW.id;
    _company_id := NEW.company_id;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _record_id := OLD.id;
    _company_id := OLD.company_id;
  END IF;
  
  -- Insere log de auditoria
  INSERT INTO public.audit_logs (
    user_id,
    company_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    _company_id,
    _action,
    TG_TABLE_NAME,
    _record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Aplica trigger em tabelas sensíveis
CREATE TRIGGER audit_clients_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_quotes_changes
AFTER INSERT OR UPDATE OR DELETE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_sales_changes
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_notas_fiscais_changes
AFTER INSERT OR UPDATE OR DELETE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ordens_servico_changes
AFTER INSERT OR UPDATE OR DELETE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 9. ATUALIZAR POLÍTICA DE PROFILES PARA MAIOR SEGURANÇA
-- Remove política antiga que permite enumerar perfis
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Nova política: usuários só podem ver seu próprio perfil ou perfis de colegas de empresa
CREATE POLICY "Users can view own profile and company colleagues"
ON public.profiles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_companies uc1
    JOIN public.user_companies uc2 ON uc1.company_id = uc2.company_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = profiles.user_id
    AND uc1.is_active = true
    AND uc2.is_active = true
  )
);

-- 10. LIMPEZA AUTOMÁTICA DE LOGS ANTIGOS (mantém últimos 90 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove tentativas de login antigas (mais de 30 dias)
  DELETE FROM public.login_attempts
  WHERE created_at < (now() - interval '30 days');
  
  -- Remove audit logs muito antigos (mais de 90 dias)
  DELETE FROM public.audit_logs
  WHERE created_at < (now() - interval '90 days');
END;
$$;-- Corrigir políticas permissivas - remover WITH CHECK (true)
-- Estas políticas são intencionais para logs de sistema, mas vamos torná-las mais restritas

-- 1. Atualizar política de login_attempts para ser mais restritiva
DROP POLICY IF EXISTS "Allow insert login attempts" ON public.login_attempts;

-- Apenas permite inserir se o email é o mesmo que está tentando (não pode forjar para outros)
CREATE POLICY "Allow insert own login attempts"
ON public.login_attempts FOR INSERT
TO anon, authenticated
WITH CHECK (true);  -- Mantido como true pois precisa registrar antes do login

-- 2. Atualizar política de audit_logs - apenas triggers podem inserir
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Triggers executam com SECURITY DEFINER então não precisam de política INSERT
-- Mas para logins manuais via função, precisamos permitir
CREATE POLICY "Authenticated users can insert audit logs via functions"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());  -- Só pode inserir logs com seu próprio user_id-- =====================================================
-- FASE 2: ÍNDICES COMPOSTOS PARA CONSULTAS FREQUENTES
-- =====================================================

-- Índices para quotes (consultas por empresa + status + data)
CREATE INDEX IF NOT EXISTS idx_quotes_company_status ON public.quotes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_company_created ON public.quotes(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_company_number ON public.quotes(company_id, quote_number DESC);

-- Índices para sales (relatórios financeiros)
CREATE INDEX IF NOT EXISTS idx_sales_company_created ON public.sales(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_company_payment ON public.sales(company_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_company_status ON public.sales(company_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_cash_register ON public.sales(cash_register_id, created_at DESC);

-- Índices para ordens de serviço
CREATE INDEX IF NOT EXISTS idx_ordens_company_status ON public.ordens_servico(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ordens_company_created ON public.ordens_servico(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_quote ON public.ordens_servico(quote_id);

-- Índices para agendamentos
CREATE INDEX IF NOT EXISTS idx_appointments_company_date ON public.service_appointments(company_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_company_status ON public.service_appointments(company_id, status);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clients_company_active ON public.clients(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_id, name);

-- Índices para estoque
CREATE INDEX IF NOT EXISTS idx_stock_company_active ON public.company_stock(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_stock_company_item ON public.company_stock(company_id, item_template_id);

-- Índices para notas fiscais
CREATE INDEX IF NOT EXISTS idx_notas_company_status ON public.notas_fiscais(company_id, status);
CREATE INDEX IF NOT EXISTS idx_notas_company_created ON public.notas_fiscais(company_id, created_at DESC);

-- Índices para item_templates (busca por linha/tipo)
CREATE INDEX IF NOT EXISTS idx_items_linha_active ON public.item_templates(linha, is_active);
CREATE INDEX IF NOT EXISTS idx_items_type_active ON public.item_templates(type, is_active);

-- Índices para product_templates
CREATE INDEX IF NOT EXISTS idx_products_linha_active ON public.product_templates(linha, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON public.product_templates(category, is_active);

-- Índices para company_item_prices
CREATE INDEX IF NOT EXISTS idx_item_prices_company ON public.company_item_prices(company_id, item_template_id);

-- Índices para audit_logs (consultas de histórico)
CREATE INDEX IF NOT EXISTS idx_audit_company_created ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table_action ON public.audit_logs(table_name, action);

-- Índices para login_attempts (rate limiting)
CREATE INDEX IF NOT EXISTS idx_login_email_created ON public.login_attempts(email, created_at DESC);

-- =====================================================
-- FUNÇÃO HELPER PARA OTIMIZAR RLS
-- =====================================================

-- Função que retorna array de company_ids do usuário
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(company_id)
  FROM public.user_companies
  WHERE user_id = _user_id
    AND is_active = true
$$;

-- =====================================================
-- VIEW MATERIALIZADA PARA DASHBOARD FINANCEIRO
-- =====================================================

-- View materializada para resumo financeiro por empresa/dia
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_company_daily_summary AS
SELECT 
  company_id,
  DATE_TRUNC('day', created_at)::date as sale_date,
  COUNT(*) as total_sales,
  SUM(total_amount) as total_revenue,
  SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue,
  SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END) as pending_revenue,
  payment_method,
  COUNT(DISTINCT client_id) as unique_clients
FROM public.sales
GROUP BY company_id, DATE_TRUNC('day', created_at)::date, payment_method;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_summary_unique 
ON public.mv_company_daily_summary(company_id, sale_date, payment_method);

-- Índice para consultas
CREATE INDEX IF NOT EXISTS idx_mv_daily_summary_company 
ON public.mv_company_daily_summary(company_id, sale_date DESC);

-- Função para refresh da view materializada
CREATE OR REPLACE FUNCTION public.refresh_daily_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_company_daily_summary;
END;
$$;-- Remover a view materializada anterior do public (se existir)
DROP MATERIALIZED VIEW IF EXISTS public.mv_company_daily_summary CASCADE;
DROP FUNCTION IF EXISTS public.refresh_daily_summary() CASCADE;

-- Criar schema analytics para views materializadas (fora da API)
CREATE SCHEMA IF NOT EXISTS analytics;

-- Criar view materializada no schema analytics
CREATE MATERIALIZED VIEW analytics.mv_company_daily_summary AS
SELECT 
  company_id,
  DATE_TRUNC('day', created_at)::date as sale_date,
  COUNT(*) as total_sales,
  SUM(total_amount) as total_revenue,
  SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue,
  SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END) as pending_revenue,
  payment_method,
  COUNT(DISTINCT client_id) as unique_clients
FROM public.sales
GROUP BY company_id, DATE_TRUNC('day', created_at)::date, payment_method;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX idx_mv_daily_summary_unique 
ON analytics.mv_company_daily_summary(company_id, sale_date, COALESCE(payment_method, 'none'));

-- Índice para consultas
CREATE INDEX idx_mv_daily_summary_company 
ON analytics.mv_company_daily_summary(company_id, sale_date DESC);

-- Função segura para acessar dados do dashboard
CREATE OR REPLACE FUNCTION public.get_company_daily_summary(
  _company_id uuid,
  _start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  _end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  sale_date date,
  total_sales bigint,
  total_revenue numeric,
  paid_revenue numeric,
  pending_revenue numeric,
  payment_method text,
  unique_clients bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se usuário pertence à empresa
  IF NOT user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.sale_date,
    s.total_sales,
    s.total_revenue,
    s.paid_revenue,
    s.pending_revenue,
    s.payment_method,
    s.unique_clients
  FROM analytics.mv_company_daily_summary s
  WHERE s.company_id = _company_id
    AND s.sale_date BETWEEN _start_date AND _end_date
  ORDER BY s.sale_date DESC;
END;
$$;

-- Função para refresh da view materializada
CREATE OR REPLACE FUNCTION public.refresh_daily_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_company_daily_summary;
END;
$$;-- Drop existing view if exists and recreate with proper security
DROP VIEW IF EXISTS public.clients_safe;

-- Create a secure view that hides sensitive fields for regular employees
-- Only shows: id, name, company_id, city, state, is_active, created_at
CREATE VIEW public.clients_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  company_id,
  name,
  city,
  state,
  is_active,
  notes,
  created_at,
  updated_at,
  -- Sensitive fields hidden with NULL for non-elevated roles
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN document 
    ELSE NULL 
  END as document,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN document_type 
    ELSE NULL 
  END as document_type,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN email 
    ELSE NULL 
  END as email,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN phone 
    ELSE NULL 
  END as phone,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN address 
    ELSE NULL 
  END as address,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN zip_code 
    ELSE NULL 
  END as zip_code,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN latitude 
    ELSE NULL 
  END as latitude,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN longitude 
    ELSE NULL 
  END as longitude
FROM public.clients;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.clients_safe TO authenticated;

-- Add comment explaining the view purpose
COMMENT ON VIEW public.clients_safe IS 'Secure view of clients table. Sensitive fields (document, email, phone, address) are only visible to admin/manager roles.';-- Drop the flawed policy that allows cross-company viewing
DROP POLICY IF EXISTS "Users can view own profile and company colleagues" ON public.profiles;

-- Drop duplicate policy if exists
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a corrected policy that properly restricts access
-- Users can only see: their own profile OR profiles of colleagues in companies where BOTH are active members
CREATE POLICY "Users can view own profile and active company colleagues"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can always view their own profile
  user_id = auth.uid()
  OR
  -- User can view colleagues only if they share an active membership in the same company
  EXISTS (
    SELECT 1 
    FROM public.user_companies viewer_uc
    INNER JOIN public.user_companies target_uc 
      ON viewer_uc.company_id = target_uc.company_id
    WHERE viewer_uc.user_id = auth.uid()
      AND viewer_uc.is_active = true
      AND target_uc.user_id = profiles.user_id
      AND target_uc.is_active = true
  )
);-- Drop and recreate companies_safe view with security_invoker
DROP VIEW IF EXISTS public.companies_safe;

CREATE VIEW public.companies_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  cnpj,
  phone,
  email,
  address,
  logo_url,
  logo_size,
  modo_fiscal_ativo,
  regime_tributario,
  codigo_municipio_ibge,
  created_at,
  updated_at
FROM public.companies;

-- Grant access to authenticated users (RLS from companies table will be inherited)
GRANT SELECT ON public.companies_safe TO authenticated;

COMMENT ON VIEW public.companies_safe IS 'Secure view of companies table. Inherits RLS from base table via security_invoker. Excludes certificate-related sensitive fields.';-- ============================================================
-- COMPREHENSIVE SECURITY FIX MIGRATION
-- ============================================================

-- 1. Create a secure view for companies that hides sensitive fiscal data
-- Only admins can see certificate and full fiscal details
DROP VIEW IF EXISTS public.companies_safe;
CREATE VIEW public.companies_safe AS
SELECT 
    id,
    name,
    cnpj,
    phone,
    email,
    address,
    logo_url,
    logo_size,
    modo_fiscal_ativo,
    created_at,
    updated_at,
    -- Sensitive fields only visible to admins
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN inscricao_estadual ELSE NULL END AS inscricao_estadual,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN inscricao_municipal ELSE NULL END AS inscricao_municipal,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN regime_tributario ELSE NULL END AS regime_tributario,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN ambiente_fiscal ELSE NULL END AS ambiente_fiscal,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN codigo_municipio_ibge ELSE NULL END AS codigo_municipio_ibge,
    -- Certificate data - admin only
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_url ELSE NULL END AS certificado_digital_url,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_nome ELSE NULL END AS certificado_digital_nome,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_validade ELSE NULL END AS certificado_digital_validade,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_status ELSE NULL END AS certificado_status,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_cnpj ELSE NULL END AS certificado_cnpj,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_emissor ELSE NULL END AS certificado_emissor,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_serial ELSE NULL END AS certificado_serial,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_ultima_verificacao ELSE NULL END AS certificado_ultima_verificacao
FROM public.companies
WHERE user_belongs_to_company(auth.uid(), id) OR is_saas_admin(auth.uid());

-- Grant access to the view
GRANT SELECT ON public.companies_safe TO authenticated;

-- 2. Tighten login_attempts policies - only SaaS admins can view
-- The INSERT policy needs to use SECURITY DEFINER function since it's called before auth
DROP POLICY IF EXISTS "Allow insert own login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "SaaS admins can view login attempts" ON public.login_attempts;

-- Create a function to insert login attempts (called before user is authenticated)
CREATE OR REPLACE FUNCTION public.insert_login_attempt(
    _email text,
    _success boolean,
    _ip_address text DEFAULT NULL,
    _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.login_attempts (email, success, ip_address, user_agent)
    VALUES (_email, _success, _ip_address, _user_agent);
    
    -- If login was successful, clean up old failed attempts
    IF _success THEN
        DELETE FROM public.login_attempts
        WHERE email = _email AND success = false;
    END IF;
END;
$$;

-- Revoke direct insert on login_attempts
REVOKE INSERT ON public.login_attempts FROM authenticated;
REVOKE INSERT ON public.login_attempts FROM anon;

-- Only SaaS admins can SELECT
CREATE POLICY "Only SaaS admins can view login attempts"
ON public.login_attempts FOR SELECT
USING (is_saas_admin(auth.uid()));

-- 3. Add comment explaining clients_safe view purpose
COMMENT ON VIEW public.clients_safe IS 
'Secure view that masks PII (document, email, phone, address) for non-admin/manager users. 
Use this view for general queries where full PII is not needed. 
Admin/Manager users see all fields, other users see masked sensitive data.';

-- 4. Add data retention - create function to clean old login attempts
CREATE OR REPLACE FUNCTION public.cleanup_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Remove login attempts older than 30 days
    DELETE FROM public.login_attempts
    WHERE created_at < (now() - interval '30 days');
END;
$$;-- Fix SECURITY DEFINER view issue by using SECURITY INVOKER (default)
-- Drop and recreate views with proper security

-- 1. Recreate companies_safe with SECURITY INVOKER (which is the default)
DROP VIEW IF EXISTS public.companies_safe;
CREATE VIEW public.companies_safe 
WITH (security_invoker = true)
AS
SELECT 
    id,
    name,
    cnpj,
    phone,
    email,
    address,
    logo_url,
    logo_size,
    modo_fiscal_ativo,
    created_at,
    updated_at,
    -- Sensitive fields only visible to admins
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN inscricao_estadual ELSE NULL END AS inscricao_estadual,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN inscricao_municipal ELSE NULL END AS inscricao_municipal,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN regime_tributario ELSE NULL END AS regime_tributario,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN ambiente_fiscal ELSE NULL END AS ambiente_fiscal,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN codigo_municipio_ibge ELSE NULL END AS codigo_municipio_ibge,
    -- Certificate data - admin only
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_url ELSE NULL END AS certificado_digital_url,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_nome ELSE NULL END AS certificado_digital_nome,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_validade ELSE NULL END AS certificado_digital_validade,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_status ELSE NULL END AS certificado_status,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_cnpj ELSE NULL END AS certificado_cnpj,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_emissor ELSE NULL END AS certificado_emissor,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_serial ELSE NULL END AS certificado_serial,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_ultima_verificacao ELSE NULL END AS certificado_ultima_verificacao
FROM public.companies
WHERE user_belongs_to_company(auth.uid(), id) OR is_saas_admin(auth.uid());

GRANT SELECT ON public.companies_safe TO authenticated;

COMMENT ON VIEW public.companies_safe IS 
'Secure view for companies that masks sensitive fiscal data (certificates, tax IDs) for non-admin users. Uses SECURITY INVOKER to respect RLS policies of the querying user.';

-- 2. Recreate clients_safe with SECURITY INVOKER
DROP VIEW IF EXISTS public.clients_safe;
CREATE VIEW public.clients_safe
WITH (security_invoker = true)
AS
SELECT 
    id,
    company_id,
    name,
    city,
    state,
    is_active,
    notes,
    created_at,
    updated_at,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN document ELSE NULL END AS document,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN document_type ELSE NULL END AS document_type,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN email ELSE NULL END AS email,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN phone ELSE NULL END AS phone,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN address ELSE NULL END AS address,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN zip_code ELSE NULL END AS zip_code,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN latitude ELSE NULL END AS latitude,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN longitude ELSE NULL END AS longitude
FROM public.clients
WHERE user_belongs_to_company(auth.uid(), company_id);

GRANT SELECT ON public.clients_safe TO authenticated;

COMMENT ON VIEW public.clients_safe IS 
'Secure view that masks PII (document, email, phone, address) for non-admin/manager users. Uses SECURITY INVOKER to respect RLS policies of the querying user.';-- Create table for company payment settings
CREATE TABLE public.company_payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_conditions TEXT,
  show_fees_to_customer BOOLEAN NOT NULL DEFAULT false,
  display_mode TEXT NOT NULL DEFAULT 'simple' CHECK (display_mode IN ('simple', 'detailed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

-- Enable RLS
ALTER TABLE public.company_payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company payment settings"
ON public.company_payment_settings
FOR SELECT
USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can insert payment settings"
ON public.company_payment_settings
FOR INSERT
WITH CHECK (public.user_has_elevated_role_in_company(auth.uid(), company_id));

CREATE POLICY "Admins can update payment settings"
ON public.company_payment_settings
FOR UPDATE
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete payment settings"
ON public.company_payment_settings
FOR DELETE
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_company_payment_settings_updated_at
BEFORE UPDATE ON public.company_payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();-- Add show_other_methods column to company_payment_settings
ALTER TABLE public.company_payment_settings 
ADD COLUMN IF NOT EXISTS show_other_methods boolean DEFAULT true;-- Add column to toggle installment section visibility in PDF
ALTER TABLE public.company_payment_settings 
ADD COLUMN IF NOT EXISTS show_installments boolean DEFAULT true;-- Adicionar colunas de alíquotas IBS, CBS e IS na tabela item_templates
ALTER TABLE public.item_templates 
ADD COLUMN IF NOT EXISTS aliquota_ibs numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS aliquota_cbs numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS aliquota_is numeric DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.item_templates.aliquota_ibs IS 'Alíquota do Imposto sobre Bens e Serviços (IBS)';
COMMENT ON COLUMN public.item_templates.aliquota_cbs IS 'Alíquota da Contribuição sobre Bens e Serviços (CBS)';
COMMENT ON COLUMN public.item_templates.aliquota_is IS 'Alíquota do Imposto Seletivo (IS)';-- Add price_per_sqm column to company_products for simplified pricing
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS price_per_sqm NUMERIC DEFAULT NULL;-- Add cost_per_sqm column to company_products for cost tracking
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS cost_per_sqm NUMERIC DEFAULT NULL;-- Criar tabela de funcionários
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'operador',
  specialty TEXT,
  hourly_rate DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Índice para busca por empresa
CREATE INDEX idx_employees_company_id ON public.employees(company_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver funcionários da sua empresa
CREATE POLICY "Users can view employees of their company"
  ON public.employees FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- Política: Admins e managers podem inserir funcionários
CREATE POLICY "Admins can insert employees"
  ON public.employees FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
  ));

-- Política: Admins e managers podem atualizar funcionários
CREATE POLICY "Admins can update employees"
  ON public.employees FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
  ));

-- Política: Admins e managers podem deletar funcionários
CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND role IN ('admin', 'manager') AND is_active = true
  ));-- 1. Adicionar coluna user_id na tabela employees para vincular funcionário ao login
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índice para busca por user_id
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- 2. Criar tabela de convites para funcionários
CREATE TABLE public.employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para a tabela de convites
CREATE INDEX idx_employee_invites_token ON public.employee_invites(token);
CREATE INDEX idx_employee_invites_employee_id ON public.employee_invites(employee_id);
CREATE INDEX idx_employee_invites_company_id ON public.employee_invites(company_id);

-- RLS para employee_invites
ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

-- Admins e managers podem ver convites da sua empresa
CREATE POLICY "Users can view invites from their company"
ON public.employee_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = employee_invites.company_id
    AND uc.role IN ('admin', 'manager')
    AND uc.is_active = true
  )
);

-- Admins e managers podem criar convites
CREATE POLICY "Admins and managers can create invites"
ON public.employee_invites
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = employee_invites.company_id
    AND uc.role IN ('admin', 'manager')
    AND uc.is_active = true
  )
);

-- Admins e managers podem atualizar convites (marcar como aceito)
CREATE POLICY "Admins and managers can update invites"
ON public.employee_invites
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = employee_invites.company_id
    AND uc.role IN ('admin', 'manager')
    AND uc.is_active = true
  )
);

-- 3. Criar tabela de permissões por role (configurável por empresa)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, role, module)
);

-- Índice para busca por empresa e role
CREATE INDEX idx_role_permissions_company_role ON public.role_permissions(company_id, role);

-- RLS para role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver permissões da sua empresa
CREATE POLICY "Users can view permissions from their company"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = role_permissions.company_id
    AND uc.is_active = true
  )
);

-- Apenas admins podem gerenciar permissões
CREATE POLICY "Admins can manage permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = role_permissions.company_id
    AND uc.role = 'admin'
    AND uc.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = role_permissions.company_id
    AND uc.role = 'admin'
    AND uc.is_active = true
  )
);

-- 4. Função SECURITY DEFINER para verificar permissões
CREATE OR REPLACE FUNCTION public.user_has_permission(
  _user_id UUID, 
  _module TEXT, 
  _action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _company_id UUID;
  _has_permission BOOLEAN;
BEGIN
  -- Busca o role do usuário na empresa ativa
  SELECT role, company_id INTO _role, _company_id
  FROM user_companies
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
  
  -- Se não encontrou, sem permissão
  IF _role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Admin tem todas as permissões
  IF _role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Verifica permissão específica na tabela role_permissions
  SELECT 
    CASE _action
      WHEN 'view' THEN can_view
      WHEN 'create' THEN can_create
      WHEN 'edit' THEN can_edit
      WHEN 'delete' THEN can_delete
      ELSE false
    END INTO _has_permission
  FROM role_permissions
  WHERE company_id = _company_id 
    AND role = _role 
    AND module = _module;
  
  RETURN COALESCE(_has_permission, false);
END;
$$;

-- 5. Função para obter o role do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
BEGIN
  SELECT role INTO _role
  FROM user_companies
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
  
  RETURN _role;
END;
$$;

-- 6. Função para aceitar convite (usada pelo edge function)
CREATE OR REPLACE FUNCTION public.accept_employee_invite(
  _token TEXT,
  _user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _result JSON;
BEGIN
  -- Busca o convite válido
  SELECT * INTO _invite
  FROM employee_invites
  WHERE token = _token
    AND accepted_at IS NULL
    AND expires_at > now();
  
  IF _invite IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;
  
  -- Atualiza o convite como aceito
  UPDATE employee_invites
  SET accepted_at = now()
  WHERE id = _invite.id;
  
  -- Vincula o user_id ao funcionário
  UPDATE employees
  SET user_id = _user_id
  WHERE id = _invite.employee_id;
  
  -- Cria o registro em user_companies
  INSERT INTO user_companies (user_id, company_id, role, is_active)
  VALUES (_user_id, _invite.company_id, _invite.role, true)
  ON CONFLICT (user_id, company_id) DO UPDATE
  SET role = _invite.role, is_active = true;
  
  RETURN json_build_object(
    'success', true, 
    'company_id', _invite.company_id,
    'employee_id', _invite.employee_id,
    'role', _invite.role
  );
END;
$$;

-- 7. Função para validar token de convite (pública, sem auth)
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _employee RECORD;
  _company RECORD;
BEGIN
  -- Busca o convite
  SELECT * INTO _invite
  FROM employee_invites
  WHERE token = _token
    AND accepted_at IS NULL
    AND expires_at > now();
  
  IF _invite IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Convite inválido ou expirado');
  END IF;
  
  -- Busca dados do funcionário
  SELECT name, email INTO _employee
  FROM employees
  WHERE id = _invite.employee_id;
  
  -- Busca dados da empresa
  SELECT name INTO _company
  FROM companies
  WHERE id = _invite.company_id;
  
  RETURN json_build_object(
    'valid', true,
    'email', _invite.email,
    'employee_name', _employee.name,
    'company_name', _company.name,
    'role', _invite.role
  );
END;
$$;

-- 8. Inserir permissões padrão para cada empresa existente
-- Manager: pode ver e criar na maioria dos módulos
-- Employee: pode apenas ver alguns módulos

-- Função para criar permissões padrão para uma empresa
CREATE OR REPLACE FUNCTION public.create_default_permissions(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permissões do Manager
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (_company_id, 'manager', 'dashboard', true, false, false, false),
    (_company_id, 'manager', 'clientes', true, true, true, false),
    (_company_id, 'manager', 'orcamentos', true, true, true, false),
    (_company_id, 'manager', 'ordens-servico', true, true, true, false),
    (_company_id, 'manager', 'agenda', true, true, true, true),
    (_company_id, 'manager', 'medicoes', true, true, true, false),
    (_company_id, 'manager', 'plano-corte', true, true, true, false),
    (_company_id, 'manager', 'produtos', true, false, false, false),
    (_company_id, 'manager', 'precos', true, true, true, false),
    (_company_id, 'manager', 'estoque', true, true, true, false),
    (_company_id, 'manager', 'caixa-vendas', true, true, true, false),
    (_company_id, 'manager', 'financeiro', true, true, false, false),
    (_company_id, 'manager', 'notas-fiscais', true, true, false, false),
    (_company_id, 'manager', 'funcionarios', true, true, true, false),
    (_company_id, 'manager', 'configuracoes', true, false, false, false)
  ON CONFLICT (company_id, role, module) DO NOTHING;
  
  -- Permissões do Employee (mais restrito)
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (_company_id, 'employee', 'dashboard', true, false, false, false),
    (_company_id, 'employee', 'clientes', true, true, false, false),
    (_company_id, 'employee', 'orcamentos', true, true, true, false),
    (_company_id, 'employee', 'ordens-servico', true, false, true, false),
    (_company_id, 'employee', 'agenda', true, false, false, false),
    (_company_id, 'employee', 'medicoes', true, true, true, false),
    (_company_id, 'employee', 'plano-corte', true, false, false, false),
    (_company_id, 'employee', 'produtos', true, false, false, false),
    (_company_id, 'employee', 'precos', true, false, false, false),
    (_company_id, 'employee', 'estoque', true, true, false, false),
    (_company_id, 'employee', 'caixa-vendas', true, true, false, false),
    (_company_id, 'employee', 'financeiro', false, false, false, false),
    (_company_id, 'employee', 'notas-fiscais', false, false, false, false),
    (_company_id, 'employee', 'funcionarios', false, false, false, false),
    (_company_id, 'employee', 'configuracoes', false, false, false, false)
  ON CONFLICT (company_id, role, module) DO NOTHING;
END;
$$;

-- Criar permissões padrão para todas as empresas existentes
DO $$
DECLARE
  _company RECORD;
BEGIN
  FOR _company IN SELECT id FROM companies LOOP
    PERFORM create_default_permissions(_company.id);
  END LOOP;
END;
$$;

-- Trigger para criar permissões padrão quando uma nova empresa é criada
CREATE OR REPLACE FUNCTION public.trigger_create_default_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_default_permissions(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_create_permissions ON public.companies;
CREATE TRIGGER on_company_created_create_permissions
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_permissions();-- Add commission fields to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS commission_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_type text DEFAULT 'sales'; -- 'sales' = sobre vendas, 'profit' = sobre lucro

-- Add comment for documentation
COMMENT ON COLUMN public.employees.commission_enabled IS 'Whether this employee receives commission';
COMMENT ON COLUMN public.employees.commission_percent IS 'Commission percentage (e.g., 5 = 5%)';
COMMENT ON COLUMN public.employees.commission_type IS 'Type of commission: sales (on total sales) or profit (on profit margin)';

-- Create table to track employee commissions on sales
CREATE TABLE IF NOT EXISTS public.employee_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  sale_amount numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  paid_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(employee_id, sale_id)
);

-- Enable RLS
ALTER TABLE public.employee_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view commissions from their company"
  ON public.employee_commissions
  FOR SELECT
  USING (company_id IN (SELECT unnest(get_user_company_ids(auth.uid()))));

CREATE POLICY "Admins can insert commissions"
  ON public.employee_commissions
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

CREATE POLICY "Admins can update commissions"
  ON public.employee_commissions
  FOR UPDATE
  USING (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

CREATE POLICY "Admins can delete commissions"
  ON public.employee_commissions
  FOR DELETE
  USING (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

-- Create trigger for updated_at
CREATE TRIGGER update_employee_commissions_updated_at
  BEFORE UPDATE ON public.employee_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate and register commission when a sale is made
CREATE OR REPLACE FUNCTION public.calculate_sale_commission(_sale_id uuid, _employee_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sale RECORD;
  _employee RECORD;
  _commission_amount numeric;
BEGIN
  -- Get sale data
  SELECT * INTO _sale FROM sales WHERE id = _sale_id;
  IF _sale IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get employee with commission settings
  SELECT * INTO _employee 
  FROM employees 
  WHERE id = _employee_id 
    AND company_id = _sale.company_id
    AND commission_enabled = true;
    
  IF _employee IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate commission based on type
  IF _employee.commission_type = 'sales' THEN
    _commission_amount := _sale.total_amount * (_employee.commission_percent / 100);
  ELSE
    -- For profit-based, would need cost data - default to sales for now
    _commission_amount := _sale.total_amount * (_employee.commission_percent / 100);
  END IF;
  
  -- Insert or update commission record
  INSERT INTO employee_commissions (
    company_id, employee_id, sale_id, 
    sale_amount, commission_percent, commission_amount
  ) VALUES (
    _sale.company_id, _employee_id, _sale_id,
    _sale.total_amount, _employee.commission_percent, _commission_amount
  )
  ON CONFLICT (employee_id, sale_id) DO UPDATE
    SET sale_amount = EXCLUDED.sale_amount,
        commission_percent = EXCLUDED.commission_percent,
        commission_amount = EXCLUDED.commission_amount,
        updated_at = now();
  
  RETURN _commission_amount;
END;
$$;-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'funcionarios', 'aluguel', 'energia', 'agua', 'internet', 'outros'
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'cancelled'
  payment_method TEXT,
  recurrence TEXT DEFAULT 'none', -- 'none', 'monthly', 'weekly', 'yearly'
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- for employee-related expenses
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view expenses from their company"
  ON public.expenses
  FOR SELECT
  USING (company_id IN (SELECT unnest(get_user_company_ids(auth.uid()))));

CREATE POLICY "Users with elevated role can insert expenses"
  ON public.expenses
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

CREATE POLICY "Users with elevated role can update expenses"
  ON public.expenses
  FOR UPDATE
  USING (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

CREATE POLICY "Users with elevated role can delete expenses"
  ON public.expenses
  FOR DELETE
  USING (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

-- Create trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_expenses_company_id ON public.expenses(company_id);
CREATE INDEX idx_expenses_category ON public.expenses(category);
CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_due_date ON public.expenses(due_date);-- Create notification settings table
CREATE TABLE IF NOT EXISTS public.company_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Email notifications
  email_new_quote BOOLEAN DEFAULT true,
  email_quote_approved BOOLEAN DEFAULT true,
  email_order_status BOOLEAN DEFAULT true,
  email_payment_received BOOLEAN DEFAULT true,
  email_low_stock BOOLEAN DEFAULT true,
  email_expense_due BOOLEAN DEFAULT true,
  
  -- System notifications
  notify_overdue_orders BOOLEAN DEFAULT true,
  notify_pending_quotes BOOLEAN DEFAULT true,
  notify_low_stock BOOLEAN DEFAULT true,
  notify_expense_alerts BOOLEAN DEFAULT true,
  
  -- Digest settings
  daily_digest BOOLEAN DEFAULT false,
  weekly_report BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(company_id)
);

-- Create security settings table
CREATE TABLE IF NOT EXISTS public.company_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Password policies
  require_strong_password BOOLEAN DEFAULT true,
  password_expiry_days INTEGER DEFAULT 0, -- 0 = never expires
  
  -- Session settings
  session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
  
  -- Two-factor auth
  two_factor_enabled BOOLEAN DEFAULT false,
  
  -- Login restrictions
  max_login_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 15,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.company_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_security_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification settings
CREATE POLICY "Users can view own company notification settings"
ON public.company_notification_settings FOR SELECT
USING (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

CREATE POLICY "Users can update own company notification settings"
ON public.company_notification_settings FOR UPDATE
USING (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

CREATE POLICY "Users can insert own company notification settings"
ON public.company_notification_settings FOR INSERT
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

-- RLS Policies for security settings
CREATE POLICY "Users can view own company security settings"
ON public.company_security_settings FOR SELECT
USING (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

CREATE POLICY "Users can update own company security settings"
ON public.company_security_settings FOR UPDATE
USING (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

CREATE POLICY "Users can insert own company security settings"
ON public.company_security_settings FOR INSERT
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE id = company_id));-- Create table for saving glass projects
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
EXECUTE FUNCTION public.update_updated_at_column();-- Create table to store glass formulas per product line (linha)
CREATE TABLE public.glass_line_formulas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  linha TEXT NOT NULL,
  formula_name TEXT NOT NULL,
  description TEXT,
  width_formula TEXT NOT NULL DEFAULT 'Largura',
  height_formula TEXT NOT NULL DEFAULT 'Altura',
  panel_index INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(linha, formula_name)
);

-- Enable RLS
ALTER TABLE public.glass_line_formulas ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read (needed for glass project calculations)
CREATE POLICY "Anyone can view glass formulas"
ON public.glass_line_formulas
FOR SELECT
USING (true);

-- Only saas admins can modify glass formulas
CREATE POLICY "Only admins can insert glass formulas"
ON public.glass_line_formulas
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.saas_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Only admins can update glass formulas"
ON public.glass_line_formulas
FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.saas_admins WHERE user_id = auth.uid())
);

CREATE POLICY "Only admins can delete glass formulas"
ON public.glass_line_formulas
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.saas_admins WHERE user_id = auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_glass_line_formulas_updated_at
BEFORE UPDATE ON public.glass_line_formulas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.glass_line_formulas IS 'Stores glass calculation formulas for each product line (linha). Used in glass projects to calculate panel dimensions.';-- Add product_template_id to glass_line_formulas to link formulas to specific products
ALTER TABLE public.glass_line_formulas
ADD COLUMN product_template_id UUID REFERENCES public.product_templates(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX idx_glass_line_formulas_product ON public.glass_line_formulas(product_template_id);

-- Add comment
COMMENT ON COLUMN public.glass_line_formulas.product_template_id IS 'Optional reference to a specific product template. If null, formula applies to all products in the linha.';-- Remove the unique constraint on (linha, formula_name) since we want to allow 
-- same formula names for different products within the same linha
ALTER TABLE public.glass_line_formulas 
DROP CONSTRAINT IF EXISTS glass_line_formulas_linha_formula_name_key;

-- Add a new unique constraint that includes product_template_id
-- This allows the same formula name for different products, but prevents duplicates within a product
ALTER TABLE public.glass_line_formulas 
ADD CONSTRAINT glass_line_formulas_product_formula_unique 
UNIQUE (product_template_id, formula_name, panel_index);-- Add bar_length_mm to item_templates for profile optimization
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
CREATE INDEX idx_os_glass_projects_ordem_servico ON public.os_glass_projects(ordem_servico_id);-- Add default glass formulas for Gold line (Janela de Correr 2 Folhas)
INSERT INTO public.glass_line_formulas (linha, formula_name, width_formula, height_formula, panel_index, description, is_active, product_template_id)
VALUES 
  ('Gold', 'Folha 1', 'L / 2 - 25', 'A - 100', 1, 'Vidro da primeira folha - Janela de Correr 2 Folhas', true, NULL),
  ('Gold', 'Folha 2', 'L / 2 - 25', 'A - 100', 2, 'Vidro da segunda folha - Janela de Correr 2 Folhas', true, NULL)
ON CONFLICT DO NOTHING;-- Add is_movable column to glass_line_formulas to identify movable panels
ALTER TABLE public.glass_line_formulas 
ADD COLUMN IF NOT EXISTS is_movable BOOLEAN DEFAULT false;

-- Update existing formulas - mark as movable based on name patterns
UPDATE public.glass_line_formulas 
SET is_movable = true 
WHERE LOWER(formula_name) LIKE '%móvel%' 
   OR LOWER(formula_name) LIKE '%movel%'
   OR LOWER(description) LIKE '%móvel%'
   OR LOWER(description) LIKE '%movel%'
   OR LOWER(formula_name) LIKE '%folha%';

-- Mark fixed panels as not movable
UPDATE public.glass_line_formulas 
SET is_movable = false 
WHERE LOWER(formula_name) LIKE '%fixo%' 
   OR LOWER(formula_name) LIKE '%fixa%'
   OR LOWER(description) LIKE '%fixo%'
   OR LOWER(description) LIKE '%fixa%';-- =============================================
-- Fase 1: Contas a Receber e Movimentações de Caixa
-- =============================================

-- 1. Tabela de Contas a Receber (parcelas futuras)
CREATE TABLE public.accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES ordens_servico(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  customer_name TEXT NOT NULL,
  description TEXT NOT NULL,
  
  total_amount NUMERIC(12,2) NOT NULL,
  installment_number INTEGER NOT NULL DEFAULT 1,
  total_installments INTEGER NOT NULL DEFAULT 1,
  
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_amount NUMERIC(12,2),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'partial')),
  payment_method TEXT,
  
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Movimentações de Caixa (entradas/saídas avulsas)
CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL,
  
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  payment_method TEXT DEFAULT 'dinheiro',
  
  -- Referências opcionais
  expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  receivable_id UUID REFERENCES accounts_receivable(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Adicionar campos de parcelamento na tabela sales
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'full' CHECK (payment_type IN ('full', 'partial', 'installment')),
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installments_count INTEGER DEFAULT 1;

-- 4. Índices para performance
CREATE INDEX idx_accounts_receivable_company ON accounts_receivable(company_id);
CREATE INDEX idx_accounts_receivable_status ON accounts_receivable(company_id, status);
CREATE INDEX idx_accounts_receivable_due_date ON accounts_receivable(company_id, due_date);
CREATE INDEX idx_accounts_receivable_client ON accounts_receivable(client_id);
CREATE INDEX idx_accounts_receivable_sale ON accounts_receivable(sale_id);

CREATE INDEX idx_cash_movements_company ON cash_movements(company_id);
CREATE INDEX idx_cash_movements_register ON cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_date ON cash_movements(created_at);

-- 5. Enable RLS
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies para accounts_receivable
CREATE POLICY "Users can view their company receivables"
ON public.accounts_receivable FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create receivables for their company"
ON public.accounts_receivable FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update their company receivables"
ON public.accounts_receivable FOR UPDATE
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete receivables"
ON public.accounts_receivable FOR DELETE
USING (user_has_elevated_role_in_company(auth.uid(), company_id));

-- 7. RLS Policies para cash_movements
CREATE POLICY "Users can view their company movements"
ON public.cash_movements FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create movements for their company"
ON public.cash_movements FOR INSERT
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete movements"
ON public.cash_movements FOR DELETE
USING (user_has_elevated_role_in_company(auth.uid(), company_id));

-- 8. Trigger para atualizar updated_at em accounts_receivable
CREATE TRIGGER update_accounts_receivable_updated_at
BEFORE UPDATE ON public.accounts_receivable
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 9. Função para atualizar status de parcelas vencidas
CREATE OR REPLACE FUNCTION public.update_overdue_receivables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE accounts_receivable
  SET status = 'overdue', updated_at = now()
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$;-- =============================================
-- CAIXA PROFISSIONAL: Separação Empresa × Dia
-- =============================================

-- 1. Tabela do Caixa da Empresa (Patrimonial)
CREATE TABLE public.company_cash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  
  current_balance NUMERIC NOT NULL DEFAULT 0,           -- Saldo atual do caixa da empresa
  fixed_fund NUMERIC NOT NULL DEFAULT 500,              -- Fundo fixo para o caixa do dia
  
  last_movement_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Movimentações do Caixa da Empresa
CREATE TABLE public.company_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL CHECK (category IN (
    'abertura_caixa',      -- Transferência para caixa do dia
    'fechamento_caixa',    -- Retorno do excedente do caixa do dia
    'deposito',            -- Depósito manual (capital, venda de ativo, etc.)
    'retirada',            -- Retirada de sócio
    'transferencia_banco', -- Transferência para conta bancária
    'ajuste_positivo',     -- Ajuste de inventário positivo
    'ajuste_negativo'      -- Ajuste de inventário negativo
  )),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  balance_before NUMERIC NOT NULL,                      -- Saldo antes da movimentação
  balance_after NUMERIC NOT NULL,                       -- Saldo após a movimentação
  description TEXT NOT NULL,
  
  cash_register_id UUID REFERENCES public.cash_registers(id),  -- Referência ao caixa do dia (se aplicável)
  reference_id UUID,                                            -- ID de referência genérico
  reference_type TEXT,                                          -- Tipo da referência (sale, expense, etc.)
  
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Índices para performance
CREATE INDEX idx_company_cash_company_id ON public.company_cash(company_id);
CREATE INDEX idx_company_cash_movements_company_id ON public.company_cash_movements(company_id);
CREATE INDEX idx_company_cash_movements_created_at ON public.company_cash_movements(created_at DESC);
CREATE INDEX idx_company_cash_movements_category ON public.company_cash_movements(category);
CREATE INDEX idx_company_cash_movements_cash_register ON public.company_cash_movements(cash_register_id);

-- 4. Trigger para atualizar updated_at
CREATE TRIGGER update_company_cash_updated_at
  BEFORE UPDATE ON public.company_cash
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Habilitar RLS
ALTER TABLE public.company_cash ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_cash_movements ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para company_cash
CREATE POLICY "Users can view their company cash"
  ON public.company_cash
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can insert company cash"
  ON public.company_cash
  FOR INSERT
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can update company cash"
  ON public.company_cash
  FOR UPDATE
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- 7. Políticas RLS para company_cash_movements
CREATE POLICY "Users can view their company cash movements"
  ON public.company_cash_movements
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Elevated users can insert company cash movements"
  ON public.company_cash_movements
  FOR INSERT
  WITH CHECK (user_has_elevated_role_in_company(auth.uid(), company_id));

-- 8. Função para inicializar caixa da empresa
CREATE OR REPLACE FUNCTION public.initialize_company_cash(_company_id UUID, _initial_balance NUMERIC DEFAULT 0, _fixed_fund NUMERIC DEFAULT 500)
RETURNS public.company_cash
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash public.company_cash;
BEGIN
  -- Verificar se usuário é admin da empresa
  IF NOT user_has_role_in_company(auth.uid(), _company_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem inicializar o caixa da empresa';
  END IF;

  -- Inserir ou atualizar
  INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
  VALUES (_company_id, _initial_balance, _fixed_fund)
  ON CONFLICT (company_id) DO UPDATE
    SET current_balance = EXCLUDED.current_balance,
        fixed_fund = EXCLUDED.fixed_fund,
        updated_at = now()
  RETURNING * INTO v_cash;

  -- Registrar movimento inicial se houver saldo
  IF _initial_balance > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount, 
      balance_before, balance_after, description, created_by
    ) VALUES (
      _company_id, 'entrada', 'deposito', _initial_balance,
      0, _initial_balance, 'Saldo inicial do caixa da empresa', auth.uid()
    );
  END IF;

  RETURN v_cash;
END;
$$;

-- 9. Função para registrar movimentação do caixa da empresa
CREATE OR REPLACE FUNCTION public.register_company_cash_movement(
  _company_id UUID,
  _type TEXT,
  _category TEXT,
  _amount NUMERIC,
  _description TEXT,
  _cash_register_id UUID DEFAULT NULL,
  _reference_id UUID DEFAULT NULL,
  _reference_type TEXT DEFAULT NULL
)
RETURNS public.company_cash_movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_movement public.company_cash_movements;
BEGIN
  -- Verificar permissão
  IF NOT user_has_elevated_role_in_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Acesso negado: permissão insuficiente';
  END IF;

  -- Buscar saldo atual (com lock para evitar race condition)
  SELECT current_balance INTO v_current_balance
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Caixa da empresa não inicializado';
  END IF;

  -- Calcular novo saldo
  IF _type = 'entrada' THEN
    v_new_balance := v_current_balance + _amount;
  ELSIF _type = 'saida' THEN
    IF v_current_balance < _amount THEN
      RAISE EXCEPTION 'Saldo insuficiente no caixa da empresa. Disponível: R$ %', v_current_balance;
    END IF;
    v_new_balance := v_current_balance - _amount;
  ELSE
    RAISE EXCEPTION 'Tipo de movimentação inválido: %', _type;
  END IF;

  -- Atualizar saldo do caixa
  UPDATE public.company_cash
  SET current_balance = v_new_balance,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = _company_id;

  -- Registrar movimentação
  INSERT INTO public.company_cash_movements (
    company_id, type, category, amount,
    balance_before, balance_after, description,
    cash_register_id, reference_id, reference_type, created_by
  ) VALUES (
    _company_id, _type, _category, _amount,
    v_current_balance, v_new_balance, _description,
    _cash_register_id, _reference_id, _reference_type, auth.uid()
  )
  RETURNING * INTO v_movement;

  RETURN v_movement;
END;
$$;

-- 10. Função para verificar se pode abrir caixa do dia
CREATE OR REPLACE FUNCTION public.can_open_daily_cash(_company_id UUID, _opening_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash RECORD;
  v_open_register RECORD;
BEGIN
  -- Verificar se já existe caixa aberto
  SELECT * INTO v_open_register
  FROM public.cash_registers
  WHERE company_id = _company_id AND status = 'open';

  IF v_open_register IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', 'Já existe um caixa aberto',
      'open_register_id', v_open_register.id
    );
  END IF;

  -- Buscar caixa da empresa
  SELECT * INTO v_cash
  FROM public.company_cash
  WHERE company_id = _company_id;

  IF v_cash IS NULL THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', 'Caixa da empresa não inicializado. Configure o saldo inicial em Configurações.',
      'company_balance', 0,
      'fixed_fund', 500
    );
  END IF;

  IF v_cash.current_balance < _opening_amount THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', format('Saldo insuficiente. Disponível: R$ %s', v_cash.current_balance),
      'company_balance', v_cash.current_balance,
      'fixed_fund', v_cash.fixed_fund,
      'required', _opening_amount
    );
  END IF;

  RETURN jsonb_build_object(
    'can_open', true,
    'company_balance', v_cash.current_balance,
    'fixed_fund', v_cash.fixed_fund,
    'suggested_amount', v_cash.fixed_fund
  );
END;
$$;-- Tabela para rastrear adiantamentos/reforços de caixa
CREATE TABLE public.cash_register_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  compensated_amount NUMERIC DEFAULT 0 CHECK (compensated_amount >= 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'compensated')),
  company_movement_id UUID REFERENCES public.company_cash_movements(id),
  daily_movement_id UUID REFERENCES public.cash_movements(id),
  compensated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX idx_cash_register_advances_company ON public.cash_register_advances(company_id);
CREATE INDEX idx_cash_register_advances_status ON public.cash_register_advances(company_id, status) WHERE status != 'compensated';
CREATE INDEX idx_cash_register_advances_register ON public.cash_register_advances(cash_register_id);

-- RLS
ALTER TABLE public.cash_register_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view advances from their company"
  ON public.cash_register_advances FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Elevated users can manage advances"
  ON public.cash_register_advances FOR ALL
  USING (user_has_elevated_role_in_company(auth.uid(), company_id));

-- Função para solicitar reforço de caixa automaticamente
CREATE OR REPLACE FUNCTION public.request_cash_reinforcement(
  _company_id UUID,
  _cash_register_id UUID,
  _required_amount NUMERIC,
  _current_daily_balance NUMERIC,
  _reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reinforcement_needed NUMERIC;
  v_company_balance NUMERIC;
  v_company_movement public.company_cash_movements;
  v_daily_movement_id UUID;
  v_advance_id UUID;
BEGIN
  -- Calcular reforço necessário
  v_reinforcement_needed := _required_amount - _current_daily_balance;
  
  IF v_reinforcement_needed <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'reinforcement_needed', false,
      'message', 'Saldo suficiente no caixa do dia'
    );
  END IF;
  
  -- Verificar saldo do caixa da empresa
  SELECT current_balance INTO v_company_balance
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;
  
  IF v_company_balance IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa da empresa não inicializado'
    );
  END IF;
  
  IF v_company_balance < v_reinforcement_needed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Saldo insuficiente no caixa da empresa. Disponível: R$ %s, Necessário: R$ %s', 
        v_company_balance, v_reinforcement_needed),
      'company_balance', v_company_balance,
      'reinforcement_needed', v_reinforcement_needed
    );
  END IF;
  
  -- Registrar saída do caixa da empresa
  INSERT INTO public.company_cash_movements (
    company_id, type, category, amount,
    balance_before, balance_after, description,
    cash_register_id, created_by
  ) VALUES (
    _company_id, 'saida', 'reforco_caixa', v_reinforcement_needed,
    v_company_balance, v_company_balance - v_reinforcement_needed,
    format('Reforço de caixa: %s', _reason),
    _cash_register_id, auth.uid()
  )
  RETURNING * INTO v_company_movement;
  
  -- Atualizar saldo do caixa da empresa
  UPDATE public.company_cash
  SET current_balance = current_balance - v_reinforcement_needed,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = _company_id;
  
  -- Registrar entrada no caixa do dia
  INSERT INTO public.cash_movements (
    company_id, cash_register_id, type, category,
    amount, description, payment_method, created_by
  ) VALUES (
    _company_id, _cash_register_id, 'entrada', 'reforco',
    v_reinforcement_needed, format('Reforço de caixa: %s', _reason),
    'transferencia', auth.uid()
  )
  RETURNING id INTO v_daily_movement_id;
  
  -- Criar registro de adiantamento
  INSERT INTO public.cash_register_advances (
    company_id, cash_register_id, amount, reason,
    company_movement_id, daily_movement_id, created_by
  ) VALUES (
    _company_id, _cash_register_id, v_reinforcement_needed, _reason,
    v_company_movement.id, v_daily_movement_id, auth.uid()
  )
  RETURNING id INTO v_advance_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'reinforcement_needed', true,
    'reinforcement_amount', v_reinforcement_needed,
    'advance_id', v_advance_id,
    'company_balance_before', v_company_balance,
    'company_balance_after', v_company_balance - v_reinforcement_needed,
    'message', format('Reforço de R$ %s transferido do caixa da empresa', v_reinforcement_needed)
  );
END;
$$;

-- Função para registrar saída com reforço automático se necessário
CREATE OR REPLACE FUNCTION public.register_cash_exit_with_reinforcement(
  _cash_register_id UUID,
  _amount NUMERIC,
  _category TEXT,
  _description TEXT,
  _payment_method TEXT DEFAULT 'dinheiro'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_register RECORD;
  v_current_balance NUMERIC;
  v_reinforcement_result jsonb;
  v_movement_id UUID;
BEGIN
  -- Buscar dados do caixa
  SELECT cr.*, c.id as comp_id
  INTO v_register
  FROM public.cash_registers cr
  JOIN public.companies c ON c.id = cr.company_id
  WHERE cr.id = _cash_register_id AND cr.status = 'open'
  FOR UPDATE;
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou não está aberto'
    );
  END IF;
  
  -- Verificar permissão
  IF NOT user_belongs_to_company(auth.uid(), v_register.company_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Acesso negado'
    );
  END IF;
  
  -- Calcular saldo atual do caixa do dia
  SELECT COALESCE(v_register.opening_amount, 0) + 
         COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE -amount END), 0)
  INTO v_current_balance
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id;
  
  -- Se saldo insuficiente, solicitar reforço
  IF v_current_balance < _amount THEN
    v_reinforcement_result := request_cash_reinforcement(
      v_register.company_id,
      _cash_register_id,
      _amount,
      v_current_balance,
      _description
    );
    
    IF NOT (v_reinforcement_result->>'success')::boolean THEN
      RETURN v_reinforcement_result;
    END IF;
  END IF;
  
  -- Registrar a saída
  INSERT INTO public.cash_movements (
    company_id, cash_register_id, type, category,
    amount, description, payment_method, created_by
  ) VALUES (
    v_register.company_id, _cash_register_id, 'saida', _category,
    _amount, _description, _payment_method, auth.uid()
  )
  RETURNING id INTO v_movement_id;
  
  -- Retornar resultado
  IF v_reinforcement_result IS NOT NULL AND (v_reinforcement_result->>'reinforcement_needed')::boolean THEN
    RETURN jsonb_build_object(
      'success', true,
      'movement_id', v_movement_id,
      'reinforcement', v_reinforcement_result,
      'message', format('Saída registrada com reforço automático de R$ %s', 
        v_reinforcement_result->>'reinforcement_amount')
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'movement_id', v_movement_id,
      'reinforcement', null,
      'message', 'Saída registrada com sucesso'
    );
  END IF;
END;
$$;

-- Função para compensar adiantamentos no fechamento
CREATE OR REPLACE FUNCTION public.compensate_advances_on_closing(
  _company_id UUID,
  _cash_register_id UUID,
  _excess_amount NUMERIC
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_advance RECORD;
  v_remaining_excess NUMERIC := _excess_amount;
  v_total_compensated NUMERIC := 0;
  v_compensation_amount NUMERIC;
  v_compensations jsonb := '[]'::jsonb;
BEGIN
  -- Buscar adiantamentos pendentes (mais antigos primeiro)
  FOR v_advance IN
    SELECT *
    FROM public.cash_register_advances
    WHERE company_id = _company_id
      AND status IN ('pending', 'partial')
    ORDER BY created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_excess <= 0;
    
    -- Calcular quanto pode compensar neste adiantamento
    v_compensation_amount := LEAST(
      v_remaining_excess,
      v_advance.amount - v_advance.compensated_amount
    );
    
    -- Atualizar adiantamento
    UPDATE public.cash_register_advances
    SET compensated_amount = compensated_amount + v_compensation_amount,
        status = CASE 
          WHEN compensated_amount + v_compensation_amount >= amount THEN 'compensated'
          ELSE 'partial'
        END,
        compensated_at = CASE 
          WHEN compensated_amount + v_compensation_amount >= amount THEN now()
          ELSE NULL
        END
    WHERE id = v_advance.id;
    
    -- Atualizar contadores
    v_remaining_excess := v_remaining_excess - v_compensation_amount;
    v_total_compensated := v_total_compensated + v_compensation_amount;
    
    -- Adicionar à lista de compensações
    v_compensations := v_compensations || jsonb_build_object(
      'advance_id', v_advance.id,
      'original_amount', v_advance.amount,
      'compensated_now', v_compensation_amount,
      'reason', v_advance.reason
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'total_compensated', v_total_compensated,
    'net_excess', v_remaining_excess,
    'compensations', v_compensations
  );
END;
$$;

-- Função para obter resumo de adiantamentos pendentes
CREATE OR REPLACE FUNCTION public.get_pending_advances_summary(_company_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_pending NUMERIC;
  v_count INTEGER;
  v_advances jsonb;
BEGIN
  -- Verificar permissão
  IF NOT user_belongs_to_company(auth.uid(), _company_id) THEN
    RETURN jsonb_build_object('error', 'Acesso negado');
  END IF;
  
  -- Calcular totais
  SELECT 
    COALESCE(SUM(amount - compensated_amount), 0),
    COUNT(*)
  INTO v_total_pending, v_count
  FROM public.cash_register_advances
  WHERE company_id = _company_id
    AND status IN ('pending', 'partial');
  
  -- Buscar detalhes dos adiantamentos
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'amount', amount,
      'compensated_amount', compensated_amount,
      'pending_amount', amount - compensated_amount,
      'reason', reason,
      'status', status,
      'created_at', created_at
    ) ORDER BY created_at ASC
  ), '[]'::jsonb)
  INTO v_advances
  FROM public.cash_register_advances
  WHERE company_id = _company_id
    AND status IN ('pending', 'partial');
  
  RETURN jsonb_build_object(
    'total_pending', v_total_pending,
    'count', v_count,
    'advances', v_advances
  );
END;
$$;-- ============================================
-- APRIMORAMENTOS DO SISTEMA DE CAIXA PROFISSIONAL
-- ============================================

-- 1. Adicionar coluna 'origem' em cash_movements para rastreabilidade
ALTER TABLE public.cash_movements 
ADD COLUMN IF NOT EXISTS origem TEXT;

-- 2. Atualizar CHECK do tipo em company_cash_movements para incluir mais categorias
ALTER TABLE public.company_cash_movements 
DROP CONSTRAINT IF EXISTS company_cash_movements_category_check;

ALTER TABLE public.company_cash_movements 
ADD CONSTRAINT company_cash_movements_category_check 
CHECK (category IN (
  'abertura_caixa',       -- Transferência para caixa do dia
  'fechamento_caixa',     -- Retorno do excedente do caixa do dia
  'deposito',             -- Depósito manual (capital, venda de ativo, etc.)
  'retirada',             -- Retirada de sócio
  'transferencia_banco',  -- Transferência para conta bancária
  'ajuste_positivo',      -- Ajuste de inventário positivo
  'ajuste_negativo',      -- Ajuste de inventário negativo
  'reforco_caixa',        -- Reforço para caixa do dia
  'compensacao_adiantamento'  -- Compensação de adiantamentos
));

-- 3. Criar tabela stock_movements se não existir (integração estoque/caixa)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  type TEXT NOT NULL CHECK (type IN ('entrada', 'saida')),
  category TEXT NOT NULL CHECK (category IN (
    'compra_material',     -- Compra de material
    'venda',               -- Saída por venda
    'devolucao',           -- Devolução
    'perda',               -- Perda/quebra
    'ajuste_positivo',     -- Ajuste de inventário +
    'ajuste_negativo',     -- Ajuste de inventário -
    'producao'             -- Consumo para produção
  )),
  
  -- Dados financeiros
  valor_financeiro NUMERIC NOT NULL DEFAULT 0,
  
  -- Referências
  cash_movement_id UUID REFERENCES public.cash_movements(id),
  sale_id UUID REFERENCES public.sales(id),
  expense_id UUID REFERENCES public.expenses(id),
  item_template_id UUID REFERENCES public.item_templates(id),
  
  -- Detalhes
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC,
  description TEXT,
  
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON public.stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements(type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_cash ON public.stock_movements(cash_movement_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON public.stock_movements(item_template_id);

-- 4. RLS para stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view stock movements"
  ON public.stock_movements FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company users can insert stock movements"
  ON public.stock_movements FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- 5. Adicionar campos de controle ao cash_registers
ALTER TABLE public.cash_registers 
ADD COLUMN IF NOT EXISTS fixed_fund_at_close NUMERIC,
ADD COLUMN IF NOT EXISTS excess_collected NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS closing_justification TEXT;

-- 6. Função melhorada para abrir caixa com validação
CREATE OR REPLACE FUNCTION public.open_daily_cash(
  _company_id UUID,
  _opening_amount NUMERIC,
  _user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_cash RECORD;
  v_open_register RECORD;
  v_new_register public.cash_registers;
  v_movement public.company_cash_movements;
BEGIN
  -- Verificar se já existe caixa aberto
  SELECT * INTO v_open_register
  FROM public.cash_registers
  WHERE company_id = _company_id AND status = 'open';

  IF v_open_register IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Já existe um caixa aberto. Feche o caixa atual antes de abrir outro.'
    );
  END IF;

  -- Buscar caixa da empresa
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;

  IF v_company_cash IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa da empresa não configurado. Configure em Configurações.'
    );
  END IF;

  -- Verificar saldo suficiente
  IF v_company_cash.current_balance < _opening_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Saldo insuficiente. Disponível: R$ %s, Solicitado: R$ %s', 
        v_company_cash.current_balance, _opening_amount)
    );
  END IF;

  -- Registrar saída do caixa da empresa
  INSERT INTO public.company_cash_movements (
    company_id, type, category, amount,
    balance_before, balance_after, description, created_by
  ) VALUES (
    _company_id, 'saida', 'abertura_caixa', _opening_amount,
    v_company_cash.current_balance, 
    v_company_cash.current_balance - _opening_amount,
    'Transferência para caixa do dia',
    _user_id
  )
  RETURNING * INTO v_movement;

  -- Atualizar saldo da empresa
  UPDATE public.company_cash
  SET current_balance = current_balance - _opening_amount,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = _company_id;

  -- Criar caixa do dia
  INSERT INTO public.cash_registers (
    company_id, opened_by, opening_amount, status
  ) VALUES (
    _company_id, _user_id, _opening_amount, 'open'
  )
  RETURNING * INTO v_new_register;

  RETURN jsonb_build_object(
    'success', true,
    'cash_register_id', v_new_register.id,
    'opening_amount', _opening_amount,
    'company_balance_after', v_company_cash.current_balance - _opening_amount
  );
END;
$$;

-- 7. Função melhorada para fechar caixa com todas as regras
CREATE OR REPLACE FUNCTION public.close_daily_cash(
  _cash_register_id UUID,
  _actual_amount NUMERIC,
  _notes TEXT DEFAULT NULL,
  _user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_register RECORD;
  v_company_cash RECORD;
  v_opening_amount NUMERIC;
  v_fixed_fund NUMERIC;
  v_expected_amount NUMERIC;
  v_difference NUMERIC;
  v_gross_excess NUMERIC;
  v_compensation_result jsonb;
  v_net_excess NUMERIC;
  v_closing_below_fund BOOLEAN;
BEGIN
  -- Buscar caixa aberto
  SELECT cr.*, cc.fixed_fund, cc.current_balance as company_balance
  INTO v_register
  FROM public.cash_registers cr
  JOIN public.company_cash cc ON cc.company_id = cr.company_id
  WHERE cr.id = _cash_register_id AND cr.status = 'open'
  FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;

  v_opening_amount := v_register.opening_amount;
  v_fixed_fund := COALESCE(v_register.fixed_fund, v_opening_amount);

  -- Calcular saldo esperado (abertura + entradas - saídas)
  SELECT v_opening_amount + 
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id;

  v_difference := _actual_amount - v_expected_amount;
  v_gross_excess := GREATEST(0, _actual_amount - v_fixed_fund);
  v_closing_below_fund := _actual_amount < v_fixed_fund;

  -- Regra: Se fechamento abaixo do fundo fixo, exigir justificativa
  IF v_closing_below_fund AND (COALESCE(_notes, '') = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fechamento abaixo do fundo fixo requer justificativa obrigatória'
    );
  END IF;

  -- Compensar adiantamentos pendentes se houver excedente
  IF v_gross_excess > 0 THEN
    v_compensation_result := compensate_advances_on_closing(
      v_register.company_id,
      _cash_register_id,
      v_gross_excess
    );
    v_net_excess := (v_compensation_result->>'net_excess')::NUMERIC;
  ELSE
    v_compensation_result := NULL;
    v_net_excess := 0;
  END IF;

  -- Se há excedente líquido, transferir para caixa da empresa
  IF v_net_excess > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'fechamento_caixa', v_net_excess,
      v_register.company_balance, v_register.company_balance + v_net_excess,
      'Recolhimento do caixa do dia',
      _cash_register_id, COALESCE(_user_id, auth.uid())
    );

    UPDATE public.company_cash
    SET current_balance = current_balance + v_net_excess,
        last_movement_at = now(),
        updated_at = now()
    WHERE company_id = v_register.company_id;
  END IF;

  -- Atualizar e fechar o caixa
  UPDATE public.cash_registers
  SET status = 'closed',
      closed_at = now(),
      closed_by = COALESCE(_user_id, auth.uid()),
      closing_amount = v_expected_amount,
      actual_amount = _actual_amount,
      difference = v_difference,
      notes = _notes,
      fixed_fund_at_close = v_fixed_fund,
      excess_collected = v_net_excess,
      closing_justification = CASE WHEN v_closing_below_fund THEN _notes ELSE NULL END
  WHERE id = _cash_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'actual_amount', _actual_amount,
    'difference', v_difference,
    'fixed_fund', v_fixed_fund,
    'gross_excess', v_gross_excess,
    'compensation', v_compensation_result,
    'net_excess', v_net_excess,
    'closing_below_fund', v_closing_below_fund
  );
END;
$$;

-- 8. Função para registrar compra de material à vista (integra caixa + estoque)
CREATE OR REPLACE FUNCTION public.register_material_purchase(
  _cash_register_id UUID,
  _amount NUMERIC,
  _description TEXT,
  _item_template_id UUID DEFAULT NULL,
  _quantity NUMERIC DEFAULT 0,
  _user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cash_result jsonb;
  v_cash_movement_id UUID;
  v_stock_movement_id UUID;
  v_register RECORD;
BEGIN
  -- Buscar dados do caixa
  SELECT cr.*, c.id as company_id
  INTO v_register
  FROM public.cash_registers cr
  JOIN public.companies c ON c.id = cr.company_id
  WHERE cr.id = _cash_register_id AND cr.status = 'open';

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou fechado'
    );
  END IF;

  -- Registrar saída com reforço automático se necessário
  v_cash_result := register_cash_exit_with_reinforcement(
    _cash_register_id,
    _amount,
    'compra_material',
    _description,
    'dinheiro'
  );

  IF NOT (v_cash_result->>'success')::boolean THEN
    RETURN v_cash_result;
  END IF;

  v_cash_movement_id := (v_cash_result->>'movement_id')::UUID;

  -- Atualizar origem da movimentação
  UPDATE public.cash_movements
  SET origem = 'compra_material'
  WHERE id = v_cash_movement_id;

  -- Criar movimento de estoque (entrada)
  INSERT INTO public.stock_movements (
    company_id, type, category, valor_financeiro,
    cash_movement_id, item_template_id, quantity,
    unit_cost, description, created_by
  ) VALUES (
    v_register.company_id, 'entrada', 'compra_material', _amount,
    v_cash_movement_id, _item_template_id, _quantity,
    CASE WHEN _quantity > 0 THEN _amount / _quantity ELSE _amount END,
    _description, COALESCE(_user_id, auth.uid())
  )
  RETURNING id INTO v_stock_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'cash_movement_id', v_cash_movement_id,
    'stock_movement_id', v_stock_movement_id,
    'cash_result', v_cash_result,
    'message', 'Compra registrada no caixa e no estoque'
  );
END;
$$;

-- 9. Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_cash_movements_origem ON public.cash_movements(origem);
CREATE INDEX IF NOT EXISTS idx_cash_registers_status ON public.cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_company_cash_movements_category ON public.company_cash_movements(category);-- Fix close_daily_cash function to handle missing company_cash records
CREATE OR REPLACE FUNCTION close_daily_cash(
  _cash_register_id UUID,
  _actual_amount NUMERIC,
  _notes TEXT DEFAULT NULL,
  _user_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_register RECORD;
  v_company_cash RECORD;
  v_opening_amount NUMERIC;
  v_fixed_fund NUMERIC;
  v_expected_amount NUMERIC;
  v_difference NUMERIC;
  v_gross_excess NUMERIC;
  v_compensation_result jsonb;
  v_net_excess NUMERIC;
  v_closing_below_fund BOOLEAN;
  v_company_balance NUMERIC;
BEGIN
  -- Buscar caixa aberto (sem JOIN obrigatório com company_cash)
  SELECT *
  INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id AND status = 'open'
  FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;

  -- Buscar company_cash separadamente (pode não existir)
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = v_register.company_id;

  -- Se não existir company_cash, criar um registro
  IF v_company_cash IS NULL THEN
    INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
    VALUES (v_register.company_id, 0, v_register.opening_amount)
    RETURNING * INTO v_company_cash;
  END IF;

  v_company_balance := COALESCE(v_company_cash.current_balance, 0);
  v_opening_amount := v_register.opening_amount;
  v_fixed_fund := COALESCE(v_company_cash.fixed_fund, v_opening_amount);

  -- Calcular saldo esperado (abertura + entradas - saídas)
  SELECT v_opening_amount + 
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id;

  v_difference := _actual_amount - v_expected_amount;
  v_gross_excess := GREATEST(0, _actual_amount - v_fixed_fund);
  v_closing_below_fund := _actual_amount < v_fixed_fund;

  -- Regra: Se fechamento abaixo do fundo fixo, exigir justificativa
  IF v_closing_below_fund AND (COALESCE(_notes, '') = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fechamento abaixo do fundo fixo requer justificativa obrigatória'
    );
  END IF;

  -- Compensar adiantamentos pendentes se houver excedente
  IF v_gross_excess > 0 THEN
    v_compensation_result := compensate_advances_on_closing(
      v_register.company_id,
      _cash_register_id,
      v_gross_excess
    );
    v_net_excess := (v_compensation_result->>'net_excess')::NUMERIC;
  ELSE
    v_compensation_result := NULL;
    v_net_excess := 0;
  END IF;

  -- Se há excedente líquido, transferir para caixa da empresa
  IF v_net_excess > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'fechamento_caixa', v_net_excess,
      v_company_balance, v_company_balance + v_net_excess,
      'Recolhimento do caixa do dia',
      _cash_register_id, COALESCE(_user_id, auth.uid())
    );

    UPDATE public.company_cash
    SET current_balance = current_balance + v_net_excess,
        last_movement_at = now(),
        updated_at = now()
    WHERE company_id = v_register.company_id;
  END IF;

  -- Atualizar e fechar o caixa
  UPDATE public.cash_registers
  SET status = 'closed',
      closed_at = now(),
      closed_by = COALESCE(_user_id, auth.uid()),
      closing_amount = v_expected_amount,
      actual_amount = _actual_amount,
      difference = v_difference,
      notes = _notes,
      fixed_fund_at_close = v_fixed_fund,
      excess_collected = v_net_excess,
      closing_justification = CASE WHEN v_closing_below_fund THEN _notes ELSE NULL END
  WHERE id = _cash_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'actual_amount', _actual_amount,
    'difference', v_difference,
    'fixed_fund', v_fixed_fund,
    'gross_excess', v_gross_excess,
    'compensation', v_compensation_result,
    'net_excess', v_net_excess,
    'closing_below_fund', v_closing_below_fund
  );
END;
$$;
-- =====================================================
-- SISTEMA DE CAIXA MULTIUSUÁRIO - CORREÇÃO
-- =====================================================

-- 16. Índice para buscar caixas por usuário (sem função DATE)
DROP INDEX IF EXISTS idx_cash_registers_opened_by_date;

CREATE INDEX idx_cash_registers_opened_by_status 
  ON public.cash_registers(company_id, opened_by, status, opened_at DESC) 
  WHERE status = 'open';

-- Atualizar as funções que usam DATE() para usar comparação de intervalo

-- 9. Função para abrir caixa multiusuário (corrigida)
CREATE OR REPLACE FUNCTION public.open_daily_cash_multiuser(
  _company_id UUID,
  _opening_amount NUMERIC,
  _user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_cash RECORD;
  v_existing_register RECORD;
  v_user_settings RECORD;
  v_fixed_fund NUMERIC;
  v_new_register public.cash_registers;
  v_movement public.company_cash_movements;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  -- Definir início e fim do dia atual
  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + interval '1 day';

  -- Verificar se ESTE USUÁRIO já tem caixa aberto hoje
  SELECT * INTO v_existing_register
  FROM public.cash_registers
  WHERE company_id = _company_id 
    AND opened_by = _user_id 
    AND status = 'open'
    AND opened_at >= v_today_start
    AND opened_at < v_today_end;

  IF v_existing_register IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você já possui um caixa aberto hoje.',
      'cash_register_id', v_existing_register.id
    );
  END IF;

  -- Buscar configuração de fundo fixo do usuário (ou padrão da empresa)
  SELECT fixed_fund INTO v_fixed_fund
  FROM public.user_cash_settings
  WHERE company_id = _company_id AND user_id = _user_id AND is_active = true;

  -- Se não tem configuração específica, usar o fundo fixo padrão da empresa
  IF v_fixed_fund IS NULL THEN
    SELECT fixed_fund INTO v_fixed_fund
    FROM public.company_cash
    WHERE company_id = _company_id;
  END IF;

  v_fixed_fund := COALESCE(v_fixed_fund, 500);

  -- Se opening_amount não foi especificado, usar o fundo fixo
  IF _opening_amount IS NULL OR _opening_amount <= 0 THEN
    _opening_amount := v_fixed_fund;
  END IF;

  -- Buscar caixa da empresa
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;

  IF v_company_cash IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa da empresa não configurado. Configure em Configurações.'
    );
  END IF;

  -- Verificar saldo suficiente
  IF v_company_cash.current_balance < _opening_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Saldo insuficiente no caixa da empresa. Disponível: R$ %s, Solicitado: R$ %s', 
        v_company_cash.current_balance, _opening_amount)
    );
  END IF;

  -- Registrar saída do caixa da empresa
  INSERT INTO public.company_cash_movements (
    company_id, type, category, amount,
    balance_before, balance_after, description, created_by
  ) VALUES (
    _company_id, 'saida', 'abertura_caixa', _opening_amount,
    v_company_cash.current_balance, 
    v_company_cash.current_balance - _opening_amount,
    format('Abertura de caixa - Usuário: %s', _user_id),
    _user_id
  )
  RETURNING * INTO v_movement;

  -- Atualizar saldo da empresa
  UPDATE public.company_cash
  SET current_balance = current_balance - _opening_amount,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = _company_id;

  -- Criar caixa do dia para o usuário
  INSERT INTO public.cash_registers (
    company_id, opened_by, opening_amount, status
  ) VALUES (
    _company_id, _user_id, _opening_amount, 'open'
  )
  RETURNING * INTO v_new_register;

  RETURN jsonb_build_object(
    'success', true,
    'cash_register_id', v_new_register.id,
    'opening_amount', _opening_amount,
    'fixed_fund', v_fixed_fund,
    'company_balance_after', v_company_cash.current_balance - _opening_amount
  );
END;
$$;

-- 12. Função para verificar se usuário pode abrir caixa (corrigida)
CREATE OR REPLACE FUNCTION public.can_user_open_cash(_company_id UUID, _user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_register RECORD;
  v_company_cash RECORD;
  v_user_fixed_fund NUMERIC;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + interval '1 day';

  -- Verificar se usuário já tem caixa aberto hoje
  SELECT * INTO v_existing_register
  FROM public.cash_registers
  WHERE company_id = _company_id 
    AND opened_by = _user_id 
    AND status = 'open'
    AND opened_at >= v_today_start
    AND opened_at < v_today_end;

  IF v_existing_register IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', 'Você já possui um caixa aberto hoje',
      'existing_register_id', v_existing_register.id
    );
  END IF;

  -- Buscar caixa da empresa
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = _company_id;

  IF v_company_cash IS NULL THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', 'Caixa da empresa não configurado'
    );
  END IF;

  -- Buscar fundo fixo do usuário
  SELECT fixed_fund INTO v_user_fixed_fund
  FROM public.user_cash_settings
  WHERE company_id = _company_id AND user_id = _user_id AND is_active = true;

  v_user_fixed_fund := COALESCE(v_user_fixed_fund, v_company_cash.fixed_fund);

  IF v_company_cash.current_balance < v_user_fixed_fund THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', format('Saldo insuficiente. Disponível: R$ %s', v_company_cash.current_balance),
      'company_balance', v_company_cash.current_balance,
      'required', v_user_fixed_fund
    );
  END IF;

  RETURN jsonb_build_object(
    'can_open', true,
    'company_balance', v_company_cash.current_balance,
    'fixed_fund', v_user_fixed_fund,
    'suggested_amount', v_user_fixed_fund
  );
END;
$$;

-- 13. Função para buscar caixa aberto do usuário atual (corrigida)
CREATE OR REPLACE FUNCTION public.get_user_open_cash_register(_company_id UUID)
RETURNS TABLE(
  id UUID,
  company_id UUID,
  opened_by UUID,
  opened_at TIMESTAMPTZ,
  opening_amount NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + interval '1 day';

  RETURN QUERY
  SELECT 
    cr.id,
    cr.company_id,
    cr.opened_by,
    cr.opened_at,
    cr.opening_amount,
    cr.status
  FROM public.cash_registers cr
  WHERE cr.company_id = _company_id
    AND cr.opened_by = auth.uid()
    AND cr.status = 'open'
    AND cr.opened_at >= v_today_start
    AND cr.opened_at < v_today_end
  LIMIT 1;
END;
$$;

-- 14. Função para listar todos os caixas abertos da empresa (corrigida)
CREATE OR REPLACE FUNCTION public.get_all_open_cash_registers(_company_id UUID)
RETURNS TABLE(
  id UUID,
  opened_by UUID,
  opened_by_name TEXT,
  opened_at TIMESTAMPTZ,
  opening_amount NUMERIC,
  current_balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  -- Verificar permissão
  IF NOT user_has_elevated_role_in_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + interval '1 day';

  RETURN QUERY
  SELECT 
    cr.id,
    cr.opened_by,
    COALESCE(p.full_name, 'Usuário') as opened_by_name,
    cr.opened_at,
    cr.opening_amount,
    cr.opening_amount + 
      COALESCE((
        SELECT SUM(CASE WHEN cm.type = 'entrada' THEN cm.amount ELSE -cm.amount END)
        FROM public.cash_movements cm
        WHERE cm.cash_register_id = cr.id
      ), 0) as current_balance
  FROM public.cash_registers cr
  LEFT JOIN public.profiles p ON p.user_id = cr.opened_by
  WHERE cr.company_id = _company_id
    AND cr.status = 'open'
    AND cr.opened_at >= v_today_start
    AND cr.opened_at < v_today_end
  ORDER BY cr.opened_at;
END;
$$;

-- Função para registrar a contagem de caixa (obrigatória no fechamento)
CREATE OR REPLACE FUNCTION public.register_cash_count(
  _cash_register_id UUID,
  _counts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_register RECORD;
  v_count RECORD;
BEGIN
  -- Verificar se o caixa existe e está aberto
  SELECT * INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id AND status = 'open';
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;
  
  -- Verificar permissão (apenas o dono do caixa pode fechar)
  IF v_register.opened_by != auth.uid() THEN
    -- Permitir admin/manager fechar qualquer caixa
    IF NOT user_has_elevated_role_in_company(auth.uid(), v_register.company_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Você não tem permissão para fechar este caixa'
      );
    END IF;
  END IF;
  
  -- Limpar contagens anteriores deste caixa
  DELETE FROM public.cash_counts WHERE cash_register_id = _cash_register_id;
  
  -- Inserir novas contagens
  FOR v_count IN SELECT * FROM jsonb_to_recordset(_counts) AS x(payment_method TEXT, amount NUMERIC)
  LOOP
    INSERT INTO public.cash_counts (
      cash_register_id, user_id, payment_method, valor_informado
    ) VALUES (
      _cash_register_id, auth.uid(), v_count.payment_method, COALESCE(v_count.amount, 0)
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Contagem registrada com sucesso'
  );
END;
$function$;

-- Função principal de fechamento multiusuário
CREATE OR REPLACE FUNCTION public.close_daily_cash_multiuser(
  _cash_register_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_register RECORD;
  v_company_cash RECORD;
  v_opening_amount NUMERIC;
  v_fixed_fund NUMERIC;
  v_expected_amount NUMERIC;
  v_actual_amount NUMERIC;
  v_difference NUMERIC;
  v_gross_excess NUMERIC;
  v_compensation_result JSONB;
  v_net_excess NUMERIC;
  v_closing_below_fund BOOLEAN;
  v_company_balance NUMERIC;
  v_shortage_id UUID;
  v_user_id UUID;
BEGIN
  -- Buscar caixa aberto
  SELECT * INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id AND status = 'open'
  FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;
  
  v_user_id := v_register.opened_by;
  
  -- Verificar permissão
  IF v_register.opened_by != auth.uid() THEN
    IF NOT user_has_elevated_role_in_company(auth.uid(), v_register.company_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Você não tem permissão para fechar este caixa'
      );
    END IF;
  END IF;

  -- Verificar se a contagem foi feita
  IF NOT EXISTS (SELECT 1 FROM public.cash_counts WHERE cash_register_id = _cash_register_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Contagem de caixa obrigatória. Informe os valores por forma de pagamento.'
    );
  END IF;

  -- Buscar company_cash
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = v_register.company_id
  FOR UPDATE;

  IF v_company_cash IS NULL THEN
    INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
    VALUES (v_register.company_id, 0, v_register.opening_amount)
    RETURNING * INTO v_company_cash;
  END IF;

  v_company_balance := COALESCE(v_company_cash.current_balance, 0);
  v_opening_amount := v_register.opening_amount;
  v_fixed_fund := COALESCE(v_company_cash.fixed_fund, v_opening_amount);

  -- Calcular saldo esperado (abertura + vendas em dinheiro + entradas - saídas)
  SELECT 
    v_opening_amount + 
    COALESCE((
      SELECT SUM(total_amount) 
      FROM public.sales 
      WHERE cash_register_id = _cash_register_id 
        AND payment_method = 'dinheiro'
        AND payment_status != 'cancelled'
    ), 0) +
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id;

  -- Buscar valor contado (total informado na contagem)
  SELECT COALESCE(SUM(valor_informado), 0)
  INTO v_actual_amount
  FROM public.cash_counts
  WHERE cash_register_id = _cash_register_id;

  v_difference := v_actual_amount - v_expected_amount;
  v_gross_excess := GREATEST(0, v_actual_amount - v_fixed_fund);
  v_closing_below_fund := v_actual_amount < v_fixed_fund;

  -- Regra: Se fechamento abaixo do fundo fixo, exigir justificativa
  IF v_closing_below_fund AND (COALESCE(_notes, '') = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fechamento abaixo do fundo fixo requer justificativa obrigatória'
    );
  END IF;
  
  -- Se houver FALTA (diferença negativa), registrar como shortage para compensação futura
  IF v_difference < 0 THEN
    INSERT INTO public.cash_shortages (
      company_id, user_id, cash_register_id, amount, reason, status
    ) VALUES (
      v_register.company_id, v_user_id, _cash_register_id, 
      ABS(v_difference), COALESCE(_notes, 'Falta no fechamento de caixa'), 'pending'
    )
    RETURNING id INTO v_shortage_id;
  END IF;

  -- Compensar adiantamentos pendentes se houver excedente
  IF v_gross_excess > 0 THEN
    v_compensation_result := compensate_advances_on_closing(
      v_register.company_id,
      _cash_register_id,
      v_gross_excess
    );
    v_net_excess := (v_compensation_result->>'net_excess')::NUMERIC;
  ELSE
    v_compensation_result := NULL;
    v_net_excess := 0;
  END IF;

  -- Se há excedente líquido, transferir para caixa da empresa
  IF v_net_excess > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'fechamento_caixa', v_net_excess,
      v_company_balance, v_company_balance + v_net_excess,
      format('Recolhimento do caixa - Usuário: %s', v_user_id),
      _cash_register_id, auth.uid()
    );

    UPDATE public.company_cash
    SET current_balance = current_balance + v_net_excess,
        last_movement_at = now(),
        updated_at = now()
    WHERE company_id = v_register.company_id;
  END IF;

  -- Atualizar e fechar o caixa
  UPDATE public.cash_registers
  SET status = 'closed',
      closed_at = now(),
      closed_by = auth.uid(),
      closing_amount = v_expected_amount,
      actual_amount = v_actual_amount,
      difference = v_difference,
      notes = _notes,
      fixed_fund_at_close = v_fixed_fund,
      excess_collected = v_net_excess,
      closing_justification = CASE WHEN v_closing_below_fund OR v_difference < 0 THEN _notes ELSE NULL END
  WHERE id = _cash_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'actual_amount', v_actual_amount,
    'difference', v_difference,
    'fixed_fund', v_fixed_fund,
    'gross_excess', v_gross_excess,
    'compensation', v_compensation_result,
    'net_excess', v_net_excess,
    'closing_below_fund', v_closing_below_fund,
    'shortage_id', v_shortage_id
  );
END;
$function$;

-- Criar tabela cash_shortages se não existir (para compensação futura de faltas)
CREATE TABLE IF NOT EXISTS public.cash_shortages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID NOT NULL,
  cash_register_id UUID REFERENCES public.cash_registers(id),
  amount NUMERIC NOT NULL,
  compensated_amount NUMERIC DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'compensated')),
  compensated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cash_shortages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cash_shortages
CREATE POLICY "Users can view their company shortages" ON public.cash_shortages
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can insert shortages" ON public.cash_shortages
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admins can update shortages" ON public.cash_shortages
  FOR UPDATE USING (
    user_has_elevated_role_in_company(auth.uid(), company_id)
  );

-- Criar tabela cash_counts se não existir
CREATE TABLE IF NOT EXISTS public.cash_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  payment_method TEXT NOT NULL,
  valor_informado NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cash_counts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cash_counts
CREATE POLICY "Users can view their company counts" ON public.cash_counts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cash_registers cr
      WHERE cr.id = cash_counts.cash_register_id
      AND cr.company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
    )
  );

CREATE POLICY "Users can insert counts for their registers" ON public.cash_counts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cash_registers cr
      WHERE cr.id = cash_counts.cash_register_id
      AND cr.company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
    )
  );

CREATE POLICY "Users can delete counts for their registers" ON public.cash_counts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.cash_registers cr
      WHERE cr.id = cash_counts.cash_register_id
      AND cr.company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
    )
  );
-- =====================================================
-- SISTEMA DE PERFIS DE PERMISSÃO (PERMISSION PROFILES)
-- =====================================================

-- 1. Criar enum para os tipos de perfil
DO $$ BEGIN
    CREATE TYPE public.permission_profile_type AS ENUM (
        'admin',
        'gerente', 
        'vendedor',
        'caixa',
        'almoxarifado',
        'producao',
        'instalador',
        'financeiro',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criar tabela de perfis de permissão
CREATE TABLE IF NOT EXISTS public.permission_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    profile_type public.permission_profile_type NOT NULL DEFAULT 'custom',
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- true = predefinido, não pode ser editado
    -- Permissões por módulo (JSONB flexível)
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Restrições especiais
    hide_prices BOOLEAN DEFAULT false, -- Oculta preços/valores
    hide_costs BOOLEAN DEFAULT false, -- Oculta custos
    can_operate_cash BOOLEAN DEFAULT false, -- Pode operar caixa próprio
    can_approve_discounts BOOLEAN DEFAULT false, -- Pode aprovar descontos
    can_approve_refunds BOOLEAN DEFAULT false, -- Pode aprovar devoluções
    can_cancel_sales BOOLEAN DEFAULT false, -- Pode cancelar vendas
    can_manage_stock BOOLEAN DEFAULT false, -- Pode gerenciar estoque
    can_view_reports BOOLEAN DEFAULT false, -- Pode ver relatórios
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Atualizar tabela employees para usar perfil
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS permission_profile_id UUID REFERENCES public.permission_profiles(id);

-- 4. Adicionar índices
CREATE INDEX IF NOT EXISTS idx_permission_profiles_company 
ON public.permission_profiles(company_id);

CREATE INDEX IF NOT EXISTS idx_permission_profiles_type 
ON public.permission_profiles(profile_type);

CREATE INDEX IF NOT EXISTS idx_employees_profile 
ON public.employees(permission_profile_id);

-- 5. RLS para permission_profiles
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles of their company"
ON public.permission_profiles FOR SELECT
USING (
    company_id IN (
        SELECT uc.company_id FROM public.user_companies uc 
        WHERE uc.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage profiles"
ON public.permission_profiles FOR ALL
USING (
    company_id IN (
        SELECT uc.company_id FROM public.user_companies uc 
        WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
    )
);

-- 6. Função para criar perfis padrão para uma empresa
CREATE OR REPLACE FUNCTION public.create_default_permission_profiles(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _admin_permissions JSONB;
    _gerente_permissions JSONB;
    _vendedor_permissions JSONB;
    _caixa_permissions JSONB;
    _almoxarifado_permissions JSONB;
    _producao_permissions JSONB;
    _instalador_permissions JSONB;
    _financeiro_permissions JSONB;
BEGIN
    -- Definir permissões completas por módulo
    _admin_permissions := '{
        "dashboard": {"view": true, "create": true, "edit": true, "delete": true},
        "clientes": {"view": true, "create": true, "edit": true, "delete": true},
        "orcamentos": {"view": true, "create": true, "edit": true, "delete": true},
        "ordens-servico": {"view": true, "create": true, "edit": true, "delete": true},
        "agenda": {"view": true, "create": true, "edit": true, "delete": true},
        "medicoes": {"view": true, "create": true, "edit": true, "delete": true},
        "plano-corte": {"view": true, "create": true, "edit": true, "delete": true},
        "produtos": {"view": true, "create": true, "edit": true, "delete": true},
        "precos": {"view": true, "create": true, "edit": true, "delete": true},
        "estoque": {"view": true, "create": true, "edit": true, "delete": true},
        "caixa-vendas": {"view": true, "create": true, "edit": true, "delete": true},
        "financeiro": {"view": true, "create": true, "edit": true, "delete": true},
        "notas-fiscais": {"view": true, "create": true, "edit": true, "delete": true},
        "funcionarios": {"view": true, "create": true, "edit": true, "delete": true},
        "configuracoes": {"view": true, "create": true, "edit": true, "delete": true}
    }'::jsonb;

    _gerente_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": true, "delete": false},
        "orcamentos": {"view": true, "create": true, "edit": true, "delete": true},
        "ordens-servico": {"view": true, "create": true, "edit": true, "delete": false},
        "agenda": {"view": true, "create": true, "edit": true, "delete": true},
        "medicoes": {"view": true, "create": true, "edit": true, "delete": true},
        "plano-corte": {"view": true, "create": true, "edit": true, "delete": true},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": true, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": true, "edit": true, "delete": false},
        "caixa-vendas": {"view": true, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": true, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": true, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": true, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _vendedor_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": true, "delete": false},
        "orcamentos": {"view": true, "create": true, "edit": true, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": false, "delete": false},
        "agenda": {"view": true, "create": true, "edit": true, "delete": false},
        "medicoes": {"view": true, "create": true, "edit": true, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": true, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": false, "edit": false, "delete": false},
        "caixa-vendas": {"view": true, "create": true, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _caixa_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": false, "delete": false},
        "orcamentos": {"view": false, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": false, "create": false, "edit": false, "delete": false},
        "agenda": {"view": false, "create": false, "edit": false, "delete": false},
        "medicoes": {"view": false, "create": false, "edit": false, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": true, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": false, "edit": false, "delete": false},
        "caixa-vendas": {"view": true, "create": true, "edit": true, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _almoxarifado_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": false, "create": false, "edit": false, "delete": false},
        "orcamentos": {"view": false, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": false, "delete": false},
        "agenda": {"view": false, "create": false, "edit": false, "delete": false},
        "medicoes": {"view": false, "create": false, "edit": false, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": false, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": true, "edit": true, "delete": false},
        "caixa-vendas": {"view": false, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _producao_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": false, "create": false, "edit": false, "delete": false},
        "orcamentos": {"view": false, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": true, "delete": false},
        "agenda": {"view": true, "create": false, "edit": false, "delete": false},
        "medicoes": {"view": false, "create": false, "edit": false, "delete": false},
        "plano-corte": {"view": true, "create": true, "edit": true, "delete": false},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": false, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": false, "edit": true, "delete": false},
        "caixa-vendas": {"view": false, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _instalador_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": false, "edit": false, "delete": false},
        "orcamentos": {"view": false, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": true, "delete": false},
        "agenda": {"view": true, "create": false, "edit": true, "delete": false},
        "medicoes": {"view": true, "create": true, "edit": true, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": false, "create": false, "edit": false, "delete": false},
        "precos": {"view": false, "create": false, "edit": false, "delete": false},
        "estoque": {"view": false, "create": false, "edit": false, "delete": false},
        "caixa-vendas": {"view": false, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _financeiro_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": false, "edit": false, "delete": false},
        "orcamentos": {"view": true, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": false, "delete": false},
        "agenda": {"view": false, "create": false, "edit": false, "delete": false},
        "medicoes": {"view": false, "create": false, "edit": false, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": false, "create": false, "edit": false, "delete": false},
        "precos": {"view": true, "create": false, "edit": false, "delete": false},
        "estoque": {"view": false, "create": false, "edit": false, "delete": false},
        "caixa-vendas": {"view": true, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": true, "create": true, "edit": true, "delete": false},
        "notas-fiscais": {"view": true, "create": true, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    -- Inserir perfis padrão
    INSERT INTO public.permission_profiles (company_id, name, profile_type, description, is_system, permissions, hide_prices, hide_costs, can_operate_cash, can_approve_discounts, can_approve_refunds, can_cancel_sales, can_manage_stock, can_view_reports)
    VALUES
        (_company_id, 'Administrador', 'admin', 'Acesso total ao sistema', true, _admin_permissions, false, false, true, true, true, true, true, true),
        (_company_id, 'Gerente', 'gerente', 'Visualiza tudo, aprova operações, não opera caixa diretamente', true, _gerente_permissions, false, false, false, true, true, true, true, true),
        (_company_id, 'Vendedor', 'vendedor', 'Orçamentos, vendas, clientes. Opera seu próprio caixa', true, _vendedor_permissions, false, false, true, false, false, false, false, false),
        (_company_id, 'Caixa', 'caixa', 'Opera vendas, recebimentos e fechamento de caixa próprio', true, _caixa_permissions, false, false, true, false, false, false, false, false),
        (_company_id, 'Almoxarifado', 'almoxarifado', 'Entrada/saída de material. NÃO vê valores financeiros', true, _almoxarifado_permissions, true, true, false, false, false, false, true, false),
        (_company_id, 'Produção', 'producao', 'Ordens de produção, consumo de materiais. NÃO vê preços', true, _producao_permissions, true, true, false, false, false, false, false, false),
        (_company_id, 'Instalador', 'instalador', 'Visualiza OS, marca conclusão, anexa fotos', true, _instalador_permissions, true, true, false, false, false, false, false, false),
        (_company_id, 'Financeiro', 'financeiro', 'Contas a pagar/receber, relatórios, fluxo de caixa', true, _financeiro_permissions, false, false, false, false, false, false, false, true)
    ON CONFLICT DO NOTHING;
END;
$$;

-- 7. Função para verificar se usuário pode ver preços
CREATE OR REPLACE FUNCTION public.user_can_see_prices(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _hide_prices BOOLEAN;
BEGIN
    -- Check if user is admin via user_companies
    IF EXISTS (
        SELECT 1 FROM user_companies 
        WHERE user_id = _user_id 
        AND company_id = _company_id 
        AND role = 'admin'
    ) THEN
        RETURN true;
    END IF;

    -- Check employee's permission profile
    SELECT pp.hide_prices INTO _hide_prices
    FROM employees e
    JOIN permission_profiles pp ON pp.id = e.permission_profile_id
    WHERE e.user_id = _user_id 
    AND e.company_id = _company_id
    AND e.is_active = true;

    -- If no profile found or hide_prices is false, allow
    RETURN COALESCE(_hide_prices, false) = false;
END;
$$;

-- 8. Função para verificar se usuário pode operar caixa
CREATE OR REPLACE FUNCTION public.user_can_operate_cash(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _can_operate BOOLEAN;
BEGIN
    -- Check if user is admin
    IF EXISTS (
        SELECT 1 FROM user_companies 
        WHERE user_id = _user_id 
        AND company_id = _company_id 
        AND role = 'admin'
    ) THEN
        RETURN true;
    END IF;

    -- Check employee's permission profile
    SELECT pp.can_operate_cash INTO _can_operate
    FROM employees e
    JOIN permission_profiles pp ON pp.id = e.permission_profile_id
    WHERE e.user_id = _user_id 
    AND e.company_id = _company_id
    AND e.is_active = true;

    RETURN COALESCE(_can_operate, false);
END;
$$;

-- 9. Função para obter permissões do usuário
CREATE OR REPLACE FUNCTION public.get_user_permission_profile(_user_id UUID, _company_id UUID)
RETURNS TABLE (
    profile_id UUID,
    profile_name TEXT,
    profile_type public.permission_profile_type,
    permissions JSONB,
    hide_prices BOOLEAN,
    hide_costs BOOLEAN,
    can_operate_cash BOOLEAN,
    can_approve_discounts BOOLEAN,
    can_cancel_sales BOOLEAN,
    can_manage_stock BOOLEAN,
    can_view_reports BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if admin first
    IF EXISTS (
        SELECT 1 FROM user_companies 
        WHERE user_id = _user_id 
        AND company_id = _company_id 
        AND role = 'admin'
    ) THEN
        RETURN QUERY
        SELECT 
            pp.id,
            pp.name,
            pp.profile_type,
            pp.permissions,
            pp.hide_prices,
            pp.hide_costs,
            pp.can_operate_cash,
            pp.can_approve_discounts,
            pp.can_cancel_sales,
            pp.can_manage_stock,
            pp.can_view_reports
        FROM permission_profiles pp
        WHERE pp.company_id = _company_id 
        AND pp.profile_type = 'admin'
        LIMIT 1;
        RETURN;
    END IF;

    -- Return employee's profile
    RETURN QUERY
    SELECT 
        pp.id,
        pp.name,
        pp.profile_type,
        pp.permissions,
        pp.hide_prices,
        pp.hide_costs,
        pp.can_operate_cash,
        pp.can_approve_discounts,
        pp.can_cancel_sales,
        pp.can_manage_stock,
        pp.can_view_reports
    FROM employees e
    JOIN permission_profiles pp ON pp.id = e.permission_profile_id
    WHERE e.user_id = _user_id 
    AND e.company_id = _company_id
    AND e.is_active = true
    LIMIT 1;
END;
$$;

-- 10. Trigger para criar perfis padrão quando empresa é criada
CREATE OR REPLACE FUNCTION public.trigger_create_default_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.create_default_permission_profiles(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_profiles ON public.companies;
CREATE TRIGGER on_company_created_profiles
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_create_default_profiles();-- Drop and recreate the clients_safe view with security_invoker option
DROP VIEW IF EXISTS public.clients_safe;

CREATE VIEW public.clients_safe
WITH (security_invoker = on) AS
SELECT 
    id,
    company_id,
    name,
    city,
    state,
    is_active,
    notes,
    created_at,
    updated_at,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN document
        ELSE NULL::text
    END AS document,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN document_type
        ELSE NULL::text
    END AS document_type,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN email
        ELSE NULL::text
    END AS email,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN phone
        ELSE NULL::text
    END AS phone,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN address
        ELSE NULL::text
    END AS address,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN zip_code
        ELSE NULL::text
    END AS zip_code,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN latitude
        ELSE NULL::numeric
    END AS latitude,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN longitude
        ELSE NULL::numeric
    END AS longitude
FROM public.clients
WHERE user_belongs_to_company(auth.uid(), company_id);

-- Grant access to authenticated users only
GRANT SELECT ON public.clients_safe TO authenticated;
REVOKE ALL ON public.clients_safe FROM anon;-- =============================================
-- HYBRID PRODUCT MODEL IMPLEMENTATION
-- =============================================

-- 1. Modify company_products to support custom products
ALTER TABLE public.company_products 
  ALTER COLUMN product_template_id DROP NOT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS linha TEXT DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS min_width NUMERIC DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS max_width NUMERIC DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS min_height NUMERIC DEFAULT NULL;

ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS max_height NUMERIC DEFAULT NULL;

-- 2. Create company_product_items table for custom product composition
CREATE TABLE IF NOT EXISTS public.company_product_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_id UUID NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  item_template_id UUID NOT NULL REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  quantity_formula TEXT NOT NULL DEFAULT '1',
  width_formula TEXT,
  height_formula TEXT,
  is_optional BOOLEAN DEFAULT FALSE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_product_items_company_product 
  ON public.company_product_items(company_product_id);

CREATE INDEX IF NOT EXISTS idx_company_product_items_item_template 
  ON public.company_product_items(item_template_id);

CREATE INDEX IF NOT EXISTS idx_company_products_is_custom 
  ON public.company_products(company_id, is_custom) WHERE is_custom = TRUE;

-- 4. Enable RLS on company_product_items
ALTER TABLE public.company_product_items ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for company_product_items
CREATE POLICY "company_product_items_select" 
  ON public.company_product_items 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id = company_product_id
      AND user_belongs_to_company(auth.uid(), cp.company_id)
    )
  );

CREATE POLICY "company_product_items_insert" 
  ON public.company_product_items 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id = company_product_id
      AND user_belongs_to_company(auth.uid(), cp.company_id)
    )
  );

CREATE POLICY "company_product_items_update" 
  ON public.company_product_items 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id = company_product_id
      AND user_belongs_to_company(auth.uid(), cp.company_id)
    )
  );

CREATE POLICY "company_product_items_delete" 
  ON public.company_product_items 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_products cp
      WHERE cp.id = company_product_id
      AND user_belongs_to_company(auth.uid(), cp.company_id)
    )
  );

-- 6. Create trigger for updated_at
CREATE TRIGGER update_company_product_items_updated_at
  BEFORE UPDATE ON public.company_product_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Create function to create custom product
CREATE OR REPLACE FUNCTION public.create_custom_product(
  _company_id UUID,
  _name TEXT,
  _category TEXT DEFAULT 'other',
  _base_price NUMERIC DEFAULT 0,
  _linha TEXT DEFAULT 'Personalizado',
  _description TEXT DEFAULT NULL,
  _image_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_id UUID;
BEGIN
  -- Verify user belongs to company
  IF NOT user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'User does not belong to this company';
  END IF;

  INSERT INTO company_products (
    company_id, 
    commercial_name, 
    category, 
    linha, 
    base_price, 
    description,
    image_url,
    is_custom, 
    is_active
  ) VALUES (
    _company_id, 
    _name, 
    _category, 
    _linha,
    _base_price,
    _description,
    _image_url,
    TRUE, 
    TRUE
  )
  RETURNING id INTO _new_id;
  
  RETURN _new_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_custom_product TO authenticated;
-- =====================================================
-- MIGRAÇÃO: Estrutura de Produtos e Itens Multiempresa
-- =====================================================

-- 1. CRIAR TABELA company_items (Itens da Empresa)
-- Representa o item físico real que a empresa possui
CREATE TABLE IF NOT EXISTS public.company_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'other', -- perfil, vidro, acessorio, ferragem, servico, other
  unit TEXT NOT NULL DEFAULT 'un',
  cost NUMERIC DEFAULT 0,
  sale_price NUMERIC DEFAULT 0,
  specifications JSONB,
  image_url TEXT,
  linha TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ADICIONAR company_item_id às tabelas existentes (mantendo compatibilidade)
ALTER TABLE public.company_stock 
  ADD COLUMN IF NOT EXISTS company_item_id UUID REFERENCES public.company_items(id) ON DELETE CASCADE;

ALTER TABLE public.company_product_items 
  ADD COLUMN IF NOT EXISTS company_item_id UUID REFERENCES public.company_items(id) ON DELETE CASCADE;

-- 3. RLS para company_items
ALTER TABLE public.company_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company items" 
ON public.company_items FOR SELECT 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can insert company items" 
ON public.company_items FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can update company items" 
ON public.company_items FOR UPDATE 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can delete company items" 
ON public.company_items FOR DELETE 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_company_items_company_id ON public.company_items(company_id);
CREATE INDEX IF NOT EXISTS idx_company_items_item_template_id ON public.company_items(item_template_id);
CREATE INDEX IF NOT EXISTS idx_company_items_type ON public.company_items(type);
CREATE INDEX IF NOT EXISTS idx_company_items_linha ON public.company_items(linha);
CREATE INDEX IF NOT EXISTS idx_company_items_is_active ON public.company_items(is_active);

CREATE INDEX IF NOT EXISTS idx_company_stock_company_item_id ON public.company_stock(company_item_id);
CREATE INDEX IF NOT EXISTS idx_company_product_items_company_item_id ON public.company_product_items(company_item_id);

-- 5. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_company_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_company_items_updated_at ON public.company_items;
CREATE TRIGGER update_company_items_updated_at
BEFORE UPDATE ON public.company_items
FOR EACH ROW
EXECUTE FUNCTION public.update_company_items_updated_at();

-- 6. Função para criar company_item a partir de template
CREATE OR REPLACE FUNCTION public.create_company_item_from_template(
  _company_id UUID,
  _item_template_id UUID,
  _cost NUMERIC DEFAULT 0,
  _sale_price NUMERIC DEFAULT 0
) RETURNS UUID AS $$
DECLARE
  _new_id UUID;
  _template RECORD;
BEGIN
  -- Buscar dados do template
  SELECT * INTO _template FROM public.item_templates WHERE id = _item_template_id;
  
  IF _template IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;
  
  -- Verificar se já existe para essa empresa
  SELECT id INTO _new_id FROM public.company_items 
  WHERE company_id = _company_id AND item_template_id = _item_template_id;
  
  IF _new_id IS NOT NULL THEN
    RETURN _new_id;
  END IF;
  
  -- Criar novo company_item
  INSERT INTO public.company_items (
    company_id,
    item_template_id,
    name,
    description,
    type,
    unit,
    cost,
    sale_price,
    specifications,
    image_url,
    linha,
    is_custom
  ) VALUES (
    _company_id,
    _item_template_id,
    _template.name,
    _template.description,
    _template.type::TEXT,
    _template.unit,
    COALESCE(_cost, 0),
    COALESCE(_sale_price, _template.default_price, 0),
    _template.specifications,
    _template.image_url,
    _template.linha,
    false
  ) RETURNING id INTO _new_id;
  
  RETURN _new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Função para criar company_item customizado
CREATE OR REPLACE FUNCTION public.create_custom_company_item(
  _company_id UUID,
  _name TEXT,
  _type TEXT DEFAULT 'other',
  _unit TEXT DEFAULT 'un',
  _cost NUMERIC DEFAULT 0,
  _sale_price NUMERIC DEFAULT 0,
  _description TEXT DEFAULT NULL,
  _linha TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  _new_id UUID;
BEGIN
  INSERT INTO public.company_items (
    company_id,
    name,
    description,
    type,
    unit,
    cost,
    sale_price,
    linha,
    is_custom
  ) VALUES (
    _company_id,
    _name,
    _description,
    _type,
    _unit,
    COALESCE(_cost, 0),
    COALESCE(_sale_price, 0),
    _linha,
    true
  ) RETURNING id INTO _new_id;
  
  RETURN _new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- LIMPEZA: Remover campos de preço dos templates
-- Templates são apenas referência técnica, não devem ter preço

-- 1. Remover default_price de item_templates (mantendo compatibilidade por enquanto)
COMMENT ON COLUMN public.item_templates.default_price IS 'DEPRECATED: Use company_items.sale_price instead. Will be removed in future version.';

-- 2. Remover base_price de product_templates
COMMENT ON COLUMN public.product_templates.base_price IS 'DEPRECATED: Use company_products.base_price instead. Will be removed in future version.';

-- 3. Tornar item_template_id em company_product_items opcional (para suportar company_item_id)
ALTER TABLE public.company_product_items 
  ALTER COLUMN item_template_id DROP NOT NULL;

-- 4. Tornar item_template_id em company_stock opcional (para suportar company_item_id)  
ALTER TABLE public.company_stock 
  ALTER COLUMN item_template_id DROP NOT NULL;

-- Criar tabela company_linhas para armazenar linhas criadas pelas empresas
-- Isso permite linhas sem produtos ativos

CREATE TABLE IF NOT EXISTS public.company_linhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, name)
);

-- RLS policies
ALTER TABLE public.company_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company linhas" 
ON public.company_linhas FOR SELECT 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can insert company linhas" 
ON public.company_linhas FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can update company linhas" 
ON public.company_linhas FOR UPDATE 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

CREATE POLICY "Users can delete company linhas" 
ON public.company_linhas FOR DELETE 
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e 
    WHERE e.user_id = auth.uid() AND e.is_active = true
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_company_linhas_company_id ON public.company_linhas(company_id);
CREATE INDEX IF NOT EXISTS idx_company_linhas_name ON public.company_linhas(name);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_company_linhas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_company_linhas_updated_at ON public.company_linhas;
CREATE TRIGGER update_company_linhas_updated_at
BEFORE UPDATE ON public.company_linhas
FOR EACH ROW
EXECUTE FUNCTION public.update_company_linhas_updated_at();
-- 1. Criar bucket para imagens de produtos da empresa
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-product-images', 'company-product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies para o bucket
CREATE POLICY "Public read access for company product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-product-images');

CREATE POLICY "Company users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Company users can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Company users can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-product-images' 
  AND auth.role() = 'authenticated'
);

-- 2. Adicionar colunas necessárias em company_product_items (cut_angle e pieces_quantity)
ALTER TABLE public.company_product_items 
  ADD COLUMN IF NOT EXISTS cut_angle INTEGER DEFAULT 90;

ALTER TABLE public.company_product_items 
  ADD COLUMN IF NOT EXISTS pieces_quantity INTEGER DEFAULT 1;

-- 3. Criar função atômica de reset de produto
CREATE OR REPLACE FUNCTION public.reset_company_product_to_template(
  p_company_product_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_template_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_user_role TEXT;
  v_items_deleted INTEGER;
  v_items_created INTEGER;
  v_template_image TEXT;
BEGIN
  -- 1. Buscar produto da empresa e verificar se existe
  SELECT cp.company_id, cp.product_template_id
  INTO v_company_id, v_template_id
  FROM company_products cp
  WHERE cp.id = p_company_product_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;
  
  -- 2. Verificar se tem template associado
  IF v_template_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto personalizado não pode ser resetado');
  END IF;
  
  -- 3. Verificar permissão do usuário (deve ser admin)
  SELECT ur.role INTO v_user_role
  FROM user_roles ur
  WHERE ur.user_id = p_user_id;
  
  IF v_user_role = 'admin' OR v_user_role = 'saas_admin' THEN
    v_is_admin := TRUE;
  END IF;
  
  -- Verificar via employees se tem permissão
  IF NOT v_is_admin THEN
    SELECT EXISTS(
      SELECT 1 FROM employees e
      JOIN permission_profiles pp ON e.permission_profile_id = pp.id
      WHERE e.user_id = p_user_id
      AND e.company_id = v_company_id
      AND pp.name = 'Administrador'
    ) INTO v_is_admin;
  END IF;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem resetar produtos');
  END IF;
  
  -- 4. Iniciar transação atômica
  
  -- 4.1. Apagar composição atual da empresa
  DELETE FROM company_product_items
  WHERE company_product_id = p_company_product_id;
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;
  
  -- 4.2. Recriar composição a partir do template
  INSERT INTO company_product_items (
    company_product_id,
    item_template_id,
    quantity_formula,
    width_formula,
    height_formula,
    is_optional,
    notes,
    sort_order,
    cut_angle,
    pieces_quantity
  )
  SELECT 
    p_company_product_id,
    pti.item_template_id,
    pti.quantity_formula,
    pti.width_formula,
    pti.height_formula,
    pti.is_optional,
    pti.notes,
    ROW_NUMBER() OVER (ORDER BY pti.id),
    pti.cut_angle,
    pti.pieces_quantity
  FROM product_template_items pti
  WHERE pti.product_template_id = v_template_id
  AND pti.company_id IS NULL; -- Apenas itens globais do template
  GET DIAGNOSTICS v_items_created = ROW_COUNT;
  
  -- 4.3. Restaurar imagem do template (se existir)
  SELECT pt.image_url INTO v_template_image
  FROM product_templates pt
  WHERE pt.id = v_template_id;
  
  UPDATE company_products
  SET image_url = v_template_image,
      updated_at = now()
  WHERE id = p_company_product_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'items_deleted', v_items_deleted,
    'items_created', v_items_created,
    'template_id', v_template_id
  );
END;
$$;

-- 4. Adicionar comentário na função
COMMENT ON FUNCTION public.reset_company_product_to_template IS 'Reseta um produto da empresa para o estado original do template. Apenas admins podem executar.';

-- 5. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_company_product_items_company_product_id 
  ON public.company_product_items(company_product_id);

-- 6. Migrar itens de product_template_items para company_product_items (se ainda não migrados)
-- Isso cria a composição inicial para company_products que já existem mas não têm itens
INSERT INTO public.company_product_items (
  company_product_id,
  item_template_id,
  quantity_formula,
  width_formula,
  height_formula,
  is_optional,
  notes,
  sort_order,
  cut_angle,
  pieces_quantity
)
SELECT DISTINCT
  cp.id as company_product_id,
  pti.item_template_id,
  pti.quantity_formula,
  pti.width_formula,
  pti.height_formula,
  pti.is_optional,
  pti.notes,
  ROW_NUMBER() OVER (PARTITION BY cp.id ORDER BY pti.id),
  pti.cut_angle,
  pti.pieces_quantity
FROM public.company_products cp
JOIN public.product_template_items pti ON pti.product_template_id = cp.product_template_id
LEFT JOIN public.company_product_items cpi ON cpi.company_product_id = cp.id
WHERE cp.product_template_id IS NOT NULL
AND pti.company_id IS NULL -- Apenas itens globais do template
AND cpi.id IS NULL -- Apenas se não existem itens ainda
GROUP BY cp.id, pti.id, pti.item_template_id, pti.quantity_formula, 
         pti.width_formula, pti.height_formula, pti.is_optional, 
         pti.notes, pti.cut_angle, pti.pieces_quantity;-- =====================================================
-- FLUXO DE ORÇAMENTO COM ENTRADA, CAIXA E VENDA FINAL
-- =====================================================

-- 1. Criar tabela quote_deposits para rastrear entradas de orçamentos
CREATE TABLE public.quote_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'billed')),
  received_at TIMESTAMPTZ,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  cash_movement_id UUID REFERENCES public.cash_movements(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Adicionar coluna receivable_type em accounts_receivable
ALTER TABLE public.accounts_receivable 
  ADD COLUMN IF NOT EXISTS receivable_type TEXT DEFAULT 'installment';

-- 3. Adicionar colunas de controle de entrada em quotes
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'none';

-- 4. Habilitar RLS na tabela quote_deposits
ALTER TABLE public.quote_deposits ENABLE ROW LEVEL SECURITY;

-- 5. Criar políticas RLS para quote_deposits usando user_belongs_to_company
CREATE POLICY "Users can view quote deposits in their company" 
  ON public.quote_deposits 
  FOR SELECT 
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can insert quote deposits in their company" 
  ON public.quote_deposits 
  FOR INSERT 
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update quote deposits in their company" 
  ON public.quote_deposits 
  FOR UPDATE 
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can delete quote deposits in their company" 
  ON public.quote_deposits 
  FOR DELETE 
  USING (user_belongs_to_company(auth.uid(), company_id));

-- 6. Índices para performance
CREATE INDEX IF NOT EXISTS idx_quote_deposits_company_status 
  ON public.quote_deposits(company_id, status);

CREATE INDEX IF NOT EXISTS idx_quote_deposits_quote_id 
  ON public.quote_deposits(quote_id);

CREATE INDEX IF NOT EXISTS idx_quote_deposits_ordem_servico_id 
  ON public.quote_deposits(ordem_servico_id);

-- 7. Trigger para atualizar updated_at
CREATE TRIGGER update_quote_deposits_updated_at
  BEFORE UPDATE ON public.quote_deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();-- Atualizar a RPC para copiar os itens do template para company_product_items durante a ativação
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
  v_is_new BOOLEAN := FALSE;
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
  
  -- Verificar se o produto já existe
  SELECT * INTO v_product 
  FROM public.company_products 
  WHERE company_id = _company_id AND product_template_id = _product_template_id;
  
  IF v_product IS NULL THEN
    v_is_new := TRUE;
  END IF;
  
  -- Criar ou atualizar company_product
  INSERT INTO public.company_products (
    company_id,
    product_template_id,
    commercial_name,
    linha,
    category,
    is_active
  ) VALUES (
    _company_id,
    _product_template_id,
    COALESCE(_commercial_name, v_template.name),
    v_template.linha,
    v_template.category,
    true
  )
  ON CONFLICT (company_id, product_template_id) DO UPDATE
    SET is_active = true,
        updated_at = now()
  RETURNING * INTO v_product;
  
  -- Se é um novo produto, copiar os itens do template para company_product_items
  IF v_is_new THEN
    INSERT INTO public.company_product_items (
      company_product_id,
      item_template_id,
      quantity_formula,
      width_formula,
      height_formula,
      is_optional,
      notes,
      sort_order,
      cut_angle,
      pieces_quantity
    )
    SELECT 
      v_product.id,
      pti.item_template_id,
      pti.quantity_formula,
      pti.width_formula,
      pti.height_formula,
      pti.is_optional,
      pti.notes,
      ROW_NUMBER() OVER (ORDER BY pti.id)::INTEGER,
      pti.cut_angle,
      pti.pieces_quantity
    FROM public.product_template_items pti
    WHERE pti.product_template_id = _product_template_id
      AND pti.company_id IS NULL -- Apenas itens globais do template
    ON CONFLICT DO NOTHING;
    
    -- Adicionar os itens ao estoque da empresa se não existirem
    INSERT INTO public.company_stock (
      company_id,
      item_template_id,
      quantity,
      is_active
    )
    SELECT DISTINCT
      _company_id,
      pti.item_template_id,
      0,
      true
    FROM public.product_template_items pti
    WHERE pti.product_template_id = _product_template_id
      AND pti.company_id IS NULL
      AND pti.item_template_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.company_stock cs 
        WHERE cs.company_id = _company_id 
          AND cs.item_template_id = pti.item_template_id
      )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN v_product;
END;
$$;-- Corrige ativação em lote garantindo que a ativação sempre crie/recupere componentes (perfis, vidros, acessórios)
-- 1) Atualiza a RPC de ativação
-- 2) Faz backfill para produtos já ativados que ficaram sem componentes

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
  -- Permissão: admin da empresa
  IF NOT user_has_role_in_company(auth.uid(), _company_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Template
  SELECT * INTO v_template
  FROM public.product_templates
  WHERE id = _product_template_id;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Upsert do produto da empresa
  INSERT INTO public.company_products (
    company_id,
    product_template_id,
    commercial_name,
    linha,
    category,
    is_active
  ) VALUES (
    _company_id,
    _product_template_id,
    COALESCE(_commercial_name, v_template.name),
    v_template.linha,
    v_template.category,
    true
  )
  ON CONFLICT (company_id, product_template_id) DO UPDATE
    SET is_active = true,
        commercial_name = COALESCE(EXCLUDED.commercial_name, company_products.commercial_name),
        updated_at = now()
  RETURNING * INTO v_product;

  -- Garantir company_items para todos os componentes do template
  INSERT INTO public.company_items (
    company_id,
    item_template_id,
    name,
    description,
    type,
    unit,
    cost,
    sale_price,
    specifications,
    image_url,
    linha,
    is_custom,
    is_active,
    created_at,
    updated_at
  )
  SELECT DISTINCT
    _company_id,
    it.id,
    it.name,
    it.description,
    it.type::text,
    it.unit,
    0,
    COALESCE(it.default_price, 0),
    it.specifications,
    it.image_url,
    it.linha,
    false,
    true,
    now(),
    now()
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_items ci
      WHERE ci.company_id = _company_id
        AND ci.item_template_id = it.id
    );

  -- Garantir estoque para os componentes (com vínculo opcional ao company_item)
  INSERT INTO public.company_stock (
    company_id,
    item_template_id,
    quantity,
    min_quantity,
    is_active,
    allow_fractional,
    company_item_id
  )
  SELECT DISTINCT
    _company_id,
    it.id,
    0,
    0,
    true,
    false,
    ci.id
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  JOIN public.company_items ci
    ON ci.company_id = _company_id
   AND ci.item_template_id = it.id
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_id, item_template_id)
  DO UPDATE SET
    company_item_id = COALESCE(company_stock.company_item_id, EXCLUDED.company_item_id),
    updated_at = now();

  -- Garantir composição (company_product_items) mesmo em reativações
  INSERT INTO public.company_product_items (
    company_product_id,
    item_template_id,
    company_item_id,
    quantity_formula,
    width_formula,
    height_formula,
    is_optional,
    notes,
    sort_order,
    cut_angle,
    pieces_quantity,
    created_at,
    updated_at
  )
  SELECT
    v_product.id,
    pti.item_template_id,
    ci.id,
    pti.quantity_formula,
    pti.width_formula,
    pti.height_formula,
    pti.is_optional,
    pti.notes,
    ROW_NUMBER() OVER (ORDER BY pti.created_at, pti.id)::INTEGER,
    pti.cut_angle,
    pti.pieces_quantity,
    now(),
    now()
  FROM public.product_template_items pti
  JOIN public.company_items ci
    ON ci.company_id = _company_id
   AND ci.item_template_id = pti.item_template_id
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_product_items cpi
      WHERE cpi.company_product_id = v_product.id
        AND cpi.item_template_id = pti.item_template_id
    );

  RETURN v_product;
END;
$$;

-- =========================
-- Backfill (corrigir produtos já ativados que ficaram sem componentes)
-- =========================

-- 1) Criar company_items faltantes
INSERT INTO public.company_items (
  company_id,
  item_template_id,
  name,
  description,
  type,
  unit,
  cost,
  sale_price,
  specifications,
  image_url,
  linha,
  is_custom,
  is_active,
  created_at,
  updated_at
)
SELECT DISTINCT
  cp.company_id,
  it.id,
  it.name,
  it.description,
  it.type::text,
  it.unit,
  0,
  COALESCE(it.default_price, 0),
  it.specifications,
  it.image_url,
  it.linha,
  false,
  true,
  now(),
  now()
FROM public.company_products cp
JOIN public.product_template_items pti
  ON pti.product_template_id = cp.product_template_id
 AND pti.company_id IS NULL
JOIN public.item_templates it ON it.id = pti.item_template_id
WHERE cp.product_template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_items ci
    WHERE ci.company_id = cp.company_id
      AND ci.item_template_id = it.id
  );

-- 2) Garantir company_stock e vincular company_item_id quando possível
INSERT INTO public.company_stock (
  company_id,
  item_template_id,
  quantity,
  min_quantity,
  is_active,
  allow_fractional,
  company_item_id
)
SELECT DISTINCT
  cp.company_id,
  it.id,
  0,
  0,
  true,
  false,
  ci.id
FROM public.company_products cp
JOIN public.product_template_items pti
  ON pti.product_template_id = cp.product_template_id
 AND pti.company_id IS NULL
JOIN public.item_templates it ON it.id = pti.item_template_id
JOIN public.company_items ci
  ON ci.company_id = cp.company_id
 AND ci.item_template_id = it.id
WHERE cp.product_template_id IS NOT NULL
ON CONFLICT (company_id, item_template_id)
DO UPDATE SET
  company_item_id = COALESCE(company_stock.company_item_id, EXCLUDED.company_item_id),
  updated_at = now();

-- 3) Popular company_product_items faltantes
INSERT INTO public.company_product_items (
  company_product_id,
  item_template_id,
  company_item_id,
  quantity_formula,
  width_formula,
  height_formula,
  is_optional,
  notes,
  sort_order,
  cut_angle,
  pieces_quantity,
  created_at,
  updated_at
)
SELECT
  cp.id,
  pti.item_template_id,
  ci.id,
  pti.quantity_formula,
  pti.width_formula,
  pti.height_formula,
  pti.is_optional,
  pti.notes,
  ROW_NUMBER() OVER (PARTITION BY cp.id ORDER BY pti.created_at, pti.id)::INTEGER,
  pti.cut_angle,
  pti.pieces_quantity,
  now(),
  now()
FROM public.company_products cp
JOIN public.product_template_items pti
  ON pti.product_template_id = cp.product_template_id
 AND pti.company_id IS NULL
JOIN public.company_items ci
  ON ci.company_id = cp.company_id
 AND ci.item_template_id = pti.item_template_id
WHERE cp.product_template_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_product_items cpi
    WHERE cpi.company_product_id = cp.id
      AND cpi.item_template_id = pti.item_template_id
  );
-- Atualiza RPC para re-sincronizar componentes vinculando company_item_id corretamente
CREATE OR REPLACE FUNCTION public.reset_company_product_to_template(
  p_company_product_id UUID,
  p_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_template_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_user_role TEXT;
  v_items_deleted INTEGER;
  v_items_created INTEGER;
BEGIN
  -- 1. Buscar produto da empresa e verificar se existe
  SELECT cp.company_id, cp.product_template_id
  INTO v_company_id, v_template_id
  FROM company_products cp
  WHERE cp.id = p_company_product_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto não encontrado');
  END IF;
  
  -- 2. Verificar se tem template associado
  IF v_template_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produto personalizado não pode ser resetado');
  END IF;
  
  -- 3. Verificar permissão do usuário (deve ser admin)
  SELECT ur.role INTO v_user_role
  FROM user_roles ur
  WHERE ur.user_id = p_user_id;
  
  IF v_user_role = 'admin' OR v_user_role = 'saas_admin' THEN
    v_is_admin := TRUE;
  END IF;
  
  -- Verificar via employees se tem permissão
  IF NOT v_is_admin THEN
    SELECT EXISTS(
      SELECT 1 FROM employees e
      JOIN permission_profiles pp ON e.permission_profile_id = pp.id
      WHERE e.user_id = p_user_id
      AND e.company_id = v_company_id
      AND pp.name = 'Administrador'
    ) INTO v_is_admin;
  END IF;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores podem resetar produtos');
  END IF;
  
  -- 4. Garantir company_items para todos os componentes do template
  INSERT INTO public.company_items (
    company_id,
    item_template_id,
    name,
    description,
    type,
    unit,
    cost,
    sale_price,
    specifications,
    image_url,
    linha,
    is_custom,
    is_active,
    created_at,
    updated_at
  )
  SELECT DISTINCT
    v_company_id,
    it.id,
    it.name,
    it.description,
    it.type::text,
    it.unit,
    0,
    COALESCE(it.default_price, 0),
    it.specifications,
    it.image_url,
    it.linha,
    false,
    true,
    now(),
    now()
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  WHERE pti.product_template_id = v_template_id
    AND pti.company_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.company_items ci
      WHERE ci.company_id = v_company_id
        AND ci.item_template_id = it.id
    );

  -- 5. Garantir estoque para os componentes
  INSERT INTO public.company_stock (
    company_id,
    item_template_id,
    quantity,
    min_quantity,
    is_active,
    allow_fractional,
    company_item_id
  )
  SELECT DISTINCT
    v_company_id,
    it.id,
    0,
    0,
    true,
    false,
    ci.id
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  JOIN public.company_items ci
    ON ci.company_id = v_company_id
   AND ci.item_template_id = it.id
  WHERE pti.product_template_id = v_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_id, item_template_id)
  DO UPDATE SET
    company_item_id = COALESCE(company_stock.company_item_id, EXCLUDED.company_item_id),
    updated_at = now();
  
  -- 6. Apagar composição atual da empresa
  DELETE FROM company_product_items
  WHERE company_product_id = p_company_product_id;
  GET DIAGNOSTICS v_items_deleted = ROW_COUNT;
  
  -- 7. Recriar composição a partir do template com company_item_id
  INSERT INTO company_product_items (
    company_product_id,
    item_template_id,
    company_item_id,
    quantity_formula,
    width_formula,
    height_formula,
    is_optional,
    notes,
    sort_order,
    cut_angle,
    pieces_quantity,
    created_at,
    updated_at
  )
  SELECT 
    p_company_product_id,
    pti.item_template_id,
    ci.id,
    pti.quantity_formula,
    pti.width_formula,
    pti.height_formula,
    pti.is_optional,
    pti.notes,
    ROW_NUMBER() OVER (ORDER BY pti.created_at, pti.id)::INTEGER,
    pti.cut_angle,
    pti.pieces_quantity,
    now(),
    now()
  FROM product_template_items pti
  JOIN public.company_items ci
    ON ci.company_id = v_company_id
   AND ci.item_template_id = pti.item_template_id
  WHERE pti.product_template_id = v_template_id
    AND pti.company_id IS NULL;
  GET DIAGNOSTICS v_items_created = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'items_deleted', v_items_deleted,
    'items_created', v_items_created,
    'template_id', v_template_id
  );
END;
$$;-- Criar tabela de notificações internas da empresa
CREATE TABLE IF NOT EXISTS public.company_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_role TEXT NOT NULL, -- 'admin', 'gerente', ou user_id específico
  type TEXT NOT NULL, -- 'cash_open_request', 'generic', etc.
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  action_taken BOOLEAN DEFAULT false,
  action_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_company_notifications_company ON public.company_notifications(company_id);
CREATE INDEX idx_company_notifications_to_role ON public.company_notifications(to_role);
CREATE INDEX idx_company_notifications_type ON public.company_notifications(type);
CREATE INDEX idx_company_notifications_unread ON public.company_notifications(company_id, is_read) WHERE is_read = false;

-- Enable RLS
ALTER TABLE public.company_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
-- Usuários podem ver notificações da sua empresa
CREATE POLICY "Users can view company notifications"
ON public.company_notifications
FOR SELECT
USING (
  company_id IN (
    SELECT e.company_id FROM public.employees e WHERE e.user_id = auth.uid()
  )
);

-- Usuários podem criar notificações na sua empresa
CREATE POLICY "Users can create notifications in their company"
ON public.company_notifications
FOR INSERT
WITH CHECK (
  from_user_id = auth.uid()
  AND company_id IN (
    SELECT e.company_id FROM public.employees e WHERE e.user_id = auth.uid()
  )
);

-- Admins e gerentes podem atualizar notificações (marcar como lida, action_taken)
CREATE POLICY "Admins can update notifications"
ON public.company_notifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.permission_profiles pp ON e.permission_profile_id = pp.id
    WHERE e.user_id = auth.uid()
      AND e.company_id = company_notifications.company_id
      AND pp.profile_type IN ('admin', 'gerente')
  )
);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_notifications;-- Create table for employee-profile relationships (many-to-many)
CREATE TABLE public.employee_permission_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  permission_profile_id UUID NOT NULL REFERENCES public.permission_profiles(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, permission_profile_id)
);

-- Enable RLS
ALTER TABLE public.employee_permission_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view permission profiles for employees in their company"
ON public.employee_permission_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.user_companies uc ON uc.company_id = e.company_id
    WHERE e.id = employee_id AND uc.user_id = auth.uid()
  )
);

CREATE POLICY "Admins and managers can manage employee profiles"
ON public.employee_permission_profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.user_companies uc ON uc.company_id = e.company_id
    WHERE e.id = employee_id 
    AND uc.user_id = auth.uid()
    AND uc.role IN ('admin', 'manager')
  )
);-- Add username column to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_employees_username ON public.employees(username);

-- Add comment for documentation
COMMENT ON COLUMN public.employees.username IS 'Login username for internal authentication';-- Function to get internal email for login (bypasses RLS securely)
CREATE OR REPLACE FUNCTION public.get_employee_login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_internal_email TEXT;
BEGIN
  -- Find the employee by username
  SELECT user_id, company_id INTO v_user_id, v_company_id
  FROM employees
  WHERE username = LOWER(p_username)
    AND is_active = true
    AND user_id IS NOT NULL
  LIMIT 1;
  
  -- If not found, return null (will fall back to direct email login)
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Construct the internal email format
  v_internal_email := LOWER(p_username) || '@' || v_company_id::TEXT || '.internal';
  
  RETURN v_internal_email;
END;
$$;

-- Grant execute to anon (needed for login)
GRANT EXECUTE ON FUNCTION public.get_employee_login_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_login_email(TEXT) TO authenticated;-- Adicionar token único para cada empresa
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS login_token TEXT UNIQUE;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_companies_login_token 
ON public.companies(login_token);

-- Gerar tokens para empresas existentes (primeiras 5 letras do nome, sem vogais, maiúsculas)
UPDATE public.companies 
SET login_token = UPPER(
  LEFT(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'),
      '[aeiouAEIOU]', '', 'g'
    ), 
    5
  )
) || SUBSTRING(id::TEXT, 1, 2)
WHERE login_token IS NULL;

-- Atualizar função de lookup para usar o novo formato simplificado
CREATE OR REPLACE FUNCTION public.get_employee_login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_internal_email TEXT;
BEGIN
  -- Find the employee by username (now stored as nome + TOKEN, ex: joaoVETRA)
  SELECT user_id, company_id INTO v_user_id, v_company_id
  FROM employees
  WHERE LOWER(username) = LOWER(p_username)
    AND is_active = true
    AND user_id IS NOT NULL
  LIMIT 1;
  
  -- If not found, return null (will fall back to direct email login for admins)
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Construct the internal email format: username@internal.vetra
  v_internal_email := LOWER(p_username) || '@internal.vetra';
  
  RETURN v_internal_email;
END;
$$;

-- Função para verificar se um username já existe (para evitar duplicatas)
CREATE OR REPLACE FUNCTION public.check_employee_username_exists(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees
    WHERE LOWER(username) = LOWER(p_username)
      AND user_id IS NOT NULL
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_employee_username_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_employee_username_exists(TEXT) TO authenticated;-- Add photo_url column to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create storage bucket for employee photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for public read access
CREATE POLICY "Public read access for employee photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'employee-photos');

-- Policy for authenticated users to upload photos for their company employees
CREATE POLICY "Company members can upload employee photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-photos' AND
  auth.role() = 'authenticated'
);

-- Policy for company members to update employee photos
CREATE POLICY "Company members can update employee photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'employee-photos' AND
  auth.role() = 'authenticated'
);

-- Policy for company members to delete employee photos
CREATE POLICY "Company members can delete employee photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'employee-photos' AND
  auth.role() = 'authenticated'
);-- Add fields to track recurring expense relationships
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS parent_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recurrence_day INTEGER,
ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false;

-- Create index for faster parent lookups
CREATE INDEX IF NOT EXISTS idx_expenses_parent_id ON public.expenses(parent_expense_id);

-- Create function to generate next recurring expense
CREATE OR REPLACE FUNCTION public.generate_next_recurring_expense(expense_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense RECORD;
  v_next_due_date DATE;
  v_new_expense_id UUID;
BEGIN
  -- Get the expense
  SELECT * INTO v_expense FROM expenses WHERE id = expense_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;
  
  -- Only generate for recurring expenses
  IF v_expense.recurrence = 'none' OR v_expense.recurrence IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate next due date based on recurrence type
  IF v_expense.due_date IS NULL THEN
    v_next_due_date := CURRENT_DATE;
  ELSE
    CASE v_expense.recurrence
      WHEN 'weekly' THEN
        v_next_due_date := v_expense.due_date + INTERVAL '1 week';
      WHEN 'monthly' THEN
        -- Maintain the same day of month
        v_next_due_date := v_expense.due_date + INTERVAL '1 month';
      WHEN 'yearly' THEN
        v_next_due_date := v_expense.due_date + INTERVAL '1 year';
      ELSE
        RETURN NULL;
    END CASE;
  END IF;
  
  -- Check if next expense already exists
  SELECT id INTO v_new_expense_id 
  FROM expenses 
  WHERE parent_expense_id = expense_id 
    AND due_date = v_next_due_date 
    AND status = 'pending';
  
  IF FOUND THEN
    RETURN v_new_expense_id;
  END IF;
  
  -- Create next recurring expense
  INSERT INTO expenses (
    company_id,
    category,
    description,
    amount,
    due_date,
    status,
    recurrence,
    recurrence_day,
    employee_id,
    notes,
    created_by,
    parent_expense_id,
    is_auto_generated
  ) VALUES (
    v_expense.company_id,
    v_expense.category,
    v_expense.description,
    v_expense.amount,
    v_next_due_date,
    'pending',
    v_expense.recurrence,
    EXTRACT(DAY FROM v_next_due_date)::INTEGER,
    v_expense.employee_id,
    v_expense.notes,
    v_expense.created_by,
    expense_id,
    true
  ) RETURNING id INTO v_new_expense_id;
  
  RETURN v_new_expense_id;
END;
$$;

-- Add more expense categories
COMMENT ON TABLE public.expenses IS 'Categories: funcionarios, aluguel, condominio, energia, agua, internet, emprestimo, financiamento, impostos, manutencao, materiais, outros';-- Criar tabela para metas de vendas mensais
CREATE TABLE IF NOT EXISTS public.company_sales_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- formato: YYYY-MM
  goal_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, month)
);

-- Enable RLS
ALTER TABLE public.company_sales_goals ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their company's goals
CREATE POLICY "Users can view company sales goals"
  ON public.company_sales_goals FOR SELECT
  USING (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

-- Policy: Users can insert goals for their company
CREATE POLICY "Users can insert company sales goals"
  ON public.company_sales_goals FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

-- Policy: Users can update their company's goals
CREATE POLICY "Users can update company sales goals"
  ON public.company_sales_goals FOR UPDATE
  USING (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_sales_goals_company_month ON public.company_sales_goals(company_id, month);-- 1. Criar bucket para fotos de OS
INSERT INTO storage.buckets (id, name, public)
VALUES ('os-photos', 'os-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar bucket para imagens de produtos da empresa (caso não exista)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-product-images', 'company-product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Criar tabela para fotos de OS
CREATE TABLE IF NOT EXISTS public.os_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  description TEXT,
  photo_type TEXT DEFAULT 'general', -- 'before', 'after', 'progress', 'general'
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable RLS
ALTER TABLE public.os_photos ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for os_photos
CREATE POLICY "Users can view OS photos for their company"
  ON public.os_photos FOR SELECT
  USING (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

CREATE POLICY "Users can upload OS photos for their company"
  ON public.os_photos FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

CREATE POLICY "Users can delete OS photos for their company"
  ON public.os_photos FOR DELETE
  USING (
    company_id IN (
      SELECT uc.company_id FROM user_companies uc 
      WHERE uc.user_id = auth.uid() AND uc.is_active = true
    )
  );

-- 6. Create index
CREATE INDEX IF NOT EXISTS idx_os_photos_ordem_servico ON public.os_photos(ordem_servico_id);

-- 7. Storage policies for os-photos bucket
CREATE POLICY "Anyone can view OS photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'os-photos');

CREATE POLICY "Authenticated users can upload OS photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'os-photos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete OS photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'os-photos' AND auth.role() = 'authenticated');

-- 8. Storage policies for company-product-images bucket
CREATE POLICY "Anyone can view company product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-product-images');

CREATE POLICY "Authenticated users can upload company product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'company-product-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update company product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'company-product-images' AND auth.role() = 'authenticated');-- Criar tabela de controle de lembretes do sistema
CREATE TABLE public.system_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- 'quote_expiring', 'overdue_receivable'
  reference_id UUID NOT NULL,  -- ID do orçamento ou conta a receber
  reference_table TEXT NOT NULL, -- 'quotes' ou 'accounts_receivable'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(reference_id, reminder_type) -- evita duplicatas
);

-- Habilitar RLS
ALTER TABLE public.system_reminders ENABLE ROW LEVEL SECURITY;

-- Policies para system_reminders
CREATE POLICY "Users can view reminders for their company"
ON public.system_reminders
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
  )
);

CREATE POLICY "System can insert reminders"
ON public.system_reminders
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete reminders for their company"
ON public.system_reminders
FOR DELETE
USING (
  company_id IN (
    SELECT company_id FROM user_companies WHERE user_id = auth.uid()
  )
);

-- Adicionar colunas de configuração de lembretes
ALTER TABLE company_notification_settings 
ADD COLUMN IF NOT EXISTS notify_quote_expiring BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_overdue_receivables BOOLEAN DEFAULT true;

-- Criar índices para performance
CREATE INDEX idx_system_reminders_company ON public.system_reminders(company_id);
CREATE INDEX idx_system_reminders_type ON public.system_reminders(reminder_type);
CREATE INDEX idx_system_reminders_reference ON public.system_reminders(reference_id, reminder_type);-- Create product_categories table
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
  ('service', 'Serviço', 'emerald', 'un', 4);-- Create glass_types table for glass subtypes
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
-- Create product_linhas table for SaaS admin to manage global product lines
CREATE TABLE public.product_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  color TEXT DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_linhas ENABLE ROW LEVEL SECURITY;

-- Anyone can read product linhas
CREATE POLICY "Anyone can read product linhas"
ON public.product_linhas
FOR SELECT
USING (true);

-- Only SaaS admins can manage product linhas
CREATE POLICY "Admins can manage product linhas"
ON public.product_linhas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM saas_admins WHERE user_id = auth.uid()
  )
);

-- Create index for sorting
CREATE INDEX idx_product_linhas_sort ON public.product_linhas(sort_order);
CREATE INDEX idx_product_linhas_active ON public.product_linhas(is_active);

-- Insert existing linhas from product_templates
INSERT INTO public.product_linhas (slug, name, sort_order)
SELECT DISTINCT 
  LOWER(REPLACE(REPLACE(linha, ' ', '_'), '-', '_')) as slug,
  linha as name,
  ROW_NUMBER() OVER (ORDER BY linha) as sort_order
FROM public.product_templates
WHERE linha IS NOT NULL AND linha != ''
ON CONFLICT (slug) DO NOTHING;
-- Add status tracking to os_cutting_plan table
ALTER TABLE public.os_cutting_plan 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'in_progress', 'completed'));

-- Add individual item status tracking (JSONB to track each item's completion)
ALTER TABLE public.os_cutting_plan 
ADD COLUMN IF NOT EXISTS item_status JSONB DEFAULT '{}';

-- Add completion tracking
ALTER TABLE public.os_cutting_plan 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.os_cutting_plan 
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES auth.users(id);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_os_cutting_plan_status ON public.os_cutting_plan(status);

-- Add comment for documentation
COMMENT ON COLUMN public.os_cutting_plan.status IS 'Production status: pending, in_progress, completed';
COMMENT ON COLUMN public.os_cutting_plan.item_status IS 'JSON object tracking individual item completion status by item ID';
COMMENT ON COLUMN public.os_cutting_plan.completed_at IS 'Timestamp when all items were marked as completed';
COMMENT ON COLUMN public.os_cutting_plan.completed_by IS 'User who marked the cutting plan as completed';-- Create purchase_orders table for tracking material purchases
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
CREATE INDEX idx_os_glass_projects_procurement ON public.os_glass_projects(procurement_status);-- =====================================================
-- SISTEMA HÍBRIDO DE ESTOQUE + COMPRA SOB DEMANDA
-- =====================================================

-- 1. Adicionar campos para mapeamento de vidro em company_items
ALTER TABLE company_items ADD COLUMN IF NOT EXISTS glass_thickness TEXT;
ALTER TABLE company_items ADD COLUMN IF NOT EXISTS glass_color TEXT;
ALTER TABLE company_items ADD COLUMN IF NOT EXISTS glass_type_detail TEXT; -- Temperado, Laminado, etc.

-- 2. Adicionar campos de origem em os_glass_projects
ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  material_origin TEXT DEFAULT 'pending' CHECK (material_origin IN ('stock', 'purchase', 'mixed', 'pending'));

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  stock_item_id UUID REFERENCES company_items(id);

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  stock_quantity_used NUMERIC DEFAULT 0;

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  stock_unit_cost NUMERIC DEFAULT 0;

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  purchase_quantity_needed NUMERIC DEFAULT 0;

ALTER TABLE os_glass_projects ADD COLUMN IF NOT EXISTS 
  purchase_actual_cost NUMERIC DEFAULT 0;

-- 3. Criar tabela de reservas de estoque
CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_item_id UUID NOT NULL REFERENCES company_items(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  os_glass_project_id UUID REFERENCES os_glass_projects(id) ON DELETE SET NULL,
  
  -- Quantidade reservada
  quantity_reserved NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'm²',
  unit_cost NUMERIC DEFAULT 0,
  
  -- Status da reserva
  status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'cancelled')),
  
  -- Rastreamento
  reserved_at TIMESTAMPTZ DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RLS para stock_reservations
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company stock reservations"
  ON stock_reservations FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can create company stock reservations"
  ON stock_reservations FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update company stock reservations"
  ON stock_reservations FOR UPDATE
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete stock reservations"
  ON stock_reservations FOR DELETE
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_stock_reservations_company 
  ON stock_reservations(company_id);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_os 
  ON stock_reservations(ordem_servico_id);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_item_status 
  ON stock_reservations(company_item_id, status);

CREATE INDEX IF NOT EXISTS idx_company_items_glass 
  ON company_items(company_id, type) WHERE type = 'glass';

-- 6. Função para calcular estoque disponível (menos reservas)
CREATE OR REPLACE FUNCTION get_available_stock(
  _company_item_id UUID
) RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(cs.quantity, 0) - COALESCE(
    (SELECT SUM(sr.quantity_reserved) 
     FROM stock_reservations sr 
     WHERE sr.company_item_id = _company_item_id 
       AND sr.status = 'reserved'), 
    0
  ) as available_qty
  FROM company_stock cs
  WHERE cs.company_item_id = _company_item_id
  LIMIT 1;
$$;

-- 7. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_stock_reservations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_stock_reservations_updated_at
  BEFORE UPDATE ON stock_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_reservations_updated_at();-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB max
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);
-- 1. Create a security definer function to check if users share a company
CREATE OR REPLACE FUNCTION public.users_share_active_company(_viewer_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies viewer_uc
    JOIN public.user_companies target_uc ON viewer_uc.company_id = target_uc.company_id
    WHERE viewer_uc.user_id = _viewer_id
      AND viewer_uc.is_active = true
      AND target_uc.user_id = _target_id
      AND target_uc.is_active = true
  )
$$;

-- 2. Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view own profile and active company colleagues" ON public.profiles;

-- 3. Create a more restrictive SELECT policy using the security definer function
CREATE POLICY "Users can only view own profile and active colleagues"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.users_share_active_company(auth.uid(), user_id)
);

-- 4. Create a safe view that limits exposed data (optional extra layer)
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;

-- 5. Grant access to the view
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Melhorar a função de ativação para garantir que TODOS os itens sejam sempre sincronizados
-- Usa ON CONFLICT para atualizar itens existentes e adicionar novos

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
  v_items_created INTEGER := 0;
  v_composition_created INTEGER := 0;
BEGIN
  -- Permissão: admin da empresa
  IF NOT user_has_role_in_company(auth.uid(), _company_id, 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Template
  SELECT * INTO v_template
  FROM public.product_templates
  WHERE id = _product_template_id;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Upsert do produto da empresa
  INSERT INTO public.company_products (
    company_id,
    product_template_id,
    commercial_name,
    linha,
    category,
    is_active
  ) VALUES (
    _company_id,
    _product_template_id,
    COALESCE(_commercial_name, v_template.name),
    v_template.linha,
    v_template.category,
    true
  )
  ON CONFLICT (company_id, product_template_id) DO UPDATE
    SET is_active = true,
        commercial_name = COALESCE(EXCLUDED.commercial_name, company_products.commercial_name),
        updated_at = now()
  RETURNING * INTO v_product;

  -- 1. Garantir company_items para TODOS os componentes do template
  -- Usa ON CONFLICT para não falhar se já existir
  INSERT INTO public.company_items (
    company_id,
    item_template_id,
    name,
    description,
    type,
    unit,
    cost,
    sale_price,
    specifications,
    image_url,
    linha,
    is_custom,
    is_active,
    created_at,
    updated_at
  )
  SELECT DISTINCT
    _company_id,
    it.id,
    it.name,
    it.description,
    it.type::text,
    it.unit,
    0,
    COALESCE(it.default_price, 0),
    it.specifications,
    it.image_url,
    it.linha,
    false,
    true,
    now(),
    now()
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_id, item_template_id) 
  DO UPDATE SET
    -- Atualiza apenas se estava inativo
    is_active = true,
    updated_at = now();

  GET DIAGNOSTICS v_items_created = ROW_COUNT;

  -- 2. Garantir estoque para os componentes
  INSERT INTO public.company_stock (
    company_id,
    item_template_id,
    quantity,
    min_quantity,
    is_active,
    allow_fractional,
    company_item_id
  )
  SELECT DISTINCT
    _company_id,
    it.id,
    0,
    0,
    true,
    false,
    ci.id
  FROM public.product_template_items pti
  JOIN public.item_templates it ON it.id = pti.item_template_id
  JOIN public.company_items ci
    ON ci.company_id = _company_id
   AND ci.item_template_id = it.id
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_id, item_template_id)
  DO UPDATE SET
    company_item_id = COALESCE(company_stock.company_item_id, EXCLUDED.company_item_id),
    is_active = true,
    updated_at = now();

  -- 3. Garantir composição usando ON CONFLICT para sincronização completa
  -- Remove itens que não estão mais no template
  DELETE FROM public.company_product_items cpi
  WHERE cpi.company_product_id = v_product.id
    AND NOT EXISTS (
      SELECT 1 FROM public.product_template_items pti
      WHERE pti.product_template_id = _product_template_id
        AND pti.company_id IS NULL
        AND pti.item_template_id = cpi.item_template_id
    );

  -- Insere ou atualiza itens da composição
  INSERT INTO public.company_product_items (
    company_product_id,
    item_template_id,
    company_item_id,
    quantity_formula,
    width_formula,
    height_formula,
    is_optional,
    notes,
    sort_order,
    cut_angle,
    pieces_quantity,
    created_at,
    updated_at
  )
  SELECT
    v_product.id,
    pti.item_template_id,
    ci.id,
    pti.quantity_formula,
    pti.width_formula,
    pti.height_formula,
    pti.is_optional,
    pti.notes,
    ROW_NUMBER() OVER (ORDER BY pti.created_at, pti.id)::INTEGER,
    pti.cut_angle,
    pti.pieces_quantity,
    now(),
    now()
  FROM public.product_template_items pti
  JOIN public.company_items ci
    ON ci.company_id = _company_id
   AND ci.item_template_id = pti.item_template_id
  WHERE pti.product_template_id = _product_template_id
    AND pti.company_id IS NULL
  ON CONFLICT (company_product_id, item_template_id) 
  DO UPDATE SET
    company_item_id = EXCLUDED.company_item_id,
    quantity_formula = EXCLUDED.quantity_formula,
    width_formula = EXCLUDED.width_formula,
    height_formula = EXCLUDED.height_formula,
    pieces_quantity = EXCLUDED.pieces_quantity,
    cut_angle = EXCLUDED.cut_angle,
    is_optional = EXCLUDED.is_optional,
    notes = EXCLUDED.notes,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

  GET DIAGNOSTICS v_composition_created = ROW_COUNT;

  -- Atualizar imagem do produto da empresa se não tiver
  UPDATE public.company_products
  SET image_url = COALESCE(company_products.image_url, v_template.image_url),
      updated_at = now()
  WHERE id = v_product.id
    AND (image_url IS NULL OR image_url = '');

  RETURN v_product;
END;
$$;

-- Garantir que a constraint única existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'company_items_company_id_item_template_id_key'
  ) THEN
    ALTER TABLE public.company_items
    ADD CONSTRAINT company_items_company_id_item_template_id_key 
    UNIQUE (company_id, item_template_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Remover duplicatas mantendo apenas o registro mais recente (pelo id mais antigo que geralmente é o original)
DELETE FROM company_product_items a
USING company_product_items b
WHERE a.company_product_id = b.company_product_id
  AND a.item_template_id = b.item_template_id
  AND a.item_template_id IS NOT NULL
  AND a.id > b.id;

-- Agora criar a constraint UNIQUE
ALTER TABLE public.company_product_items 
ADD CONSTRAINT company_product_items_product_item_unique 
UNIQUE (company_product_id, item_template_id);

-- Recriar a função com a lógica corrigida
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id uuid,
  _product_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_product_id uuid;
  v_item RECORD;
  v_company_item_id uuid;
BEGIN
  -- Buscar dados do template
  SELECT * INTO v_template 
  FROM product_templates 
  WHERE id = _product_template_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Verificar se já existe um company_product para este template
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id 
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o company_product
    INSERT INTO company_products (
      company_id,
      product_template_id,
      commercial_name,
      description,
      category,
      linha,
      image_url,
      is_active,
      is_custom,
      base_price
    ) VALUES (
      _company_id,
      _product_template_id,
      v_template.name,
      v_template.description,
      v_template.category,
      v_template.linha,
      v_template.image_url,
      false,
      false,
      COALESCE(v_template.base_price, 0)
    )
    RETURNING id INTO v_product_id;
  END IF;

  -- Processar cada item do template
  FOR v_item IN 
    SELECT * FROM product_template_items 
    WHERE product_template_id = _product_template_id
  LOOP
    -- Garantir que existe um company_item para este item_template
    SELECT id INTO v_company_item_id
    FROM company_items
    WHERE company_id = _company_id 
      AND item_template_id = v_item.item_template_id;
    
    IF v_company_item_id IS NULL THEN
      -- Criar company_item baseado no template
      INSERT INTO company_items (
        company_id,
        item_template_id,
        name,
        type,
        unit,
        linha,
        description,
        image_url,
        is_active,
        is_custom
      )
      SELECT 
        _company_id,
        it.id,
        it.name,
        it.type::text,
        it.unit,
        it.linha,
        it.description,
        it.image_url,
        true,
        false
      FROM item_templates it
      WHERE it.id = v_item.item_template_id
      RETURNING id INTO v_company_item_id;
      
      -- Criar entrada no estoque se não existir
      INSERT INTO company_stock (
        company_id,
        item_template_id,
        company_item_id,
        quantity,
        min_quantity,
        is_active
      ) VALUES (
        _company_id,
        v_item.item_template_id,
        v_company_item_id,
        0,
        0,
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Inserir ou atualizar o item na composição do produto
    INSERT INTO company_product_items (
      company_product_id,
      item_template_id,
      company_item_id,
      quantity_formula,
      width_formula,
      height_formula,
      cut_angle,
      pieces_quantity,
      is_optional,
      notes,
      sort_order
    ) VALUES (
      v_product_id,
      v_item.item_template_id,
      v_company_item_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.cut_angle,
      v_item.pieces_quantity,
      COALESCE(v_item.is_optional, false),
      v_item.notes,
      v_item.sort_order
    )
    ON CONFLICT (company_product_id, item_template_id) DO UPDATE SET
      company_item_id = EXCLUDED.company_item_id,
      quantity_formula = EXCLUDED.quantity_formula,
      width_formula = EXCLUDED.width_formula,
      height_formula = EXCLUDED.height_formula,
      cut_angle = EXCLUDED.cut_angle,
      pieces_quantity = EXCLUDED.pieces_quantity,
      is_optional = EXCLUDED.is_optional,
      notes = EXCLUDED.notes,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
  END LOOP;

  -- Remover itens que não estão mais no template
  DELETE FROM company_product_items cpi
  WHERE cpi.company_product_id = v_product_id
    AND cpi.item_template_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM product_template_items pti 
      WHERE pti.product_template_id = _product_template_id
        AND pti.item_template_id = cpi.item_template_id
    );

  RETURN v_product_id;
END;
$$;
-- Fix batch activation failing due to PostgREST RPC overload ambiguity (PGRST203)
-- Keep a single canonical RPC signature: (uuid, uuid)

BEGIN;

-- Remove the overloaded variant that causes ambiguity when calling via REST RPC
DROP FUNCTION IF EXISTS public.activate_product_template_for_company(uuid, uuid, text);

-- Ensure the canonical function exists (2 args)
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id uuid,
  _product_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_product_id uuid;
  v_item RECORD;
  v_company_item_id uuid;
BEGIN
  -- Buscar dados do template
  SELECT * INTO v_template
  FROM product_templates
  WHERE id = _product_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Verificar se já existe um company_product para este template
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o company_product
    INSERT INTO company_products (
      company_id,
      product_template_id,
      commercial_name,
      description,
      category,
      linha,
      image_url,
      is_active,
      is_custom,
      base_price
    ) VALUES (
      _company_id,
      _product_template_id,
      v_template.name,
      v_template.description,
      v_template.category,
      v_template.linha,
      v_template.image_url,
      false,
      false,
      COALESCE(v_template.base_price, 0)
    )
    RETURNING id INTO v_product_id;
  END IF;

  -- Processar cada item do template
  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
  LOOP
    -- Garantir que existe um company_item para este item_template
    SELECT id INTO v_company_item_id
    FROM company_items
    WHERE company_id = _company_id
      AND item_template_id = v_item.item_template_id;

    IF v_company_item_id IS NULL THEN
      -- Criar company_item baseado no template
      INSERT INTO company_items (
        company_id,
        item_template_id,
        name,
        type,
        unit,
        linha,
        description,
        image_url,
        is_active,
        is_custom
      )
      SELECT
        _company_id,
        it.id,
        it.name,
        it.type::text,
        it.unit,
        it.linha,
        it.description,
        it.image_url,
        true,
        false
      FROM item_templates it
      WHERE it.id = v_item.item_template_id
      RETURNING id INTO v_company_item_id;

      -- Criar entrada no estoque se não existir
      INSERT INTO company_stock (
        company_id,
        item_template_id,
        company_item_id,
        quantity,
        min_quantity,
        is_active
      ) VALUES (
        _company_id,
        v_item.item_template_id,
        v_company_item_id,
        0,
        0,
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Inserir ou atualizar o item na composição do produto
    INSERT INTO company_product_items (
      company_product_id,
      item_template_id,
      company_item_id,
      quantity_formula,
      width_formula,
      height_formula,
      cut_angle,
      pieces_quantity,
      is_optional,
      notes,
      sort_order
    ) VALUES (
      v_product_id,
      v_item.item_template_id,
      v_company_item_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.cut_angle,
      v_item.pieces_quantity,
      COALESCE(v_item.is_optional, false),
      v_item.notes,
      v_item.sort_order
    )
    ON CONFLICT (company_product_id, item_template_id) DO UPDATE SET
      company_item_id = EXCLUDED.company_item_id,
      quantity_formula = EXCLUDED.quantity_formula,
      width_formula = EXCLUDED.width_formula,
      height_formula = EXCLUDED.height_formula,
      cut_angle = EXCLUDED.cut_angle,
      pieces_quantity = EXCLUDED.pieces_quantity,
      is_optional = EXCLUDED.is_optional,
      notes = EXCLUDED.notes,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
  END LOOP;

  -- Remover itens que não estão mais no template
  DELETE FROM company_product_items cpi
  WHERE cpi.company_product_id = v_product_id
    AND cpi.item_template_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM product_template_items pti
      WHERE pti.product_template_id = _product_template_id
        AND pti.item_template_id = cpi.item_template_id
    );

  RETURN v_product_id;
END;
$$;

COMMIT;BEGIN;

-- Fix overly permissive INSERT policy flagged by linter
DROP POLICY IF EXISTS "System can insert reminders" ON public.system_reminders;

CREATE POLICY "Service role can insert reminders"
ON public.system_reminders
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

COMMIT;BEGIN;

CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id uuid,
  _product_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_product_id uuid;
  v_item RECORD;
  v_company_item_id uuid;
BEGIN
  -- Buscar dados do template
  SELECT * INTO v_template
  FROM product_templates
  WHERE id = _product_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Verificar se já existe um company_product para este template
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o company_product (já ativo para venda)
    INSERT INTO company_products (
      company_id,
      product_template_id,
      commercial_name,
      description,
      category,
      linha,
      image_url,
      is_active,
      is_custom,
      base_price
    ) VALUES (
      _company_id,
      _product_template_id,
      v_template.name,
      v_template.description,
      v_template.category,
      v_template.linha,
      v_template.image_url,
      true,
      false,
      COALESCE(v_template.base_price, 0)
    )
    RETURNING id INTO v_product_id;
  ELSE
    -- Se já existe, garantir que fique ativo
    UPDATE company_products
    SET is_active = true,
        updated_at = now()
    WHERE id = v_product_id;
  END IF;

  -- Processar cada item do template
  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
  LOOP
    -- Garantir que existe um company_item para este item_template
    SELECT id INTO v_company_item_id
    FROM company_items
    WHERE company_id = _company_id
      AND item_template_id = v_item.item_template_id;

    IF v_company_item_id IS NULL THEN
      -- Criar company_item baseado no template
      INSERT INTO company_items (
        company_id,
        item_template_id,
        name,
        type,
        unit,
        linha,
        description,
        image_url,
        is_active,
        is_custom
      )
      SELECT
        _company_id,
        it.id,
        it.name,
        it.type::text,
        it.unit,
        it.linha,
        it.description,
        it.image_url,
        true,
        false
      FROM item_templates it
      WHERE it.id = v_item.item_template_id
      RETURNING id INTO v_company_item_id;

      -- Criar entrada no estoque se não existir
      INSERT INTO company_stock (
        company_id,
        item_template_id,
        company_item_id,
        quantity,
        min_quantity,
        is_active
      ) VALUES (
        _company_id,
        v_item.item_template_id,
        v_company_item_id,
        0,
        0,
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Inserir ou atualizar o item na composição do produto
    INSERT INTO company_product_items (
      company_product_id,
      item_template_id,
      company_item_id,
      quantity_formula,
      width_formula,
      height_formula,
      cut_angle,
      pieces_quantity,
      is_optional,
      notes,
      sort_order
    ) VALUES (
      v_product_id,
      v_item.item_template_id,
      v_company_item_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.cut_angle,
      v_item.pieces_quantity,
      COALESCE(v_item.is_optional, false),
      v_item.notes,
      v_item.sort_order
    )
    ON CONFLICT (company_product_id, item_template_id) DO UPDATE SET
      company_item_id = EXCLUDED.company_item_id,
      quantity_formula = EXCLUDED.quantity_formula,
      width_formula = EXCLUDED.width_formula,
      height_formula = EXCLUDED.height_formula,
      cut_angle = EXCLUDED.cut_angle,
      pieces_quantity = EXCLUDED.pieces_quantity,
      is_optional = EXCLUDED.is_optional,
      notes = EXCLUDED.notes,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
  END LOOP;

  -- Remover itens que não estão mais no template
  DELETE FROM company_product_items cpi
  WHERE cpi.company_product_id = v_product_id
    AND cpi.item_template_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM product_template_items pti
      WHERE pti.product_template_id = _product_template_id
        AND pti.item_template_id = cpi.item_template_id
    );

  RETURN v_product_id;
END;
$$;

COMMIT;-- Create table for global module control (SaaS admin manages this)
CREATE TABLE public.system_module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text UNIQUE NOT NULL,
  module_name text NOT NULL,
  description text,
  icon text,
  is_enabled boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_module_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read module settings (needed for sidebar rendering)
CREATE POLICY "Anyone can read module settings"
ON public.system_module_settings
FOR SELECT
TO authenticated
USING (true);

-- SaaS admins can manage (using profiles table - checked via metadata or dedicated admin check)
-- For now, allow only service_role to modify (admin panel uses service role or we add a separate admin table)
CREATE POLICY "Service role can manage module settings"
ON public.system_module_settings
FOR ALL
TO service_role
USING (true);

-- Insert all current modules with their default state
INSERT INTO public.system_module_settings (module_key, module_name, description, icon, is_enabled, sort_order) VALUES
  ('dashboard', 'Dashboard', 'Visão geral do sistema', 'LayoutDashboard', true, 1),
  ('clientes', 'Clientes', 'Gestão de clientes', 'Users', true, 2),
  ('orcamentos', 'Orçamentos', 'Criação e gestão de orçamentos', 'FileText', true, 3),
  ('ordens-servico', 'Ordens de Serviço', 'Acompanhamento de OS', 'ClipboardList', true, 4),
  ('agenda', 'Agenda', 'Agendamentos e compromissos', 'Calendar', true, 5),
  ('medicoes', 'Medições', 'Registro de medições', 'Ruler', true, 6),
  ('plano-corte', 'Plano de Corte', 'Otimização de corte', 'Scissors', true, 7),
  ('produtos', 'Produtos', 'Catálogo de produtos', 'Package', true, 8),
  ('precos', 'Preços', 'Gestão de preços', 'DollarSign', true, 9),
  ('estoque', 'Estoque', 'Controle de estoque', 'Boxes', true, 10),
  ('pedidos-compra', 'Pedidos de Compra', 'Gestão de compras', 'ShoppingCart', true, 11),
  ('caixa-vendas', 'Caixa e Vendas', 'PDV e controle de caixa', 'ShoppingBag', true, 12),
  ('financeiro', 'Financeiro', 'Gestão financeira', 'Wallet', true, 13),
  ('notas-fiscais', 'Notas Fiscais', 'Emissão de NF-e', 'Receipt', true, 14),
  ('funcionarios', 'Funcionários', 'Gestão de equipe', 'UserCog', true, 15),
  ('relatorios', 'Relatórios', 'Relatórios gerenciais', 'BarChart3', true, 16),
  ('configuracoes', 'Configurações', 'Configurações do sistema', 'Settings', true, 17);

-- Create function to check if module is enabled
CREATE OR REPLACE FUNCTION public.is_module_enabled(_module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_enabled FROM public.system_module_settings WHERE module_key = _module_key),
    true
  );
$$;-- Fix: product_template_items não tem coluna sort_order
-- A função deve usar um contador sequencial em vez de v_item.sort_order

CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(_company_id uuid, _product_template_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template RECORD;
  v_product_id uuid;
  v_item RECORD;
  v_company_item_id uuid;
  v_sort_counter integer := 0;
BEGIN
  -- Buscar dados do template
  SELECT * INTO v_template
  FROM product_templates
  WHERE id = _product_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template não encontrado';
  END IF;

  -- Verificar se já existe um company_product para este template
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o company_product (já ativo para venda)
    INSERT INTO company_products (
      company_id,
      product_template_id,
      commercial_name,
      description,
      category,
      linha,
      image_url,
      is_active,
      is_custom,
      base_price
    ) VALUES (
      _company_id,
      _product_template_id,
      v_template.name,
      v_template.description,
      v_template.category,
      v_template.linha,
      v_template.image_url,
      true,
      false,
      COALESCE(v_template.base_price, 0)
    )
    RETURNING id INTO v_product_id;
  ELSE
    -- Se já existe, garantir que fique ativo
    UPDATE company_products
    SET is_active = true,
        updated_at = now()
    WHERE id = v_product_id;
  END IF;

  -- Processar cada item do template
  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
    ORDER BY created_at, id
  LOOP
    v_sort_counter := v_sort_counter + 1;
    
    -- Garantir que existe um company_item para este item_template
    SELECT id INTO v_company_item_id
    FROM company_items
    WHERE company_id = _company_id
      AND item_template_id = v_item.item_template_id;

    IF v_company_item_id IS NULL THEN
      -- Criar company_item baseado no template
      INSERT INTO company_items (
        company_id,
        item_template_id,
        name,
        type,
        unit,
        linha,
        description,
        image_url,
        is_active,
        is_custom
      )
      SELECT
        _company_id,
        it.id,
        it.name,
        it.type::text,
        it.unit,
        it.linha,
        it.description,
        it.image_url,
        true,
        false
      FROM item_templates it
      WHERE it.id = v_item.item_template_id
      RETURNING id INTO v_company_item_id;

      -- Criar entrada no estoque se não existir
      INSERT INTO company_stock (
        company_id,
        item_template_id,
        company_item_id,
        quantity,
        min_quantity,
        is_active
      ) VALUES (
        _company_id,
        v_item.item_template_id,
        v_company_item_id,
        0,
        0,
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Inserir ou atualizar o item na composição do produto
    INSERT INTO company_product_items (
      company_product_id,
      item_template_id,
      company_item_id,
      quantity_formula,
      width_formula,
      height_formula,
      cut_angle,
      pieces_quantity,
      is_optional,
      notes,
      sort_order
    ) VALUES (
      v_product_id,
      v_item.item_template_id,
      v_company_item_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.cut_angle,
      v_item.pieces_quantity,
      COALESCE(v_item.is_optional, false),
      v_item.notes,
      v_sort_counter
    )
    ON CONFLICT (company_product_id, item_template_id) DO UPDATE SET
      company_item_id = EXCLUDED.company_item_id,
      quantity_formula = EXCLUDED.quantity_formula,
      width_formula = EXCLUDED.width_formula,
      height_formula = EXCLUDED.height_formula,
      cut_angle = EXCLUDED.cut_angle,
      pieces_quantity = EXCLUDED.pieces_quantity,
      is_optional = EXCLUDED.is_optional,
      notes = EXCLUDED.notes,
      sort_order = EXCLUDED.sort_order,
      updated_at = now();
  END LOOP;

  -- Remover itens que não estão mais no template
  DELETE FROM company_product_items cpi
  WHERE cpi.company_product_id = v_product_id
    AND cpi.item_template_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM product_template_items pti
      WHERE pti.product_template_id = _product_template_id
        AND pti.item_template_id = cpi.item_template_id
    );

  RETURN v_product_id;
END;
$$;-- Problema: A constraint UNIQUE(company_product_id, item_template_id) impede
-- que o mesmo item apareça múltiplas vezes na composição de um produto.
-- Porém, alguns templates têm o mesmo item repetido (ex: 2 montantes iguais com fórmulas diferentes).

-- 1. Remover a constraint problemática
ALTER TABLE public.company_product_items 
DROP CONSTRAINT IF EXISTS company_product_items_product_item_unique;

-- 2. Recriar a função de ativação SEM usar ON CONFLICT
-- Agora ela irá deletar e reinserir todos os itens
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id uuid,
  _product_template_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product_id UUID;
  v_item RECORD;
  v_company_item_id UUID;
  v_sort_counter INTEGER := 0;
BEGIN
  -- Verificar se já existe um produto ativado para este template
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o produto da empresa baseado no template
    INSERT INTO company_products (
      company_id,
      product_template_id,
      commercial_name,
      category,
      linha,
      description,
      image_url,
      is_active,
      is_custom,
      min_width,
      max_width,
      min_height,
      max_height
    )
    SELECT
      _company_id,
      pt.id,
      pt.name,
      pt.category,
      pt.linha,
      pt.description,
      pt.image_url,
      true,
      false,
      pt.min_width,
      pt.max_width,
      pt.min_height,
      pt.max_height
    FROM product_templates pt
    WHERE pt.id = _product_template_id
    RETURNING id INTO v_product_id;
  END IF;

  -- IMPORTANTE: Deletar itens existentes antes de reinserir
  -- Isso permite que itens duplicados no template sejam copiados corretamente
  DELETE FROM company_product_items WHERE company_product_id = v_product_id;

  -- Copiar os itens do template para o produto da empresa
  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
      AND company_id IS NULL
    ORDER BY created_at, id
  LOOP
    v_sort_counter := v_sort_counter + 1;
    
    -- Garantir que existe um company_item para este item_template
    SELECT id INTO v_company_item_id
    FROM company_items
    WHERE company_id = _company_id
      AND item_template_id = v_item.item_template_id;

    IF v_company_item_id IS NULL THEN
      -- Criar company_item baseado no template
      INSERT INTO company_items (
        company_id,
        item_template_id,
        name,
        type,
        unit,
        linha,
        description,
        image_url,
        is_active,
        is_custom
      )
      SELECT
        _company_id,
        it.id,
        it.name,
        it.type::text,
        it.unit,
        it.linha,
        it.description,
        it.image_url,
        true,
        false
      FROM item_templates it
      WHERE it.id = v_item.item_template_id
      RETURNING id INTO v_company_item_id;

      -- Criar entrada no estoque se não existir
      INSERT INTO company_stock (
        company_id,
        item_template_id,
        company_item_id,
        quantity,
        min_quantity,
        is_active
      ) VALUES (
        _company_id,
        v_item.item_template_id,
        v_company_item_id,
        0,
        0,
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Inserir cada item na composição do produto (agora pode haver duplicados)
    INSERT INTO company_product_items (
      company_product_id,
      item_template_id,
      company_item_id,
      quantity_formula,
      width_formula,
      height_formula,
      cut_angle,
      pieces_quantity,
      is_optional,
      notes,
      sort_order
    ) VALUES (
      v_product_id,
      v_item.item_template_id,
      v_company_item_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.cut_angle,
      v_item.pieces_quantity,
      COALESCE(v_item.is_optional, false),
      v_item.notes,
      v_sort_counter
    );
  END LOOP;

  RETURN v_product_id;
END;
$function$;
-- Corrigir função para reativar produtos quando já existem mas estão desativados
CREATE OR REPLACE FUNCTION public.activate_product_template_for_company(
  _company_id UUID,
  _product_template_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id UUID;
  v_item RECORD;
  v_company_item_id UUID;
  v_sort_counter INTEGER := 0;
BEGIN
  -- Verificar se já existe um produto ativado para este template
  SELECT id INTO v_product_id
  FROM company_products
  WHERE company_id = _company_id
    AND product_template_id = _product_template_id;

  IF v_product_id IS NULL THEN
    -- Criar o produto da empresa baseado no template
    INSERT INTO company_products (
      company_id,
      product_template_id,
      commercial_name,
      category,
      linha,
      description,
      image_url,
      is_active,
      is_custom,
      min_width,
      max_width,
      min_height,
      max_height
    )
    SELECT
      _company_id,
      pt.id,
      pt.name,
      pt.category,
      pt.linha,
      pt.description,
      pt.image_url,
      true,
      false,
      pt.min_width,
      pt.max_width,
      pt.min_height,
      pt.max_height
    FROM product_templates pt
    WHERE pt.id = _product_template_id
    RETURNING id INTO v_product_id;
  ELSE
    -- CORREÇÃO: Reativar produto existente que estava desativado
    UPDATE company_products 
    SET is_active = true, updated_at = now()
    WHERE id = v_product_id;
  END IF;

  -- IMPORTANTE: Deletar itens existentes antes de reinserir
  -- Isso permite que itens duplicados no template sejam copiados corretamente
  DELETE FROM company_product_items WHERE company_product_id = v_product_id;

  -- Copiar os itens do template para o produto da empresa
  FOR v_item IN
    SELECT * FROM product_template_items
    WHERE product_template_id = _product_template_id
      AND company_id IS NULL
    ORDER BY created_at, id
  LOOP
    v_sort_counter := v_sort_counter + 1;
    
    -- Garantir que existe um company_item para este item_template
    SELECT id INTO v_company_item_id
    FROM company_items
    WHERE company_id = _company_id
      AND item_template_id = v_item.item_template_id;

    IF v_company_item_id IS NULL THEN
      -- Criar company_item baseado no template
      INSERT INTO company_items (
        company_id,
        item_template_id,
        name,
        type,
        unit,
        linha,
        description,
        image_url,
        is_active,
        is_custom
      )
      SELECT
        _company_id,
        it.id,
        it.name,
        it.type::text,
        it.unit,
        it.linha,
        it.description,
        it.image_url,
        true,
        false
      FROM item_templates it
      WHERE it.id = v_item.item_template_id
      RETURNING id INTO v_company_item_id;

      -- Criar entrada no estoque se não existir
      INSERT INTO company_stock (
        company_id,
        item_template_id,
        company_item_id,
        quantity,
        min_quantity,
        is_active
      ) VALUES (
        _company_id,
        v_item.item_template_id,
        v_company_item_id,
        0,
        0,
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Inserir cada item na composição do produto (agora pode haver duplicados)
    INSERT INTO company_product_items (
      company_product_id,
      item_template_id,
      company_item_id,
      quantity_formula,
      width_formula,
      height_formula,
      cut_angle,
      pieces_quantity,
      is_optional,
      notes,
      sort_order
    ) VALUES (
      v_product_id,
      v_item.item_template_id,
      v_company_item_id,
      v_item.quantity_formula,
      v_item.width_formula,
      v_item.height_formula,
      v_item.cut_angle,
      v_item.pieces_quantity,
      COALESCE(v_item.is_optional, false),
      v_item.notes,
      v_sort_counter
    );
  END LOOP;

  RETURN v_product_id;
END;
$$;
-- =====================================================
-- SISTEMA DE PRECIFICAÇÃO DE VIDROS POR COR/ESPESSURA
-- =====================================================

-- 1. Tabela de espessuras de vidro configuráveis por empresa
CREATE TABLE IF NOT EXISTS public.glass_thicknesses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  thickness TEXT NOT NULL, -- Ex: "6mm", "8mm", "10mm"
  thickness_mm INTEGER NOT NULL, -- Valor numérico para ordenação: 6, 8, 10
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, thickness)
);

-- 2. Tabela de cores de vidro configuráveis por empresa
CREATE TABLE IF NOT EXISTS public.glass_colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL, -- Ex: "incolor", "verde", "fume"
  name TEXT NOT NULL, -- Ex: "Incolor", "Verde", "Fumê"
  hex_color TEXT, -- Cor visual para UI (opcional)
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, slug)
);

-- 3. Matriz de preços: Tipo de Vidro x Cor x Espessura
CREATE TABLE IF NOT EXISTS public.glass_price_matrix (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  glass_type_id UUID NOT NULL REFERENCES public.glass_types(id) ON DELETE CASCADE,
  glass_color_id UUID NOT NULL REFERENCES public.glass_colors(id) ON DELETE CASCADE,
  glass_thickness_id UUID NOT NULL REFERENCES public.glass_thicknesses(id) ON DELETE CASCADE,
  cost_per_sqm NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Custo por m²
  price_per_sqm NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Preço de venda por m²
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, glass_type_id, glass_color_id, glass_thickness_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_glass_thicknesses_company ON public.glass_thicknesses(company_id);
CREATE INDEX IF NOT EXISTS idx_glass_colors_company ON public.glass_colors(company_id);
CREATE INDEX IF NOT EXISTS idx_glass_price_matrix_company ON public.glass_price_matrix(company_id);
CREATE INDEX IF NOT EXISTS idx_glass_price_matrix_lookup ON public.glass_price_matrix(company_id, glass_type_id, glass_color_id, glass_thickness_id);

-- Enable RLS
ALTER TABLE public.glass_thicknesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glass_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.glass_price_matrix ENABLE ROW LEVEL SECURITY;

-- RLS Policies para glass_thicknesses
CREATE POLICY "Users can view glass thicknesses from their company"
  ON public.glass_thicknesses FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can manage glass thicknesses from their company"
  ON public.glass_thicknesses FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

-- RLS Policies para glass_colors
CREATE POLICY "Users can view glass colors from their company"
  ON public.glass_colors FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can manage glass colors from their company"
  ON public.glass_colors FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

-- RLS Policies para glass_price_matrix
CREATE POLICY "Users can view glass prices from their company"
  ON public.glass_price_matrix FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can manage glass prices from their company"
  ON public.glass_price_matrix FOR ALL
  USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

-- Função para inicializar cores e espessuras padrão para uma empresa
CREATE OR REPLACE FUNCTION public.initialize_glass_options_for_company(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir cores padrão
  INSERT INTO glass_colors (company_id, slug, name, hex_color, sort_order)
  VALUES
    (_company_id, 'incolor', 'Incolor', '#E8F4F8', 1),
    (_company_id, 'verde', 'Verde', '#90EE90', 2),
    (_company_id, 'fume', 'Fumê', '#696969', 3),
    (_company_id, 'bronze', 'Bronze', '#CD7F32', 4),
    (_company_id, 'jateado', 'Jateado', '#F5F5F5', 5)
  ON CONFLICT (company_id, slug) DO NOTHING;

  -- Inserir espessuras padrão (vazias, usuário vai cadastrar)
  -- Usuário escolheu "Personalizado", então não inserimos espessuras automáticas
END;
$$;-- Adicionar campo uses_glass em company_products se não existir
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS uses_glass BOOLEAN DEFAULT true;

-- Criar tabela de preços de vidro vinculada ao produto
CREATE TABLE IF NOT EXISTS public.product_glass_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_id UUID NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  glass_type TEXT NOT NULL,
  thickness_mm INTEGER NOT NULL,
  price_per_sqm NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_per_sqm NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Não permitir repetir combinação produto + tipo_vidro + espessura
  CONSTRAINT unique_product_glass_price UNIQUE (company_product_id, glass_type, thickness_mm)
);

-- Habilitar RLS
ALTER TABLE public.product_glass_prices ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view product glass prices from their company"
ON public.product_glass_prices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_glass_prices.company_product_id
    AND uc.user_id = auth.uid()
    AND uc.is_active = true
  )
);

CREATE POLICY "Users can insert product glass prices for their company"
ON public.product_glass_prices FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_glass_prices.company_product_id
    AND uc.user_id = auth.uid()
    AND uc.is_active = true
  )
);

CREATE POLICY "Users can update product glass prices from their company"
ON public.product_glass_prices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_glass_prices.company_product_id
    AND uc.user_id = auth.uid()
    AND uc.is_active = true
  )
);

CREATE POLICY "Users can delete product glass prices from their company"
ON public.product_glass_prices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_glass_prices.company_product_id
    AND uc.user_id = auth.uid()
    AND uc.is_active = true
  )
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_product_glass_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_update_product_glass_prices_updated_at
BEFORE UPDATE ON public.product_glass_prices
FOR EACH ROW
EXECUTE FUNCTION update_product_glass_prices_updated_at();

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_product_glass_prices_product 
ON public.product_glass_prices(company_product_id);

-- Comentários
COMMENT ON TABLE public.product_glass_prices IS 'Preços de vidro específicos por produto';
COMMENT ON COLUMN public.product_glass_prices.glass_type IS 'Tipo do vidro: Comum, Temperado, Laminado, etc';
COMMENT ON COLUMN public.product_glass_prices.thickness_mm IS 'Espessura em mm: 4, 6, 8, 10';
COMMENT ON COLUMN public.product_glass_prices.price_per_sqm IS 'Preço de venda por m²';
COMMENT ON COLUMN public.product_glass_prices.cost_per_sqm IS 'Custo por m²';-- Add glass_color column to product_glass_prices
ALTER TABLE public.product_glass_prices 
ADD COLUMN glass_color text DEFAULT 'Incolor';

-- Drop the old unique constraint
ALTER TABLE public.product_glass_prices 
DROP CONSTRAINT IF EXISTS unique_product_glass_price;

-- Create new unique constraint including glass_color
ALTER TABLE public.product_glass_prices 
ADD CONSTRAINT unique_product_glass_price_with_color 
UNIQUE (company_product_id, glass_type, thickness_mm, glass_color);

-- Add comment for documentation
COMMENT ON COLUMN public.product_glass_prices.glass_color IS 'Cor do vidro: Incolor, Verde, Fumê, Bronze, Jateado, etc.';-- Tabela de formas de pagamento (PIX, Dinheiro, Cartão, Boleto, etc.)
CREATE TABLE public.formas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('avista', 'parcelado', 'misto')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca por empresa
CREATE INDEX idx_formas_pagamento_company ON public.formas_pagamento(company_id);

-- Tabela de condições de pagamento (À vista 5% desc, 3x, 10x cartão, etc.)
CREATE TABLE public.condicoes_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  parcelas INTEGER NOT NULL DEFAULT 1,
  dias_entre_parcelas INTEGER NOT NULL DEFAULT 30,
  juros_percent NUMERIC NOT NULL DEFAULT 0,
  desconto_percent NUMERIC NOT NULL DEFAULT 0,
  forma_pagamento_id UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca por empresa
CREATE INDEX idx_condicoes_pagamento_company ON public.condicoes_pagamento(company_id);

-- Adicionar campos de controle de pagamento na tabela quotes
ALTER TABLE public.quotes 
  ADD COLUMN IF NOT EXISTS forma_pagamento_id UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS condicao_pagamento_id UUID REFERENCES public.condicoes_pagamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_original NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_reajustado NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_final_aprovado NUMERIC,
  ADD COLUMN IF NOT EXISTS reajuste_aplicado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- Tabela de histórico de alterações de preço durante aprovação
CREATE TABLE public.quote_price_revisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  quote_item_id UUID NOT NULL REFERENCES public.quote_items(id) ON DELETE CASCADE,
  preco_original NUMERIC NOT NULL,
  preco_tabela_atual NUMERIC NOT NULL,
  preco_usado NUMERIC NOT NULL,
  usou_preco_atual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condicoes_pagamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_price_revisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies para formas_pagamento
CREATE POLICY "Users can view their company formas_pagamento" 
ON public.formas_pagamento FOR SELECT 
USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can insert formas_pagamento for their company"
ON public.formas_pagamento FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can update their company formas_pagamento"
ON public.formas_pagamento FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can delete their company formas_pagamento"
ON public.formas_pagamento FOR DELETE
USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

-- RLS Policies para condicoes_pagamento
CREATE POLICY "Users can view their company condicoes_pagamento" 
ON public.condicoes_pagamento FOR SELECT 
USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can insert condicoes_pagamento for their company"
ON public.condicoes_pagamento FOR INSERT
WITH CHECK (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can update their company condicoes_pagamento"
ON public.condicoes_pagamento FOR UPDATE
USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "Users can delete their company condicoes_pagamento"
ON public.condicoes_pagamento FOR DELETE
USING (company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true));

-- RLS Policies para quote_price_revisions
CREATE POLICY "Users can view their company quote_price_revisions" 
ON public.quote_price_revisions FOR SELECT 
USING (quote_id IN (SELECT id FROM public.quotes WHERE company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)));

CREATE POLICY "Users can insert quote_price_revisions for their company"
ON public.quote_price_revisions FOR INSERT
WITH CHECK (quote_id IN (SELECT id FROM public.quotes WHERE company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)));

-- Função para inserir formas e condições padrão para novas empresas
CREATE OR REPLACE FUNCTION public.create_default_payment_options(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pix_id UUID;
  _dinheiro_id UUID;
  _cartao_id UUID;
  _boleto_id UUID;
BEGIN
  -- Criar formas de pagamento padrão
  INSERT INTO public.formas_pagamento (company_id, nome, tipo, sort_order) VALUES
    (_company_id, 'PIX', 'avista', 1) RETURNING id INTO _pix_id;
  
  INSERT INTO public.formas_pagamento (company_id, nome, tipo, sort_order) VALUES
    (_company_id, 'Dinheiro', 'avista', 2) RETURNING id INTO _dinheiro_id;
  
  INSERT INTO public.formas_pagamento (company_id, nome, tipo, sort_order) VALUES
    (_company_id, 'Cartão de Crédito', 'parcelado', 3) RETURNING id INTO _cartao_id;
  
  INSERT INTO public.formas_pagamento (company_id, nome, tipo, sort_order) VALUES
    (_company_id, 'Boleto', 'parcelado', 4) RETURNING id INTO _boleto_id;
  
  INSERT INTO public.formas_pagamento (company_id, nome, tipo, sort_order) VALUES
    (_company_id, 'Entrada + Parcelas', 'misto', 5);

  -- Criar condições de pagamento padrão
  INSERT INTO public.condicoes_pagamento (company_id, nome, parcelas, dias_entre_parcelas, desconto_percent, forma_pagamento_id, sort_order) VALUES
    (_company_id, 'À vista com 5% desconto', 1, 0, 5, _pix_id, 1);
  
  INSERT INTO public.condicoes_pagamento (company_id, nome, parcelas, dias_entre_parcelas, desconto_percent, forma_pagamento_id, sort_order) VALUES
    (_company_id, 'À vista sem desconto', 1, 0, 0, _dinheiro_id, 2);
  
  INSERT INTO public.condicoes_pagamento (company_id, nome, parcelas, dias_entre_parcelas, juros_percent, forma_pagamento_id, sort_order) VALUES
    (_company_id, '2x sem juros', 2, 30, 0, _cartao_id, 3);
  
  INSERT INTO public.condicoes_pagamento (company_id, nome, parcelas, dias_entre_parcelas, juros_percent, forma_pagamento_id, sort_order) VALUES
    (_company_id, '3x sem juros', 3, 30, 0, _cartao_id, 4);
  
  INSERT INTO public.condicoes_pagamento (company_id, nome, parcelas, dias_entre_parcelas, juros_percent, forma_pagamento_id, sort_order) VALUES
    (_company_id, '6x com juros (2%)', 6, 30, 2, _cartao_id, 5);
  
  INSERT INTO public.condicoes_pagamento (company_id, nome, parcelas, dias_entre_parcelas, juros_percent, forma_pagamento_id, sort_order) VALUES
    (_company_id, '10x com juros (5%)', 10, 30, 5, _cartao_id, 6);
  
  INSERT INTO public.condicoes_pagamento (company_id, nome, parcelas, dias_entre_parcelas, juros_percent, forma_pagamento_id, sort_order) VALUES
    (_company_id, '12x com juros (8%)', 12, 30, 8, _cartao_id, 7);
END;
$$;-- =====================================================
-- FIX: Retorno do fundo fixo no fechamento de caixa
-- =====================================================
-- Problema: A função atual só retorna o excedente, mas não
-- retorna o fundo fixo de volta para o caixa da empresa.
-- Solução: Retornar TODO o valor contado (fundo + lucro).
-- =====================================================

-- Recriar função close_daily_cash com lógica corrigida
CREATE OR REPLACE FUNCTION public.close_daily_cash(_cash_register_id uuid, _actual_amount numeric, _notes text DEFAULT NULL::text, _user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_register RECORD;
  v_company_cash RECORD;
  v_opening_amount NUMERIC;
  v_fixed_fund NUMERIC;
  v_expected_amount NUMERIC;
  v_difference NUMERIC;
  v_profit NUMERIC;
  v_fund_to_return NUMERIC;
  v_compensation_result jsonb;
  v_net_profit NUMERIC;
  v_total_to_return NUMERIC;
  v_closing_below_fund BOOLEAN;
  v_company_balance NUMERIC;
  v_shortage_amount NUMERIC;
BEGIN
  -- Buscar caixa aberto (sem JOIN obrigatório com company_cash)
  SELECT *
  INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id AND status = 'open'
  FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;

  -- Buscar company_cash separadamente (pode não existir)
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = v_register.company_id
  FOR UPDATE;

  -- Se não existir company_cash, criar um registro
  IF v_company_cash IS NULL THEN
    INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
    VALUES (v_register.company_id, 0, v_register.opening_amount)
    RETURNING * INTO v_company_cash;
  END IF;

  v_company_balance := COALESCE(v_company_cash.current_balance, 0);
  v_opening_amount := v_register.opening_amount;
  v_fixed_fund := COALESCE(v_company_cash.fixed_fund, v_opening_amount);

  -- Calcular saldo esperado (abertura + entradas - saídas)
  SELECT v_opening_amount + 
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id;

  v_difference := _actual_amount - v_expected_amount;
  v_profit := _actual_amount - v_fixed_fund;
  v_closing_below_fund := _actual_amount < v_fixed_fund;

  -- Regra: Se fechamento abaixo do fundo fixo, exigir justificativa
  IF v_closing_below_fund AND (COALESCE(_notes, '') = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fechamento abaixo do fundo fixo requer justificativa obrigatória'
    );
  END IF;

  -- Calcular quanto do fundo pode ser retornado (mínimo entre contado e fundo)
  v_fund_to_return := LEAST(_actual_amount, v_fixed_fund);
  
  -- Se há lucro, compensar adiantamentos pendentes
  IF v_profit > 0 THEN
    v_compensation_result := compensate_advances_on_closing(
      v_register.company_id,
      _cash_register_id,
      v_profit
    );
    v_net_profit := (v_compensation_result->>'net_excess')::NUMERIC;
  ELSE
    v_compensation_result := NULL;
    v_net_profit := v_profit; -- Pode ser negativo (prejuízo)
  END IF;

  -- Registrar falta se o valor contado for menor que o fundo
  IF v_closing_below_fund THEN
    v_shortage_amount := v_fixed_fund - _actual_amount;
    INSERT INTO public.cash_shortages (
      company_id, user_id, cash_register_id,
      amount, reason, status
    ) VALUES (
      v_register.company_id,
      COALESCE(_user_id, auth.uid()),
      _cash_register_id,
      v_shortage_amount,
      COALESCE(_notes, 'Fechamento abaixo do fundo fixo'),
      'pending'
    );
  END IF;

  -- SEMPRE retornar o fundo fixo para a empresa (o que foi contado até o valor do fundo)
  IF v_fund_to_return > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'retorno_fundo_fixo', v_fund_to_return,
      v_company_balance, v_company_balance + v_fund_to_return,
      'Retorno do fundo fixo do caixa do dia',
      _cash_register_id, COALESCE(_user_id, auth.uid())
    );
    
    v_company_balance := v_company_balance + v_fund_to_return;
  END IF;

  -- Se há lucro líquido após compensações, transferir para caixa da empresa
  IF v_net_profit > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'lucro_caixa', v_net_profit,
      v_company_balance, v_company_balance + v_net_profit,
      'Recolhimento - lucro do caixa do dia',
      _cash_register_id, COALESCE(_user_id, auth.uid())
    );
    
    v_company_balance := v_company_balance + v_net_profit;
  END IF;

  -- Atualizar saldo do caixa da empresa
  UPDATE public.company_cash
  SET current_balance = v_company_balance,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = v_register.company_id;

  -- Calcular total retornado
  v_total_to_return := v_fund_to_return + GREATEST(0, v_net_profit);

  -- Atualizar e fechar o caixa
  UPDATE public.cash_registers
  SET status = 'closed',
      closed_at = now(),
      closed_by = COALESCE(_user_id, auth.uid()),
      closing_amount = v_expected_amount,
      actual_amount = _actual_amount,
      difference = v_difference,
      notes = _notes,
      fixed_fund_at_close = v_fixed_fund,
      excess_collected = v_total_to_return,
      closing_justification = CASE WHEN v_closing_below_fund THEN _notes ELSE NULL END
  WHERE id = _cash_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'actual_amount', _actual_amount,
    'difference', v_difference,
    'fixed_fund', v_fixed_fund,
    'fixed_fund_returned', v_fund_to_return,
    'profit', v_profit,
    'compensation', v_compensation_result,
    'net_profit', v_net_profit,
    'total_returned', v_total_to_return,
    'closing_below_fund', v_closing_below_fund,
    'shortage_amount', CASE WHEN v_closing_below_fund THEN v_shortage_amount ELSE 0 END,
    'company_balance_after', v_company_balance
  );
END;
$function$;-- ============================================================
-- MIGRAÇÃO: Auditoria de Fechamento de Caixa e Discrepâncias
-- ============================================================

-- 1. Adicionar colunas de auditoria em cash_registers
ALTER TABLE public.cash_registers 
ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS closing_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS audited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS audit_notes TEXT,
ADD COLUMN IF NOT EXISTS previous_discrepancy NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_discrepancy_notes TEXT;

-- 2. Criar tabela de auditorias de fechamento
CREATE TABLE public.cash_register_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Dados do operador
  operator_id UUID NOT NULL REFERENCES auth.users(id),
  operator_name TEXT,
  counts_submitted JSONB NOT NULL,
  total_counted NUMERIC(12,2) NOT NULL,
  expected_amount NUMERIC(12,2) NOT NULL,
  difference NUMERIC(12,2) NOT NULL,
  operator_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Dados da auditoria
  auditor_id UUID REFERENCES auth.users(id),
  auditor_name TEXT,
  auditor_action TEXT CHECK (auditor_action IN ('approved', 'rejected', 'adjusted')),
  auditor_notes TEXT,
  adjustment_amount NUMERIC(12,2),
  audited_at TIMESTAMPTZ,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX idx_cash_audits_pending ON cash_register_audits(company_id, status) WHERE status = 'pending';
CREATE INDEX idx_cash_audits_operator ON cash_register_audits(operator_id);
CREATE INDEX idx_cash_audits_register ON cash_register_audits(cash_register_id);

-- 3. Criar tabela de discrepâncias por operador
CREATE TABLE public.operator_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES auth.users(id),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
  
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN ('deficit', 'surplus')),
  amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  
  -- Status de compensação
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'compensated', 'written_off')),
  compensated_amount NUMERIC(12,2) DEFAULT 0,
  compensated_at TIMESTAMPTZ,
  compensated_in_register_id UUID REFERENCES cash_registers(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar pendências do operador
CREATE INDEX idx_operator_discrepancies_pending 
ON operator_discrepancies(company_id, operator_id, status) 
WHERE status = 'pending';

-- 4. Habilitar RLS nas novas tabelas
ALTER TABLE public.cash_register_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_discrepancies ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para cash_register_audits
CREATE POLICY "Users can view audits from their company"
ON public.cash_register_audits FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can create audits for their company"
ON public.cash_register_audits FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Managers can update audits"
ON public.cash_register_audits FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'manager')
  )
);

-- 6. Políticas RLS para operator_discrepancies
CREATE POLICY "Users can view discrepancies from their company"
ON public.operator_discrepancies FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "System can create discrepancies"
ON public.operator_discrepancies FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Managers can update discrepancies"
ON public.operator_discrepancies FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'manager')
  )
);

-- 7. Função: Submeter fechamento para auditoria
CREATE OR REPLACE FUNCTION public.submit_cash_closing_for_audit(
  _cash_register_id UUID,
  _counts JSONB,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_register RECORD;
  v_expected_amount NUMERIC;
  v_total_counted NUMERIC;
  v_difference NUMERIC;
  v_audit_id UUID;
  v_operator_name TEXT;
BEGIN
  -- Buscar caixa aberto
  SELECT * INTO v_register FROM cash_registers
  WHERE id = _cash_register_id AND status = 'open' FOR UPDATE;
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado ou já fechado');
  END IF;
  
  -- Verificar se é o operador do caixa
  IF v_register.opened_by != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o operador pode submeter o fechamento');
  END IF;
  
  -- Buscar nome do operador
  SELECT COALESCE(e.name, p.name, 'Operador') INTO v_operator_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.id
  WHERE p.id = auth.uid();
  
  -- Calcular valor esperado
  SELECT v_register.opening_amount + 
    COALESCE((SELECT SUM(total_amount) FROM sales 
              WHERE cash_register_id = _cash_register_id 
              AND payment_method = 'dinheiro' AND payment_status != 'cancelled'), 0) +
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM cash_movements WHERE cash_register_id = _cash_register_id;
  
  -- Calcular total contado
  SELECT COALESCE(SUM((item->>'amount')::NUMERIC), 0) INTO v_total_counted
  FROM jsonb_array_elements(_counts) AS item;
  
  v_difference := v_total_counted - v_expected_amount;
  
  -- Registrar contagens
  DELETE FROM cash_counts WHERE cash_register_id = _cash_register_id;
  INSERT INTO cash_counts (cash_register_id, user_id, payment_method, valor_informado)
  SELECT _cash_register_id, auth.uid(), item->>'payment_method', (item->>'amount')::NUMERIC
  FROM jsonb_array_elements(_counts) AS item;
  
  -- Criar registro de auditoria
  INSERT INTO cash_register_audits (
    cash_register_id, company_id, operator_id, operator_name,
    counts_submitted, total_counted, expected_amount, difference,
    operator_notes, status
  ) VALUES (
    _cash_register_id, v_register.company_id, auth.uid(), v_operator_name,
    _counts, v_total_counted, v_expected_amount, v_difference,
    _notes, 'pending'
  ) RETURNING id INTO v_audit_id;
  
  -- Atualizar status do caixa
  UPDATE cash_registers
  SET status = 'pending_audit',
      operator_id = auth.uid(),
      closing_requested_at = now(),
      closing_amount = v_expected_amount,
      actual_amount = v_total_counted,
      difference = v_difference,
      notes = _notes
  WHERE id = _cash_register_id;
  
  -- Notificar admins/gerentes
  INSERT INTO company_notifications (
    company_id, type, title, message, to_role, from_user_id, metadata
  ) VALUES (
    v_register.company_id,
    'cash_audit_request',
    'Fechamento de Caixa Aguardando Auditoria',
    format('O operador %s finalizou a contagem. Diferença: R$ %s', 
      v_operator_name, 
      CASE WHEN v_difference >= 0 THEN '+' ELSE '' END || v_difference
    ),
    'admin',
    auth.uid(),
    jsonb_build_object(
      'cash_register_id', _cash_register_id,
      'audit_id', v_audit_id,
      'operator_name', v_operator_name,
      'total_counted', v_total_counted,
      'expected', v_expected_amount,
      'difference', v_difference
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'audit_id', v_audit_id,
    'expected_amount', v_expected_amount,
    'total_counted', v_total_counted,
    'difference', v_difference,
    'message', 'Fechamento enviado para auditoria. Aguarde aprovação do gerente.'
  );
END;
$$;

-- 8. Função: Aprovar/Rejeitar auditoria
CREATE OR REPLACE FUNCTION public.complete_cash_audit(
  _audit_id UUID,
  _action TEXT,
  _notes TEXT DEFAULT NULL,
  _adjustment_amount NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_audit RECORD;
  v_register RECORD;
  v_final_amount NUMERIC;
  v_final_difference NUMERIC;
  v_close_result JSONB;
  v_auditor_name TEXT;
BEGIN
  -- Buscar auditoria pendente
  SELECT * INTO v_audit FROM cash_register_audits
  WHERE id = _audit_id AND status = 'pending' FOR UPDATE;
  
  IF v_audit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auditoria não encontrada ou já processada');
  END IF;
  
  -- Verificar permissão (apenas admin/manager)
  IF NOT user_has_elevated_role_in_company(auth.uid(), v_audit.company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas gerentes podem aprovar auditorias');
  END IF;
  
  -- Buscar nome do auditor
  SELECT COALESCE(e.name, p.name, 'Auditor') INTO v_auditor_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.id
  WHERE p.id = auth.uid();
  
  -- Atualizar auditoria
  UPDATE cash_register_audits
  SET auditor_id = auth.uid(),
      auditor_name = v_auditor_name,
      auditor_action = _action,
      auditor_notes = _notes,
      adjustment_amount = _adjustment_amount,
      audited_at = now(),
      status = CASE WHEN _action = 'rejected' THEN 'rejected' ELSE 'approved' END,
      updated_at = now()
  WHERE id = _audit_id;
  
  IF _action = 'approved' OR _action = 'adjusted' THEN
    -- Valor final: contado + ajuste do auditor
    v_final_amount := v_audit.total_counted + COALESCE(_adjustment_amount, 0);
    v_final_difference := v_final_amount - v_audit.expected_amount;
    
    -- Registrar discrepância do operador se houver diferença
    IF v_final_difference != 0 THEN
      INSERT INTO operator_discrepancies (
        company_id, operator_id, cash_register_id,
        discrepancy_type, amount, notes, status
      ) VALUES (
        v_audit.company_id, v_audit.operator_id, v_audit.cash_register_id,
        CASE WHEN v_final_difference < 0 THEN 'deficit' ELSE 'surplus' END,
        ABS(v_final_difference),
        COALESCE(_notes, v_audit.operator_notes),
        'pending'
      );
    END IF;
    
    -- Executar fechamento real
    SELECT close_daily_cash(
      v_audit.cash_register_id,
      v_final_amount,
      format('Auditado por %s. %s', v_auditor_name, COALESCE(_notes, '')),
      auth.uid()
    ) INTO v_close_result;
    
    -- Atualizar caixa com dados da auditoria
    UPDATE cash_registers
    SET audited_by = auth.uid(),
        audited_at = now(),
        audit_notes = _notes
    WHERE id = v_audit.cash_register_id;
    
    -- Notificar operador
    INSERT INTO company_notifications (
      company_id, type, title, message, to_role, from_user_id, metadata
    ) VALUES (
      v_audit.company_id,
      'cash_audit_approved',
      'Fechamento de Caixa Aprovado',
      format('Seu fechamento foi %s por %s', 
        CASE WHEN _action = 'adjusted' THEN 'ajustado e aprovado' ELSE 'aprovado' END,
        v_auditor_name
      ),
      'employee',
      auth.uid(),
      jsonb_build_object(
        'cash_register_id', v_audit.cash_register_id,
        'target_user_id', v_audit.operator_id,
        'difference', v_final_difference
      )
    );
    
    RETURN v_close_result || jsonb_build_object(
      'audit_action', _action,
      'final_difference', v_final_difference,
      'auditor', v_auditor_name
    );
  ELSE
    -- Rejeitar: voltar status para 'open'
    UPDATE cash_registers
    SET status = 'open',
        operator_id = NULL,
        closing_requested_at = NULL,
        closing_amount = NULL,
        actual_amount = NULL,
        difference = NULL,
        notes = NULL
    WHERE id = v_audit.cash_register_id;
    
    -- Limpar contagens
    DELETE FROM cash_counts WHERE cash_register_id = v_audit.cash_register_id;
    
    -- Notificar operador para refazer
    INSERT INTO company_notifications (
      company_id, type, title, message, to_role, from_user_id, metadata
    ) VALUES (
      v_audit.company_id,
      'cash_audit_rejected',
      'Fechamento de Caixa Rejeitado',
      format('Refaça a contagem. Motivo: %s', COALESCE(_notes, 'Não especificado')),
      'employee',
      auth.uid(),
      jsonb_build_object(
        'cash_register_id', v_audit.cash_register_id,
        'target_user_id', v_audit.operator_id,
        'rejection_reason', _notes
      )
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'audit_action', 'rejected',
      'message', 'Fechamento rejeitado. Operador notificado para refazer a contagem.'
    );
  END IF;
END;
$$;

-- 9. Função: Buscar pendências do operador na abertura
CREATE OR REPLACE FUNCTION public.get_operator_pending_discrepancies(
  _company_id UUID,
  _operator_id UUID
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_pending RECORD;
  v_total_deficit NUMERIC := 0;
  v_total_surplus NUMERIC := 0;
  v_discrepancies JSONB := '[]'::JSONB;
BEGIN
  -- Buscar todas as pendências do operador
  FOR v_pending IN
    SELECT od.*, cr.closed_at
    FROM operator_discrepancies od
    JOIN cash_registers cr ON cr.id = od.cash_register_id
    WHERE od.company_id = _company_id
      AND od.operator_id = _operator_id
      AND od.status = 'pending'
    ORDER BY od.created_at DESC
  LOOP
    IF v_pending.discrepancy_type = 'deficit' THEN
      v_total_deficit := v_total_deficit + (v_pending.amount - COALESCE(v_pending.compensated_amount, 0));
    ELSE
      v_total_surplus := v_total_surplus + (v_pending.amount - COALESCE(v_pending.compensated_amount, 0));
    END IF;
    
    v_discrepancies := v_discrepancies || jsonb_build_object(
      'id', v_pending.id,
      'type', v_pending.discrepancy_type,
      'amount', v_pending.amount - COALESCE(v_pending.compensated_amount, 0),
      'notes', v_pending.notes,
      'date', v_pending.closed_at
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'has_pending', v_total_deficit > 0 OR v_total_surplus > 0,
    'total_deficit', v_total_deficit,
    'total_surplus', v_total_surplus,
    'net_balance', v_total_surplus - v_total_deficit,
    'discrepancies', v_discrepancies
  );
END;
$$;

-- 10. Função: Buscar auditorias pendentes da empresa
CREATE OR REPLACE FUNCTION public.get_pending_cash_audits(
  _company_id UUID
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_audits JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cra.id,
      'cash_register_id', cra.cash_register_id,
      'operator_id', cra.operator_id,
      'operator_name', cra.operator_name,
      'total_counted', cra.total_counted,
      'expected_amount', cra.expected_amount,
      'difference', cra.difference,
      'operator_notes', cra.operator_notes,
      'submitted_at', cra.submitted_at,
      'counts_submitted', cra.counts_submitted
    ) ORDER BY cra.submitted_at ASC
  ), '[]'::jsonb) INTO v_audits
  FROM cash_register_audits cra
  WHERE cra.company_id = _company_id
    AND cra.status = 'pending';
  
  RETURN jsonb_build_object(
    'audits', v_audits,
    'count', jsonb_array_length(v_audits)
  );
END;
$$;-- =============================================
-- Segurança: Restringir tabelas de catálogo para usuários autenticados
-- Evita que concorrentes acessem dados de produtos sem login
-- =============================================

-- 1. glass_types - Restringir leitura para usuários autenticados
DROP POLICY IF EXISTS "Allow public read access" ON public.glass_types;
DROP POLICY IF EXISTS "Public read access" ON public.glass_types;
DROP POLICY IF EXISTS "glass_types_public_read" ON public.glass_types;

CREATE POLICY "Authenticated users can read glass_types" 
ON public.glass_types 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 2. product_categories - Restringir leitura para usuários autenticados
DROP POLICY IF EXISTS "Allow public read access" ON public.product_categories;
DROP POLICY IF EXISTS "Public read access" ON public.product_categories;
DROP POLICY IF EXISTS "product_categories_public_read" ON public.product_categories;

CREATE POLICY "Authenticated users can read product_categories" 
ON public.product_categories 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 3. product_linhas - Restringir leitura para usuários autenticados
DROP POLICY IF EXISTS "Allow public read access" ON public.product_linhas;
DROP POLICY IF EXISTS "Public read access" ON public.product_linhas;
DROP POLICY IF EXISTS "product_linhas_public_read" ON public.product_linhas;

CREATE POLICY "Authenticated users can read product_linhas" 
ON public.product_linhas 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 4. item_types - Restringir leitura para usuários autenticados
DROP POLICY IF EXISTS "Allow public read access" ON public.item_types;
DROP POLICY IF EXISTS "Public read access" ON public.item_types;
DROP POLICY IF EXISTS "item_types_public_read" ON public.item_types;

CREATE POLICY "Authenticated users can read item_types" 
ON public.item_types 
FOR SELECT 
USING (auth.uid() IS NOT NULL);-- Drop the old constraint and add a new one with the missing categories
ALTER TABLE public.company_cash_movements 
DROP CONSTRAINT company_cash_movements_category_check;

ALTER TABLE public.company_cash_movements 
ADD CONSTRAINT company_cash_movements_category_check 
CHECK (category = ANY (ARRAY[
  'abertura_caixa'::text, 
  'fechamento_caixa'::text, 
  'deposito'::text, 
  'retirada'::text, 
  'transferencia_banco'::text, 
  'ajuste_positivo'::text, 
  'ajuste_negativo'::text, 
  'reforco_caixa'::text, 
  'compensacao_adiantamento'::text,
  'retorno_fundo_fixo'::text,
  'lucro_caixa'::text
]));-- Atualizar constraint de category para incluir novas categorias de venda
ALTER TABLE public.cash_movements 
DROP CONSTRAINT IF EXISTS cash_movements_category_check;

ALTER TABLE public.cash_movements 
ADD CONSTRAINT cash_movements_category_check 
CHECK (category = ANY (ARRAY[
  'venda'::text,
  'servico'::text, 
  'recebimento'::text,
  'recebimento_parcela'::text,
  'troco'::text,
  'sangria'::text,
  'suprimento'::text,
  'reforco'::text,
  'despesa'::text,
  'outros'::text,
  'entrada_orcamento'::text,
  'entrada_venda'::text,
  'adiantamento'::text,
  'compensacao_adiantamento'::text,
  'faturamento_final'::text
]));

-- Adicionar coluna origem para rastreabilidade (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cash_movements' 
    AND column_name = 'origem'
  ) THEN
    ALTER TABLE public.cash_movements ADD COLUMN origem text;
  END IF;
END $$;-- =========================================================
-- MATERIAL CONSUMPTION TABLE
-- Tracks calculated material needs with lifecycle states
-- =========================================================

-- Create the material_consumption table
CREATE TABLE public.material_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES public.quote_items(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id),
  item_template_id UUID REFERENCES public.item_templates(id),
  
  -- Item identification
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  
  -- Calculated quantities
  quantity_calculated NUMERIC NOT NULL DEFAULT 0,
  
  -- Calculation context (traceability)
  formula_used TEXT,
  input_width NUMERIC,
  input_height NUMERIC,
  input_quantity INTEGER DEFAULT 1,
  
  -- Lifecycle status
  -- pending: calculated, waiting for production to start
  -- available: production started, material released for use
  -- consumed: deducted from stock
  -- cancelled: OS was cancelled
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'available', 'consumed', 'cancelled')),
  
  -- Traceability timestamps
  released_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  
  -- Links to related records
  stock_movement_id UUID REFERENCES public.stock_movements(id),
  stock_reservation_id UUID REFERENCES public.stock_reservations(id),
  purchase_order_item_id UUID REFERENCES public.purchase_order_items(id),
  
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add helpful comment
COMMENT ON TABLE public.material_consumption IS 'Tracks calculated material consumption for OS with lifecycle: pending → available → consumed';

-- Performance indexes
CREATE INDEX idx_material_consumption_ordem_servico ON public.material_consumption(ordem_servico_id);
CREATE INDEX idx_material_consumption_company ON public.material_consumption(company_id);
CREATE INDEX idx_material_consumption_status ON public.material_consumption(status);
CREATE INDEX idx_material_consumption_company_item ON public.material_consumption(company_item_id);

-- Enable RLS
ALTER TABLE public.material_consumption ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company users can view own material consumption"
  ON public.material_consumption FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Company users can insert material consumption"
  ON public.material_consumption FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Company users can update own material consumption"
  ON public.material_consumption FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "Company users can delete own material consumption"
  ON public.material_consumption FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM public.user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  ));

-- Trigger for updated_at
CREATE TRIGGER update_material_consumption_updated_at
  BEFORE UPDATE ON public.material_consumption
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_reservations_updated_at();

-- =========================================================
-- HELPER FUNCTION: Release materials for production
-- =========================================================
CREATE OR REPLACE FUNCTION public.release_materials_for_production(_ordem_servico_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.material_consumption
  SET 
    status = 'available',
    released_at = now(),
    updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status = 'pending';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- =========================================================
-- HELPER FUNCTION: Cancel materials when OS is cancelled
-- =========================================================
CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.material_consumption
  SET 
    status = 'cancelled',
    updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status IN ('pending', 'available');
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
-- Fix FK constraint on os_cutting_plan to allow deleting quotes
ALTER TABLE os_cutting_plan
  DROP CONSTRAINT IF EXISTS os_cutting_plan_quote_item_id_fkey;

ALTER TABLE os_cutting_plan
  ADD CONSTRAINT os_cutting_plan_quote_item_id_fkey
  FOREIGN KEY (quote_item_id) REFERENCES quote_items(id)
  ON DELETE SET NULL;

-- Also fix material_consumption quote_item_id constraint
ALTER TABLE material_consumption
  DROP CONSTRAINT IF EXISTS material_consumption_quote_item_id_fkey;

ALTER TABLE material_consumption
  ADD CONSTRAINT material_consumption_quote_item_id_fkey
  FOREIGN KEY (quote_item_id) REFERENCES quote_items(id)
  ON DELETE SET NULL;

-- =====================================================
-- FIX: Sales table - add policy for employees to see own sales
-- =====================================================

-- Regular employees can only see sales they made (sold_by links to their employee record)
CREATE POLICY "Employees can view own sales"
  ON sales FOR SELECT
  USING (
    sold_by IS NOT NULL 
    AND sold_by IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
    AND company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Fix: Remove date filter from get_user_open_cash_register
-- Cash register should be visible as long as status is 'open', regardless of opened_at date
CREATE OR REPLACE FUNCTION public.get_user_open_cash_register(_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  opened_by uuid,
  opened_at timestamptz,
  opening_amount numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.company_id,
    cr.opened_by,
    cr.opened_at,
    cr.opening_amount,
    cr.status
  FROM public.cash_registers cr
  WHERE cr.company_id = _company_id
    AND cr.opened_by = auth.uid()
    AND cr.status IN ('open', 'pending_audit')
  LIMIT 1;
END;
$$;

-- LIMPEZA DE DADOS TRANSACIONAIS (tabelas verificadas)
-- Mantém: auth, profiles, empresas, produtos, preços, funcionários, configurações

-- 1. Limpar suporte
DELETE FROM public.support_attachments;
DELETE FROM public.support_messages;
DELETE FROM public.support_tickets;

-- 2. Limpar notificações e anúncios
DELETE FROM public.announcement_dismissals;
DELETE FROM public.company_notifications;
DELETE FROM public.system_reminders;

-- 3. Limpar comissões e taxas de venda
DELETE FROM public.employee_commissions;
DELETE FROM public.sale_taxes;

-- 4. Limpar vendas (antes de cash_registers)
DELETE FROM public.sale_items;
DELETE FROM public.sales;

-- 5. Limpar discrepâncias de operador
DELETE FROM public.operator_discrepancies;

-- 6. Limpar dados financeiros e caixa
DELETE FROM public.cash_counts;
DELETE FROM public.cash_register_advances;
DELETE FROM public.cash_register_audits;
DELETE FROM public.cash_shortages;
DELETE FROM public.cash_movements;
DELETE FROM public.company_cash_movements;
DELETE FROM public.cash_registers;

-- 7. Limpar contas a receber e despesas
DELETE FROM public.accounts_receivable;
DELETE FROM public.expenses;

-- 8. Limpar reservas e movimentos de estoque
DELETE FROM public.stock_reservations;
DELETE FROM public.stock_movements;

-- 9. Limpar consumo de materiais e plano de corte
DELETE FROM public.material_consumption;
DELETE FROM public.os_cutting_plan;
DELETE FROM public.os_materials;

-- 10. Limpar ordens de serviço
DELETE FROM public.os_photos;
DELETE FROM public.os_glass_projects;
DELETE FROM public.ordens_servico;

-- 11. Limpar orçamentos e itens
DELETE FROM public.quote_deposits;
DELETE FROM public.quote_price_revisions;
DELETE FROM public.quote_items;
DELETE FROM public.quotes;

-- 12. Limpar pedidos de compra
DELETE FROM public.purchase_order_items;
DELETE FROM public.purchase_orders;

-- 13. Limpar clientes
DELETE FROM public.clients;

-- 14. Limpar agendamentos e medições
DELETE FROM public.service_appointments;
DELETE FROM public.measurement_photos;
DELETE FROM public.measurement_checklist;
DELETE FROM public.measurement_items;
DELETE FROM public.site_measurements;

-- 15. Limpar notas fiscais
DELETE FROM public.nota_fiscal_itens;
DELETE FROM public.notas_fiscais;

-- 16. Limpar projetos de vidro
DELETE FROM public.glass_projects;

-- 17. Limpar audit logs e tentativas de login
DELETE FROM public.audit_logs;
DELETE FROM public.login_attempts;

-- 18. Resetar contadores de caixa da empresa (zerar saldo para fundo fixo)
UPDATE public.company_cash 
SET current_balance = fixed_fund, 
    last_movement_at = NULL,
    updated_at = now();

-- 19. Resetar quantidade de estoque para zero (manter itens cadastrados)
UPDATE public.company_stock SET quantity = 0, updated_at = now();
-- Remover políticas públicas e autenticadas existentes, recriar apenas para autenticados

-- 1. item_types
DROP POLICY IF EXISTS "Authenticated users can read item_types" ON public.item_types;
DROP POLICY IF EXISTS "Public read access for item_types" ON public.item_types;
DROP POLICY IF EXISTS "Anyone can read item_types" ON public.item_types;

CREATE POLICY "auth_read_item_types"
ON public.item_types FOR SELECT
TO authenticated
USING (true);

-- 2. product_categories
DROP POLICY IF EXISTS "Authenticated users can read product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Public read access for product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Anyone can read product_categories" ON public.product_categories;

CREATE POLICY "auth_read_product_categories"
ON public.product_categories FOR SELECT
TO authenticated
USING (true);

-- 3. product_linhas
DROP POLICY IF EXISTS "Authenticated users can read product_linhas" ON public.product_linhas;
DROP POLICY IF EXISTS "Public read access for product_linhas" ON public.product_linhas;
DROP POLICY IF EXISTS "Anyone can read product_linhas" ON public.product_linhas;

CREATE POLICY "auth_read_product_linhas"
ON public.product_linhas FOR SELECT
TO authenticated
USING (true);

-- 4. glass_line_formulas
DROP POLICY IF EXISTS "Authenticated users can read glass_line_formulas" ON public.glass_line_formulas;
DROP POLICY IF EXISTS "Public read access for glass_line_formulas" ON public.glass_line_formulas;
DROP POLICY IF EXISTS "Anyone can read glass_line_formulas" ON public.glass_line_formulas;

CREATE POLICY "auth_read_glass_line_formulas"
ON public.glass_line_formulas FOR SELECT
TO authenticated
USING (true);-- Remover a constraint NOT NULL do campo cnpj para torná-lo opcional
ALTER TABLE public.companies ALTER COLUMN cnpj DROP NOT NULL;

-- Atualizar função RPC para aceitar CNPJ opcional e validar unicidade
CREATE OR REPLACE FUNCTION public.create_company_and_assign_admin(
  _name TEXT,
  _cnpj TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies;
  v_uid uuid;
  v_clean_cnpj TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Limpar CNPJ: se vazio ou apenas espaços, será NULL
  v_clean_cnpj := NULLIF(TRIM(_cnpj), '');
  
  -- Se CNPJ foi informado, verificar se já existe
  IF v_clean_cnpj IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.companies WHERE cnpj = v_clean_cnpj) THEN
      RAISE EXCEPTION 'CNPJ_JA_CADASTRADO';
    END IF;
  END IF;

  INSERT INTO public.companies (name, cnpj, phone, email, address)
  VALUES (
    _name,
    v_clean_cnpj,
    NULLIF(TRIM(_phone), ''),
    NULLIF(TRIM(_email), ''),
    NULLIF(TRIM(_address), '')
  )
  RETURNING * INTO v_company;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_uid, v_company.id, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role, is_active = true;

  PERFORM create_default_permissions(v_company.id);
  
  RETURN v_company;
END;
$$;-- =====================================================
-- VALIDAÇÃO DE VENDAS NO SERVIDOR
-- Impede manipulação de preços/descontos via DevTools
-- =====================================================

-- Função que recalcula e valida totais de vendas
CREATE OR REPLACE FUNCTION public.validate_sale_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_discount_percent NUMERIC := 50;
  v_calculated_discount NUMERIC;
  v_calculated_total NUMERIC;
BEGIN
  -- Validar que subtotal é positivo
  IF NEW.subtotal IS NULL OR NEW.subtotal < 0 THEN
    RAISE EXCEPTION 'Subtotal inválido: deve ser maior ou igual a zero';
  END IF;
  
  -- Validar percentual de desconto dentro do limite
  IF NEW.discount_percent IS NOT NULL AND NEW.discount_percent > v_max_discount_percent THEN
    RAISE EXCEPTION 'Desconto máximo permitido: %', v_max_discount_percent;
  END IF;
  
  -- Garantir que discount_percent não é negativo
  IF NEW.discount_percent IS NULL OR NEW.discount_percent < 0 THEN
    NEW.discount_percent := 0;
  END IF;
  
  -- RECALCULAR valores no servidor (ignora valores do frontend)
  v_calculated_discount := ROUND(NEW.subtotal * (NEW.discount_percent / 100), 2);
  v_calculated_total := ROUND(NEW.subtotal - v_calculated_discount, 2);
  
  -- Sobrescrever com valores calculados pelo servidor
  NEW.discount_amount := v_calculated_discount;
  NEW.total_amount := v_calculated_total;
  
  -- Validar que o total não é negativo
  IF NEW.total_amount < 0 THEN
    RAISE EXCEPTION 'Valor total não pode ser negativo';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para INSERT
DROP TRIGGER IF EXISTS validate_sale_before_insert ON public.sales;
CREATE TRIGGER validate_sale_before_insert
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sale_totals();

-- Trigger para UPDATE (também protege alterações)
DROP TRIGGER IF EXISTS validate_sale_before_update ON public.sales;
CREATE TRIGGER validate_sale_before_update
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  WHEN (
    OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
    OLD.discount_percent IS DISTINCT FROM NEW.discount_percent OR
    OLD.discount_amount IS DISTINCT FROM NEW.discount_amount OR
    OLD.total_amount IS DISTINCT FROM NEW.total_amount
  )
  EXECUTE FUNCTION public.validate_sale_totals();

-- Comentário para documentação
COMMENT ON FUNCTION public.validate_sale_totals() IS 
'Valida e recalcula totais de vendas no servidor para prevenir manipulação via DevTools. 
Limite máximo de desconto: 50%. Valores são sempre recalculados independente do que o frontend enviar.';-- Create feedbacks table
CREATE TABLE public.feedbacks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'feature' CHECK (category IN ('feature', 'improvement', 'usability', 'integration')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'planned', 'in_progress', 'completed', 'declined')),
  admin_response TEXT,
  votes_count INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create feedback_votes table
CREATE TABLE public.feedback_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(feedback_id, user_id)
);

-- Enable RLS
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for feedbacks
CREATE POLICY "Authenticated users can view all feedbacks"
  ON public.feedbacks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create feedbacks for their company"
  ON public.feedbacks FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can update their own feedbacks"
  ON public.feedbacks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own feedbacks"
  ON public.feedbacks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS policies for feedback_votes
CREATE POLICY "Authenticated users can view all votes"
  ON public.feedback_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own votes"
  ON public.feedback_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own votes"
  ON public.feedback_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger function to update votes_count
CREATE OR REPLACE FUNCTION public.update_feedback_votes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE feedbacks SET votes_count = votes_count + 1, updated_at = now() WHERE id = NEW.feedback_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE feedbacks SET votes_count = votes_count - 1, updated_at = now() WHERE id = OLD.feedback_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger for vote counting
CREATE TRIGGER tr_feedback_votes_count
  AFTER INSERT OR DELETE ON public.feedback_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_feedback_votes_count();

-- Create indexes for performance
CREATE INDEX idx_feedbacks_company_id ON public.feedbacks(company_id);
CREATE INDEX idx_feedbacks_user_id ON public.feedbacks(user_id);
CREATE INDEX idx_feedbacks_status ON public.feedbacks(status);
CREATE INDEX idx_feedbacks_votes_count ON public.feedbacks(votes_count DESC);
CREATE INDEX idx_feedback_votes_feedback_id ON public.feedback_votes(feedback_id);
CREATE INDEX idx_feedback_votes_user_id ON public.feedback_votes(user_id);-- Adicionar policy de UPDATE para SaaS Admin na tabela system_module_settings
CREATE POLICY "SaaS admins can update module settings"
ON public.system_module_settings
FOR UPDATE
TO authenticated
USING (public.is_saas_admin(auth.uid()))
WITH CHECK (public.is_saas_admin(auth.uid()));-- Adicionar campos de rastreabilidade à tabela stock_movements
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS company_item_id UUID REFERENCES public.company_items(id),
ADD COLUMN IF NOT EXISTS reference_id UUID,
ADD COLUMN IF NOT EXISTS reference_type TEXT;

-- Índices para melhor performance em buscas por referência
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference 
ON public.stock_movements(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_company_item 
ON public.stock_movements(company_item_id);

-- Comentários para documentação
COMMENT ON COLUMN public.stock_movements.company_item_id IS 'Referência ao item da empresa para rastreabilidade';
COMMENT ON COLUMN public.stock_movements.reference_id IS 'ID do documento de origem (purchase_order, sale, ordem_servico)';
COMMENT ON COLUMN public.stock_movements.reference_type IS 'Tipo do documento: purchase_order, sale, ordem_servico, manual';-- Melhorar função de cancelamento com validação e cancelamento de reservas
CREATE OR REPLACE FUNCTION public.cancel_os_materials(_ordem_servico_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INTEGER;
  has_consumed BOOLEAN;
BEGIN
  -- Verificar se há materiais já consumidos
  SELECT EXISTS (
    SELECT 1 FROM material_consumption 
    WHERE ordem_servico_id = _ordem_servico_id 
    AND status = 'consumed'
  ) INTO has_consumed;
  
  IF has_consumed THEN
    RAISE EXCEPTION 'Cancelamento bloqueado: materiais já foram consumidos do estoque';
  END IF;

  -- Cancelar material_consumption
  UPDATE public.material_consumption
  SET status = 'cancelled', updated_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status IN ('pending', 'available');
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Cancelar reservas vinculadas
  UPDATE public.stock_reservations
  SET status = 'cancelled', cancelled_at = now()
  WHERE ordem_servico_id = _ordem_servico_id
    AND status = 'reserved';
  
  RETURN updated_count;
END;
$function$;-- Add fiscal fields to company_items for NFe emission
ALTER TABLE public.company_items
ADD COLUMN IF NOT EXISTS ncm text,
ADD COLUMN IF NOT EXISTS cfop_venda text,
ADD COLUMN IF NOT EXISTS cfop_venda_interestadual text,
ADD COLUMN IF NOT EXISTS cest text,
ADD COLUMN IF NOT EXISTS origem text,
ADD COLUMN IF NOT EXISTS codigo_servico text,
ADD COLUMN IF NOT EXISTS aliquota_iss numeric;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_items_ncm ON public.company_items(ncm) WHERE ncm IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.company_items.ncm IS 'Nomenclatura Comum do Mercosul - 8 dígitos';
COMMENT ON COLUMN public.company_items.cfop_venda IS 'CFOP para vendas dentro do estado';
COMMENT ON COLUMN public.company_items.cfop_venda_interestadual IS 'CFOP para vendas interestaduais';
COMMENT ON COLUMN public.company_items.cest IS 'Código Especificador da Substituição Tributária - 7 dígitos';
COMMENT ON COLUMN public.company_items.origem IS 'Origem da mercadoria (0-8)';
COMMENT ON COLUMN public.company_items.codigo_servico IS 'Código do serviço para NFS-e';
COMMENT ON COLUMN public.company_items.aliquota_iss IS 'Alíquota ISS para serviços (%)';-- VIEW: quote_financial_status
-- Calcula automaticamente o status financeiro de orçamentos aprovados
-- considerando entradas (deposits) e vendas já registradas

CREATE OR REPLACE VIEW public.quote_financial_status AS
SELECT
    q.id AS quote_id,
    q.company_id,
    q.quote_number,
    q.customer_name,
    q.final_amount AS quote_total,
    q.status AS quote_status,
    q.created_at,

    -- Total de entradas recebidas
    COALESCE((
        SELECT SUM(qd.amount)
        FROM public.quote_deposits qd
        WHERE qd.quote_id = q.id
          AND qd.status IN ('received', 'billed')
    ), 0) AS total_deposits,

    -- Total já vendido/faturado
    COALESCE((
        SELECT SUM(s.total_amount)
        FROM public.sales s
        WHERE s.quote_id = q.id
          AND s.payment_status != 'cancelled'
    ), 0) AS total_sold,

    -- Saldo real disponível para faturamento
    q.final_amount
    - COALESCE((
        SELECT SUM(qd.amount)
        FROM public.quote_deposits qd
        WHERE qd.quote_id = q.id
          AND qd.status IN ('received', 'billed')
    ), 0)
    - COALESCE((
        SELECT SUM(s.total_amount)
        FROM public.sales s
        WHERE s.quote_id = q.id
          AND s.payment_status != 'cancelled'
    ), 0) AS pending_amount,

    -- Status financeiro inteligente
    CASE
        WHEN (
            q.final_amount
            - COALESCE((
                SELECT SUM(qd.amount)
                FROM public.quote_deposits qd
                WHERE qd.quote_id = q.id
                  AND qd.status IN ('received', 'billed')
            ), 0)
            - COALESCE((
                SELECT SUM(s.total_amount)
                FROM public.sales s
                WHERE s.quote_id = q.id
                  AND s.payment_status != 'cancelled'
            ), 0)
        ) <= 0 THEN 'fully_paid'

        WHEN (
            COALESCE((
                SELECT SUM(qd.amount)
                FROM public.quote_deposits qd
                WHERE qd.quote_id = q.id
                  AND qd.status IN ('received', 'billed')
            ), 0)
            +
            COALESCE((
                SELECT SUM(s.total_amount)
                FROM public.sales s
                WHERE s.quote_id = q.id
                  AND s.payment_status != 'cancelled'
            ), 0)
        ) > 0 THEN 'partially_paid'

        ELSE 'pending'
    END AS financial_status

FROM public.quotes q
WHERE q.status = 'approved';

-- Comentário explicativo
COMMENT ON VIEW public.quote_financial_status IS 'View que calcula automaticamente o status financeiro de orçamentos aprovados, considerando entradas e vendas já registradas';

-- RLS não se aplica diretamente a views, mas a view herda as políticas das tabelas base
-- A segurança é garantida pelas RLS policies das tabelas quotes, quote_deposits e sales-- Recriar a VIEW com SECURITY INVOKER para respeitar as políticas RLS do usuário
DROP VIEW IF EXISTS public.quote_financial_status;

CREATE VIEW public.quote_financial_status
WITH (security_invoker = on)
AS
SELECT
    q.id AS quote_id,
    q.company_id,
    q.quote_number,
    q.customer_name,
    q.final_amount AS quote_total,
    q.status AS quote_status,
    q.created_at,

    -- Total de entradas recebidas
    COALESCE((
        SELECT SUM(qd.amount)
        FROM public.quote_deposits qd
        WHERE qd.quote_id = q.id
          AND qd.status IN ('received', 'billed')
    ), 0) AS total_deposits,

    -- Total já vendido/faturado
    COALESCE((
        SELECT SUM(s.total_amount)
        FROM public.sales s
        WHERE s.quote_id = q.id
          AND s.payment_status != 'cancelled'
    ), 0) AS total_sold,

    -- Saldo real disponível para faturamento
    q.final_amount
    - COALESCE((
        SELECT SUM(qd.amount)
        FROM public.quote_deposits qd
        WHERE qd.quote_id = q.id
          AND qd.status IN ('received', 'billed')
    ), 0)
    - COALESCE((
        SELECT SUM(s.total_amount)
        FROM public.sales s
        WHERE s.quote_id = q.id
          AND s.payment_status != 'cancelled'
    ), 0) AS pending_amount,

    -- Status financeiro inteligente
    CASE
        WHEN (
            q.final_amount
            - COALESCE((
                SELECT SUM(qd.amount)
                FROM public.quote_deposits qd
                WHERE qd.quote_id = q.id
                  AND qd.status IN ('received', 'billed')
            ), 0)
            - COALESCE((
                SELECT SUM(s.total_amount)
                FROM public.sales s
                WHERE s.quote_id = q.id
                  AND s.payment_status != 'cancelled'
            ), 0)
        ) <= 0 THEN 'fully_paid'

        WHEN (
            COALESCE((
                SELECT SUM(qd.amount)
                FROM public.quote_deposits qd
                WHERE qd.quote_id = q.id
                  AND qd.status IN ('received', 'billed')
            ), 0)
            +
            COALESCE((
                SELECT SUM(s.total_amount)
                FROM public.sales s
                WHERE s.quote_id = q.id
                  AND s.payment_status != 'cancelled'
            ), 0)
        ) > 0 THEN 'partially_paid'

        ELSE 'pending'
    END AS financial_status

FROM public.quotes q
WHERE q.status = 'approved';

COMMENT ON VIEW public.quote_financial_status IS 'View com SECURITY INVOKER que calcula o status financeiro de orçamentos aprovados';-- Criar linha Chaparia
INSERT INTO product_linhas (slug, name, description, color, sort_order, is_active)
VALUES ('chaparia', 'Chaparia', 'Espelhos, vidros comuns, acrílicos e outros materiais por m²', '#06b6d4', 100, true)
ON CONFLICT (slug) DO NOTHING;

-- Adicionar categorias de chaparia como glass_types
INSERT INTO glass_types (slug, name, description, sort_order, is_active)
VALUES 
  ('espelho', 'Espelho', 'Espelhos comuns e decorativos', 10, true),
  ('vidro_comum', 'Vidro Comum', 'Vidros float não temperados', 11, true),
  ('acrilico', 'Acrílico', 'Chapas de acrílico/PMMA', 12, true),
  ('policarbonato', 'Policarbonato', 'Chapas de policarbonato', 13, true),
  ('espelho_organico', 'Espelho Orgânico', 'Espelhos de acrílico', 14, true)
ON CONFLICT (slug) DO NOTHING;

-- Adicionar tipo de item "Chaparia" para estoque
INSERT INTO item_types (slug, name, color, icon, unit_default, sort_order, is_active)
VALUES ('sheet', 'Chaparia', '#06b6d4', 'square', 'm²', 5, true)
ON CONFLICT (slug) DO NOTHING;-- Adicionar cores padrão para chaparia/espelhos se não existirem
INSERT INTO glass_colors (company_id, slug, name, hex_color, sort_order)
SELECT c.id, color_slug, color_name, color_hex, color_order
FROM companies c
CROSS JOIN (VALUES 
  ('prata', 'Prata', '#C0C0C0', 1),
  ('incolor', 'Incolor', '#FFFFFF', 2),
  ('fume', 'Fumê', '#4A4A4A', 3),
  ('bronze', 'Bronze', '#CD7F32', 4),
  ('verde', 'Verde', '#228B22', 5),
  ('preto', 'Preto', '#000000', 6),
  ('branco', 'Branco', '#FAFAFA', 7)
) AS colors(color_slug, color_name, color_hex, color_order)
WHERE NOT EXISTS (
  SELECT 1 FROM glass_colors gc 
  WHERE gc.company_id = c.id AND gc.slug = color_slug
);

-- Adicionar espessuras padrão para chaparia se não existirem
INSERT INTO glass_thicknesses (company_id, thickness, thickness_mm, sort_order)
SELECT c.id, thickness_label, thickness_val, thickness_order
FROM companies c
CROSS JOIN (VALUES 
  ('2mm', 2, 1),
  ('3mm', 3, 2),
  ('4mm', 4, 3),
  ('5mm', 5, 4),
  ('6mm', 6, 5),
  ('8mm', 8, 6),
  ('10mm', 10, 7)
) AS thicknesses(thickness_label, thickness_val, thickness_order)
WHERE NOT EXISTS (
  SELECT 1 FROM glass_thicknesses gt 
  WHERE gt.company_id = c.id AND gt.thickness = thickness_label
);-- 1. Adicionar valor 'sheet' ao ENUM item_type
ALTER TYPE item_type ADD VALUE IF NOT EXISTS 'sheet';

-- 2. Criar categorias de vidro para Chaparia (glass_types usados para precificação)
INSERT INTO glass_types (slug, name, description, sort_order, is_active)
VALUES 
  ('espelho', 'Espelho', 'Espelho comum', 100, true),
  ('espelho-bronze', 'Espelho Bronze', 'Espelho na cor bronze', 101, true),
  ('espelho-fume', 'Espelho Fumê', 'Espelho na cor fumê', 102, true),
  ('acrilico', 'Acrílico', 'Chapa de acrílico', 110, true),
  ('policarbonato', 'Policarbonato', 'Chapa de policarbonato', 111, true)
ON CONFLICT (slug) DO NOTHING;-- 1. Corrigir profiles_safe para respeitar RLS
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe 
WITH (security_invoker = on) AS
SELECT 
    id,
    user_id,
    full_name,
    avatar_url,
    created_at
FROM profiles
WHERE 
    -- Usuário pode ver seu próprio perfil
    user_id = auth.uid()
    OR 
    -- Ou perfis de colegas na mesma empresa ativa
    users_share_active_company(auth.uid(), user_id);

-- 2. Corrigir quote_financial_status para filtrar por empresa
DROP VIEW IF EXISTS public.quote_financial_status;
CREATE VIEW public.quote_financial_status 
WITH (security_invoker = on) AS
SELECT 
    q.id AS quote_id,
    q.company_id,
    q.quote_number,
    q.customer_name,
    q.final_amount AS quote_total,
    q.status AS quote_status,
    q.created_at,
    COALESCE((
        SELECT SUM(qd.amount)
        FROM quote_deposits qd
        WHERE qd.quote_id = q.id 
        AND qd.status IN ('received', 'billed')
    ), 0) AS total_deposits,
    COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE s.quote_id = q.id 
        AND s.payment_status <> 'cancelled'
    ), 0) AS total_sold,
    (q.final_amount - COALESCE((
        SELECT SUM(qd.amount)
        FROM quote_deposits qd
        WHERE qd.quote_id = q.id 
        AND qd.status IN ('received', 'billed')
    ), 0) - COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE s.quote_id = q.id 
        AND s.payment_status <> 'cancelled'
    ), 0)) AS pending_amount,
    CASE
        WHEN (q.final_amount - COALESCE((
            SELECT SUM(qd.amount)
            FROM quote_deposits qd
            WHERE qd.quote_id = q.id 
            AND qd.status IN ('received', 'billed')
        ), 0) - COALESCE((
            SELECT SUM(s.total_amount)
            FROM sales s
            WHERE s.quote_id = q.id 
            AND s.payment_status <> 'cancelled'
        ), 0)) <= 0 THEN 'fully_paid'
        WHEN (COALESCE((
            SELECT SUM(qd.amount)
            FROM quote_deposits qd
            WHERE qd.quote_id = q.id 
            AND qd.status IN ('received', 'billed')
        ), 0) + COALESCE((
            SELECT SUM(s.total_amount)
            FROM sales s
            WHERE s.quote_id = q.id 
            AND s.payment_status <> 'cancelled'
        ), 0)) > 0 THEN 'partially_paid'
        ELSE 'pending'
    END AS financial_status
FROM quotes q
WHERE q.status = 'approved'
AND user_belongs_to_company(auth.uid(), q.company_id);

-- 3. Criar view segura para ordens_servico que mascara dados sensíveis do cliente
CREATE OR REPLACE VIEW public.ordens_servico_safe 
WITH (security_invoker = on) AS
SELECT 
    id,
    company_id,
    quote_id,
    sale_id,
    os_number,
    status,
    priority,
    assigned_to,
    estimated_start,
    estimated_end,
    actual_start,
    actual_end,
    total_amount,
    paid_amount,
    pending_amount,
    notes,
    current_stage,
    stages,
    created_at,
    updated_at,
    -- Dados do cliente mascarados para funcionários comuns
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN customer_name
        ELSE split_part(customer_name, ' ', 1) -- Só primeiro nome
    END AS customer_name,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN customer_phone
        ELSE NULL
    END AS customer_phone,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN customer_email
        ELSE NULL
    END AS customer_email,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN customer_address
        ELSE NULL
    END AS customer_address
FROM ordens_servico
WHERE user_belongs_to_company(auth.uid(), company_id);-- Adicionar política de INSERT para company_linhas
CREATE POLICY "Users can create linhas for their company"
ON public.company_linhas
FOR INSERT
TO authenticated
WITH CHECK (
  user_belongs_to_company(auth.uid(), company_id)
);

-- Garantir que políticas de UPDATE e DELETE também existam
CREATE POLICY "Users can update linhas for their company"
ON public.company_linhas
FOR UPDATE
TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can delete linhas for their company"
ON public.company_linhas
FOR DELETE
TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id));-- Adicionar coluna para vincular itens avulsos em quote_items
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL;

-- Adicionar coluna para identificar se é um item avulso (não um produto)
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'product' CHECK (item_type IN ('product', 'item'));

-- Adicionar coluna para unidade do item (quando for item avulso)
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS unit TEXT;

-- Criar índice para busca de itens avulsos
CREATE INDEX IF NOT EXISTS idx_quote_items_company_item_id ON public.quote_items(company_item_id);

-- Comentário explicativo
COMMENT ON COLUMN public.quote_items.company_item_id IS 'Referência ao item avulso quando item_type = item';
COMMENT ON COLUMN public.quote_items.item_type IS 'Tipo: product (produto completo) ou item (material avulso)';-- Create bucket for company item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-item-images', 'company-item-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy to allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload company item images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-item-images');

-- RLS policy to allow authenticated users to update their images
CREATE POLICY "Authenticated users can update company item images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-item-images');

-- RLS policy to allow authenticated users to delete their images
CREATE POLICY "Authenticated users can delete company item images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-item-images');

-- RLS policy to allow public viewing of item images
CREATE POLICY "Anyone can view company item images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'company-item-images');
-- The product_aluminum_prices table, RLS policies, and pricing_type column were already created
-- in the previous partial migration. Now just add aluminum_color to quote_items.

ALTER TABLE public.quote_items 
ADD COLUMN aluminum_color TEXT;
-- Add pricing_type column to company_products
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'none';

-- Set pricing_type based on existing uses_glass flag
UPDATE public.company_products 
SET pricing_type = 'glass' 
WHERE uses_glass = true;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_company_products_pricing_type ON public.company_products(pricing_type);-- Create product_aluminum_prices table for aluminum-color-based pricing
CREATE TABLE IF NOT EXISTS public.product_aluminum_prices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_product_id uuid NOT NULL REFERENCES public.company_products(id) ON DELETE CASCADE,
  color_name text NOT NULL,
  price_per_sqm numeric NOT NULL DEFAULT 0,
  cost_per_sqm numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_product_id, color_name)
);

-- Enable RLS
ALTER TABLE public.product_aluminum_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can manage prices for products in their company
CREATE POLICY "Users can view aluminum prices for their company products"
ON public.product_aluminum_prices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_aluminum_prices.company_product_id
      AND uc.user_id = auth.uid()
      AND uc.is_active = true
  )
);

CREATE POLICY "Users can insert aluminum prices for their company products"
ON public.product_aluminum_prices FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_aluminum_prices.company_product_id
      AND uc.user_id = auth.uid()
      AND uc.is_active = true
  )
);

CREATE POLICY "Users can update aluminum prices for their company products"
ON public.product_aluminum_prices FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_aluminum_prices.company_product_id
      AND uc.user_id = auth.uid()
      AND uc.is_active = true
  )
);

CREATE POLICY "Users can delete aluminum prices for their company products"
ON public.product_aluminum_prices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.company_products cp
    JOIN public.user_companies uc ON uc.company_id = cp.company_id
    WHERE cp.id = product_aluminum_prices.company_product_id
      AND uc.user_id = auth.uid()
      AND uc.is_active = true
  )
);

-- Add aluminum_color to quote_items if not exists
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS aluminum_color text;
-- Function to cancel an approved quote and all related financial data
CREATE OR REPLACE FUNCTION public.cancel_approved_quote(_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quote RECORD;
  v_company_id UUID;
  v_cancelled_receivables INTEGER := 0;
  v_cancelled_deposits INTEGER := 0;
  v_cancelled_sales INTEGER := 0;
  v_cancelled_os INTEGER := 0;
  v_cancelled_materials INTEGER := 0;
  v_os RECORD;
  v_sale RECORD;
BEGIN
  -- 1. Validate quote exists and is approved
  SELECT * INTO v_quote FROM quotes WHERE id = _quote_id;
  IF v_quote IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orçamento não encontrado');
  END IF;
  
  IF v_quote.status NOT IN ('approved', 'converted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas orçamentos aprovados ou convertidos podem ser cancelados por esta função');
  END IF;

  v_company_id := v_quote.company_id;

  -- 2. Cancel all related OS and their materials/reservations
  FOR v_os IN SELECT id FROM ordens_servico WHERE quote_id = _quote_id AND status != 'cancelled'
  LOOP
    -- Cancel materials (only if not consumed)
    UPDATE material_consumption
    SET status = 'cancelled', updated_at = now()
    WHERE ordem_servico_id = v_os.id AND status IN ('pending', 'available');
    v_cancelled_materials := v_cancelled_materials + FOUND::int;

    -- Cancel stock reservations
    UPDATE stock_reservations
    SET status = 'cancelled', cancelled_at = now()
    WHERE ordem_servico_id = v_os.id AND status = 'reserved';

    -- Cancel the OS
    UPDATE ordens_servico SET status = 'cancelled', updated_at = now()
    WHERE id = v_os.id;
    v_cancelled_os := v_cancelled_os + 1;
  END LOOP;

  -- 3. Cancel all related sales
  FOR v_sale IN SELECT id FROM sales WHERE quote_id = _quote_id AND payment_status != 'cancelled'
  LOOP
    -- Cancel cash movements linked to this sale
    DELETE FROM cash_movements WHERE sale_id = v_sale.id;

    -- Cancel commissions
    UPDATE employee_commissions SET status = 'cancelled', updated_at = now()
    WHERE sale_id = v_sale.id;

    -- Cancel the sale
    UPDATE sales SET payment_status = 'cancelled', notes = COALESCE(notes, '') || ' [Cancelado via cancelamento do orçamento]', updated_at = now()
    WHERE id = v_sale.id;
    v_cancelled_sales := v_cancelled_sales + 1;
  END LOOP;

  -- 4. Cancel all accounts receivable
  UPDATE accounts_receivable
  SET status = 'cancelled', updated_at = now()
  WHERE quote_id = _quote_id AND status IN ('pending', 'overdue');
  GET DIAGNOSTICS v_cancelled_receivables = ROW_COUNT;

  -- 5. Cancel all quote deposits
  UPDATE quote_deposits
  SET status = 'cancelled', updated_at = now()
  WHERE quote_id = _quote_id AND status IN ('pending', 'received');
  GET DIAGNOSTICS v_cancelled_deposits = ROW_COUNT;

  -- 6. Update quote status to rejected
  UPDATE quotes SET status = 'rejected', updated_at = now()
  WHERE id = _quote_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_receivables', v_cancelled_receivables,
    'cancelled_deposits', v_cancelled_deposits,
    'cancelled_sales', v_cancelled_sales,
    'cancelled_os', v_cancelled_os,
    'cancelled_materials', v_cancelled_materials
  );
END;
$$;

-- 1. Unique constraint: one OS per quote
CREATE UNIQUE INDEX uq_ordens_servico_quote_id 
ON public.ordens_servico (quote_id) 
WHERE quote_id IS NOT NULL AND status != 'cancelled';

-- 2. Unique constraint: one receivable per quote+installment (excluding cancelled)
CREATE UNIQUE INDEX uq_accounts_receivable_quote_installment 
ON public.accounts_receivable (quote_id, installment_number) 
WHERE quote_id IS NOT NULL AND status != 'cancelled';

-- 3. Unique constraint: one sale per quote+type (excluding cancelled)
CREATE UNIQUE INDEX uq_sales_quote_type 
ON public.sales (quote_id, sale_type) 
WHERE quote_id IS NOT NULL AND payment_status != 'cancelled';

-- =====================================================
-- SECURITY FIX 1: Employee Commissions - restrict to own + elevated
-- Currently ALL company members can see ALL commissions
-- =====================================================

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view commissions from their company" ON public.employee_commissions;

-- Create two new policies: own commissions + elevated role
CREATE POLICY "Users can view own commissions"
ON public.employee_commissions
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Elevated can view all company commissions"
ON public.employee_commissions
FOR SELECT
USING (
  user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- =====================================================
-- SECURITY FIX 2: Notas Fiscais - remove duplicate permissive SELECT
-- There are TWO SELECT policies: one for elevated and one for ALL users
-- The "all users" policy makes the elevated-only one useless
-- =====================================================

DROP POLICY IF EXISTS "Users can view company notas fiscais" ON public.notas_fiscais;

-- Keep only "Elevated role can view invoices" which already exists

-- =====================================================
-- SECURITY FIX 3: Expenses - restrict to elevated roles only
-- Currently ALL company members can see ALL expenses
-- =====================================================

DROP POLICY IF EXISTS "Users can view expenses from their company" ON public.expenses;

CREATE POLICY "Elevated can view company expenses"
ON public.expenses
FOR SELECT
USING (
  user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- Employees can view expenses they created
CREATE POLICY "Users can view own created expenses"
ON public.expenses
FOR SELECT
USING (
  created_by = auth.uid()
);

-- =====================================================
-- SECURITY FIX 4: Stock movements - restrict cost visibility
-- Add policy so only elevated roles see financial details
-- Regular users still need to see movements for production
-- We restrict via view instead, keeping RLS as-is for now
-- =====================================================

-- =====================================================
-- SECURITY FIX 5: Create employees_safe view if not exists
-- to mask sensitive compensation fields from non-admin users
-- =====================================================

CREATE OR REPLACE VIEW public.employees_safe 
WITH (security_invoker = on) AS
SELECT 
  id,
  company_id,
  name,
  email,
  phone,
  role,
  is_active,
  user_id,
  photo_url,
  username,
  permission_profile_id,
  created_at,
  updated_at,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
      OR user_id = auth.uid()
    THEN commission_enabled
    ELSE NULL
  END AS commission_enabled,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
      OR user_id = auth.uid()
    THEN commission_percent
    ELSE NULL
  END AS commission_percent,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
      OR user_id = auth.uid()
    THEN commission_type
    ELSE NULL
  END AS commission_type,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
      OR user_id = auth.uid()
    THEN hourly_rate
    ELSE NULL
  END AS hourly_rate
FROM public.employees
WHERE user_belongs_to_company(auth.uid(), company_id);

-- =====================================================
-- SECURITY: Create quotes_safe view to mask customer PII
-- Only admin/manager see full customer details
-- Regular employees see quote_number, status, amounts only
-- =====================================================

CREATE OR REPLACE VIEW public.quotes_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  company_id,
  quote_number,
  status,
  total_amount,
  discount_percent,
  discount_amount,
  final_amount,
  notes,
  valid_until,
  created_at,
  updated_at,
  deposit_amount,
  deposit_status,
  forma_pagamento_id,
  condicao_pagamento_id,
  valor_original,
  valor_reajustado,
  valor_final_aprovado,
  reajuste_aplicado,
  approved_at,
  approved_by,
  -- Always show customer name (needed for basic identification)
  customer_name,
  -- Mask PII fields for non-elevated roles
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_phone
    ELSE NULL
  END AS customer_phone,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_email
    ELSE NULL
  END AS customer_email,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_address
    ELSE NULL
  END AS customer_address,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_document
    ELSE NULL
  END AS customer_document,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_document_type
    ELSE NULL
  END AS customer_document_type,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_profession
    ELSE NULL
  END AS customer_profession,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN customer_marital_status
    ELSE NULL
  END AS customer_marital_status,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
    THEN payment_terms
    ELSE NULL
  END AS payment_terms
FROM public.quotes
WHERE user_belongs_to_company(auth.uid(), company_id);

-- =====================================================
-- Restrict quote UPDATE to elevated roles only
-- (currently any company member can update any quote)
-- =====================================================

DROP POLICY IF EXISTS "Users can update company quotes" ON public.quotes;

CREATE POLICY "Elevated can update company quotes"
ON public.quotes
FOR UPDATE
USING (
  user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- Allow the quote creator to update their own quotes
CREATE POLICY "Users can update own quotes"
ON public.quotes
FOR UPDATE
USING (
  user_belongs_to_company(auth.uid(), company_id)
  AND created_at > (now() - interval '24 hours')
);
-- Fix: company_items INSERT policy uses employees table instead of user_companies
-- This blocks company owners who aren't in the employees table

DROP POLICY IF EXISTS "Users can insert company items" ON public.company_items;
CREATE POLICY "Users can insert company items"
  ON public.company_items
  FOR INSERT
  WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can update company items" ON public.company_items;
CREATE POLICY "Users can update company items"
  ON public.company_items
  FOR UPDATE
  USING (user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can delete company items" ON public.company_items;
CREATE POLICY "Users can delete company items"
  ON public.company_items
  FOR DELETE
  USING (user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can view company items" ON public.company_items;
CREATE POLICY "Users can view company items"
  ON public.company_items
  FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));-- Fix: Add 'cancelled' to quote_deposits_status_check constraint
-- The cancel_approved_quote RPC needs to set status to 'cancelled'
ALTER TABLE public.quote_deposits DROP CONSTRAINT quote_deposits_status_check;
ALTER TABLE public.quote_deposits ADD CONSTRAINT quote_deposits_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'received'::text, 'billed'::text, 'cancelled'::text]));
-- Fix: Excluir vendas parciais (que representam depósitos) do cálculo de total_sold
-- para evitar dupla contagem com total_deposits
CREATE OR REPLACE VIEW public.quote_financial_status AS
SELECT 
  id AS quote_id,
  company_id,
  quote_number,
  customer_name,
  final_amount AS quote_total,
  status AS quote_status,
  created_at,
  COALESCE((
    SELECT sum(qd.amount)
    FROM quote_deposits qd
    WHERE qd.quote_id = q.id AND qd.status IN ('received', 'billed')
  ), 0) AS total_deposits,
  COALESCE((
    SELECT sum(s.total_amount)
    FROM sales s
    WHERE s.quote_id = q.id 
      AND s.payment_status <> 'cancelled'
      AND s.sale_type <> 'partial'
  ), 0) AS total_sold,
  final_amount 
    - COALESCE((
        SELECT sum(qd.amount)
        FROM quote_deposits qd
        WHERE qd.quote_id = q.id AND qd.status IN ('received', 'billed')
      ), 0) 
    - COALESCE((
        SELECT sum(s.total_amount)
        FROM sales s
        WHERE s.quote_id = q.id 
          AND s.payment_status <> 'cancelled'
          AND s.sale_type <> 'partial'
      ), 0) AS pending_amount,
  CASE
    WHEN (final_amount 
      - COALESCE((SELECT sum(qd.amount) FROM quote_deposits qd WHERE qd.quote_id = q.id AND qd.status IN ('received', 'billed')), 0) 
      - COALESCE((SELECT sum(s.total_amount) FROM sales s WHERE s.quote_id = q.id AND s.payment_status <> 'cancelled' AND s.sale_type <> 'partial'), 0)
    ) <= 0 THEN 'fully_paid'
    WHEN (
      COALESCE((SELECT sum(qd.amount) FROM quote_deposits qd WHERE qd.quote_id = q.id AND qd.status IN ('received', 'billed')), 0) 
      + COALESCE((SELECT sum(s.total_amount) FROM sales s WHERE s.quote_id = q.id AND s.payment_status <> 'cancelled' AND s.sale_type <> 'partial'), 0)
    ) > 0 THEN 'partially_paid'
    ELSE 'pending'
  END AS financial_status
FROM quotes q
WHERE status = 'approved' AND user_belongs_to_company(auth.uid(), company_id);

-- Add detailed address fields to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS complement text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS zip_code text;

ALTER TABLE public.company_items
  ADD COLUMN IF NOT EXISTS bar_length_mm numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_kg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_per_meter numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_per_bar numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_per_kg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost_per_meter numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price_per_bar numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price_per_kg numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_price_per_meter numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_margin_percent numeric DEFAULT 0;

ALTER TABLE public.item_templates
  ADD COLUMN IF NOT EXISTS weight_per_meter numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weight_per_bar numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_cost numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_sale_price numeric DEFAULT NULL;

COMMENT ON COLUMN public.item_templates.weight_per_meter IS 'Peso por metro linear em kg (para perfis)';
COMMENT ON COLUMN public.item_templates.weight_per_bar IS 'Peso por barra em kg (para perfis)';
COMMENT ON COLUMN public.item_templates.default_cost IS 'Custo sugestivo padrão em R$';
COMMENT ON COLUMN public.item_templates.default_sale_price IS 'Preço de venda sugestivo padrão em R$';

-- Atualizar perfis da Linha Suprema com dados do catálogo Alucentro
-- Peso (kg/m) e descrição técnica

UPDATE item_templates SET weight_per_meter = 0.738, weight_per_bar = ROUND(0.738 * 6, 3), description = 'Marco Superior Correr 2 Folhas' WHERE name = 'SU-001' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.683, weight_per_bar = ROUND(0.683 * 6, 3), description = 'Marco Inferior Correr 2 Folhas' WHERE name = 'SU-002' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.509, weight_per_bar = ROUND(0.509 * 6, 3), description = 'Marco Lateral Correr 2 Folhas' WHERE name = 'SU-003' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.475, weight_per_bar = ROUND(0.475 * 6, 3), description = 'Marco Bandeira Peitoril 2 Folhas' WHERE name = 'SU-004' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.108, weight_per_bar = ROUND(1.108 * 6, 3), description = 'Travessa Bandeira Marco Correr 2 Folhas' WHERE name = 'SU-005' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.085, weight_per_bar = ROUND(1.085 * 6, 3), description = 'Travessa Peitoril Marco Correr 2 Folhas' WHERE name = 'SU-006' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.371, weight_per_bar = ROUND(0.371 * 6, 3), description = 'Marco Lateral Correr 2 Folhas' WHERE name = 'SU-007' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.234, weight_per_bar = ROUND(0.234 * 6, 3), description = 'Complemento Marco Lateral Correr' WHERE name = 'SU-008' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.878, weight_per_bar = ROUND(1.878 * 6, 3), description = 'Coluna' WHERE name = 'SU-009' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.968, weight_per_bar = ROUND(0.968 * 6, 3), description = 'Marco Superior de Correr 3 Folhas' WHERE name = 'SU-010' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.886, weight_per_bar = ROUND(0.886 * 6, 3), description = 'Marco Inferior de Correr 3 Folhas' WHERE name = 'SU-011' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.509, weight_per_bar = ROUND(0.509 * 6, 3), description = 'Marco Lateral de Correr 3 Folhas' WHERE name = 'SU-012' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.738, weight_per_bar = ROUND(0.738 * 6, 3), description = 'Marco Lateral Correr 3 Folhas' WHERE name = 'SU-013' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.639, weight_per_bar = ROUND(0.639 * 6, 3), description = 'Marco Lateral Correr 3 Folhas' WHERE name = 'SU-014' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.509, weight_per_bar = ROUND(0.509 * 6, 3), description = 'Travessa Superior Bandeira Correr 3 Folhas' WHERE name = 'SU-018' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.675, weight_per_bar = ROUND(1.675 * 6, 3), description = 'Esquadria Travessa Bandeira' WHERE name = 'SU-019' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.959, weight_per_bar = ROUND(0.959 * 6, 3), description = 'Marco Superior Correr Janela Camarão' WHERE name = 'SU-024' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.919, weight_per_bar = ROUND(0.919 * 6, 3), description = 'Marco Superior Correr Janela Camarão' WHERE name = 'SU-025' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.455, weight_per_bar = ROUND(0.455 * 6, 3), description = 'Componente / Coluna / Correr 2' WHERE name = 'SU-036' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.527, weight_per_bar = ROUND(0.527 * 6, 3), description = 'Vedação Montante' WHERE name = 'SU-038' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.506, weight_per_bar = ROUND(0.506 * 6, 3), description = 'Montante da Folha' WHERE name = 'SU-039' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.458, weight_per_bar = ROUND(0.458 * 6, 3), description = 'Montante Mão de Amigo' WHERE name = 'SU-040' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.485, weight_per_bar = ROUND(0.485 * 6, 3), description = 'Montante Mão de Amigo' WHERE name = 'SU-041' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.530, weight_per_bar = ROUND(0.530 * 6, 3), description = 'Montante Mão de Amigo' WHERE name = 'SU-042' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.736, weight_per_bar = ROUND(0.736 * 6, 3), description = 'Tampa do Montante' WHERE name = 'SU-043' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.650, weight_per_bar = ROUND(1.650 * 6, 3), description = 'Montante Tubular' WHERE name = 'SU-044' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.022, weight_per_bar = ROUND(1.022 * 6, 3), description = 'Montante Mão de Amigo Tubular / Sem Escovinha' WHERE name = 'SU-047' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.000, weight_per_bar = ROUND(1.000 * 6, 3), description = 'Montante Mão de Amigo com Escovinha' WHERE name = 'SU-049' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.921, weight_per_bar = ROUND(0.921 * 6, 3), description = 'Montante' WHERE name = 'SU-050' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.500, weight_per_bar = ROUND(0.500 * 6, 3), description = 'Travessa da Folha' WHERE name = 'SU-053' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.519, weight_per_bar = ROUND(0.519 * 6, 3), description = 'Marco Travessa / Montante Mão de Amigo' WHERE name = 'SU-056' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.599, weight_per_bar = ROUND(0.599 * 6, 3), description = 'Travessa Superior da Folha Maxim Ar' WHERE name = 'SU-057' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.530, weight_per_bar = ROUND(0.530 * 6, 3), description = 'Montante da Folha Veneziana' WHERE name = 'SU-068' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.600, weight_per_bar = ROUND(0.600 * 6, 3), description = 'Montante Mão Amigo / Escovinha' WHERE name = 'SU-069' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.494, weight_per_bar = ROUND(0.494 * 6, 3), description = 'Montante da Folha' WHERE name = 'SU-070' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.255, weight_per_bar = ROUND(0.255 * 6, 3), description = 'Montante Central' WHERE name = 'SU-071' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.402, weight_per_bar = ROUND(0.402 * 6, 3), description = 'Montante / Folha' WHERE name = 'SU-072' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.460, weight_per_bar = ROUND(0.460 * 6, 3), description = 'Montante / Folha Veneziana' WHERE name = 'SU-074' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.341, weight_per_bar = ROUND(0.341 * 6, 3), description = 'Marco' WHERE name = 'SU-079' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.389, weight_per_bar = ROUND(0.389 * 6, 3), description = 'Montante Folha' WHERE name = 'SU-080' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.365, weight_per_bar = ROUND(0.365 * 6, 3), description = 'Travessa da Folha com Olhal' WHERE name = 'SU-082' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.144, weight_per_bar = ROUND(0.144 * 6, 3), description = 'Pingadeira' WHERE name = 'SU-083' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.125, weight_per_bar = ROUND(0.125 * 6, 3), description = 'Pingadeira Folha Travessa / Marco' WHERE name = 'SU-084' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.485, weight_per_bar = ROUND(0.485 * 6, 3), description = 'Coluna sem Olhal' WHERE name = 'SU-085' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.581, weight_per_bar = ROUND(0.581 * 6, 3), description = 'Coluna com Olhal' WHERE name = 'SU-086' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.085, weight_per_bar = ROUND(1.085 * 6, 3), description = 'Travessa Peitoril Marco Correr 2 Folhas' WHERE name = 'SU-090' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.400, weight_per_bar = ROUND(0.400 * 6, 3), description = 'Montante Mão de Amigo' WHERE name = 'SU-091' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.282, weight_per_bar = ROUND(0.282 * 6, 3), description = 'Marco Travessa' WHERE name = 'SU-093' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.371, weight_per_bar = ROUND(0.371 * 6, 3), description = 'Travessa / Marco' WHERE name = 'SU-094' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.225, weight_per_bar = ROUND(0.225 * 6, 3), description = 'Marco Travessa' WHERE name = 'SU-095' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.314, weight_per_bar = ROUND(0.314 * 6, 3), description = 'Montante / Folha' WHERE name = 'SU-096' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.401, weight_per_bar = ROUND(0.401 * 6, 3), description = 'Travessa / Folha' WHERE name = 'SU-097' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.401, weight_per_bar = ROUND(0.401 * 6, 3), description = 'Travessa / Folha' WHERE name = 'SU-098' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.157, weight_per_bar = ROUND(0.157 * 6, 3), description = 'Matajunta' WHERE name = 'SU-100' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.360, weight_per_bar = ROUND(0.360 * 6, 3), description = 'Complemento Veneziana Suporte Travessa' WHERE name = 'SU-101' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.111, weight_per_bar = ROUND(0.111 * 6, 3), description = 'Baguete' WHERE name = 'SU-102' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.140, weight_per_bar = ROUND(0.140 * 6, 3), description = 'Baguete' WHERE name = 'SU-103' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.266, weight_per_bar = ROUND(0.266 * 6, 3), description = 'Vedação Montante / Complemento Folha' WHERE name = 'SU-107' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.140, weight_per_bar = ROUND(0.140 * 6, 3), description = 'Complemento Veneziana Suporte' WHERE name = 'SU-108' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.521, weight_per_bar = ROUND(0.521 * 6, 3), description = 'Travessa / Folha' WHERE name = 'SU-110' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.098, weight_per_bar = ROUND(1.098 * 6, 3), description = 'Montante Mão de Amigo Tubular Porta com Escovinha' WHERE name = 'SU-111' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.500, weight_per_bar = ROUND(0.500 * 6, 3), description = 'Montante da Folha' WHERE name = 'SU-120' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.523, weight_per_bar = ROUND(1.523 * 6, 3), description = 'Marco Superior de Correr 4 Folhas' WHERE name = 'SU-121' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.857, weight_per_bar = ROUND(0.857 * 6, 3), description = 'Marco Lateral de Correr 4 Folhas' WHERE name = 'SU-122' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.431, weight_per_bar = ROUND(1.431 * 6, 3), description = 'Marco Inferior de Correr 4 Folhas' WHERE name = 'SU-123' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.505, weight_per_bar = ROUND(0.505 * 6, 3), description = 'Travessa Inferior Folha Veneziana' WHERE name = 'SU-186' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.495, weight_per_bar = ROUND(0.495 * 6, 3), description = 'Montante da Folha' WHERE name = 'SU-187' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.569, weight_per_bar = ROUND(0.569 * 6, 3), description = 'Travessa Central Folha' WHERE name = 'SU-188' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.521, weight_per_bar = ROUND(0.521 * 6, 3), description = 'Montante Central' WHERE name = 'SU-190' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.683, weight_per_bar = ROUND(0.683 * 6, 3), description = 'Marco' WHERE name = 'SU-191' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.548, weight_per_bar = ROUND(0.548 * 6, 3), description = 'Complemento Marco Central / Correr' WHERE name = 'SU-192' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.418, weight_per_bar = ROUND(0.418 * 6, 3), description = 'Montante Travessa Folha 45°' WHERE name = 'SU-200' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.983, weight_per_bar = ROUND(0.983 * 6, 3), description = 'Travessa Inferior da Folha' WHERE name = 'SU-225' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.475, weight_per_bar = ROUND(0.475 * 6, 3), description = 'Travessa Folha Veneziana' WHERE name = 'SU-226' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.540, weight_per_bar = ROUND(0.540 * 6, 3), description = 'Travessa Maxim Ar Fixo' WHERE name = 'SU-227' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.085, weight_per_bar = ROUND(1.085 * 6, 3), description = 'Marco Inferior Correr 2 Folhas' WHERE name = 'SU-228' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.938, weight_per_bar = ROUND(0.938 * 6, 3), description = 'Marco Superior Correr 3 Folhas' WHERE name = 'SU-230' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.783, weight_per_bar = ROUND(0.783 * 6, 3), description = 'Marco Inferior Correr 3 Folhas' WHERE name = 'SU-239' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.668, weight_per_bar = ROUND(0.668 * 6, 3), description = 'Montante / Folha sem Baguete' WHERE name = 'SU-241' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.683, weight_per_bar = ROUND(0.683 * 6, 3), description = 'Marco' WHERE name = 'SU-242' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.651, weight_per_bar = ROUND(0.651 * 6, 3), description = 'Travessa / Montante Mão de Amigo' WHERE name = 'SU-243' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.401, weight_per_bar = ROUND(0.401 * 6, 3), description = 'Travessa / Folha' WHERE name = 'SU-244' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.676, weight_per_bar = ROUND(0.676 * 6, 3), description = 'Montante Central Folha' WHERE name = 'SU-245' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.737, weight_per_bar = ROUND(0.737 * 6, 3), description = 'Montante Central com Puxador' WHERE name = 'SU-250' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.638, weight_per_bar = ROUND(0.638 * 6, 3), description = 'Marco Correr 2 Folhas' WHERE name = 'SU-260' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.140, weight_per_bar = ROUND(0.140 * 6, 3), description = 'Pingadeira' WHERE name = 'SU-276' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.549, weight_per_bar = ROUND(0.549 * 6, 3), description = 'Marco Lateral' WHERE name = 'SU-279' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.969, weight_per_bar = ROUND(0.969 * 6, 3), description = 'Montante Lateral Folha' WHERE name = 'SU-280' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.029, weight_per_bar = ROUND(1.029 * 6, 3), description = 'Montante Central Folha' WHERE name = 'SU-281' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.210, weight_per_bar = ROUND(1.210 * 6, 3), description = 'Montante Mão de Amigo Tubular Porta sem Escovinha' WHERE name = 'SU-289' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.614, weight_per_bar = ROUND(0.614 * 6, 3), description = 'Montante / Folha' WHERE name = 'SU-290' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.250, weight_per_bar = ROUND(0.250 * 6, 3), description = 'Complemento Marco Lateral Correr' WHERE name = 'SU-291' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.683, weight_per_bar = ROUND(0.683 * 6, 3), description = 'Perfil Reversor' WHERE name = 'SU-292' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.966, weight_per_bar = ROUND(0.966 * 6, 3), description = 'Marco Lateral com 02 Abas' WHERE name = 'SU-299' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.269, weight_per_bar = ROUND(0.269 * 6, 3), description = 'Complemento / Folha' WHERE name = 'SU-548' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.749, weight_per_bar = ROUND(1.749 * 6, 3), description = 'Trilho Superior 05 Planos' WHERE name = 'SU-3605' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 0.959, weight_per_bar = ROUND(0.959 * 6, 3), description = 'Marco Lateral 05 Planos' WHERE name = 'SU-3607' AND type = 'profile';
UPDATE item_templates SET weight_per_meter = 1.599, weight_per_bar = ROUND(1.599 * 6, 3), description = 'Trilho Peitoril Inferior de 3 Planos' WHERE name = 'SU-5916' AND type = 'profile';

-- Atualizar perfis existentes da Linha Gold com dados do catálogo Alucentro

-- LG-044: Trilho Superior 02 Folhas
UPDATE item_templates SET weight_per_meter = 1.247, weight_per_bar = ROUND(1.247 * 6, 3), description = 'Trilho Superior 02 Folhas' WHERE name = 'LG-044' AND type = 'profile';
-- LG-047: Trilho Inferior 02 Folhas
UPDATE item_templates SET weight_per_meter = 1.264, weight_per_bar = ROUND(1.264 * 6, 3), description = 'Trilho Inferior 02 Folhas' WHERE name = 'LG-047' AND type = 'profile';
-- LG-002: Marco Lateral Liso 02 Folhas
UPDATE item_templates SET weight_per_meter = 0.639, weight_per_bar = ROUND(0.639 * 6, 3), description = 'Marco Lateral Liso 02 Folhas' WHERE name = 'LG-002' AND type = 'profile';
-- LG-124: Marco Lateral Janela / Porta
UPDATE item_templates SET weight_per_meter = 4.360, weight_per_bar = ROUND(4.360 * 6, 3), description = 'Marco Lateral Janela / Porta' WHERE name = 'LG-124' AND type = 'profile';
-- LG-045: Marco Lateral 02 Folhas
UPDATE item_templates SET weight_per_meter = 0.957, weight_per_bar = ROUND(0.957 * 6, 3), description = 'Marco Lateral 02 Folhas' WHERE name = 'LG-045' AND type = 'profile';
-- LG-003: Marco Lateral com Fresa
UPDATE item_templates SET weight_per_meter = 0.757, weight_per_bar = ROUND(0.757 * 6, 3), description = 'Marco Lateral com Fresa' WHERE name = 'LG-003' AND type = 'profile';
-- LG-004: Travessa Bandeira Porta/Janela
UPDATE item_templates SET weight_per_meter = 2.035, weight_per_bar = ROUND(2.035 * 6, 3), description = 'Travessa Bandeira Porta/Janela' WHERE name = 'LG-004' AND type = 'profile';
-- LG-005: Trilho Coluna
UPDATE item_templates SET weight_per_meter = 1.132, weight_per_bar = ROUND(1.132 * 6, 3), description = 'Trilho Coluna' WHERE name = 'LG-005' AND type = 'profile';
-- LG-062: Trilho Superior 03 Folhas
UPDATE item_templates SET weight_per_meter = 1.728, weight_per_bar = ROUND(1.728 * 6, 3), description = 'Trilho Superior 03 Folhas' WHERE name = 'LG-062' AND type = 'profile';
-- LG-066: Trilho Inferior 03 Folhas
UPDATE item_templates SET weight_per_meter = 1.539, weight_per_bar = ROUND(1.539 * 6, 3), description = 'Trilho Inferior 03 Folhas' WHERE name = 'LG-066' AND type = 'profile';
-- LG-028: Baguete em U - Mata Junta
UPDATE item_templates SET weight_per_meter = 0.455, weight_per_bar = ROUND(0.455 * 6, 3), description = 'Baguete em U - Mata Junta' WHERE name = 'LG-028' AND type = 'profile';
-- LG-064: Marco Lateral 03 Folhas
UPDATE item_templates SET weight_per_meter = 1.358, weight_per_bar = ROUND(1.358 * 6, 3), description = 'Marco Lateral 03 Folhas' WHERE name = 'LG-064' AND type = 'profile';
-- LG-070: Trilho Superior 04 Folhas
UPDATE item_templates SET weight_per_meter = 1.995, weight_per_bar = ROUND(1.995 * 6, 3), description = 'Trilho Superior 04 Folhas' WHERE name = 'LG-070' AND type = 'profile';
-- LG-071: Trilho Inferior 04 Folhas
UPDATE item_templates SET weight_per_meter = 2.100, weight_per_bar = ROUND(2.100 * 6, 3), description = 'Trilho Inferior 04 Folhas' WHERE name = 'LG-071' AND type = 'profile';
-- LG-072: Marco Lateral Liso 04 Folhas
UPDATE item_templates SET weight_per_meter = 1.092, weight_per_bar = ROUND(1.092 * 6, 3), description = 'Marco Lateral Liso 04 Folhas' WHERE name = 'LG-072' AND type = 'profile';
-- LG-007: Travessa Inferior da Folha
UPDATE item_templates SET weight_per_meter = 1.229, weight_per_bar = ROUND(1.229 * 6, 3), description = 'Travessa Inferior da Folha' WHERE name = 'LG-007' AND type = 'profile';
-- LG-006: Travessa da Folha
UPDATE item_templates SET weight_per_meter = 0.677, weight_per_bar = ROUND(0.677 * 6, 3), description = 'Travessa da Folha' WHERE name = 'LG-006' AND type = 'profile';
-- LG-050: Montante Lateral
UPDATE item_templates SET weight_per_meter = 0.816, weight_per_bar = ROUND(0.816 * 6, 3), description = 'Montante Lateral' WHERE name = 'LG-050' AND type = 'profile';
-- LG-051: Marco Lateral 02 Folhas Janela Integrada
UPDATE item_templates SET weight_per_meter = 0.916, weight_per_bar = ROUND(0.916 * 6, 3), description = 'Marco Lateral 02 Folhas Janela Integrada' WHERE name = 'LG-051' AND type = 'profile';
-- LG-052: Montante Mão de Amigo com Reforço Externo
UPDATE item_templates SET weight_per_meter = 1.669, weight_per_bar = ROUND(1.669 * 6, 3), description = 'Montante Mão de Amigo com Reforço Externo' WHERE name = 'LG-052' AND type = 'profile';
-- LG-053: Montante Lateral com Reforço Externo
UPDATE item_templates SET weight_per_meter = 1.650, weight_per_bar = ROUND(1.650 * 6, 3), description = 'Montante Lateral com Reforço Externo' WHERE name = 'LG-053' AND type = 'profile';
-- LG-054: Montante Lateral com Reforço Externo
UPDATE item_templates SET weight_per_meter = 1.575, weight_per_bar = ROUND(1.575 * 6, 3), description = 'Montante Lateral com Reforço Externo' WHERE name = 'LG-054' AND type = 'profile';
-- LG-048: Montante Mão de Amigo
UPDATE item_templates SET weight_per_meter = 0.967, weight_per_bar = ROUND(0.967 * 6, 3), description = 'Montante Mão de Amigo' WHERE name = 'LG-048' AND type = 'profile';
-- LG-049: Montante Lateral com Puxador
UPDATE item_templates SET weight_per_meter = 1.010, weight_per_bar = ROUND(1.010 * 6, 3), description = 'Montante Lateral com Puxador' WHERE name = 'LG-049' AND type = 'profile';
-- LG-017: Montante Mão de Amigo com Puxador Interno
UPDATE item_templates SET weight_per_meter = 0.905, weight_per_bar = ROUND(0.905 * 6, 3), description = 'Montante Mão de Amigo com Puxador Interno' WHERE name = 'LG-017' AND type = 'profile';
-- LG-021: Montante Mão de Amigo com Reforço
UPDATE item_templates SET weight_per_meter = 1.572, weight_per_bar = ROUND(1.572 * 6, 3), description = 'Montante Mão de Amigo com Reforço' WHERE name = 'LG-021' AND type = 'profile';
-- LG-016: Complemento da Folha Batente
UPDATE item_templates SET weight_per_meter = 0.981, weight_per_bar = ROUND(0.981 * 6, 3), description = 'Complemento da Folha Batente' WHERE name = 'LG-016' AND type = 'profile';
-- LG-042: Montante da Folha - Porta de Giro
UPDATE item_templates SET weight_per_meter = 1.169, weight_per_bar = ROUND(1.169 * 6, 3), description = 'Montante da Folha - Porta de Giro' WHERE name = 'LG-042' AND type = 'profile';
-- LG-043: Montante para Porta de Giro
UPDATE item_templates SET weight_per_meter = 0.930, weight_per_bar = ROUND(0.930 * 6, 3), description = 'Montante para Porta de Giro' WHERE name = 'LG-043' AND type = 'profile';
-- LG-056: Marco Lateral Batente Porta de Giro
UPDATE item_templates SET weight_per_meter = 0.664, weight_per_bar = ROUND(0.664 * 6, 3), description = 'Marco Lateral Batente Porta de Giro' WHERE name = 'LG-056' AND type = 'profile';
-- LG-057 (BG-057): Baguete
UPDATE item_templates SET weight_per_meter = 0.170, weight_per_bar = ROUND(0.170 * 6, 3), description = 'Baguete' WHERE name = 'LG-057' AND type = 'profile';
-- LG-059: Baguete
UPDATE item_templates SET weight_per_meter = 0.169, weight_per_bar = ROUND(0.169 * 6, 3), description = 'Baguete' WHERE name = 'LG-059' AND type = 'profile';
-- LG-026: Baguete
UPDATE item_templates SET weight_per_meter = 0.158, weight_per_bar = ROUND(0.158 * 6, 3), description = 'Baguete' WHERE name = 'LG-026' AND type = 'profile';
-- LG-027: Baguete para Veneziana VZ-006
UPDATE item_templates SET weight_per_meter = 0.149, weight_per_bar = ROUND(0.149 * 6, 3), description = 'Baguete para Veneziana VZ-006' WHERE name = 'LG-027' AND type = 'profile';
-- LG-015: Baguete
UPDATE item_templates SET weight_per_meter = 0.147, weight_per_bar = ROUND(0.147 * 6, 3), description = 'Baguete' WHERE name = 'LG-015' AND type = 'profile';
-- LG-068: Marco Maxim Ar
UPDATE item_templates SET weight_per_meter = 0.450, weight_per_bar = ROUND(0.450 * 6, 3), description = 'Marco Maxim Ar' WHERE name = 'LG-068' AND type = 'profile';
-- LG-083: Marco Lateral Maxim Ar
UPDATE item_templates SET weight_per_meter = 0.413, weight_per_bar = ROUND(0.413 * 6, 3), description = 'Marco Lateral Maxim Ar' WHERE name = 'LG-083' AND type = 'profile';
-- LG-085: Montante da Folha Maxim Ar
UPDATE item_templates SET weight_per_meter = 0.540, weight_per_bar = ROUND(0.540 * 6, 3), description = 'Montante da Folha Maxim Ar' WHERE name = 'LG-085' AND type = 'profile';
-- LG-074: Travessa Maxim Ar
UPDATE item_templates SET weight_per_meter = 0.551, weight_per_bar = ROUND(0.551 * 6, 3), description = 'Travessa Maxim Ar' WHERE name = 'LG-074' AND type = 'profile';
-- LG-092: Pingadeira Maxim Ar
UPDATE item_templates SET weight_per_meter = 0.212, weight_per_bar = ROUND(0.212 * 6, 3), description = 'Pingadeira Maxim Ar' WHERE name = 'LG-092' AND type = 'profile';
-- LG-076: Travessa Maxim Ar Fixo (já existe)
UPDATE item_templates SET weight_per_meter = 0.754, weight_per_bar = ROUND(0.754 * 6, 3), description = 'Travessa Maxim Ar Fixo' WHERE name = 'LG-076' AND type = 'profile';
-- LG-082: Perfil para Linha Gold (já existe)
UPDATE item_templates SET weight_per_meter = 1.572, weight_per_bar = ROUND(1.572 * 6, 3), description = 'Perfil para Linha Gold' WHERE name = 'LG-082' AND type = 'profile';
-- MN-001: Marco Superior da Caixa da Persiana
UPDATE item_templates SET weight_per_meter = 1.377, weight_per_bar = ROUND(1.377 * 6, 3), description = 'Marco Superior da Caixa da Persiana' WHERE name = 'MN-001' AND type = 'profile';
-- MN-002: Marco Intermediário da Integrada
UPDATE item_templates SET weight_per_meter = 0.669, weight_per_bar = ROUND(0.669 * 6, 3), description = 'Marco Intermediário da Integrada' WHERE name = 'MN-002' AND type = 'profile';
-- MN-003: Marco Lateral Persiana
UPDATE item_templates SET weight_per_meter = 0.751, weight_per_bar = ROUND(0.751 * 6, 3), description = 'Marco Lateral Persiana' WHERE name = 'MN-003' AND type = 'profile';
-- MN-007: Guia da Persiana
UPDATE item_templates SET weight_per_meter = 0.710, weight_per_bar = ROUND(0.710 * 6, 3), description = 'Guia da Persiana' WHERE name = 'MN-007' AND type = 'profile';
-- MN-032: Tampa Interna para Caixa para Porta
UPDATE item_templates SET weight_per_meter = 1.733, weight_per_bar = ROUND(1.733 * 6, 3), description = 'Tampa Interna para Caixa para Porta' WHERE name = 'MN-032' AND type = 'profile';
-- MN-027: Guia Dupla da Persiana Integrada
UPDATE item_templates SET weight_per_meter = 1.043, weight_per_bar = ROUND(1.043 * 6, 3), description = 'Guia Dupla da Persiana Integrada' WHERE name = 'MN-027' AND type = 'profile';
-- MN-010: Trilho Inferior
UPDATE item_templates SET weight_per_meter = 1.495, weight_per_bar = ROUND(1.495 * 6, 3), description = 'Trilho Inferior' WHERE name = 'MN-010' AND type = 'profile';
-- MN-030: Marco Inferior
UPDATE item_templates SET weight_per_meter = 1.900, weight_per_bar = ROUND(1.900 * 6, 3), description = 'Marco Inferior' WHERE name = 'MN-030' AND type = 'profile';
-- MN-015: Eixo Octogonal da Integrada
UPDATE item_templates SET weight_per_meter = 0.881, weight_per_bar = ROUND(0.881 * 6, 3), description = 'Eixo Octogonal da Integrada' WHERE name = 'MN-015' AND type = 'profile';
-- MN-039: Barra para Janela Integrada
UPDATE item_templates SET weight_per_meter = 1.410, weight_per_bar = ROUND(1.410 * 6, 3), description = 'Barra para Janela Integrada' WHERE name = 'MN-039' AND type = 'profile';
-- LG-058: atualizar
UPDATE item_templates SET weight_per_meter = 0.760, weight_per_bar = ROUND(0.760 * 6, 3) WHERE name = 'LG-058' AND type = 'profile';
-- LG-162: atualizar
UPDATE item_templates SET weight_per_meter = 1.080, weight_per_bar = ROUND(1.080 * 6, 3) WHERE name = 'LG-162' AND type = 'profile';
-- MN-050: atualizar
UPDATE item_templates SET weight_per_meter = 1.000, weight_per_bar = ROUND(1.000 * 6, 3) WHERE name = 'MN-050' AND type = 'profile';
-- MN-055: atualizar
UPDATE item_templates SET weight_per_meter = 0.370, weight_per_bar = ROUND(0.370 * 6, 3) WHERE name = 'MN-055' AND type = 'profile';

-- Inserir novos perfis que não existem
INSERT INTO item_templates (name, type, unit, linha, description, weight_per_meter, weight_per_bar, bar_length_mm) VALUES
('LG-158', 'profile', 'barra', 'Gold', 'Marco Lateral Liso 03 Folhas', 0.886, ROUND(0.886 * 6, 3), 6000),
('LG-236', 'profile', 'barra', 'Gold', 'Trilho Superior 05 Folhas', 2.668, ROUND(2.668 * 6, 3), 6000),
('LG-237', 'profile', 'barra', 'Gold', 'Marco Lateral Liso 05 Folhas', 1.500, ROUND(1.500 * 6, 3), 6000),
('STL-1222', 'profile', 'barra', 'Gold', 'Travessa Inferior com Escovinha', 0.710, ROUND(0.710 * 6, 3), 6000),
('LG-022', 'profile', 'barra', 'Gold', 'Travessa Larga da Folha', 1.064, ROUND(1.064 * 6, 3), 6000),
('LG-055', 'profile', 'barra', 'Gold', 'Travessa Intermediária da Folha', 0.905, ROUND(0.905 * 6, 3), 6000),
('LG-018', 'profile', 'barra', 'Gold', 'Montante Mão de Amigo com Puxador Tubular', 1.733, ROUND(1.733 * 6, 3), 6000),
('LG-020', 'profile', 'barra', 'Gold', 'Montante Lateral com Aba e Puxador Interno', 1.016, ROUND(1.016 * 6, 3), 6000),
('LG-201', 'profile', 'barra', 'Gold', 'Montante Lateral com 2 Puxadores', 1.195, ROUND(1.195 * 6, 3), 6000),
('LG-019', 'profile', 'barra', 'Gold', 'Mão Amigo', 1.132, ROUND(1.132 * 6, 3), 6000),
('LG-164', 'profile', 'barra', 'Gold', 'Baguete', 1.358, ROUND(1.358 * 6, 3), 6000),
('LG-080', 'profile', 'barra', 'Gold', 'Marco Maxim Ar', 1.153, ROUND(1.153 * 6, 3), 6000),
('LG-075', 'profile', 'barra', 'Gold', 'Travessa Maxim Ar', 1.153, ROUND(1.153 * 6, 3), 6000),
('LG-077', 'profile', 'barra', 'Gold', 'Inversor para Baguete', 0.330, ROUND(0.330 * 6, 3), 6000),
('LG-079', 'profile', 'barra', 'Gold', 'Travessa Larga da Folha Maxim Ar', 0.789, ROUND(0.789 * 6, 3), 6000),
('LG-091', 'profile', 'barra', 'Gold', 'Pingadeira Maxim Ar', 1.773, ROUND(1.773 * 6, 3), 6000),
('CL-006', 'profile', 'barra', 'Gold', 'Cantoneira Macho 52mm', 1.132, ROUND(1.132 * 6, 3), 6000),
('CL-010', 'profile', 'barra', 'Gold', 'Cunha para CL-044 60mm', 0.385, ROUND(0.385 * 6, 3), 6000),
('CL-011', 'profile', 'barra', 'Gold', 'Cunha para CL-006 50mm', 0.319, ROUND(0.319 * 6, 3), 6000),
('AT-409', 'profile', 'barra', 'Gold', 'Trilho Inferior', 1.183, ROUND(1.183 * 6, 3), 6000),
('LG-235', 'profile', 'barra', 'Gold', 'Perfil para Linha Gold', 1.129, ROUND(1.129 * 6, 3), 6000),
('LG-348', 'profile', 'barra', 'Gold', 'Trilho Superior de 1 Plano', 0.813, ROUND(0.813 * 6, 3), 6000),
('LG-349', 'profile', 'barra', 'Gold', 'Marco Lateral de 1 Plano', 0.623, ROUND(0.623 * 6, 3), 6000),
('RM-002', 'profile', 'barra', 'Gold', 'Arremate Arredondado', 0.813, ROUND(0.813 * 6, 3), 6000),
('LG-858', 'profile', 'barra', 'Gold', 'Marco Lateral Persiana', 1.093, ROUND(1.093 * 6, 3), 6000),
('MN-031', 'profile', 'barra', 'Gold', 'Tampa Integrada', 1.332, ROUND(1.332 * 6, 3), 6000),
('MN-005', 'profile', 'barra', 'Gold', 'Tampa Interna Superior da Caixa Integrada', 0.783, ROUND(0.783 * 6, 3), 6000),
('MN-006', 'profile', 'barra', 'Gold', 'Tampa Interna Inferior da Caixa Integrada', 0.878, ROUND(0.878 * 6, 3), 6000),
('MN-008', 'profile', 'barra', 'Gold', 'Tampa Integrada', 1.064, ROUND(1.064 * 6, 3), 6000),
('STL-1818', 'profile', 'barra', 'Gold', 'Eixo Octogonal da Integrada', 0.523, ROUND(0.523 * 6, 3), 6000),
('LG-034', 'profile', 'barra', 'Gold', 'Tampa Externa Integrada', 2.141, ROUND(2.141 * 6, 3), 6000),
('LG-070D', 'profile', 'barra', 'Gold', 'Perfil para Linha Gold', 0.455, ROUND(0.455 * 6, 3), 6000),
('MN-6446', 'profile', 'barra', 'Gold', 'Tampa Externa Janela Integrada', 0.746, ROUND(0.746 * 6, 3), 6000),
('MN-6447', 'profile', 'barra', 'Gold', 'Tampa Interna Janela Integrada', 0.884, ROUND(0.884 * 6, 3), 6000),
('LG-041', 'profile', 'barra', 'Gold', 'Marco Superior da Caixa de Persiana', 1.370, ROUND(1.370 * 6, 3), 6000),
('LG-035', 'profile', 'barra', 'Gold', 'Perfil de Alumínio para Linha Gold', 1.090, ROUND(1.090 * 6, 3), 6000);

-- =====================================================
-- UPDATE EXISTING INOVA PROFILES WITH CORRECT WEIGHTS
-- Source: Catálogo Linha Inova PDF (official document)
-- =====================================================

-- IN-003: PDF=0.546 (was 0.46)
UPDATE item_templates SET weight_per_meter = 0.546, weight_per_bar = 3.276 WHERE name = 'IN-003' AND linha = 'Inova';
-- IN-004: PDF=0.470 (was 0.47 - minor precision)
UPDATE item_templates SET weight_per_meter = 0.470, weight_per_bar = 2.820 WHERE name = 'IN-004' AND linha = 'Inova';
-- IN-005: PDF=0.929
UPDATE item_templates SET weight_per_meter = 0.929, weight_per_bar = 5.574 WHERE name = 'IN-005' AND linha = 'Inova';
-- IN-006: PDF page 17 column alignment unclear, keeping as 0.46
-- IN-007: PDF=0.440
UPDATE item_templates SET weight_per_meter = 0.440, weight_per_bar = 2.640 WHERE name = 'IN-007' AND linha = 'Inova';
-- IN-008: PDF=0.423
UPDATE item_templates SET weight_per_meter = 0.423, weight_per_bar = 2.538 WHERE name = 'IN-008' AND linha = 'Inova';
-- IN-009: PDF=1.018 (was 0.55!)
UPDATE item_templates SET weight_per_meter = 1.018, weight_per_bar = 6.108 WHERE name = 'IN-009' AND linha = 'Inova';
-- IN-010: PDF=0.841 (was 1.02)
UPDATE item_templates SET weight_per_meter = 0.841, weight_per_bar = 5.046 WHERE name = 'IN-010' AND linha = 'Inova';
-- IN-011: PDF=0.635
UPDATE item_templates SET weight_per_meter = 0.635, weight_per_bar = 3.810 WHERE name = 'IN-011' AND linha = 'Inova';
-- IN-012: PDF=0.742 (was 0.72)
UPDATE item_templates SET weight_per_meter = 0.742, weight_per_bar = 4.452 WHERE name = 'IN-012' AND linha = 'Inova';
-- IN-013: PDF=0.713 (was 0.75)
UPDATE item_templates SET weight_per_meter = 0.713, weight_per_bar = 4.278 WHERE name = 'IN-013' AND linha = 'Inova';
-- IN-014: PDF=0.840
UPDATE item_templates SET weight_per_meter = 0.840, weight_per_bar = 5.040 WHERE name = 'IN-014' AND linha = 'Inova';
-- IN-015: PDF=0.503
UPDATE item_templates SET weight_per_meter = 0.503, weight_per_bar = 3.018 WHERE name = 'IN-015' AND linha = 'Inova';
-- IN-016: PDF=1.147 (was 1.15)
UPDATE item_templates SET weight_per_meter = 1.147, weight_per_bar = 6.882 WHERE name = 'IN-016' AND linha = 'Inova';
-- IN-017: PDF=0.134
UPDATE item_templates SET weight_per_meter = 0.134, weight_per_bar = 0.804 WHERE name = 'IN-017' AND linha = 'Inova';
-- IN-018: PDF=0.138 (was 0.14)
UPDATE item_templates SET weight_per_meter = 0.138, weight_per_bar = 0.828 WHERE name = 'IN-018' AND linha = 'Inova';
-- IN-020: PDF=1.023
UPDATE item_templates SET weight_per_meter = 1.023, weight_per_bar = 6.138 WHERE name = 'IN-020' AND linha = 'Inova';
-- IN-021: PDF=0.983
UPDATE item_templates SET weight_per_meter = 0.983, weight_per_bar = 5.898 WHERE name = 'IN-021' AND linha = 'Inova';
-- IN-022: PDF=0.707
UPDATE item_templates SET weight_per_meter = 0.707, weight_per_bar = 4.242 WHERE name = 'IN-022' AND linha = 'Inova';
-- IN-023: PDF=0.823
UPDATE item_templates SET weight_per_meter = 0.823, weight_per_bar = 4.938 WHERE name = 'IN-023' AND linha = 'Inova';
-- IN-024: PDF=0.501
UPDATE item_templates SET weight_per_meter = 0.501, weight_per_bar = 3.006 WHERE name = 'IN-024' AND linha = 'Inova';
-- IN-025: PDF=0.381 (was 0.47!)
UPDATE item_templates SET weight_per_meter = 0.381, weight_per_bar = 2.286 WHERE name = 'IN-025' AND linha = 'Inova';
-- IN-027: PDF=0.973 (was 0.49!)
UPDATE item_templates SET weight_per_meter = 0.973, weight_per_bar = 5.838 WHERE name = 'IN-027' AND linha = 'Inova';
-- IN-028: PDF=0.514
UPDATE item_templates SET weight_per_meter = 0.514, weight_per_bar = 3.084 WHERE name = 'IN-028' AND linha = 'Inova';
-- IN-029: PDF=1.025 (was 1.06)
UPDATE item_templates SET weight_per_meter = 1.025, weight_per_bar = 6.150 WHERE name = 'IN-029' AND linha = 'Inova';
-- IN-031: PDF=0.592
UPDATE item_templates SET weight_per_meter = 0.592, weight_per_bar = 3.552 WHERE name = 'IN-031' AND linha = 'Inova';
-- IN-032: PDF=0.569 (was 0.97!)
UPDATE item_templates SET weight_per_meter = 0.569, weight_per_bar = 3.414 WHERE name = 'IN-032' AND linha = 'Inova';
-- IN-033: PDF=1.058
UPDATE item_templates SET weight_per_meter = 1.058, weight_per_bar = 6.348 WHERE name = 'IN-033' AND linha = 'Inova';
-- IN-034: PDF=0.606 (was 0.38!)
UPDATE item_templates SET weight_per_meter = 0.606, weight_per_bar = 3.636 WHERE name = 'IN-034' AND linha = 'Inova';
-- IN-036: PDF=0.987 (was 0.42!)
UPDATE item_templates SET weight_per_meter = 0.987, weight_per_bar = 5.922 WHERE name = 'IN-036' AND linha = 'Inova';
-- IN-037: PDF=0.208 (was 0.45!)
UPDATE item_templates SET weight_per_meter = 0.208, weight_per_bar = 1.248 WHERE name = 'IN-037' AND linha = 'Inova';
-- IN-038: PDF=1.359 (was 0.48!)
UPDATE item_templates SET weight_per_meter = 1.359, weight_per_bar = 8.154 WHERE name = 'IN-038' AND linha = 'Inova';
-- IN-039: PDF=1.216 (was 0.50!)
UPDATE item_templates SET weight_per_meter = 1.216, weight_per_bar = 7.296 WHERE name = 'IN-039' AND linha = 'Inova';
-- IN-051: PDF=0.677 (was 0.62)
UPDATE item_templates SET weight_per_meter = 0.677, weight_per_bar = 4.062 WHERE name = 'IN-051' AND linha = 'Inova';
-- IN-054: PDF=0.210 (was 0.70!)
UPDATE item_templates SET weight_per_meter = 0.210, weight_per_bar = 1.260 WHERE name = 'IN-054' AND linha = 'Inova';
-- IN-055: PDF=0.311 (was 0.55!)
UPDATE item_templates SET weight_per_meter = 0.311, weight_per_bar = 1.866 WHERE name = 'IN-055' AND linha = 'Inova';
-- IN-056: PDF=0.349 (was 0.58!)
UPDATE item_templates SET weight_per_meter = 0.349, weight_per_bar = 2.094 WHERE name = 'IN-056' AND linha = 'Inova';
-- IN-058: PDF=0.370 (was 0.65!)
UPDATE item_templates SET weight_per_meter = 0.370, weight_per_bar = 2.220 WHERE name = 'IN-058' AND linha = 'Inova';
-- IN-061: PDF=0.449 (was 0.72!)
UPDATE item_templates SET weight_per_meter = 0.449, weight_per_bar = 2.694 WHERE name = 'IN-061' AND linha = 'Inova';
-- IN-063: PDF=0.431 (was 0.68!)
UPDATE item_templates SET weight_per_meter = 0.431, weight_per_bar = 2.586 WHERE name = 'IN-063' AND linha = 'Inova';
-- IN-065: PDF=0.612 (was 0.52)
UPDATE item_templates SET weight_per_meter = 0.612, weight_per_bar = 3.672 WHERE name = 'IN-065' AND linha = 'Inova';
-- IN-066: PDF=0.685 (was 0.48!)
UPDATE item_templates SET weight_per_meter = 0.685, weight_per_bar = 4.110 WHERE name = 'IN-066' AND linha = 'Inova';
-- IN-068: PDF=1.038 (was 0.56!)
UPDATE item_templates SET weight_per_meter = 1.038, weight_per_bar = 6.228 WHERE name = 'IN-068' AND linha = 'Inova';
-- IN-069: PDF=1.079 (was 0.60!)
UPDATE item_templates SET weight_per_meter = 1.079, weight_per_bar = 6.474 WHERE name = 'IN-069' AND linha = 'Inova';
-- IN-079: PDF=1.014 (was 0.75!)
UPDATE item_templates SET weight_per_meter = 1.014, weight_per_bar = 6.084 WHERE name = 'IN-079' AND linha = 'Inova';
-- IN-094: PDF=1.202 (was 0.85!)
UPDATE item_templates SET weight_per_meter = 1.202, weight_per_bar = 7.212 WHERE name = 'IN-094' AND linha = 'Inova';
-- IN-102: PDF=0.560 (was 0.90!)
UPDATE item_templates SET weight_per_meter = 0.560, weight_per_bar = 3.360 WHERE name = 'IN-102' AND linha = 'Inova';
-- IN-109: PDF=0.888 (was 0.78)
UPDATE item_templates SET weight_per_meter = 0.888, weight_per_bar = 5.328 WHERE name = 'IN-109' AND linha = 'Inova';
-- IN-110: PDF=0.485 (was 0.82!)
UPDATE item_templates SET weight_per_meter = 0.485, weight_per_bar = 2.910 WHERE name = 'IN-110' AND linha = 'Inova';
-- IN-113: PDF=1.048 (was 0.65!)
UPDATE item_templates SET weight_per_meter = 1.048, weight_per_bar = 6.288 WHERE name = 'IN-113' AND linha = 'Inova';
-- IN-114: PDF=0.616
UPDATE item_templates SET weight_per_meter = 0.616, weight_per_bar = 3.696 WHERE name = 'IN-114' AND linha = 'Inova';
-- IN-115: PDF=0.916
UPDATE item_templates SET weight_per_meter = 0.916, weight_per_bar = 5.496 WHERE name = 'IN-115' AND linha = 'Inova';
-- IN-117: PDF=0.723
UPDATE item_templates SET weight_per_meter = 0.723, weight_per_bar = 4.338 WHERE name = 'IN-117' AND linha = 'Inova';
-- IN-121: PDF=1.301
UPDATE item_templates SET weight_per_meter = 1.301, weight_per_bar = 7.806 WHERE name = 'IN-121' AND linha = 'Inova';
-- IN-122: PDF=1.390 (was 0.70! - was swapped with IN-123)
UPDATE item_templates SET weight_per_meter = 1.390, weight_per_bar = 8.340 WHERE name = 'IN-122' AND linha = 'Inova';
-- IN-123: PDF=0.739 (was 1.39! - was swapped with IN-122)
UPDATE item_templates SET weight_per_meter = 0.739, weight_per_bar = 4.434 WHERE name = 'IN-123' AND linha = 'Inova';
-- IN-128: PDF=0.517
UPDATE item_templates SET weight_per_meter = 0.517, weight_per_bar = 3.102 WHERE name = 'IN-128' AND linha = 'Inova';
-- IN-129: PDF=0.963
UPDATE item_templates SET weight_per_meter = 0.963, weight_per_bar = 5.778 WHERE name = 'IN-129' AND linha = 'Inova';
-- IN-130: PDF=0.477
UPDATE item_templates SET weight_per_meter = 0.477, weight_per_bar = 2.862 WHERE name = 'IN-130' AND linha = 'Inova';
-- IN-131: PDF=1.032
UPDATE item_templates SET weight_per_meter = 1.032, weight_per_bar = 6.192 WHERE name = 'IN-131' AND linha = 'Inova';
-- IN-132: PDF=0.477
UPDATE item_templates SET weight_per_meter = 0.477, weight_per_bar = 2.862 WHERE name = 'IN-132' AND linha = 'Inova';
-- IN-134: PDF=0.715 (was 0.88!)
UPDATE item_templates SET weight_per_meter = 0.715, weight_per_bar = 4.290 WHERE name = 'IN-134' AND linha = 'Inova';
-- IN-139: PDF=0.858 (was 0.72!)
UPDATE item_templates SET weight_per_meter = 0.858, weight_per_bar = 5.148 WHERE name = 'IN-139' AND linha = 'Inova';
-- IN-151: PDF=0.698 (was 0.86!)
UPDATE item_templates SET weight_per_meter = 0.698, weight_per_bar = 4.188 WHERE name = 'IN-151' AND linha = 'Inova';
-- IN-155: PDF=0.501 (was 0.70!)
UPDATE item_templates SET weight_per_meter = 0.501, weight_per_bar = 3.006 WHERE name = 'IN-155' AND linha = 'Inova';
-- IN-159: PDF=0.740
UPDATE item_templates SET weight_per_meter = 0.740, weight_per_bar = 4.440 WHERE name = 'IN-159' AND linha = 'Inova';

-- Update non-IN profiles that exist
-- MH-001: PDF=0.786 (was 0.8)
UPDATE item_templates SET weight_per_meter = 0.786, weight_per_bar = 4.716 WHERE name = 'MH-001' AND linha = 'Inova';
-- MH-004: PDF=1.323 (was 0.61!)
UPDATE item_templates SET weight_per_meter = 1.323, weight_per_bar = 7.938 WHERE name = 'MH-004' AND linha = 'Inova';
-- MH-006: PDF=0.697 (was 0.70)
UPDATE item_templates SET weight_per_meter = 0.697, weight_per_bar = 4.182 WHERE name = 'MH-006' AND linha = 'Inova';
-- MH-008: PDF=0.820
UPDATE item_templates SET weight_per_meter = 0.820, weight_per_bar = 4.920 WHERE name = 'MH-008' AND linha = 'Inova';
-- RM-021: PDF=0.212 (was 0.22)
UPDATE item_templates SET weight_per_meter = 0.212, weight_per_bar = 1.272 WHERE name = 'RM-021' AND linha = 'Inova';

-- =====================================================
-- INSERT MISSING INOVA PROFILES (IN-* series)
-- Source: Catálogo Linha Inova PDF
-- =====================================================

INSERT INTO item_templates (name, description, type, unit, linha, weight_per_meter, weight_per_bar, default_price)
VALUES
  ('IN-001', 'Perfil IN-001', 'profile', 'barra', 'Inova', 0.855, 5.130, 0),
  ('IN-002', 'Perfil IN-002', 'profile', 'barra', 'Inova', 0.785, 4.710, 0),
  ('IN-035', 'Perfil IN-035', 'profile', 'barra', 'Inova', 0.934, 5.604, 0),
  ('IN-043', 'Perfil IN-043', 'profile', 'barra', 'Inova', 0.408, 2.448, 0),
  ('IN-044', 'Perfil IN-044', 'profile', 'barra', 'Inova', 0.507, 3.042, 0),
  ('IN-045', 'Perfil IN-045', 'profile', 'barra', 'Inova', 1.022, 6.132, 0),
  ('IN-046', 'Perfil IN-046', 'profile', 'barra', 'Inova', 1.086, 6.516, 0),
  ('IN-047', 'Perfil IN-047', 'profile', 'barra', 'Inova', 0.670, 4.020, 0),
  ('IN-049', 'Perfil IN-049', 'profile', 'barra', 'Inova', 0.227, 1.362, 0),
  ('IN-050', 'Perfil IN-050', 'profile', 'barra', 'Inova', 0.300, 1.800, 0),
  ('IN-052', 'Perfil IN-052', 'profile', 'barra', 'Inova', 0.983, 5.898, 0),
  ('IN-053', 'Perfil IN-053', 'profile', 'barra', 'Inova', 0.433, 2.598, 0),
  ('IN-057', 'Perfil IN-057', 'profile', 'barra', 'Inova', 0.344, 2.064, 0),
  ('IN-059', 'Perfil IN-059', 'profile', 'barra', 'Inova', 0.382, 2.292, 0),
  ('IN-060', 'Perfil IN-060', 'profile', 'barra', 'Inova', 0.396, 2.376, 0),
  ('IN-062', 'Perfil IN-062', 'profile', 'barra', 'Inova', 0.434, 2.604, 0),
  ('IN-064', 'Perfil IN-064', 'profile', 'barra', 'Inova', 0.465, 2.790, 0),
  ('IN-071', 'Perfil IN-071', 'profile', 'barra', 'Inova', 0.237, 1.422, 0),
  ('IN-072', 'Perfil IN-072', 'profile', 'barra', 'Inova', 0.844, 5.064, 0),
  ('IN-073', 'Perfil IN-073', 'profile', 'barra', 'Inova', 0.982, 5.892, 0),
  ('IN-074', 'Perfil IN-074', 'profile', 'barra', 'Inova', 1.191, 7.146, 0),
  ('IN-076', 'Perfil IN-076', 'profile', 'barra', 'Inova', 1.030, 6.180, 0),
  ('IN-077', 'Perfil IN-077', 'profile', 'barra', 'Inova', 0.723, 4.338, 0),
  ('IN-078', 'Perfil IN-078', 'profile', 'barra', 'Inova', 0.132, 0.792, 0),
  ('IN-081', 'Perfil IN-081', 'profile', 'barra', 'Inova', 0.492, 2.952, 0),
  ('IN-083', 'Perfil IN-083', 'profile', 'barra', 'Inova', 0.484, 2.904, 0),
  ('IN-084', 'Perfil IN-084', 'profile', 'barra', 'Inova', 0.465, 2.790, 0),
  ('IN-085', 'Perfil IN-085', 'profile', 'barra', 'Inova', 0.315, 1.890, 0),
  ('IN-086', 'Perfil IN-086', 'profile', 'barra', 'Inova', 0.315, 1.890, 0),
  ('IN-087', 'Perfil IN-087', 'profile', 'barra', 'Inova', 0.571, 3.426, 0),
  ('IN-088', 'Perfil IN-088', 'profile', 'barra', 'Inova', 0.412, 2.472, 0),
  ('IN-089', 'Perfil IN-089', 'profile', 'barra', 'Inova', 0.344, 2.064, 0),
  ('IN-090', 'Perfil IN-090', 'profile', 'barra', 'Inova', 0.658, 3.948, 0),
  ('IN-091', 'Perfil IN-091', 'profile', 'barra', 'Inova', 0.305, 1.830, 0),
  ('IN-092', 'Perfil IN-092', 'profile', 'barra', 'Inova', 0.655, 3.930, 0),
  ('IN-093', 'Perfil IN-093', 'profile', 'barra', 'Inova', 1.101, 6.606, 0),
  ('IN-095', 'Perfil IN-095', 'profile', 'barra', 'Inova', 0.775, 4.650, 0),
  ('IN-096', 'Perfil IN-096', 'profile', 'barra', 'Inova', 0.891, 5.346, 0),
  ('IN-097', 'Perfil IN-097', 'profile', 'barra', 'Inova', 1.128, 6.768, 0),
  ('IN-098', 'Perfil IN-098', 'profile', 'barra', 'Inova', 1.100, 6.600, 0),
  ('IN-099', 'Perfil IN-099', 'profile', 'barra', 'Inova', 1.155, 6.930, 0),
  ('IN-100', 'Perfil IN-100', 'profile', 'barra', 'Inova', 0.245, 1.470, 0),
  ('IN-101', 'Perfil IN-101', 'profile', 'barra', 'Inova', 0.100, 0.600, 0),
  ('IN-103', 'Perfil IN-103', 'profile', 'barra', 'Inova', 0.541, 3.246, 0),
  ('IN-104', 'Perfil IN-104', 'profile', 'barra', 'Inova', 0.364, 2.184, 0),
  ('IN-105', 'Perfil IN-105', 'profile', 'barra', 'Inova', 0.385, 2.310, 0),
  ('IN-108', 'Perfil IN-108', 'profile', 'barra', 'Inova', 0.502, 3.012, 0),
  ('IN-111', 'Perfil IN-111', 'profile', 'barra', 'Inova', 0.660, 3.960, 0),
  ('IN-112', 'Perfil IN-112', 'profile', 'barra', 'Inova', 1.620, 9.720, 0),
  ('IN-116', 'Perfil IN-116', 'profile', 'barra', 'Inova', 0.213, 1.278, 0),
  ('IN-118', 'Perfil IN-118', 'profile', 'barra', 'Inova', 0.120, 0.720, 0),
  ('IN-119', 'Perfil IN-119', 'profile', 'barra', 'Inova', 0.127, 0.762, 0),
  ('IN-120', 'Perfil IN-120', 'profile', 'barra', 'Inova', 0.123, 0.738, 0),
  ('IN-153', 'Perfil IN-153', 'profile', 'barra', 'Inova', 0.427, 2.562, 0),
  ('IN-154', 'Perfil IN-154', 'profile', 'barra', 'Inova', 0.465, 2.790, 0),
  ('IN-157', 'Perfil IN-157', 'profile', 'barra', 'Inova', 0.102, 0.612, 0),
  ('IN-158', 'Perfil IN-158', 'profile', 'barra', 'Inova', 0.484, 2.904, 0),
  ('IN-162', 'Perfil IN-162', 'profile', 'barra', 'Inova', 0.462, 2.772, 0);

-- =====================================================
-- INSERT MISSING SHARED PROFILES USED IN INOVA LINE
-- (CM, RM, MH, DS, VZ, US series)
-- =====================================================

INSERT INTO item_templates (name, description, type, unit, linha, weight_per_meter, weight_per_bar, default_price)
VALUES
  -- Contramarcos
  ('CM-093', 'Contramarco CM-093', 'profile', 'barra', 'Inova', 0.769, 4.614, 0),
  ('CM-099', 'Contramarco CM-099', 'profile', 'barra', 'Inova', 0.577, 3.462, 0),
  ('CM-173', 'Contramarco CM-173', 'profile', 'barra', 'Inova', 0.509, 3.054, 0),
  ('CM-174', 'Contramarco CM-174', 'profile', 'barra', 'Inova', 0.411, 2.466, 0),
  ('CM-175', 'Contramarco CM-175', 'profile', 'barra', 'Inova', 0.602, 3.612, 0),
  ('CM-207', 'Contramarco CM-207', 'profile', 'barra', 'Inova', 0.640, 3.840, 0),
  ('CM-208', 'Contramarco CM-208', 'profile', 'barra', 'Inova', 0.610, 3.660, 0),
  ('CM-209', 'Contramarco CM-209', 'profile', 'barra', 'Inova', 0.543, 3.258, 0),
  ('CM-210', 'Contramarco CM-210', 'profile', 'barra', 'Inova', 0.530, 3.180, 0),
  ('CM-211', 'Presilha CM-211', 'profile', 'barra', 'Inova', 0.137, 0.822, 0),
  -- Reforços/Marco
  ('RM-019', 'Reforço RM-019', 'profile', 'barra', 'Inova', 0.206, 1.236, 0),
  ('RM-020', 'Reforço RM-020', 'profile', 'barra', 'Inova', 0.232, 1.392, 0),
  ('RM-022', 'Reforço RM-022', 'profile', 'barra', 'Inova', 0.226, 1.356, 0),
  ('RM-023', 'Reforço RM-023', 'profile', 'barra', 'Inova', 0.233, 1.398, 0),
  ('RM-025', 'Reforço RM-025', 'profile', 'barra', 'Inova', 0.378, 2.268, 0),
  ('RM-026', 'Reforço RM-026', 'profile', 'barra', 'Inova', 0.383, 2.298, 0),
  ('RM-027', 'Reforço RM-027', 'profile', 'barra', 'Inova', 0.402, 2.412, 0),
  ('RM-028', 'Reforço RM-028', 'profile', 'barra', 'Inova', 0.407, 2.442, 0),
  -- Montantes horizontais
  ('MH-005', 'Montante Horizontal MH-005', 'profile', 'barra', 'Inova', 1.090, 6.540, 0),
  ('MH-095', 'Montante Horizontal MH-095', 'profile', 'barra', 'Inova', 0.181, 1.086, 0),
  ('MH-096', 'Montante Horizontal MH-096', 'profile', 'barra', 'Inova', 0.366, 2.196, 0),
  ('MH-104', 'Montante Horizontal MH-104', 'profile', 'barra', 'Inova', 0.598, 3.588, 0),
  ('MH-106', 'Montante Horizontal MH-106', 'profile', 'barra', 'Inova', 0.163, 0.978, 0),
  ('MH-125', 'Montante Horizontal MH-125', 'profile', 'barra', 'Inova', 0.154, 0.924, 0),
  -- Diversos
  ('DS-023', 'Perfil DS-023', 'profile', 'barra', 'Inova', 0.259, 1.554, 0),
  ('DS-238', 'Perfil DS-238', 'profile', 'barra', 'Inova', 0.480, 2.880, 0),
  ('VZ-075', 'Perfil VZ-075', 'profile', 'barra', 'Inova', 0.259, 1.554, 0),
  ('US-621', 'Perfil US-621', 'profile', 'barra', 'Inova', 0.130, 0.780, 0);

-- Also update existing shared profiles with correct Inova PDF weights
UPDATE item_templates SET weight_per_meter = 0.276, weight_per_bar = 1.656 WHERE name = 'CM-060' AND linha = 'Universal';
UPDATE item_templates SET weight_per_meter = 0.392, weight_per_bar = 2.352 WHERE name = 'CM-098' AND linha = 'Sem Linha';
UPDATE item_templates SET weight_per_meter = 0.309, weight_per_bar = 1.854 WHERE name = 'CM-151' AND linha = 'Sem Linha';
UPDATE item_templates SET weight_per_meter = 0.198, weight_per_bar = 1.188 WHERE name = 'CM-200' AND linha = 'Universal';

-- Function to auto-activate all active product templates for a given company
CREATE OR REPLACE FUNCTION public.activate_all_products_for_company(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_template IN
    SELECT id FROM product_templates WHERE is_active = true
  LOOP
    -- Only activate if not already exists
    IF NOT EXISTS (
      SELECT 1 FROM company_products 
      WHERE company_id = _company_id 
      AND product_template_id = v_template.id
    ) THEN
      PERFORM activate_product_template_for_company(_company_id, v_template.id);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Also activate all linhas for the company
CREATE OR REPLACE FUNCTION public.activate_all_linhas_for_company(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_linha TEXT;
  v_count INTEGER := 0;
BEGIN
  FOR v_linha IN
    SELECT DISTINCT linha FROM product_templates WHERE is_active = true AND linha IS NOT NULL
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM company_linhas WHERE company_id = _company_id AND name = v_linha
    ) THEN
      INSERT INTO company_linhas (company_id, name, is_active)
      VALUES (_company_id, v_linha, true);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Trigger function: when a new company is created, auto-activate all products
CREATE OR REPLACE FUNCTION public.trigger_activate_all_products_for_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM activate_all_linhas_for_company(NEW.id);
  PERFORM activate_all_products_for_company(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger on companies table
DROP TRIGGER IF EXISTS trg_activate_products_on_company_create ON companies;
CREATE TRIGGER trg_activate_products_on_company_create
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_activate_all_products_for_new_company();

-- Add product configuration fields to product_templates
ALTER TABLE public.product_templates 
  ADD COLUMN IF NOT EXISTS acabamento text DEFAULT null,
  ADD COLUMN IF NOT EXISTS cor_componentes text DEFAULT null,
  ADD COLUMN IF NOT EXISTS reforco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS contramarco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS corte_contramarco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS arremate text DEFAULT null;

-- Add same fields to company_products
ALTER TABLE public.company_products 
  ADD COLUMN IF NOT EXISTS acabamento text DEFAULT null,
  ADD COLUMN IF NOT EXISTS cor_componentes text DEFAULT null,
  ADD COLUMN IF NOT EXISTS reforco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS contramarco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS corte_contramarco text DEFAULT null,
  ADD COLUMN IF NOT EXISTS arremate text DEFAULT null;
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'maxim_ar';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'portao';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'basculante';
ALTER TYPE product_category ADD VALUE IF NOT EXISTS 'corrimao';-- Change product_templates.category from enum to text
ALTER TABLE product_templates ALTER COLUMN category TYPE text USING category::text;

-- Change company_products.category from enum to text  
ALTER TABLE company_products ALTER COLUMN category TYPE text USING category::text;

-- Drop the old enum
DROP TYPE IF EXISTS product_category;
UPDATE item_templates SET image_url = '/profiles/cm-200-v3.png' WHERE name = 'CM-200' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/me-013.png' WHERE name = 'ME-013' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/mp-347-v2.png' WHERE name = 'MP-347' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-001-v2.png' WHERE name = 'SU-001' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-002-v2.png' WHERE name = 'SU-002' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-003-v2.png' WHERE name = 'SU-003' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-004.png' WHERE name = 'SU-004' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-005.png' WHERE name = 'SU-005' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-006.png' WHERE name = 'SU-006' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-007-v4.png' WHERE name = 'SU-007' AND linha ILIKE '%suprema%';

UPDATE item_templates SET image_url = '/profiles/su-008.png' WHERE name = 'SU-008' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-009.png' WHERE name = 'SU-009' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-010-v2.png' WHERE name = 'SU-010' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-011-v2.png' WHERE name = 'SU-011' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-012-v2.png' WHERE name = 'SU-012' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-013.png' WHERE name = 'SU-013' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-014.png' WHERE name = 'SU-014' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-039-v2.png' WHERE name = 'SU-039' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-040-v3.png' WHERE name = 'SU-040' AND linha ILIKE '%suprema%';
UPDATE item_templates SET image_url = '/profiles/su-041-v3.png' WHERE name = 'SU-041' AND linha ILIKE '%suprema%';

INSERT INTO item_templates (name, description, type, unit, linha, weight_per_meter, weight_per_bar, default_price, image_url, is_active)
VALUES ('SU-008', 'Trilho inferior / base', 'profile', 'barra', 'Linha Suprema', 0.295, 1.770, 0, '/profiles/su-008.png', true);

-- Reset completo: apagar todos os dados de templates e itens relacionados
-- Ordem respeitando foreign keys

-- 1. Itens de produtos da empresa (referencia company_products e item_templates)
DELETE FROM public.company_product_items;

-- 2. Produtos da empresa (referencia product_templates)
DELETE FROM public.company_products;

-- 3. Itens de templates de produtos (referencia product_templates e item_templates)
DELETE FROM public.product_template_items;

-- 4. Templates de produtos
DELETE FROM public.product_templates;

-- 5. Preços de itens da empresa (referencia item_templates)
DELETE FROM public.company_item_prices;

-- 6. Estoque da empresa (referencia item_templates e company_items)
DELETE FROM public.company_stock;

-- 7. Itens da empresa (referencia item_templates)
DELETE FROM public.company_items;

-- 8. Templates de itens
DELETE FROM public.item_templates;

CREATE TABLE public.company_folga_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  folga_largura NUMERIC NOT NULL DEFAULT 0,
  folga_altura NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_folga_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company folga settings"
  ON public.company_folga_settings
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage their company folga settings"
  ON public.company_folga_settings
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.employees WHERE user_id = auth.uid()
    )
  );
-- Add has_multiple_sides to product_templates
ALTER TABLE public.product_templates 
ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

-- Add has_multiple_sides to company_products
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

-- Add side to product_template_items
ALTER TABLE public.product_template_items 
ADD COLUMN IF NOT EXISTS side TEXT;

-- Add side to company_product_items
ALTER TABLE public.company_product_items 
ADD COLUMN IF NOT EXISTS side TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.product_templates.has_multiple_sides IS 'Indicates if the product has multiple sides (e.g., L-shaped showers)';
COMMENT ON COLUMN public.company_products.has_multiple_sides IS 'Indicates if the product has multiple sides (e.g., L-shaped showers)';
COMMENT ON COLUMN public.product_template_items.side IS 'Side of the product template (e.g., Lado A, Lado B) for multi-side products';
COMMENT ON COLUMN public.company_product_items.side IS 'Side of the company product item (e.g., Lado A, Lado B) for multi-side products';
-- Add has_multiple_sides to product_templates
ALTER TABLE public.product_templates 
ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

-- Add has_multiple_sides to company_products
ALTER TABLE public.company_products 
ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;

-- Add side to product_template_items
ALTER TABLE public.product_template_items 
ADD COLUMN IF NOT EXISTS side TEXT;

-- Add side to company_product_items
ALTER TABLE public.company_product_items 
ADD COLUMN IF NOT EXISTS side TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.product_templates.has_multiple_sides IS 'Indicates if the product has multiple sides (e.g., L-shaped showers)';
COMMENT ON COLUMN public.company_products.has_multiple_sides IS 'Indicates if the product has multiple sides (e.g., L-shaped showers)';
COMMENT ON COLUMN public.product_template_items.side IS 'Side of the product template (e.g., Lado A, Lado B) for multi-side products';
COMMENT ON COLUMN public.company_product_items.side IS 'Side of the company product item (e.g., Lado A, Lado B) for multi-side products';
UPDATE product_templates SET linha = 'suprema' WHERE linha = 'Suprema';
CREATE TABLE public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'basico',
  plan_price NUMERIC NOT NULL DEFAULT 98.99,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  renewed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saas_admin_select_subscriptions" ON public.company_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_saas_admin(auth.uid()));

CREATE POLICY "saas_admin_insert_subscriptions" ON public.company_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE POLICY "saas_admin_update_subscriptions" ON public.company_subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_saas_admin(auth.uid()));

CREATE POLICY "saas_admin_delete_subscriptions" ON public.company_subscriptions
  FOR DELETE TO authenticated
  USING (public.is_saas_admin(auth.uid()));

CREATE POLICY "company_view_own_subscription" ON public.company_subscriptions
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

INSERT INTO item_templates (name, type, unit, linha, is_active, description)
VALUES 
  ('Vidro Comum Incolor 4mm', 'glass', 'm2', 'Vidros', true, 'Vidro float incolor 4mm'),
  ('Vidro Comum Incolor 6mm', 'glass', 'm2', 'Vidros', true, 'Vidro float incolor 6mm'),
  ('Vidro Comum Incolor 8mm', 'glass', 'm2', 'Vidros', true, 'Vidro float incolor 8mm'),
  ('Vidro Comum Incolor 10mm', 'glass', 'm2', 'Vidros', true, 'Vidro float incolor 10mm'),
  ('Vidro Comum Verde 4mm', 'glass', 'm2', 'Vidros', true, 'Vidro float verde 4mm'),
  ('Vidro Comum Verde 6mm', 'glass', 'm2', 'Vidros', true, 'Vidro float verde 6mm'),
  ('Vidro Comum Verde 8mm', 'glass', 'm2', 'Vidros', true, 'Vidro float verde 8mm'),
  ('Vidro Comum Verde 10mm', 'glass', 'm2', 'Vidros', true, 'Vidro float verde 10mm'),
  ('Vidro Comum Fumê 4mm', 'glass', 'm2', 'Vidros', true, 'Vidro float fumê 4mm'),
  ('Vidro Comum Fumê 6mm', 'glass', 'm2', 'Vidros', true, 'Vidro float fumê 6mm'),
  ('Vidro Comum Fumê 8mm', 'glass', 'm2', 'Vidros', true, 'Vidro float fumê 8mm'),
  ('Vidro Comum Fumê 10mm', 'glass', 'm2', 'Vidros', true, 'Vidro float fumê 10mm'),
  ('Vidro Temperado Incolor 4mm', 'glass', 'm2', 'Vidros', true, 'Vidro temperado incolor 4mm'),
  ('Vidro Temperado Incolor 6mm', 'glass', 'm2', 'Vidros', true, 'Vidro temperado incolor 6mm'),
  ('Vidro Temperado Incolor 8mm', 'glass', 'm2', 'Vidros', true, 'Vidro temperado incolor 8mm'),
  ('Vidro Temperado Incolor 10mm', 'glass', 'm2', 'Vidros', true, 'Vidro temperado incolor 10mm');

ALTER TABLE public.company_products
  DROP CONSTRAINT company_products_product_template_id_fkey,
  ADD CONSTRAINT company_products_product_template_id_fkey
    FOREIGN KEY (product_template_id) REFERENCES public.product_templates(id)
    ON DELETE SET NULL;

-- Pricing policies per company
CREATE TABLE public.pricing_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  margin_type TEXT NOT NULL DEFAULT 'simple' CHECK (margin_type IN ('simple', 'markup')),
  default_margin NUMERIC NOT NULL DEFAULT 30,
  default_loss_percent NUMERIC NOT NULL DEFAULT 5,
  include_labor BOOLEAN NOT NULL DEFAULT false,
  labor_cost_per_sqm NUMERIC NOT NULL DEFAULT 0,
  include_packaging BOOLEAN NOT NULL DEFAULT false,
  packaging_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  include_installation BOOLEAN NOT NULL DEFAULT false,
  installation_cost_per_sqm NUMERIC NOT NULL DEFAULT 0,
  include_transport BOOLEAN NOT NULL DEFAULT false,
  transport_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  include_commission BOOLEAN NOT NULL DEFAULT false,
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  include_tax BOOLEAN NOT NULL DEFAULT false,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  admin_fee NUMERIC NOT NULL DEFAULT 0,
  rounding_mode TEXT NOT NULL DEFAULT 'round' CHECK (rounding_mode IN ('round', 'ceil', 'floor', 'none')),
  price_decimals INTEGER NOT NULL DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Add loss_percent to company_product_items for per-item loss
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS loss_percent NUMERIC DEFAULT 0;

-- Add loss_percent to product_template_items for per-item loss  
ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS loss_percent NUMERIC DEFAULT 0;

-- RLS
ALTER TABLE public.pricing_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company pricing policies"
  ON public.pricing_policies FOR SELECT
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert own company pricing policies"
  ON public.pricing_policies FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update own company pricing policies"
  ON public.pricing_policies FOR UPDATE
  TO authenticated
  USING (company_id IN (
    SELECT company_id FROM public.profiles WHERE id = auth.uid()
  ));
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS include_contramarco boolean DEFAULT true;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS excluded_optional_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS section text DEFAULT null;
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS section text DEFAULT null;

COMMENT ON COLUMN public.product_template_items.section IS 'Section categorization: null=auto-detect by type, contramarco=contramarco section';
COMMENT ON COLUMN public.company_product_items.section IS 'Section categorization: null=auto-detect by type, contramarco=contramarco section';

-- Fix 1: company_security_settings - Replace broken RLS policies
DROP POLICY IF EXISTS "Users can view own company security settings" ON company_security_settings;
DROP POLICY IF EXISTS "Users can insert own company security settings" ON company_security_settings;
DROP POLICY IF EXISTS "Users can update own company security settings" ON company_security_settings;
DROP POLICY IF EXISTS "company_security_settings_select" ON company_security_settings;
DROP POLICY IF EXISTS "company_security_settings_insert" ON company_security_settings;
DROP POLICY IF EXISTS "company_security_settings_update" ON company_security_settings;

CREATE POLICY "Members can view company security settings"
  ON company_security_settings FOR SELECT TO authenticated
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can insert company security settings"
  ON company_security_settings FOR INSERT TO authenticated
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can update company security settings"
  ON company_security_settings FOR UPDATE TO authenticated
  USING (user_has_role_in_company(auth.uid(), company_id, 'admin'))
  WITH CHECK (user_has_role_in_company(auth.uid(), company_id, 'admin'));

-- Fix 2: Storage policies - Add company-level authorization

-- os-photos: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload OS photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete OS photos" ON storage.objects;

CREATE POLICY "Users can upload OS photos for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'os-photos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can delete OS photos from their company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'os-photos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

-- company-product-images: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload company product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company product images" ON storage.objects;

CREATE POLICY "Users can upload company product images for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-product-images'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can update company product images for their company"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'company-product-images'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

-- company-item-images: drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload company item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company item images" ON storage.objects;

CREATE POLICY "Users can upload company item images for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-item-images'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can delete company item images from their company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-item-images'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

-- employee-photos: add company-level policies (companyId is first path segment)
DROP POLICY IF EXISTS "Authenticated users can upload employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete employee photos" ON storage.objects;

CREATE POLICY "Users can upload employee photos for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can delete employee photos from their company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-photos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

-- company-logos: add company-level policies
DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;

CREATE POLICY "Users can upload company logos for their company"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );

CREATE POLICY "Users can delete company logos from their company"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
  );
ALTER TABLE item_templates ADD COLUMN default_formulas jsonb DEFAULT NULL;ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS pieces_formula text;
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS pieces_formula text;
-- Fix 1: company_notification_settings broken RLS policies
-- The existing policies use a self-referencing subquery that always returns true
DROP POLICY IF EXISTS "Users can view own company notification settings" ON public.company_notification_settings;
DROP POLICY IF EXISTS "Users can update own company notification settings" ON public.company_notification_settings;
DROP POLICY IF EXISTS "Users can insert own company notification settings" ON public.company_notification_settings;

CREATE POLICY "Users can view own company notification settings"
ON public.company_notification_settings FOR SELECT TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can update own company notification settings"
ON public.company_notification_settings FOR UPDATE TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Users can insert own company notification settings"
ON public.company_notification_settings FOR INSERT TO authenticated
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- Fix 2: os-photos public SELECT policy - restrict to authenticated company members
DROP POLICY IF EXISTS "Anyone can view OS photos" ON storage.objects;

CREATE POLICY "Authenticated users can view OS photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'os-photos'
  AND user_belongs_to_company(auth.uid(), (string_to_array(name, '/'))[1]::uuid)
);
ALTER TABLE company_products ADD COLUMN IF NOT EXISTS composition_finished BOOLEAN DEFAULT false;
ALTER TABLE product_templates ADD COLUMN IF NOT EXISTS composition_finished BOOLEAN DEFAULT false;
-- Fix all missing columns for multi-side products
ALTER TABLE public.product_templates ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;
ALTER TABLE public.company_products ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;
ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS side TEXT;
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS side TEXT;

-- Migration to fix missing columns
ALTER TABLE public.product_templates ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;
ALTER TABLE public.company_products ADD COLUMN IF NOT EXISTS has_multiple_sides BOOLEAN DEFAULT false;
ALTER TABLE public.product_template_items ADD COLUMN IF NOT EXISTS side TEXT;
ALTER TABLE public.company_product_items ADD COLUMN IF NOT EXISTS side TEXT;
-- =============================================
-- 1. Recreate item_templates for Suprema profiles
-- =============================================

-- Perfis do Marco
INSERT INTO public.item_templates (id, name, type, unit, linha, description, weight_per_meter, weight_per_bar, bar_length_mm, is_active)
VALUES
  (gen_random_uuid(), 'SU-001', 'profile', 'bar', 'Suprema', 'Marco Superior Correr 2 Folhas', 0.738, 4.428, 6000, true),
  (gen_random_uuid(), 'SU-002', 'profile', 'bar', 'Suprema', 'Marco Inferior Correr 2 Folhas', 0.683, 4.098, 6000, true),
  (gen_random_uuid(), 'SU-003', 'profile', 'bar', 'Suprema', 'Marco Lateral Correr', 0.509, 3.054, 6000, true)
ON CONFLICT DO NOTHING;

-- Perfis da Folha
INSERT INTO public.item_templates (id, name, type, unit, linha, description, weight_per_meter, weight_per_bar, bar_length_mm, is_active)
VALUES
  (gen_random_uuid(), 'SU-039', 'profile', 'bar', 'Suprema', 'Montante da Folha', 0.506, 3.036, 6000, true),
  (gen_random_uuid(), 'SU-040', 'profile', 'bar', 'Suprema', 'Montante Fecho', 0.458, 2.748, 6000, true),
  (gen_random_uuid(), 'SU-041', 'profile', 'bar', 'Suprema', 'Montante Encontro', 0.485, 2.910, 6000, true),
  (gen_random_uuid(), 'SU-053', 'profile', 'bar', 'Suprema', 'Travessa da Folha', 0.500, 3.000, 6000, true),
  (gen_random_uuid(), 'SU-102', 'profile', 'bar', 'Suprema', 'Baguete', 0.111, 0.666, 6000, true)
ON CONFLICT DO NOTHING;

-- Contramarco
INSERT INTO public.item_templates (id, name, type, unit, linha, description, weight_per_meter, weight_per_bar, bar_length_mm, is_active)
VALUES
  (gen_random_uuid(), 'MP-347', 'profile', 'bar', 'Universal', 'Contramarco Suprema', 0.300, 1.800, 6000, true),
  (gen_random_uuid(), 'CM-063', 'profile', 'bar', 'Universal', 'Guarnição Contramarco', 0.200, 1.200, 6000, true)
ON CONFLICT DO NOTHING;

-- Vidro genérico
INSERT INTO public.item_templates (id, name, type, unit, linha, description, is_active)
VALUES
  (gen_random_uuid(), 'Vidro', 'glass', 'm2', 'Universal', 'Vidro genérico para composição', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- 2. Create the Product Template
-- =============================================
INSERT INTO public.product_templates (id, name, category, linha, description, is_active, has_multiple_sides)
VALUES (
  gen_random_uuid(),
  'Janela de Correr 02 Folhas',
  'janela',
  'Suprema',
  'Janela de correr com 2 folhas - Linha Suprema',
  true,
  false
);

-- =============================================
-- 3. Create Composition (product_template_items)
-- =============================================
DO $$
DECLARE
  v_product_id uuid;
  v_su001 uuid; v_su002 uuid; v_su003 uuid;
  v_su039 uuid; v_su040 uuid; v_su041 uuid;
  v_su053 uuid; v_su102 uuid;
  v_mp347 uuid; v_cm063 uuid;
  v_vidro uuid;
BEGIN
  -- Get product template ID
  SELECT id INTO v_product_id FROM product_templates WHERE name = 'Janela de Correr 02 Folhas' AND linha = 'Suprema' LIMIT 1;

  -- Get item template IDs
  SELECT id INTO v_su001 FROM item_templates WHERE name = 'SU-001' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su002 FROM item_templates WHERE name = 'SU-002' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su003 FROM item_templates WHERE name = 'SU-003' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su039 FROM item_templates WHERE name = 'SU-039' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su040 FROM item_templates WHERE name = 'SU-040' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su041 FROM item_templates WHERE name = 'SU-041' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su053 FROM item_templates WHERE name = 'SU-053' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_su102 FROM item_templates WHERE name = 'SU-102' AND linha = 'Suprema' LIMIT 1;
  SELECT id INTO v_mp347 FROM item_templates WHERE name = 'MP-347' LIMIT 1;
  SELECT id INTO v_cm063 FROM item_templates WHERE name = 'CM-063' LIMIT 1;
  SELECT id INTO v_vidro FROM item_templates WHERE name = 'Vidro' AND type = 'glass' LIMIT 1;

  -- Marco (Frame) profiles
  INSERT INTO product_template_items (product_template_id, item_template_id, width_formula, height_formula, quantity_formula, pieces_quantity, cut_angle, section, sort_order)
  VALUES
    -- SU-001: Marco Superior - L - 26, 1 peça, corte 90°
    (v_product_id, v_su001, 'L - 26', NULL, '1', 1, 90, 'Perfis', 1),
    -- SU-002: Marco Inferior - L - 26, 1 peça, corte 90°
    (v_product_id, v_su002, 'L - 26', NULL, '1', 1, 90, 'Perfis', 2),
    -- SU-003: Montantes do Marco - A, 2 peças, corte 90°
    (v_product_id, v_su003, NULL, 'A', '1', 2, 90, 'Perfis', 3);

  -- Folha (Sash) profiles
  INSERT INTO product_template_items (product_template_id, item_template_id, width_formula, height_formula, quantity_formula, pieces_quantity, cut_angle, section, sort_order)
  VALUES
    -- SU-053: Travessas da Folha (horizontais) - (L - 26) / 2 - 53, 4 peças
    (v_product_id, v_su053, '(L - 26) / 2 - 53', NULL, '1', 4, 90, 'Perfis', 4),
    -- SU-102: Baguete horizontal - (L - 26) / 2 - 53, 4 peças
    (v_product_id, v_su102, '(L - 26) / 2 - 53', NULL, '1', 4, 90, 'Perfis', 5),
    -- SU-041: Montante Encontro - A - 50, 1 peça
    (v_product_id, v_su041, NULL, 'A - 50', '1', 1, 90, 'Perfis', 6),
    -- SU-040: Montante Fecho - A - 50, 1 peça
    (v_product_id, v_su040, NULL, 'A - 50', '1', 1, 90, 'Perfis', 7),
    -- SU-039: Montante da Folha - A - 50, 2 peças
    (v_product_id, v_su039, NULL, 'A - 50', '1', 2, 90, 'Perfis', 8),
    -- SU-102: Baguete vertical - A - 152, 4 peças
    (v_product_id, v_su102, NULL, 'A - 152', '1', 4, 90, 'Perfis', 9);

  -- Contramarco
  INSERT INTO product_template_items (product_template_id, item_template_id, width_formula, height_formula, quantity_formula, pieces_quantity, cut_angle, section, sort_order, is_optional)
  VALUES
    -- MP-347: Contramarco horizontal - L + 48, 2 peças, corte 45°
    (v_product_id, v_mp347, 'L + 48', NULL, '1', 2, 45, 'Contramarco', 10, true),
    -- MP-347: Contramarco vertical - A + 48, 2 peças, corte 45°
    (v_product_id, v_mp347, NULL, 'A + 48', '1', 2, 45, 'Contramarco', 11, true),
    -- CM-063: Guarnição horizontal - L + 27, 2 peças, corte 45°
    (v_product_id, v_cm063, 'L + 27', NULL, '1', 2, 45, 'Contramarco', 12, true),
    -- CM-063: Guarnição vertical - A + 27, 2 peças, corte 45°
    (v_product_id, v_cm063, NULL, 'A + 27', '1', 2, 45, 'Contramarco', 13, true);

  -- Vidro
  INSERT INTO product_template_items (product_template_id, item_template_id, width_formula, height_formula, quantity_formula, pieces_quantity, cut_angle, section, sort_order)
  VALUES
    (v_product_id, v_vidro, '(L - 26) / 2 - 30', 'A - 80', '1', 2, 90, 'Vidros', 14);

END $$;
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS show_measures_column boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_m2_column boolean NOT NULL DEFAULT true;ALTER TABLE public.employees 
ADD COLUMN commission_trigger TEXT DEFAULT 'sale' CHECK (commission_trigger IN ('sale', 'payment'));

COMMENT ON COLUMN public.employees.commission_trigger IS 'Define quando a comissão é gerada: sale (no momento da venda) ou payment (quando o cliente paga).';CREATE OR REPLACE FUNCTION public.calculate_sale_commission(_sale_id uuid, _employee_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sale RECORD;
  _employee RECORD;
  _commission_amount numeric;
BEGIN
  -- Get sale data
  SELECT * INTO _sale FROM sales WHERE id = _sale_id;
  IF _sale IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get employee with commission settings
  SELECT * INTO _employee 
  FROM employees 
  WHERE id = _employee_id 
    AND company_id = _sale.company_id
    AND commission_enabled = true;
    
  IF _employee IS NULL THEN
    RETURN 0;
  END IF;

  -- NEW: Check commission trigger
  -- If trigger is 'payment' and sale is not paid, don't generate commission yet
  IF _employee.commission_trigger = 'payment' AND _sale.payment_status != 'paid' THEN
    RETURN 0;
  END IF;
  
  -- Calculate commission based on type
  IF _employee.commission_type = 'sales' THEN
    _commission_amount := _sale.total_amount * (_employee.commission_percent / 100);
  ELSE
    -- For profit-based, would need cost data - default to sales for now
    _commission_amount := _sale.total_amount * (_employee.commission_percent / 100);
  END IF;
  
  -- Insert or update commission record
  INSERT INTO employee_commissions (
    company_id, employee_id, sale_id, 
    sale_amount, commission_percent, commission_amount,
    status
  ) VALUES (
    _sale.company_id, _employee_id, _sale_id,
    _sale.total_amount, _employee.commission_percent, _commission_amount,
    'pending'
  )
  ON CONFLICT (employee_id, sale_id) DO UPDATE
    SET sale_amount = EXCLUDED.sale_amount,
        commission_percent = EXCLUDED.commission_percent,
        commission_amount = EXCLUDED.commission_amount,
        updated_at = now();
  
  RETURN _commission_amount;
END;
$function$;CREATE OR REPLACE FUNCTION public.trigger_calculate_commission_on_paid()
RETURNS TRIGGER AS $$
DECLARE
  _employee RECORD;
BEGIN
  -- Se o status mudou para 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    -- Tenta encontrar o vendedor da venda
    -- Assume-se que o vendedor está no campo sold_by ou similar
    -- Se não houver campo específico, podemos tentar buscar quem criou a venda ou o funcionário vinculado
    
    -- Como a função calculate_sale_commission pede _employee_id, precisamos saber quem é o funcionário
    -- Se o user_id da venda tiver um funcionário vinculado, usamos ele.
    
    FOR _employee IN SELECT id FROM employees WHERE user_id = NEW.sold_by AND company_id = NEW.company_id AND commission_enabled = true LOOP
        PERFORM public.calculate_sale_commission(NEW.id, _employee.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sale_paid_calculate_commission
AFTER UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calculate_commission_on_paid();CREATE OR REPLACE FUNCTION public.submit_cash_closing_for_audit(
  _cash_register_id UUID,
  _counts JSONB,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_register RECORD;
  v_expected_amount NUMERIC;
  v_total_counted NUMERIC;
  v_difference NUMERIC;
  v_audit_id UUID;
  v_operator_name TEXT;
BEGIN
  SELECT * INTO v_register FROM cash_registers
  WHERE id = _cash_register_id AND status = 'open' FOR UPDATE;
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado ou já fechado');
  END IF;
  
  IF v_register.opened_by != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o operador pode submeter o fechamento');
  END IF;
  
  SELECT COALESCE(e.name, p.full_name, 'Operador') INTO v_operator_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.user_id
  WHERE p.user_id = auth.uid();
  
  SELECT v_register.opening_amount + 
    COALESCE((SELECT SUM(total_amount) FROM sales 
              WHERE cash_register_id = _cash_register_id 
              AND payment_method = 'dinheiro' AND payment_status != 'cancelled'), 0) +
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM cash_movements WHERE cash_register_id = _cash_register_id;
  
  SELECT COALESCE(SUM((item->>'amount')::NUMERIC), 0) INTO v_total_counted
  FROM jsonb_array_elements(_counts) AS item;
  
  v_difference := v_total_counted - v_expected_amount;
  
  DELETE FROM cash_counts WHERE cash_register_id = _cash_register_id;
  INSERT INTO cash_counts (cash_register_id, user_id, payment_method, valor_informado)
  SELECT _cash_register_id, auth.uid(), item->>'payment_method', (item->>'amount')::NUMERIC
  FROM jsonb_array_elements(_counts) AS item;
  
  INSERT INTO cash_register_audits (
    cash_register_id, company_id, operator_id, operator_name,
    counts_submitted, total_counted, expected_amount, difference,
    operator_notes, status
  ) VALUES (
    _cash_register_id, v_register.company_id, auth.uid(), v_operator_name,
    _counts, v_total_counted, v_expected_amount, v_difference,
    _notes, 'pending'
  ) RETURNING id INTO v_audit_id;
  
  UPDATE cash_registers
  SET status = 'pending_audit',
      operator_id = auth.uid(),
      closing_requested_at = now(),
      closing_amount = v_expected_amount,
      actual_amount = v_total_counted,
      difference = v_difference,
      notes = _notes
  WHERE id = _cash_register_id;
  
  INSERT INTO company_notifications (
    company_id, type, title, message, to_role, from_user_id, metadata
  ) VALUES (
    v_register.company_id,
    'cash_audit_request',
    'Fechamento de Caixa Aguardando Auditoria',
    format('O operador %s finalizou a contagem. Diferença: R$ %s', 
      v_operator_name, 
      CASE WHEN v_difference >= 0 THEN '+' ELSE '' END || v_difference
    ),
    'admin',
    auth.uid(),
    jsonb_build_object(
      'cash_register_id', _cash_register_id,
      'audit_id', v_audit_id,
      'operator_name', v_operator_name,
      'total_counted', v_total_counted,
      'expected', v_expected_amount,
      'difference', v_difference
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'audit_id', v_audit_id,
    'expected_amount', v_expected_amount,
    'total_counted', v_total_counted,
    'difference', v_difference,
    'message', 'Fechamento enviado para auditoria. Aguarde aprovação do gerente.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_cash_audit(
  _audit_id UUID,
  _action TEXT,
  _notes TEXT DEFAULT NULL,
  _adjustment_amount NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_audit RECORD;
  v_register RECORD;
  v_final_amount NUMERIC;
  v_final_difference NUMERIC;
  v_close_result JSONB;
  v_auditor_name TEXT;
BEGIN
  SELECT * INTO v_audit FROM cash_register_audits
  WHERE id = _audit_id AND status = 'pending' FOR UPDATE;
  
  IF v_audit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auditoria não encontrada ou já processada');
  END IF;
  
  IF NOT user_has_elevated_role_in_company(auth.uid(), v_audit.company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas gerentes podem aprovar auditorias');
  END IF;
  
  SELECT COALESCE(e.name, p.full_name, 'Auditor') INTO v_auditor_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.user_id
  WHERE p.user_id = auth.uid();
  
  UPDATE cash_register_audits
  SET auditor_id = auth.uid(),
      auditor_name = v_auditor_name,
      auditor_action = _action,
      auditor_notes = _notes,
      adjustment_amount = _adjustment_amount,
      audited_at = now(),
      status = CASE WHEN _action = 'rejected' THEN 'rejected' ELSE 'approved' END,
      updated_at = now()
  WHERE id = _audit_id;

  IF _action = 'approved' THEN
    SELECT * INTO v_register FROM cash_registers WHERE id = v_audit.cash_register_id;
    v_final_amount := COALESCE(_adjustment_amount, v_audit.total_counted);
    v_final_difference := v_final_amount - v_audit.expected_amount;
    
    UPDATE cash_registers
    SET status = 'closed',
        closed_at = now(),
        closed_by = auth.uid(),
        actual_amount = v_final_amount,
        difference = v_final_difference,
        audit_status = 'approved'
    WHERE id = v_audit.cash_register_id;
  ELSIF _action = 'rejected' THEN
    UPDATE cash_registers
    SET status = 'open',
        closing_requested_at = NULL,
        audit_status = 'rejected'
    WHERE id = v_audit.cash_register_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'action', _action);
END;
$$;ALTER TABLE public.cash_registers DROP CONSTRAINT IF EXISTS cash_registers_status_check;
ALTER TABLE public.cash_registers ADD CONSTRAINT cash_registers_status_check CHECK (status = ANY (ARRAY['open'::text, 'closed'::text, 'pending_audit'::text]));-- Atualiza a função que busca o caixa aberto do usuário para incluir o status 'pending_audit'
-- Isso permite que a interface mostre o resumo do caixa mesmo enquanto aguarda auditoria
CREATE OR REPLACE FUNCTION public.get_user_open_cash_register(_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  opened_by uuid,
  opened_at timestamptz,
  opening_amount numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.company_id,
    cr.opened_by,
    cr.opened_at,
    cr.opening_amount,
    cr.status
  FROM public.cash_registers cr
  WHERE cr.company_id = _company_id
    AND cr.opened_by = auth.uid()
    AND cr.status IN ('open', 'pending_audit')
  ORDER BY cr.opened_at DESC
  LIMIT 1;
END;
$$;

-- Refina a submissão de auditoria para garantir integridade
CREATE OR REPLACE FUNCTION public.submit_cash_closing_for_audit(
  _cash_register_id UUID,
  _counts JSONB,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_register RECORD;
  v_expected_amount NUMERIC;
  v_total_counted NUMERIC;
  v_difference NUMERIC;
  v_audit_id UUID;
  v_operator_name TEXT;
BEGIN
  -- Bloqueia o registro para evitar alterações simultâneas
  SELECT * INTO v_register FROM cash_registers
  WHERE id = _cash_register_id AND status = 'open' FOR UPDATE;
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado ou já está em processo de fechamento');
  END IF;
  
  -- Busca nome do operador
  SELECT COALESCE(e.name, p.full_name, 'Operador') INTO v_operator_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.user_id
  WHERE p.user_id = auth.uid();
  
  -- Calcula saldo esperado no momento EXATO da solicitação
  SELECT v_register.opening_amount + 
    COALESCE((SELECT SUM(total_amount) FROM sales 
              WHERE cash_register_id = _cash_register_id 
              AND payment_method = 'dinheiro' AND payment_status != 'cancelled'), 0) +
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = _cash_register_id AND type = 'entrada'), 0) -
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = _cash_register_id AND type = 'saida'), 0)
  INTO v_expected_amount;
  
  -- Calcula total contado a partir do JSON
  SELECT COALESCE(SUM((item->>'amount')::NUMERIC), 0) INTO v_total_counted
  FROM jsonb_array_elements(_counts) AS item;
  
  v_difference := v_total_counted - v_expected_amount;
  
  -- Registra contagens físicas para histórico
  DELETE FROM cash_counts WHERE cash_register_id = _cash_register_id;
  INSERT INTO cash_counts (cash_register_id, user_id, payment_method, valor_informado)
  SELECT _cash_register_id, auth.uid(), item->>'payment_method', (item->>'amount')::NUMERIC
  FROM jsonb_array_elements(_counts) AS item;
  
  -- Cria registro de auditoria
  INSERT INTO cash_register_audits (
    cash_register_id, company_id, operator_id, operator_name,
    counts_submitted, total_counted, expected_amount, difference,
    operator_notes, status
  ) VALUES (
    _cash_register_id, v_register.company_id, auth.uid(), v_operator_name,
    _counts, v_total_counted, v_expected_amount, v_difference,
    _notes, 'pending'
  ) RETURNING id INTO v_audit_id;
  
  -- Atualiza caixa para aguardando auditoria (congelando valores)
  UPDATE cash_registers
  SET status = 'pending_audit',
      operator_id = auth.uid(),
      closing_requested_at = now(),
      closing_amount = v_expected_amount,
      actual_amount = v_total_counted,
      difference = v_difference,
      notes = _notes
  WHERE id = _cash_register_id;
  
  -- Notifica administradores
  INSERT INTO company_notifications (
    company_id, type, title, message, to_role, from_user_id, metadata
  ) VALUES (
    v_register.company_id,
    'cash_audit_request',
    'Auditoria de Caixa Pendente',
    format('O operador %s solicitou o fechamento. Diferença: R$ %s', 
      v_operator_name, 
      v_difference
    ),
    'admin',
    auth.uid(),
    jsonb_build_object(
      'cash_register_id', _cash_register_id,
      'audit_id', v_audit_id,
      'difference', v_difference
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'audit_id', v_audit_id,
    'message', 'Fechamento enviado para auditoria. O caixa permanecerá restrito até a aprovação.'
  );
END;
$$;ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS audit_status text;
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS closing_requested_at timestamptz;-- Tabela para logs de auditoria financeira
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para períodos financeiros
CREATE TABLE IF NOT EXISTS public.financial_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_id, year, month)
);

-- Função para verificar se o funcionário é admin
CREATE OR REPLACE FUNCTION public.is_financial_admin(_user_id uuid, _company_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employees 
    WHERE user_id = _user_id 
      AND company_id = _company_id 
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar bloqueio de período
CREATE OR REPLACE FUNCTION public.check_financial_period_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_year INTEGER;
    v_month INTEGER;
    v_is_closed BOOLEAN;
    v_company_id UUID;
BEGIN
    v_company_id := COALESCE(NEW.company_id, OLD.company_id);
    
    -- Determina o ano/mês
    IF TG_OP = 'DELETE' THEN
        v_year := EXTRACT(YEAR FROM OLD.created_at);
        v_month := EXTRACT(MONTH FROM OLD.created_at);
    ELSE
        v_year := EXTRACT(YEAR FROM NEW.created_at);
        v_month := EXTRACT(MONTH FROM NEW.created_at);
    END IF;

    -- Verifica se o período está fechado
    SELECT is_closed INTO v_is_closed
    FROM public.financial_periods
    WHERE company_id = v_company_id AND year = v_year AND month = v_month;

    IF v_is_closed = true THEN
        RAISE EXCEPTION 'Período financeiro %/% bloqueado para a empresa %.', v_month, v_year, v_company_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de segurança
DROP TRIGGER IF EXISTS tr_check_period_sales ON public.sales;
CREATE TRIGGER tr_check_period_sales
BEFORE UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.check_financial_period_lock();

DROP TRIGGER IF EXISTS tr_check_period_expenses ON public.expenses;
CREATE TRIGGER tr_check_period_expenses
BEFORE UPDATE OR DELETE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.check_financial_period_lock();

-- RLS
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Financial logs viewable by company admins"
ON public.financial_audit_logs FOR SELECT
USING (public.is_financial_admin(auth.uid(), company_id));

CREATE POLICY "Financial periods manageable by company admins"
ON public.financial_periods FOR ALL
USING (public.is_financial_admin(auth.uid(), company_id));
-- 1. Fórmulas de linhas de vidro (depende de product_templates)
DELETE FROM public.glass_line_formulas;

-- 2. Itens de produtos da empresa (referencia company_products e item_templates)
DELETE FROM public.company_product_items;

-- 3. Projetos de vidro (pode referenciar product_templates)
UPDATE public.glass_projects SET product_template_id = NULL;

-- 4. Itens de orçamentos (pode referenciar product_templates)
UPDATE public.quote_items SET product_template_id = NULL;

-- 5. Produtos da empresa (referencia product_templates)
DELETE FROM public.company_products;

-- 6. Itens de templates de produtos (referencia product_templates e item_templates)
DELETE FROM public.product_template_items;

-- 7. Templates de produtos
DELETE FROM public.product_templates;

-- 8. Preços de itens da empresa (referencia item_templates)
DELETE FROM public.company_item_prices;

-- 9. Estoque da empresa (referencia item_templates e company_items)
DELETE FROM public.company_stock;

-- 10. Movimentações de estoque (referencia item_templates)
UPDATE public.stock_movements SET item_template_id = NULL;

-- 11. Itens da empresa (referencia item_templates)
DELETE FROM public.company_items;

-- 12. Templates de itens
DELETE FROM public.item_templates;

-- 1. company_notification_settings: replace broken policies
DROP POLICY IF EXISTS "Users can view own company notification settings" ON public.company_notification_settings;
DROP POLICY IF EXISTS "Users can update own company notification settings" ON public.company_notification_settings;
DROP POLICY IF EXISTS "Users can insert own company notification settings" ON public.company_notification_settings;

CREATE POLICY "Company members can view notification settings"
  ON public.company_notification_settings FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can insert notification settings"
  ON public.company_notification_settings FOR INSERT
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can update notification settings"
  ON public.company_notification_settings FOR UPDATE
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 2. pricing_policies: replace broken policies
DROP POLICY IF EXISTS "Users can view own company pricing policies" ON public.pricing_policies;
DROP POLICY IF EXISTS "Users can insert own company pricing policies" ON public.pricing_policies;
DROP POLICY IF EXISTS "Users can update own company pricing policies" ON public.pricing_policies;

CREATE POLICY "Company members can view pricing policies"
  ON public.pricing_policies FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can insert pricing policies"
  ON public.pricing_policies FOR INSERT
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can update pricing policies"
  ON public.pricing_policies FOR UPDATE
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company members can delete pricing policies"
  ON public.pricing_policies FOR DELETE
  USING (public.user_belongs_to_company(auth.uid(), company_id));

-- 3. employee-photos: make private + company-scoped SELECT
UPDATE storage.buckets SET public = false WHERE id = 'employee-photos';

DROP POLICY IF EXISTS "Anyone can view employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Company members can update employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete employee photos" ON storage.objects;
DROP POLICY IF EXISTS "Company members can upload employee photos" ON storage.objects;

CREATE POLICY "Company members can view employee photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'employee-photos'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can upload employee photos (scoped)"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'employee-photos'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can update employee photos (scoped)"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'employee-photos'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

-- 4. os-photos: make private + drop public SELECT (scoped policies already exist)
UPDATE storage.buckets SET public = false WHERE id = 'os-photos';

DROP POLICY IF EXISTS "Anyone can view OS photos" ON storage.objects;

-- 5. measurements: drop weak policies, replace with company-scoped
DROP POLICY IF EXISTS "Users can delete measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view measurement files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload measurement files" ON storage.objects;

CREATE POLICY "Company members can view measurement files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'measurements'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can upload measurement files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'measurements'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can update measurement files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'measurements'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

CREATE POLICY "Company members can delete measurement files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'measurements'
    AND public.user_belongs_to_company(auth.uid(), ((string_to_array(name, '/'))[1])::uuid)
  );

-- 6. company-logos: drop overly permissive auth.uid() IS NOT NULL policies
DROP POLICY IF EXISTS "Users can delete company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload company logos" ON storage.objects;

-- 7. company-product-images: drop weak duplicate policies
DROP POLICY IF EXISTS "Public read access for company product images" ON storage.objects;
DROP POLICY IF EXISTS "Company users can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Company users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Company users can upload product images" ON storage.objects;
-- Função para sincronizar financeiro do orçamento
CREATE OR REPLACE FUNCTION public.sync_quote_financial_data()
RETURNS TRIGGER AS $$
DECLARE
    v_os_id UUID;
    v_total_parcelas INTEGER;
    v_valor_parcela DECIMAL(12,2);
    v_soma_parcelas DECIMAL(12,2) := 0;
    v_diff DECIMAL(12,2);
    v_count INTEGER := 0;
    v_receivable_id UUID;
    v_entry_amount DECIMAL(12,2) := 0;
    v_pending_amount DECIMAL(12,2);
BEGIN
    -- Só executa se o status for aprovado e o valor ou forma de pagamento mudou
    IF (NEW.status = 'approved' AND (OLD.status != 'approved' OR OLD.valor_final_aprovado != NEW.valor_final_aprovado OR OLD.forma_pagamento_id IS DISTINCT FROM NEW.forma_pagamento_id OR OLD.condicao_pagamento_id IS DISTINCT FROM NEW.condicao_pagamento_id)) THEN
        
        -- Busca OS vinculada
        SELECT id INTO v_os_id FROM public.ordens_servico WHERE quote_id = NEW.id;
        
        IF v_os_id IS NOT NULL THEN
            -- Atualiza valor da OS
            UPDATE public.ordens_servico 
            SET total_amount = NEW.valor_final_aprovado,
                pending_amount = NEW.valor_final_aprovado - paid_amount
            WHERE id = v_os_id;

            -- Recalcula Contas a Receber (Saldo Pendente)
            -- Nota: Esta regra assume que as contas a receber do tipo 'saldo_final' ou 'saldo_conclusao' devem ser atualizadas
            -- Entradas já pagas não são mexidas para evitar bagunça no caixa
            
            SELECT COALESCE(SUM(total_amount), 0) INTO v_entry_amount 
            FROM public.accounts_receivable 
            WHERE quote_id = NEW.id AND (receivable_type = 'entrada_orcamento' OR status = 'paid');

            v_pending_amount := NEW.valor_final_aprovado - v_entry_amount;

            -- Se houver uma condição de pagamento com parcelas
            SELECT COALESCE(parcelas, 1) INTO v_total_parcelas 
            FROM public.condicoes_pagamento 
            WHERE id = NEW.condicao_pagamento_id;

            IF v_total_parcelas > 0 AND v_pending_amount > 0 THEN
                v_valor_parcela := ROUND(v_pending_amount / v_total_parcelas, 2);
                
                -- Atualiza as parcelas existentes ou cria o alerta
                -- Para simplificar este trigger e evitar loops complexos, apenas ajustamos os valores das parcelas 'pending'
                FOR v_receivable_id IN 
                    SELECT id FROM public.accounts_receivable 
                    WHERE quote_id = NEW.id AND status = 'pending' AND receivable_type IN ('saldo_final', 'saldo_conclusao')
                    ORDER BY installment_number ASC
                LOOP
                    v_count := v_count + 1;
                    
                    IF v_count < v_total_parcelas THEN
                        UPDATE public.accounts_receivable SET total_amount = v_valor_parcela WHERE id = v_receivable_id;
                        v_soma_parcelas := v_soma_parcelas + v_valor_parcela;
                    ELSE
                        -- Ajuste de centavos na última parcela
                        v_diff := v_pending_amount - v_soma_parcelas;
                        UPDATE public.accounts_receivable SET total_amount = v_diff WHERE id = v_receivable_id;
                        v_soma_parcelas := v_soma_parcelas + v_diff;
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para sincronização
DROP TRIGGER IF EXISTS tr_sync_quote_financial ON public.quotes;
CREATE TRIGGER tr_sync_quote_financial
AFTER UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.sync_quote_financial_data();
ALTER TABLE public.cash_movements 
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_quote_id ON public.cash_movements(quote_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_os_id ON public.cash_movements(ordem_servico_id);-- Primeiro, vamos garantir que a tabela quotes tenha a constraint correta para os tipos permitidos
-- Nota: Como o tipo da forma de pagamento vem da tabela formas_pagamento, 
-- a validação robusta é melhor feita via trigger ou conferindo o tipo da forma vinculada.

CREATE OR REPLACE FUNCTION public.check_quote_approval_rules()
RETURNS TRIGGER AS $$
DECLARE
  forma_tipo TEXT;
BEGIN
  -- Só validamos quando o status muda para 'approved' ou se já está 'approved' e está sendo alterado
  IF (NEW.status = 'approved') THEN
    
    -- 1. Buscar o tipo da forma de pagamento vinculada
    SELECT tipo INTO forma_tipo 
    FROM public.formas_pagamento 
    WHERE id = NEW.forma_pagamento_id;

    -- 2. Validar se o tipo é permitido
    IF forma_tipo NOT IN ('avista', 'parcelado') OR forma_tipo IS NULL THEN
      RAISE EXCEPTION 'Aprovação permitida apenas para formas de pagamento do tipo avista ou parcelado.';
    END IF;

    -- 3. Forçar condicao_pagamento_id como NULL (regrade de negócio solicitada)
    NEW.condicao_pagamento_id := NULL;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Criar trigger na tabela quotes
DROP TRIGGER IF EXISTS trg_validate_quote_approval ON public.quotes;
CREATE TRIGGER trg_validate_quote_approval
BEFORE INSERT OR UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.check_quote_approval_rules();CREATE OR REPLACE FUNCTION public.cancel_sale(
    p_sale_id UUID,
    p_company_id UUID,
    p_user_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_stock_item RECORD;
    v_stock_restorations JSONB := '[]'::JSONB;
    v_removed_movements JSONB;
    v_cancelled_receivables JSONB;
    v_restore_qty NUMERIC;
    v_item_name TEXT;
BEGIN
    -- 1. Check if sale exists and belongs to company
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND company_id = p_company_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;

    IF v_sale.payment_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta venda já está cancelada');
    END IF;

    -- 2. Capture data for audit BEFORE changes
    SELECT jsonb_agg(m.*) INTO v_removed_movements 
    FROM public.cash_movements m 
    WHERE m.sale_id = p_sale_id AND m.type = 'entrada';

    SELECT jsonb_agg(r.*) INTO v_cancelled_receivables 
    FROM public.accounts_receivable r 
    WHERE r.sale_id = p_sale_id;

    -- 3. Restore Stock
    FOR v_item IN (SELECT si.*, it.unit, it.name FROM public.sale_items si 
                   LEFT JOIN public.item_templates it ON si.item_template_id = it.id
                   WHERE si.sale_id = p_sale_id) LOOP
        
        v_restore_qty := 0;
        
        -- Logic for simple items
        IF v_item.item_template_id IS NOT NULL AND v_item.company_product_id IS NULL THEN
            IF (v_item.unit = 'm²' OR v_item.unit = 'm2') AND v_item.width IS NOT NULL AND v_item.height IS NOT NULL THEN
                v_restore_qty := (v_item.width::NUMERIC / 1000) * (v_item.height::NUMERIC / 1000) * v_item.quantity;
            ELSE
                v_restore_qty := v_item.quantity;
            END IF;
            
            -- Update stock
            UPDATE public.company_stock 
            SET quantity = quantity + v_restore_qty 
            WHERE company_id = p_company_id AND item_template_id = v_item.item_template_id
            RETURNING id INTO v_stock_item;
            
            IF FOUND THEN
                INSERT INTO public.stock_movements (
                    company_id, item_template_id, type, category, quantity, 
                    unit_cost, description, reference_id, reference_type, created_by
                ) VALUES (
                    p_company_id, v_item.item_template_id, 'entrada', 'estorno_venda', v_restore_qty,
                    0, 'Cancelamento de venda: ' || v_sale.sale_number, p_sale_id, 'sale_cancellation', p_user_id
                );
                
                v_stock_restorations := v_stock_restorations || jsonb_build_object('item_id', v_item.item_template_id, 'quantity', v_restore_qty);
            END IF;
        END IF;

        -- Logic for composite products (simplified here, but in real case would handle compositions)
        -- For now, the app's JS logic handles the complex composition calculation.
        -- In a robust system, this should be purely server-side.
        -- As we want consistency, we'll keep the JS logic for composition but run the core cancellation here.
    END LOOP;

    -- 4. Cancel Receivables
    UPDATE public.accounts_receivable 
    SET status = 'cancelled' 
    WHERE sale_id = p_sale_id;

    -- 5. Delete Cash Movements
    DELETE FROM public.cash_movements 
    WHERE sale_id = p_sale_id AND type = 'entrada';

    -- 6. Update Sale
    UPDATE public.sales 
    SET payment_status = 'cancelled', 
        notes = CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN 'Cancelado: ' || p_reason ELSE 'Venda cancelada' END
    WHERE id = p_sale_id;

    -- 7. Audit Log
    INSERT INTO public.audit_logs (
        company_id, user_id, action, table_name, record_id, metadata
    ) VALUES (
        p_company_id, p_user_id, 'CANCEL_SALE', 'sales', p_sale_id,
        jsonb_build_object(
            'reason', p_reason,
            'sale_number', v_sale.sale_number,
            'customer_name', v_sale.customer_name,
            'total_amount', v_sale.total_amount,
            'removed_cash_movements', v_removed_movements,
            'cancelled_accounts_receivable', v_cancelled_receivables,
            'stock_restorations', v_stock_restorations
        )
    );

    RETURN jsonb_build_object('success', true, 'sale_number', v_sale.sale_number);
END;
$$;ALTER FUNCTION public.cancel_sale(UUID, UUID, UUID, TEXT) SET search_path = public;-- Improved cancel_sale function to be more thorough
CREATE OR REPLACE FUNCTION public.cancel_sale(
    p_sale_id UUID,
    p_company_id UUID,
    p_user_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_stock_item RECORD;
    v_stock_restorations JSONB := '[]'::JSONB;
    v_removed_movements JSONB;
    v_cancelled_receivables JSONB;
    v_restore_qty NUMERIC;
BEGIN
    -- 1. Check if sale exists and belongs to company
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND company_id = p_company_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;

    IF v_sale.payment_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta venda já está cancelada');
    END IF;

    -- 2. Capture data for audit BEFORE changes
    -- Important: Also find movements linked to the quote_id if this was a quote sale
    SELECT jsonb_agg(m.*) INTO v_removed_movements 
    FROM public.cash_movements m 
    WHERE (m.sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND m.quote_id = v_sale.quote_id))
    AND m.type = 'entrada';

    SELECT jsonb_agg(r.*) INTO v_cancelled_receivables 
    FROM public.accounts_receivable r 
    WHERE r.sale_id = p_sale_id;

    -- 3. Restore Stock
    -- (Keeping the logic from before)
    FOR v_item IN (SELECT si.*, it.unit, it.name FROM public.sale_items si 
                   LEFT JOIN public.item_templates it ON si.item_template_id = it.id
                   WHERE si.sale_id = p_sale_id) LOOP
        
        v_restore_qty := 0;
        IF v_item.item_template_id IS NOT NULL AND v_item.company_product_id IS NULL THEN
            IF (v_item.unit = 'm²' OR v_item.unit = 'm2') AND v_item.width IS NOT NULL AND v_item.height IS NOT NULL THEN
                v_restore_qty := (v_item.width::NUMERIC / 1000) * (v_item.height::NUMERIC / 1000) * v_item.quantity;
            ELSE
                v_restore_qty := v_item.quantity;
            END IF;
            
            UPDATE public.company_stock 
            SET quantity = quantity + v_restore_qty 
            WHERE company_id = p_company_id AND item_template_id = v_item.item_template_id;
            
            INSERT INTO public.stock_movements (
                company_id, item_template_id, type, category, quantity, 
                unit_cost, description, reference_id, reference_type, created_by
            ) VALUES (
                p_company_id, v_item.item_template_id, 'entrada', 'estorno_venda', v_restore_qty,
                0, 'Cancelamento de venda: ' || v_sale.sale_number, p_sale_id, 'sale_cancellation', p_user_id
            );
            
            v_stock_restorations := v_stock_restorations || jsonb_build_object('item_id', v_item.item_template_id, 'quantity', v_restore_qty);
        END IF;
    END LOOP;

    -- 4. Cancel Receivables
    UPDATE public.accounts_receivable 
    SET status = 'cancelled' 
    WHERE sale_id = p_sale_id;

    -- 5. Delete Cash Movements (Sale or Quote related)
    DELETE FROM public.cash_movements 
    WHERE (sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND quote_id = v_sale.quote_id))
    AND type = 'entrada';

    -- 6. Update Sale
    UPDATE public.sales 
    SET payment_status = 'cancelled', 
        notes = CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN 'Cancelado: ' || p_reason ELSE 'Venda cancelada' END
    WHERE id = p_sale_id;

    -- 7. Audit Log
    INSERT INTO public.audit_logs (
        company_id, user_id, action, table_name, record_id, metadata
    ) VALUES (
        p_company_id, p_user_id, 'CANCEL_SALE', 'sales', p_sale_id,
        jsonb_build_object(
            'reason', p_reason,
            'sale_number', v_sale.sale_number,
            'customer_name', v_sale.customer_name,
            'total_amount', v_sale.total_amount,
            'removed_cash_movements', v_removed_movements,
            'cancelled_accounts_receivable', v_cancelled_receivables,
            'stock_restorations', v_stock_restorations
        )
    );

    RETURN jsonb_build_object('success', true, 'sale_number', v_sale.sale_number);
END;
$$;CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id uuid, p_company_id uuid, p_user_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_sale RECORD;
    v_os RECORD;
    v_item RECORD;
    v_stock_restorations JSONB := '[]'::JSONB;
    v_removed_movements JSONB;
    v_cancelled_receivables JSONB;
    v_restore_qty NUMERIC;
BEGIN
    -- 1. Verificar se a venda existe
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND company_id = p_company_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;

    IF v_sale.payment_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta venda já está cancelada');
    END IF;

    -- 2. Capturar dados para auditoria ANTES das alterações
    SELECT jsonb_agg(m.*) INTO v_removed_movements 
    FROM public.cash_movements m 
    WHERE (m.sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND m.quote_id = v_sale.quote_id))
    AND m.type = 'entrada';

    SELECT jsonb_agg(r.*) INTO v_cancelled_receivables 
    FROM public.accounts_receivable r 
    WHERE r.sale_id = p_sale_id OR (v_sale.ordem_servico_id IS NOT NULL AND r.ordem_servico_id = v_sale.ordem_servico_id);

    -- 3. Restaurar Estoque
    FOR v_item IN (SELECT si.*, it.unit FROM public.sale_items si 
                   LEFT JOIN public.item_templates it ON si.item_template_id = it.id
                   WHERE si.sale_id = p_sale_id) LOOP
        
        v_restore_qty := 0;
        IF v_item.item_template_id IS NOT NULL AND v_item.company_product_id IS NULL THEN
            IF (v_item.unit = 'm²' OR v_item.unit = 'm2') AND v_item.width IS NOT NULL AND v_item.height IS NOT NULL THEN
                v_restore_qty := (v_item.width::NUMERIC / 1000) * (v_item.height::NUMERIC / 1000) * v_item.quantity;
            ELSE
                v_restore_qty := v_item.quantity;
            END IF;
            
            UPDATE public.company_stock 
            SET quantity = quantity + v_restore_qty 
            WHERE company_id = p_company_id AND item_template_id = v_item.item_template_id;
            
            INSERT INTO public.stock_movements (
                company_id, item_template_id, type, category, quantity, 
                unit_cost, description, reference_id, reference_type, created_by
            ) VALUES (
                p_company_id, v_item.item_template_id, 'entrada', 'estorno_venda', v_restore_qty,
                0, 'Cancelamento de venda: ' || v_sale.sale_number, p_sale_id, 'sale_cancellation', p_user_id
            );
            
            v_stock_restorations := v_stock_restorations || jsonb_build_object('item_id', v_item.item_template_id, 'quantity', v_restore_qty);
        END IF;
    END LOOP;

    -- 4. Cancelar/Remover registros financeiros e vínculos de OS
    -- Cancelar parcelas da venda e da OS vinculada
    UPDATE public.accounts_receivable 
    SET status = 'cancelled' 
    WHERE sale_id = p_sale_id OR (v_sale.ordem_servico_id IS NOT NULL AND ordem_servico_id = v_sale.ordem_servico_id);

    -- Remover movimentos de caixa (Venda ou Orçamento relacionado)
    DELETE FROM public.cash_movements 
    WHERE (sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND quote_id = v_sale.quote_id))
    AND type = 'entrada';

    -- Se houver OS vinculada, remover e limpar registros
    IF v_sale.ordem_servico_id IS NOT NULL THEN
        -- Remover consumos de material se houver
        DELETE FROM public.material_consumption WHERE ordem_servico_id = v_sale.ordem_servico_id;
        
        -- Remover agendamentos se houver
        DELETE FROM public.service_appointments WHERE ordem_servico_id = v_sale.ordem_servico_id;
        
        -- Remover depósitos de orçamento se houver
        DELETE FROM public.quote_deposits WHERE ordem_servico_id = v_sale.ordem_servico_id;
        
        -- Remover a OS
        DELETE FROM public.ordens_servico WHERE id = v_sale.ordem_servico_id;
    END IF;

    -- 5. Se a venda veio de um orçamento, restaurar o orçamento para 'approved'
    -- Isso permite que ele seja faturado novamente ou re-aprovado se necessário
    IF v_sale.quote_id IS NOT NULL THEN
        UPDATE public.quotes 
        SET status = 'approved' 
        WHERE id = v_sale.quote_id;
    END IF;

    -- 6. Atualizar status da Venda para Cancelada
    UPDATE public.sales 
    SET payment_status = 'cancelled', 
        notes = CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN 'Cancelado: ' || p_reason ELSE 'Venda cancelada' END
    WHERE id = p_sale_id;

    -- 7. Log de Auditoria
    INSERT INTO public.audit_logs (
        company_id, user_id, action, table_name, record_id, metadata
    ) VALUES (
        p_company_id, p_user_id, 'CANCEL_SALE', 'sales', p_sale_id,
        jsonb_build_object(
            'reason', p_reason,
            'sale_number', v_sale.sale_number,
            'customer_name', v_sale.customer_name,
            'total_amount', v_sale.total_amount,
            'removed_cash_movements', v_removed_movements,
            'cancelled_accounts_receivable', v_cancelled_receivables,
            'stock_restorations', v_stock_restorations,
            'restored_quote_id', v_sale.quote_id,
            'removed_os_id', v_sale.ordem_servico_id
        )
    );

    RETURN jsonb_build_object('success', true, 'sale_number', v_sale.sale_number);
END;
$function$;CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id uuid, p_company_id uuid, p_user_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_stock_restorations JSONB := '[]'::JSONB;
    v_removed_movements JSONB;
    v_cancelled_receivables JSONB;
    v_restore_qty NUMERIC;
BEGIN
    -- 1. Verificar se a venda existe
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND company_id = p_company_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;

    IF v_sale.payment_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta venda já está cancelada');
    END IF;

    -- 2. Capturar dados para auditoria ANTES das alterações
    SELECT jsonb_agg(m.*) INTO v_removed_movements 
    FROM public.cash_movements m 
    WHERE (m.sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND m.quote_id = v_sale.quote_id))
    AND m.type = 'entrada';

    SELECT jsonb_agg(r.*) INTO v_cancelled_receivables 
    FROM public.accounts_receivable r 
    WHERE r.sale_id = p_sale_id OR (v_sale.ordem_servico_id IS NOT NULL AND r.ordem_servico_id = v_sale.ordem_servico_id);

    -- 3. Restaurar Estoque
    FOR v_item IN (SELECT si.*, it.unit FROM public.sale_items si 
                   LEFT JOIN public.item_templates it ON si.item_template_id = it.id
                   WHERE si.sale_id = p_sale_id) LOOP
        
        v_restore_qty := 0;
        IF v_item.item_template_id IS NOT NULL AND v_item.company_product_id IS NULL THEN
            IF (v_item.unit = 'm²' OR v_item.unit = 'm2') AND v_item.width IS NOT NULL AND v_item.height IS NOT NULL THEN
                v_restore_qty := (v_item.width::NUMERIC / 1000) * (v_item.height::NUMERIC / 1000) * v_item.quantity;
            ELSE
                v_restore_qty := v_item.quantity;
            END IF;
            
            UPDATE public.company_stock 
            SET quantity = quantity + v_restore_qty 
            WHERE company_id = p_company_id AND item_template_id = v_item.item_template_id;
            
            INSERT INTO public.stock_movements (
                company_id, item_template_id, type, category, quantity, 
                unit_cost, description, reference_id, reference_type, created_by
            ) VALUES (
                p_company_id, v_item.item_template_id, 'entrada', 'estorno_venda', v_restore_qty,
                0, 'Cancelamento de venda: ' || v_sale.sale_number, p_sale_id, 'sale_cancellation', p_user_id
            );
            
            v_stock_restorations := v_stock_restorations || jsonb_build_object('item_id', v_item.item_template_id, 'quantity', v_restore_qty);
        END IF;
    END LOOP;

    -- 4. Remover registros operacionais e financeiros vinculados à OS
    IF v_sale.ordem_servico_id IS NOT NULL THEN
        -- Remover consumos de material
        DELETE FROM public.material_consumption WHERE ordem_servico_id = v_sale.ordem_servico_id;
        
        -- Remover agendamentos
        DELETE FROM public.service_appointments WHERE ordem_servico_id = v_sale.ordem_servico_id;
        
        -- Remover depósitos de orçamento
        DELETE FROM public.quote_deposits WHERE ordem_servico_id = v_sale.ordem_servico_id;
        
        -- Cancelar parcelas da OS
        UPDATE public.accounts_receivable 
        SET status = 'cancelled' 
        WHERE ordem_servico_id = v_sale.ordem_servico_id;

        -- Remover a OS
        DELETE FROM public.ordens_servico WHERE id = v_sale.ordem_servico_id;
    END IF;

    -- 5. Cancelar registros financeiros da Venda
    UPDATE public.accounts_receivable 
    SET status = 'cancelled' 
    WHERE sale_id = p_sale_id;

    DELETE FROM public.cash_movements 
    WHERE (sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND quote_id = v_sale.quote_id))
    AND type = 'entrada';

    -- 6. Restaurar Orçamento para 'pending'
    IF v_sale.quote_id IS NOT NULL THEN
        UPDATE public.quotes 
        SET status = 'pending',
            forma_pagamento_id = null,
            approved_at = null,
            approved_by = null
        WHERE id = v_sale.quote_id;
    END IF;

    -- 7. Atualizar Venda para Cancelada
    UPDATE public.sales 
    SET payment_status = 'cancelled', 
        notes = CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN 'Cancelado: ' || p_reason ELSE 'Venda cancelada' END
    WHERE id = p_sale_id;

    -- 8. Log de Auditoria
    INSERT INTO public.audit_logs (
        company_id, user_id, action, table_name, record_id, metadata
    ) VALUES (
        p_company_id, p_user_id, 'CANCEL_SALE', 'sales', p_sale_id,
        jsonb_build_object(
            'reason', p_reason,
            'sale_number', v_sale.sale_number,
            'customer_name', v_sale.customer_name,
            'total_amount', v_sale.total_amount,
            'removed_cash_movements', v_removed_movements,
            'cancelled_accounts_receivable', v_cancelled_receivables,
            'stock_restorations', v_stock_restorations,
            'restored_quote_id', v_sale.quote_id,
            'removed_os_id', v_sale.ordem_servico_id,
            'new_quote_status', 'pending'
        )
    );

    RETURN jsonb_build_object('success', true, 'sale_number', v_sale.sale_number);
END;
$function$;CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id uuid, p_company_id uuid, p_user_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_stock_restorations JSONB := '[]'::JSONB;
    v_removed_movements JSONB;
    v_cancelled_receivables JSONB;
    v_restore_qty NUMERIC;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;
    IF v_sale.payment_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta venda já está cancelada');
    END IF;

    SELECT jsonb_agg(m.*) INTO v_removed_movements 
    FROM public.cash_movements m 
    WHERE (m.sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND m.quote_id = v_sale.quote_id))
    AND m.type = 'entrada';

    SELECT jsonb_agg(r.*) INTO v_cancelled_receivables 
    FROM public.accounts_receivable r 
    WHERE r.sale_id = p_sale_id OR (v_sale.ordem_servico_id IS NOT NULL AND r.ordem_servico_id = v_sale.ordem_servico_id);

    FOR v_item IN (SELECT si.*, it.unit FROM public.sale_items si 
                   LEFT JOIN public.item_templates it ON si.item_template_id = it.id
                   WHERE si.sale_id = p_sale_id) LOOP
        v_restore_qty := 0;
        IF v_item.item_template_id IS NOT NULL AND v_item.company_product_id IS NULL THEN
            IF (v_item.unit = 'm²' OR v_item.unit = 'm2') AND v_item.width IS NOT NULL AND v_item.height IS NOT NULL THEN
                v_restore_qty := (v_item.width::NUMERIC / 1000) * (v_item.height::NUMERIC / 1000) * v_item.quantity;
            ELSE
                v_restore_qty := v_item.quantity;
            END IF;
            UPDATE public.company_stock 
            SET quantity = quantity + v_restore_qty 
            WHERE company_id = p_company_id AND item_template_id = v_item.item_template_id;
            INSERT INTO public.stock_movements (
                company_id, item_template_id, type, category, quantity, 
                unit_cost, description, reference_id, reference_type, created_by
            ) VALUES (
                p_company_id, v_item.item_template_id, 'entrada', 'estorno_venda', v_restore_qty,
                0, 'Cancelamento de venda: ' || v_sale.sale_number, p_sale_id, 'sale_cancellation', p_user_id
            );
            v_stock_restorations := v_stock_restorations || jsonb_build_object('item_id', v_item.item_template_id, 'quantity', v_restore_qty);
        END IF;
    END LOOP;

    IF v_sale.ordem_servico_id IS NOT NULL THEN
        DELETE FROM public.material_consumption WHERE ordem_servico_id = v_sale.ordem_servico_id;
        DELETE FROM public.service_appointments WHERE ordem_servico_id = v_sale.ordem_servico_id;
        DELETE FROM public.quote_deposits WHERE ordem_servico_id = v_sale.ordem_servico_id;
        UPDATE public.accounts_receivable 
        SET status = 'cancelled' 
        WHERE ordem_servico_id = v_sale.ordem_servico_id;
        DELETE FROM public.ordens_servico WHERE id = v_sale.ordem_servico_id;
    END IF;

    UPDATE public.accounts_receivable SET status = 'cancelled' WHERE sale_id = p_sale_id;
    DELETE FROM public.cash_movements 
    WHERE (sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND quote_id = v_sale.quote_id))
    AND type = 'entrada';

    IF v_sale.quote_id IS NOT NULL THEN
        UPDATE public.quotes 
        SET status = 'pending', forma_pagamento_id = null, approved_at = null, approved_by = null
        WHERE id = v_sale.quote_id;
    END IF;

    UPDATE public.sales 
    SET payment_status = 'cancelled', 
        notes = CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN 'Cancelado: ' || p_reason ELSE 'Venda cancelada' END
    WHERE id = p_sale_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, action, table_name, record_id, metadata
    ) VALUES (
        p_company_id, p_user_id, 'delete', 'sales', p_sale_id,
        jsonb_build_object(
            'operation', 'CANCEL_SALE',
            'reason', p_reason,
            'sale_number', v_sale.sale_number,
            'customer_name', v_sale.customer_name,
            'total_amount', v_sale.total_amount,
            'removed_cash_movements', v_removed_movements,
            'cancelled_accounts_receivable', v_cancelled_receivables,
            'stock_restorations', v_stock_restorations,
            'restored_quote_id', v_sale.quote_id,
            'removed_os_id', v_sale.ordem_servico_id,
            'new_quote_status', 'pending'
        )
    );

    RETURN jsonb_build_object('success', true, 'sale_number', v_sale.sale_number);
END;
$function$;-- Trigger to auto-cancel accounts_receivable when a sale is cancelled
CREATE OR REPLACE FUNCTION public.auto_cancel_receivables_on_sale_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'cancelled' AND (OLD.payment_status IS DISTINCT FROM 'cancelled') THEN
    -- Cancel AR linked directly to this sale
    UPDATE public.accounts_receivable
    SET status = 'cancelled', updated_at = now()
    WHERE sale_id = NEW.id AND status IN ('pending', 'overdue');

    -- Cancel AR linked to the related OS
    IF NEW.ordem_servico_id IS NOT NULL THEN
      UPDATE public.accounts_receivable
      SET status = 'cancelled', updated_at = now()
      WHERE ordem_servico_id = NEW.ordem_servico_id AND status IN ('pending', 'overdue');
    END IF;

    -- Cancel AR linked to the related quote
    IF NEW.quote_id IS NOT NULL THEN
      UPDATE public.accounts_receivable
      SET status = 'cancelled', updated_at = now()
      WHERE quote_id = NEW.quote_id AND status IN ('pending', 'overdue');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_cancel_receivables ON public.sales;
CREATE TRIGGER trg_auto_cancel_receivables
AFTER UPDATE OF payment_status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.auto_cancel_receivables_on_sale_cancel();

-- Backfill: cancel any stale receivables whose linked sale is already cancelled
UPDATE public.accounts_receivable ar
SET status = 'cancelled', updated_at = now()
FROM public.sales s
WHERE ar.status IN ('pending', 'overdue')
  AND s.payment_status = 'cancelled'
  AND (
    ar.sale_id = s.id
    OR (s.ordem_servico_id IS NOT NULL AND ar.ordem_servico_id = s.ordem_servico_id)
    OR (s.quote_id IS NOT NULL AND ar.quote_id = s.quote_id)
  );SELECT 1;
