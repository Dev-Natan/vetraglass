
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
