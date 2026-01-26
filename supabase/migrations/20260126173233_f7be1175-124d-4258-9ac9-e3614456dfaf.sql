-- Tabela de formas de pagamento (PIX, Dinheiro, Cartão, Boleto, etc.)
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
$$;