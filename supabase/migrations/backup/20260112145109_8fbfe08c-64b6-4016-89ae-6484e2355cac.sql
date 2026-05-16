-- Tabela de configuração tributária da empresa (Simples Nacional)
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
  EXECUTE FUNCTION public.update_updated_at_column();