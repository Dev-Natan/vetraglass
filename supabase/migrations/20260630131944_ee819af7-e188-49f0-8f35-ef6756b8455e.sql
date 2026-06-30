
CREATE TABLE public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.financial_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('receita','despesa')),
  dre_group text NOT NULL CHECK (dre_group IN (
    'receita_bruta','deducoes','cmv','despesas_operacionais',
    'despesas_administrativas','despesas_pessoal','despesas_financeiras',
    'receitas_financeiras','impostos','outras_receitas','outras_despesas'
  )),
  color text,
  icon text,
  is_system boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fin_cat_company ON public.financial_categories(company_id);
CREATE INDEX idx_fin_cat_parent ON public.financial_categories(parent_id);
CREATE INDEX idx_fin_cat_kind ON public.financial_categories(company_id, kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_categories TO authenticated;
GRANT ALL ON public.financial_categories TO service_role;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_fin_cat" ON public.financial_categories FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "members_insert_fin_cat" ON public.financial_categories FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "members_update_fin_cat" ON public.financial_categories FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "members_delete_fin_cat" ON public.financial_categories FOR DELETE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) AND is_system = false);

CREATE TRIGGER trg_fin_cat_updated BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank_name text,
  bank_code text,
  agency text,
  account_number text,
  account_type text NOT NULL DEFAULT 'corrente' CHECK (account_type IN ('corrente','poupanca','caixa','investimento','carteira_digital')),
  pix_key text,
  pix_key_type text CHECK (pix_key_type IN ('cpf','cnpj','email','telefone','aleatoria')),
  initial_balance numeric(14,2) NOT NULL DEFAULT 0,
  current_balance numeric(14,2) NOT NULL DEFAULT 0,
  color text DEFAULT '#3b82f6',
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_accounts_company ON public.bank_accounts(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_bank" ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "members_insert_bank" ON public.bank_accounts FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "members_update_bank" ON public.bank_accounts FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "members_delete_bank" ON public.bank_accounts FOR DELETE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TRIGGER trg_bank_updated BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_document text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS installment_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_installments integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_payable_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2);

CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_bank_account ON public.expenses(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_parent_payable ON public.expenses(parent_payable_id);

ALTER TABLE public.accounts_receivable
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ar_category_id ON public.accounts_receivable(category_id);
CREATE INDEX IF NOT EXISTS idx_ar_bank_account ON public.accounts_receivable(bank_account_id);

CREATE OR REPLACE FUNCTION public.seed_default_financial_categories(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM public.financial_categories WHERE company_id = _company_id;
  IF cnt > 0 THEN RETURN; END IF;

  INSERT INTO public.financial_categories (company_id, name, kind, dre_group, is_system, sort_order, color, icon) VALUES
    (_company_id, 'Vendas de Produtos',     'receita','receita_bruta',        true, 10, '#16a34a','ShoppingCart'),
    (_company_id, 'Prestação de Serviços',  'receita','receita_bruta',        true, 20, '#16a34a','Wrench'),
    (_company_id, 'Instalação',             'receita','receita_bruta',        true, 30, '#16a34a','HardHat'),
    (_company_id, 'Rendimentos Financeiros','receita','receitas_financeiras', true, 40, '#0891b2','TrendingUp'),
    (_company_id, 'Outras Receitas',        'receita','outras_receitas',      true, 50, '#64748b','Plus'),
    (_company_id, 'Compra de Vidro',          'despesa','cmv',                     true, 100, '#dc2626','Package'),
    (_company_id, 'Compra de Alumínio',       'despesa','cmv',                     true, 110, '#dc2626','Package'),
    (_company_id, 'Ferragens / Acessórios',   'despesa','cmv',                     true, 120, '#dc2626','Wrench'),
    (_company_id, 'Frete e Entrega',          'despesa','cmv',                     true, 130, '#dc2626','Truck'),
    (_company_id, 'Salários e Encargos',      'despesa','despesas_pessoal',        true, 200, '#ea580c','Users'),
    (_company_id, 'Comissões de Vendas',      'despesa','despesas_pessoal',        true, 210, '#ea580c','Percent'),
    (_company_id, 'Vale Transporte / Alim.',  'despesa','despesas_pessoal',        true, 220, '#ea580c','Bus'),
    (_company_id, 'Aluguel',                  'despesa','despesas_administrativas',true, 300, '#7c3aed','Home'),
    (_company_id, 'Energia Elétrica',         'despesa','despesas_administrativas',true, 310, '#7c3aed','Zap'),
    (_company_id, 'Água',                     'despesa','despesas_administrativas',true, 320, '#7c3aed','Droplets'),
    (_company_id, 'Internet / Telefone',      'despesa','despesas_administrativas',true, 330, '#7c3aed','Wifi'),
    (_company_id, 'Material de Escritório',   'despesa','despesas_administrativas',true, 340, '#7c3aed','FileText'),
    (_company_id, 'Contador / Honorários',    'despesa','despesas_administrativas',true, 350, '#7c3aed','Briefcase'),
    (_company_id, 'Marketing e Publicidade',  'despesa','despesas_operacionais',   true, 400, '#0ea5e9','Megaphone'),
    (_company_id, 'Combustível / Veículos',   'despesa','despesas_operacionais',   true, 410, '#0ea5e9','Car'),
    (_company_id, 'Manutenção / Equipamentos','despesa','despesas_operacionais',   true, 420, '#0ea5e9','Settings'),
    (_company_id, 'Software / Assinaturas',   'despesa','despesas_operacionais',   true, 430, '#0ea5e9','Monitor'),
    (_company_id, 'Tarifas Bancárias',        'despesa','despesas_financeiras',    true, 500, '#475569','Landmark'),
    (_company_id, 'Juros e Multas',           'despesa','despesas_financeiras',    true, 510, '#475569','AlertTriangle'),
    (_company_id, 'Empréstimos / Financ.',    'despesa','despesas_financeiras',    true, 520, '#475569','CreditCard'),
    (_company_id, 'Simples Nacional / DAS',   'despesa','impostos',                true, 600, '#be123c','Receipt'),
    (_company_id, 'ICMS',                     'despesa','impostos',                true, 610, '#be123c','Receipt'),
    (_company_id, 'ISS',                      'despesa','impostos',                true, 620, '#be123c','Receipt'),
    (_company_id, 'Outras Despesas',          'despesa','outras_despesas',         true, 700, '#64748b','Minus');
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_default_financial_categories(uuid) TO authenticated, service_role;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_default_financial_categories(r.id);
  END LOOP;
END $$;
