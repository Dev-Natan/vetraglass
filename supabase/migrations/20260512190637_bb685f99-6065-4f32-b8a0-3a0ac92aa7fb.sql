-- Tabela para logs de auditoria financeira
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
