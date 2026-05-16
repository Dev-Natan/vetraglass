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
$$;