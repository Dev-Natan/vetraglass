
-- =========================================================
-- FASE 3 — Clientes, Orçamentos, OS, Vendas, Caixa, Financeiro
-- =========================================================

-- ---------- CLIENTES ----------
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  document_type TEXT CHECK (document_type IN ('CPF','CNPJ')),
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_company ON public.clients(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY clients_company_access ON public.clients FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- ORÇAMENTOS ----------
CREATE SEQUENCE IF NOT EXISTS public.quotes_number_seq;

CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_number BIGINT NOT NULL DEFAULT nextval('public.quotes_number_seq'),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  customer_document TEXT,
  customer_document_type TEXT,
  customer_profession TEXT,
  customer_marital_status TEXT,
  payment_terms TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','converted','cancelled')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC,
  discount_amount NUMERIC,
  final_amount NUMERIC NOT NULL DEFAULT 0,
  valid_until DATE,
  show_measures_column BOOLEAN DEFAULT true,
  show_m2_column BOOLEAN DEFAULT true,
  presentation_template TEXT,
  presentation_enabled BOOLEAN DEFAULT false,
  cover_html TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  converted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_quotes_company_number ON public.quotes(company_id, quote_number);
CREATE INDEX idx_quotes_company ON public.quotes(company_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY quotes_company_access ON public.quotes FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  company_product_id UUID REFERENCES public.company_products(id) ON DELETE SET NULL,
  product_template_id UUID REFERENCES public.product_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  description TEXT,
  width NUMERIC,
  width_b NUMERIC,
  height NUMERIC,
  height_b NUMERIC,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  has_glass BOOLEAN DEFAULT false,
  glass_color TEXT,
  glass_thickness NUMERIC,
  aluminum_color TEXT,
  composition JSONB,
  item_notes TEXT,
  position INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_items_quote ON public.quote_items(quote_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY quote_items_access ON public.quote_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.user_belongs_to_company(auth.uid(), q.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.user_belongs_to_company(auth.uid(), q.company_id)));

CREATE TABLE public.quote_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  ordem_servico_id UUID,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','received','cancelled')),
  due_date DATE,
  received_at TIMESTAMPTZ,
  cash_movement_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_deposits_quote ON public.quote_deposits(quote_id);
CREATE INDEX idx_quote_deposits_company ON public.quote_deposits(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_deposits TO authenticated;
GRANT ALL ON public.quote_deposits TO service_role;
ALTER TABLE public.quote_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY quote_deposits_access ON public.quote_deposits FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_quote_deposits_updated BEFORE UPDATE ON public.quote_deposits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- ORDENS DE SERVIÇO ----------
CREATE SEQUENCE IF NOT EXISTS public.os_number_seq;

CREATE TABLE public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  os_number BIGINT NOT NULL DEFAULT nextval('public.os_number_seq'),
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  customer_address TEXT,
  customer_document TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  production_status TEXT,
  installation_status TEXT,
  delivery_date DATE,
  installation_date DATE,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  pending_amount NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT DEFAULT 'pending',
  notes TEXT,
  technical_notes TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_ordens_servico_company_number ON public.ordens_servico(company_id, os_number);
CREATE INDEX idx_os_company ON public.ordens_servico(company_id);
CREATE INDEX idx_os_quote ON public.ordens_servico(quote_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_access ON public.ordens_servico FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_os_updated BEFORE UPDATE ON public.ordens_servico FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.quote_deposits ADD CONSTRAINT quote_deposits_os_fk FOREIGN KEY (ordem_servico_id) REFERENCES public.ordens_servico(id) ON DELETE SET NULL;

CREATE TABLE public.os_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  quote_item_id UUID REFERENCES public.quote_items(id) ON DELETE SET NULL,
  company_product_id UUID REFERENCES public.company_products(id) ON DELETE SET NULL,
  product_template_id UUID REFERENCES public.product_templates(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  largura_venda NUMERIC NOT NULL DEFAULT 0,
  altura_venda NUMERIC NOT NULL DEFAULT 0,
  largura_venda_b NUMERIC,
  altura_venda_b NUMERIC,
  largura_venda_c NUMERIC,
  altura_venda_c NUMERIC,
  largura_producao NUMERIC NOT NULL DEFAULT 0,
  altura_producao NUMERIC NOT NULL DEFAULT 0,
  largura_producao_b NUMERIC,
  altura_producao_b NUMERIC,
  largura_producao_c NUMERIC,
  altura_producao_c NUMERIC,
  quantity NUMERIC NOT NULL DEFAULT 1,
  glass_color TEXT,
  glass_thickness NUMERIC,
  aluminum_color TEXT,
  technical_notes TEXT,
  recalculation_required BOOLEAN DEFAULT false,
  last_recalculated_at TIMESTAMPTZ,
  item_status JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_os_items_os ON public.os_items(os_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_items TO authenticated;
GRANT ALL ON public.os_items TO service_role;
ALTER TABLE public.os_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_items_access ON public.os_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ordens_servico o WHERE o.id = os_id AND public.user_belongs_to_company(auth.uid(), o.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ordens_servico o WHERE o.id = os_id AND public.user_belongs_to_company(auth.uid(), o.company_id)));

CREATE TABLE public.os_dimension_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_item_id UUID NOT NULL REFERENCES public.os_items(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  previous_value NUMERIC,
  new_value NUMERIC NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_dimension_history TO authenticated;
GRANT ALL ON public.os_dimension_history TO service_role;
ALTER TABLE public.os_dimension_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_dim_history_access ON public.os_dimension_history FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.os_items i JOIN public.ordens_servico o ON o.id = i.os_id WHERE i.id = os_item_id AND public.user_belongs_to_company(auth.uid(), o.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.os_items i JOIN public.ordens_servico o ON o.id = i.os_id WHERE i.id = os_item_id AND public.user_belongs_to_company(auth.uid(), o.company_id)));

CREATE TABLE public.os_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  stage TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_photos TO authenticated;
GRANT ALL ON public.os_photos TO service_role;
ALTER TABLE public.os_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_photos_access ON public.os_photos FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.os_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  os_item_id UUID REFERENCES public.os_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_type TEXT,
  unit TEXT,
  color TEXT,
  pieces_count NUMERIC DEFAULT 0,
  total_length_mm NUMERIC DEFAULT 0,
  bars_needed NUMERIC DEFAULT 0,
  quantity NUMERIC DEFAULT 0,
  unit_cost NUMERIC,
  total_cost NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_os_materials_os ON public.os_materials(ordem_servico_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_materials TO authenticated;
GRANT ALL ON public.os_materials TO service_role;
ALTER TABLE public.os_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_materials_access ON public.os_materials FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.os_glass_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  os_item_id UUID REFERENCES public.os_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  glass_type_id UUID REFERENCES public.glass_types(id) ON DELETE SET NULL,
  glass_color TEXT,
  glass_thickness NUMERIC,
  width_mm NUMERIC,
  height_mm NUMERIC,
  quantity NUMERIC DEFAULT 1,
  area_m2 NUMERIC,
  panels JSONB,
  status TEXT DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_os_glass_projects_os ON public.os_glass_projects(ordem_servico_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_glass_projects TO authenticated;
GRANT ALL ON public.os_glass_projects TO service_role;
ALTER TABLE public.os_glass_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_glass_projects_access ON public.os_glass_projects FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.os_cutting_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_servico_id UUID NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  os_item_id UUID REFERENCES public.os_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  color TEXT,
  bar_length_mm NUMERIC,
  cuts JSONB,
  bars JSONB,
  waste_mm NUMERIC,
  bars_needed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  progress JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_os_cutting_plan_os ON public.os_cutting_plan(ordem_servico_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_cutting_plan TO authenticated;
GRANT ALL ON public.os_cutting_plan TO service_role;
ALTER TABLE public.os_cutting_plan ENABLE ROW LEVEL SECURITY;
CREATE POLICY os_cutting_plan_access ON public.os_cutting_plan FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- ---------- VENDAS ----------
CREATE SEQUENCE IF NOT EXISTS public.sales_number_seq;

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_number BIGINT NOT NULL DEFAULT nextval('public.sales_number_seq'),
  cash_register_id UUID,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC,
  discount_amount NUMERIC,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  pending_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  sale_type TEXT,
  notes TEXT,
  sold_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_sales_company_number ON public.sales(company_id, sale_number);
-- garante 1 venda ativa por orçamento/tipo
CREATE UNIQUE INDEX uq_sales_quote_type ON public.sales(quote_id, sale_type) WHERE quote_id IS NOT NULL AND payment_status <> 'cancelled';
CREATE INDEX idx_sales_company ON public.sales(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_access ON public.sales FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_sales_updated BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  company_product_id UUID REFERENCES public.company_products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_unit TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  width NUMERIC,
  height NUMERIC,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sale_items_access ON public.sale_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.user_belongs_to_company(auth.uid(), s.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND public.user_belongs_to_company(auth.uid(), s.company_id)));

CREATE TABLE public.sale_item_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_item_id UUID REFERENCES public.company_items(id) ON DELETE SET NULL,
  item_template_id UUID REFERENCES public.item_templates(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  source TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_item_components_item ON public.sale_item_components(sale_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_item_components TO authenticated;
GRANT ALL ON public.sale_item_components TO service_role;
ALTER TABLE public.sale_item_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY sale_item_components_access ON public.sale_item_components FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- ---------- CAIXA ----------
CREATE TABLE public.company_cash (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_company_cash_company ON public.company_cash(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_cash TO authenticated;
GRANT ALL ON public.company_cash TO service_role;
ALTER TABLE public.company_cash ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_cash_access ON public.company_cash FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.company_cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida','transferencia_in','transferencia_out')),
  amount NUMERIC NOT NULL,
  description TEXT,
  category TEXT,
  bank_account_id UUID,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_cash_movements_company ON public.company_cash_movements(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_cash_movements TO authenticated;
GRANT ALL ON public.company_cash_movements TO service_role;
ALTER TABLE public.company_cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_cash_movements_access ON public.company_cash_movements FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  opening_amount NUMERIC NOT NULL DEFAULT 0,
  closing_amount NUMERIC,
  expected_amount NUMERIC,
  difference_amount NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_registers_company_status ON public.cash_registers(company_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_registers TO authenticated;
GRANT ALL ON public.cash_registers TO service_role;
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_registers_access ON public.cash_registers FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

ALTER TABLE public.sales ADD CONSTRAINT sales_cash_register_fk FOREIGN KEY (cash_register_id) REFERENCES public.cash_registers(id) ON DELETE SET NULL;

CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida','sangria','suprimento')),
  category TEXT,
  amount NUMERIC NOT NULL,
  description TEXT,
  payment_method TEXT,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  receivable_id UUID,
  expense_id UUID,
  origem TEXT,
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_movements_register ON public.cash_movements(cash_register_id);
CREATE INDEX idx_cash_movements_company ON public.cash_movements(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_movements_access ON public.cash_movements FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.cash_register_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  reason TEXT,
  received_by TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_register_advances TO authenticated;
GRANT ALL ON public.cash_register_advances TO service_role;
ALTER TABLE public.cash_register_advances ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_register_advances_access ON public.cash_register_advances FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- ---------- FINANCEIRO ----------
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  bank_code TEXT,
  agency TEXT,
  account_number TEXT,
  account_type TEXT NOT NULL DEFAULT 'corrente',
  pix_key TEXT,
  pix_key_type TEXT,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3b82f6',
  active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_accounts_company ON public.bank_accounts(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_accounts_access ON public.bank_accounts FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('receita','despesa')),
  dre_group TEXT,
  color TEXT DEFAULT '#64748b',
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_financial_categories_company ON public.financial_categories(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_categories TO authenticated;
GRANT ALL ON public.financial_categories TO service_role;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_categories_access ON public.financial_categories FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_financial_categories_updated BEFORE UPDATE ON public.financial_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tax_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ncm TEXT,
  cest TEXT,
  cfop TEXT,
  origem TEXT,
  icms_percent NUMERIC,
  pis_percent NUMERIC,
  cofins_percent NUMERIC,
  ipi_percent NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tax_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_categories TO authenticated;
GRANT ALL ON public.tax_categories TO service_role;
ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY tax_categories_read ON public.tax_categories FOR SELECT TO authenticated
  USING (company_id IS NULL OR public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY tax_categories_write ON public.tax_categories FOR ALL TO authenticated
  USING (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (company_id IS NOT NULL AND public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.formas_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tipo TEXT,
  taxa_percent NUMERIC DEFAULT 0,
  taxa_fixa NUMERIC DEFAULT 0,
  prazo_recebimento_dias INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formas_pagamento TO authenticated;
GRANT ALL ON public.formas_pagamento TO service_role;
ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY formas_pagamento_access ON public.formas_pagamento FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.condicoes_pagamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entrada_percent NUMERIC DEFAULT 0,
  installments INTEGER NOT NULL DEFAULT 1,
  interval_days INTEGER NOT NULL DEFAULT 30,
  descricao TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.condicoes_pagamento TO authenticated;
GRANT ALL ON public.condicoes_pagamento TO service_role;
ALTER TABLE public.condicoes_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY condicoes_pagamento_access ON public.condicoes_pagamento FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled')),
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  category TEXT,
  payment_method TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  supplier_name TEXT,
  supplier_document TEXT,
  reference_type TEXT,
  reference_id UUID,
  employee_id UUID,
  installment_number INTEGER DEFAULT 1,
  total_installments INTEGER DEFAULT 1,
  parent_expense_id UUID,
  notes TEXT,
  attachments JSONB,
  is_recurring BOOLEAN DEFAULT false,
  recurrence JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_company_due ON public.expenses(company_id, due_date);
CREATE INDEX idx_expenses_status ON public.expenses(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_access ON public.expenses FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.accounts_receivable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC NOT NULL,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','partial','paid','cancelled','overdue')),
  due_date DATE NOT NULL,
  paid_date DATE,
  receivable_type TEXT,
  payment_method TEXT,
  installment_number INTEGER DEFAULT 0,
  total_installments INTEGER DEFAULT 0,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_receivable_company_due ON public.accounts_receivable(company_id, due_date);
CREATE INDEX idx_receivable_status ON public.accounts_receivable(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_receivable TO authenticated;
GRANT ALL ON public.accounts_receivable TO service_role;
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounts_receivable_access ON public.accounts_receivable FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_receivable_updated BEFORE UPDATE ON public.accounts_receivable FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.employee_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  base_amount NUMERIC NOT NULL DEFAULT 0,
  commission_percent NUMERIC NOT NULL DEFAULT 0,
  commission_amount NUMERIC NOT NULL DEFAULT 0,
  reference_month DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employee_commissions_company ON public.employee_commissions(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_commissions TO authenticated;
GRANT ALL ON public.employee_commissions TO service_role;
ALTER TABLE public.employee_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY employee_commissions_access ON public.employee_commissions FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_employee_commissions_updated BEFORE UPDATE ON public.employee_commissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'nfe',
  numero TEXT,
  serie TEXT,
  chave TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  ref_externa TEXT,
  focusnfe_ref TEXT,
  focusnfe_status TEXT,
  focusnfe_payload JSONB,
  focusnfe_response JSONB,
  danfe_url TEXT,
  xml_url TEXT,
  valor_total NUMERIC,
  emitida_em TIMESTAMPTZ,
  cancelada_em TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notas_fiscais_company ON public.notas_fiscais(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
CREATE POLICY notas_fiscais_access ON public.notas_fiscais FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_notas_fiscais_updated BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- AGENDA E LEMBRETES ----------
CREATE TABLE public.service_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  appointment_type TEXT NOT NULL DEFAULT 'instalacao',
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  ends_at TIMESTAMPTZ,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','done','cancelled','postponed')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_appointments_company_date ON public.service_appointments(company_id, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_appointments TO authenticated;
GRANT ALL ON public.service_appointments TO service_role;
ALTER TABLE public.service_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_appointments_access ON public.service_appointments FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE TRIGGER trg_service_appointments_updated BEFORE UPDATE ON public.service_appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.system_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  title TEXT NOT NULL,
  message TEXT,
  due_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_system_reminders_company ON public.system_reminders(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_reminders TO authenticated;
GRANT ALL ON public.system_reminders TO service_role;
ALTER TABLE public.system_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY system_reminders_access ON public.system_reminders FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TABLE public.company_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','success','warning','error')),
  reference_type TEXT,
  reference_id UUID,
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_notifications_user ON public.company_notifications(company_id, user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_notifications TO authenticated;
GRANT ALL ON public.company_notifications TO service_role;
ALTER TABLE public.company_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_notifications_access ON public.company_notifications FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- ---------- CONFIGURAÇÕES DA EMPRESA ----------
CREATE TABLE public.company_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  reminder_receivables BOOLEAN NOT NULL DEFAULT true,
  reminder_expenses BOOLEAN NOT NULL DEFAULT true,
  reminder_appointments BOOLEAN NOT NULL DEFAULT true,
  reminder_low_stock BOOLEAN NOT NULL DEFAULT true,
  channel_email BOOLEAN NOT NULL DEFAULT true,
  channel_inapp BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_notification_settings TO authenticated;
GRANT ALL ON public.company_notification_settings TO service_role;
ALTER TABLE public.company_notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_notification_settings_access ON public.company_notification_settings FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id) AND public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager'));
CREATE TRIGGER trg_cns_updated BEFORE UPDATE ON public.company_notification_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.company_payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  default_forma_id UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  default_condicao_id UUID REFERENCES public.condicoes_pagamento(id) ON DELETE SET NULL,
  accepts_cash BOOLEAN NOT NULL DEFAULT true,
  accepts_pix BOOLEAN NOT NULL DEFAULT true,
  accepts_card BOOLEAN NOT NULL DEFAULT true,
  settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_payment_settings TO authenticated;
GRANT ALL ON public.company_payment_settings TO service_role;
ALTER TABLE public.company_payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_payment_settings_access ON public.company_payment_settings FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id) AND public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager'));
CREATE TRIGGER trg_cps_updated BEFORE UPDATE ON public.company_payment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.company_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  session_timeout_minutes INTEGER NOT NULL DEFAULT 60,
  require_2fa BOOLEAN NOT NULL DEFAULT false,
  password_min_length INTEGER NOT NULL DEFAULT 8,
  max_login_attempts INTEGER NOT NULL DEFAULT 5,
  lockout_minutes INTEGER NOT NULL DEFAULT 15,
  allow_multiple_sessions BOOLEAN NOT NULL DEFAULT true,
  settings JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_security_settings TO authenticated;
GRANT ALL ON public.company_security_settings TO service_role;
ALTER TABLE public.company_security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_security_settings_access ON public.company_security_settings FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id) AND public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager'));
CREATE TRIGGER trg_css_updated BEFORE UPDATE ON public.company_security_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- VIEW: quote_financial_status
-- Consolida depósitos, vendas e saldo pendente por orçamento
-- =========================================================
CREATE OR REPLACE VIEW public.quote_financial_status
WITH (security_invoker = true)
AS
SELECT
  q.id AS quote_id,
  q.company_id,
  q.quote_number,
  q.customer_name,
  q.final_amount,
  q.status,
  q.created_at,
  COALESCE(dep.total_deposits, 0) AS total_deposits,
  COALESCE(sal.total_sold, 0) AS total_sold,
  GREATEST(q.final_amount - COALESCE(dep.total_deposits, 0) - COALESCE(sal.total_sold, 0), 0) AS pending_amount,
  CASE
    WHEN q.final_amount <= COALESCE(dep.total_deposits, 0) + COALESCE(sal.total_sold, 0) THEN 'paid'
    WHEN COALESCE(dep.total_deposits, 0) + COALESCE(sal.total_sold, 0) > 0 THEN 'partial'
    ELSE 'pending'
  END AS financial_status
FROM public.quotes q
LEFT JOIN (
  SELECT quote_id, SUM(amount) AS total_deposits
  FROM public.quote_deposits
  WHERE status = 'received'
  GROUP BY quote_id
) dep ON dep.quote_id = q.id
LEFT JOIN (
  SELECT quote_id, SUM(total_amount) AS total_sold
  FROM public.sales
  WHERE quote_id IS NOT NULL AND payment_status <> 'cancelled'
  GROUP BY quote_id
) sal ON sal.quote_id = q.id;

GRANT SELECT ON public.quote_financial_status TO authenticated;
GRANT SELECT ON public.quote_financial_status TO service_role;

-- =========================================================
-- FUNÇÕES / RPCs
-- =========================================================

-- Abrir caixa diário
CREATE OR REPLACE FUNCTION public.open_daily_cash(
  _company_id UUID,
  _opening_amount NUMERIC,
  _user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
  new_id UUID;
BEGIN
  IF NOT public.user_belongs_to_company(_user_id, _company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT id INTO existing_id FROM public.cash_registers
  WHERE company_id = _company_id AND status = 'open'
  ORDER BY opened_at DESC LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'cash_register_id', existing_id, 'already_open', true);
  END IF;

  INSERT INTO public.cash_registers (company_id, opened_by, opening_amount)
  VALUES (_company_id, _user_id, COALESCE(_opening_amount, 0))
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('success', true, 'cash_register_id', new_id);
END $$;

-- Buscar caixa aberto atual do usuário na empresa
CREATE OR REPLACE FUNCTION public.get_user_open_cash_register(_company_id UUID)
RETURNS TABLE (id UUID, opened_at TIMESTAMPTZ, opening_amount NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cr.id, cr.opened_at, cr.opening_amount
  FROM public.cash_registers cr
  WHERE cr.company_id = _company_id
    AND cr.status = 'open'
    AND public.user_belongs_to_company(auth.uid(), cr.company_id)
  ORDER BY cr.opened_at DESC
  LIMIT 1;
$$;

-- Cancelar orçamento aprovado (cascata segura)
CREATE OR REPLACE FUNCTION public.cancel_approved_quote(_quote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q RECORD;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id = _quote_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'quote_not_found');
  END IF;
  IF NOT public.user_belongs_to_company(auth.uid(), q.company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Cancela vendas vinculadas
  UPDATE public.sales SET payment_status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
  WHERE quote_id = _quote_id AND payment_status <> 'cancelled';

  -- Cancela contas a receber
  UPDATE public.accounts_receivable SET status = 'cancelled'
  WHERE quote_id = _quote_id AND status <> 'paid';

  -- Cancela depósitos pendentes
  UPDATE public.quote_deposits SET status = 'cancelled'
  WHERE quote_id = _quote_id AND status = 'pending';

  -- Cancela OS vinculada, se houver
  UPDATE public.ordens_servico
     SET status = 'cancelada', cancelled_at = now(), cancelled_by = auth.uid()
   WHERE quote_id = _quote_id AND status <> 'cancelada';

  -- Marca orçamento como cancelado
  UPDATE public.quotes SET status = 'cancelled', updated_at = now() WHERE id = _quote_id;

  RETURN jsonb_build_object('success', true);
END $$;

-- Converter orçamento aprovado em OS
CREATE OR REPLACE FUNCTION public.convert_quote_to_os(_quote_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q RECORD;
  new_os_id UUID;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id = _quote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF NOT public.user_belongs_to_company(auth.uid(), q.company_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.ordens_servico (
    company_id, quote_id, client_id, customer_name, customer_phone, customer_email,
    customer_address, customer_document, total_amount, pending_amount, notes, created_by
  ) VALUES (
    q.company_id, q.id, q.client_id, q.customer_name, q.customer_phone, q.customer_email,
    q.customer_address, q.customer_document, q.final_amount, q.final_amount, q.notes, auth.uid()
  ) RETURNING id INTO new_os_id;

  -- Copia itens
  INSERT INTO public.os_items (
    os_id, quote_item_id, company_product_id, product_template_id, product_name,
    largura_venda, altura_venda, largura_venda_b, altura_venda_b,
    largura_producao, altura_producao, largura_producao_b, altura_producao_b,
    quantity, glass_color, glass_thickness, aluminum_color
  )
  SELECT
    new_os_id, qi.id, qi.company_product_id, qi.product_template_id,
    COALESCE(qi.description, 'Item'),
    COALESCE(qi.width, 0), COALESCE(qi.height, 0), qi.width_b, qi.height_b,
    COALESCE(qi.width, 0), COALESCE(qi.height, 0), qi.width_b, qi.height_b,
    qi.quantity, qi.glass_color, qi.glass_thickness, qi.aluminum_color
  FROM public.quote_items qi WHERE qi.quote_id = _quote_id;

  UPDATE public.quotes SET status = 'converted', converted_at = now() WHERE id = _quote_id;

  RETURN new_os_id;
END $$;

-- Relatório DRE agregado por categoria
CREATE OR REPLACE FUNCTION public.get_dre_report(
  p_company_id UUID,
  p_start DATE,
  p_end DATE
) RETURNS TABLE (
  kind TEXT,
  dre_group TEXT,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  amount NUMERIC,
  count BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), p_company_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN QUERY
  -- Receitas (vendas)
  SELECT
    'receita'::TEXT AS kind,
    'receita_bruta'::TEXT AS dre_group,
    NULL::UUID AS category_id,
    'Vendas'::TEXT AS category_name,
    '#10b981'::TEXT AS category_color,
    COALESCE(SUM(s.total_amount), 0) AS amount,
    COUNT(*)::BIGINT AS count
  FROM public.sales s
  WHERE s.company_id = p_company_id
    AND s.payment_status <> 'cancelled'
    AND s.created_at::DATE BETWEEN p_start AND p_end
  HAVING COUNT(*) > 0
  UNION ALL
  -- Despesas por categoria
  SELECT
    'despesa'::TEXT,
    COALESCE(fc.dre_group, 'outras_despesas'),
    fc.id,
    COALESCE(fc.name, e.category, 'Sem categoria'),
    COALESCE(fc.color, '#ef4444'),
    COALESCE(SUM(e.amount), 0),
    COUNT(*)::BIGINT
  FROM public.expenses e
  LEFT JOIN public.financial_categories fc ON fc.id = e.category_id
  WHERE e.company_id = p_company_id
    AND e.status <> 'cancelled'
    AND e.due_date BETWEEN p_start AND p_end
  GROUP BY fc.id, fc.dre_group, fc.name, fc.color, e.category;
END $$;
