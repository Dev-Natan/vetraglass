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
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();