
-- =====================================================
-- FASE 4: Colaboradores, Suporte, Assinaturas, Medições
-- =====================================================

-- ============ EMPLOYEES ============
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  permission_profile_id UUID REFERENCES public.permission_profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  specialty TEXT,
  photo_url TEXT,
  admission_date DATE,
  hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_payment_day INT CHECK (salary_payment_day BETWEEN 1 AND 31),
  commission_enabled BOOLEAN NOT NULL DEFAULT false,
  commission_percent NUMERIC(6,3) NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'percent',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, username)
);
CREATE INDEX idx_employees_company ON public.employees(company_id);
CREATE INDEX idx_employees_user ON public.employees(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employees_company_access" ON public.employees FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()));

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add employee_id to expenses (fase 3 já criou expenses)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_day INT;

-- ============ EMPLOYEE INVITES ============
CREATE TABLE public.employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invites_company ON public.employee_invites(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_invites TO authenticated;
GRANT ALL ON public.employee_invites TO service_role;
ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_company_access" ON public.employee_invites FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()));

-- ============ FEEDBACKS ============
CREATE TABLE public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('feature','improvement','usability','integration')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','planned','in_progress','completed','declined')),
  admin_response TEXT,
  votes_count INT NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedbacks_status ON public.feedbacks(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedbacks_read_public" ON public.feedbacks FOR SELECT TO authenticated
  USING (is_public OR user_id = auth.uid() OR public.is_saas_admin(auth.uid()));
CREATE POLICY "feedbacks_insert_own" ON public.feedbacks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "feedbacks_update_own_or_admin" ON public.feedbacks FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_saas_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_saas_admin(auth.uid()));
CREATE POLICY "feedbacks_delete_own_or_admin" ON public.feedbacks FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_saas_admin(auth.uid()));

CREATE TRIGGER update_feedbacks_updated_at BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FEEDBACK VOTES ============
CREATE TABLE public.feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feedback_id, user_id)
);
CREATE INDEX idx_fvotes_feedback ON public.feedback_votes(feedback_id);

GRANT SELECT, INSERT, DELETE ON public.feedback_votes TO authenticated;
GRANT ALL ON public.feedback_votes TO service_role;
ALTER TABLE public.feedback_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_read_all" ON public.feedback_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "votes_insert_own" ON public.feedback_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "votes_delete_own" ON public.feedback_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Trigger to keep votes_count in sync
CREATE OR REPLACE FUNCTION public.sync_feedback_votes_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.feedbacks SET votes_count = votes_count + 1 WHERE id = NEW.feedback_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.feedbacks SET votes_count = GREATEST(votes_count - 1, 0) WHERE id = OLD.feedback_id;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_feedback_votes_count
  AFTER INSERT OR DELETE ON public.feedback_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_feedback_votes_count();

-- ============ SUPPORT TICKETS ============
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq;

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number INT NOT NULL DEFAULT nextval('public.support_ticket_number_seq') UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('bug','feature','question','billing','other')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_company ON public.support_tickets(company_id);
CREATE INDEX idx_tickets_status ON public.support_tickets(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_access" ON public.support_tickets FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()));

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SUPPORT MESSAGES ============
CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_smsg_ticket ON public.support_messages(ticket_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smsg_access" ON public.support_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (public.user_belongs_to_company(auth.uid(), t.company_id) OR public.is_saas_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id
    AND (public.user_belongs_to_company(auth.uid(), t.company_id) OR public.is_saas_admin(auth.uid()))));

-- ============ SUPPORT ATTACHMENTS ============
CREATE TABLE public.support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_satt_msg ON public.support_attachments(message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_attachments TO authenticated;
GRANT ALL ON public.support_attachments TO service_role;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "satt_access" ON public.support_attachments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_messages m
    JOIN public.support_tickets t ON t.id = m.ticket_id
    WHERE m.id = message_id
      AND (public.user_belongs_to_company(auth.uid(), t.company_id) OR public.is_saas_admin(auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_messages m
    JOIN public.support_tickets t ON t.id = m.ticket_id
    WHERE m.id = message_id
      AND (public.user_belongs_to_company(auth.uid(), t.company_id) OR public.is_saas_admin(auth.uid()))
  ));

-- ============ COMPANY SUBSCRIPTIONS ============
CREATE TABLE public.company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'basico',
  plan_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','trial','cancelled','past_due')),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_subscriptions TO authenticated;
GRANT ALL ON public.company_subscriptions TO service_role;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subs_read_own_or_admin" ON public.company_subscriptions FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()));
CREATE POLICY "subs_write_admin_only" ON public.company_subscriptions FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid()))
  WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE TRIGGER update_subs_updated_at BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SITE MEASUREMENTS ============
CREATE SEQUENCE IF NOT EXISTS public.site_measurement_number_seq;

CREATE TABLE public.site_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_number INT NOT NULL DEFAULT nextval('public.site_measurement_number_seq') UNIQUE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  measured_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  measured_by_name TEXT,
  measured_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','completed','approved','rejected')),
  location_name TEXT,
  location_address TEXT,
  room_name TEXT,
  observations TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_measurements_company ON public.site_measurements(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_measurements TO authenticated;
GRANT ALL ON public.site_measurements TO service_role;
ALTER TABLE public.site_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "measurements_company_access" ON public.site_measurements FOR ALL TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()));

CREATE TRIGGER update_measurements_updated_at BEFORE UPDATE ON public.site_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MEASUREMENT ITEMS ============
CREATE TABLE public.measurement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id UUID NOT NULL REFERENCES public.site_measurements(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_type TEXT,
  room TEXT,
  position TEXT,
  width NUMERIC,
  height NUMERIC,
  depth NUMERIC,
  vao_largura NUMERIC,
  vao_altura NUMERIC,
  peitoril NUMERIC,
  suggested_product TEXT,
  notes TEXT,
  quantity INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mitems_measurement ON public.measurement_items(measurement_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_items TO authenticated;
GRANT ALL ON public.measurement_items TO service_role;
ALTER TABLE public.measurement_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mitems_access" ON public.measurement_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.site_measurements m WHERE m.id = measurement_id
    AND (public.user_belongs_to_company(auth.uid(), m.company_id) OR public.is_saas_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.site_measurements m WHERE m.id = measurement_id
    AND (public.user_belongs_to_company(auth.uid(), m.company_id) OR public.is_saas_admin(auth.uid()))));

CREATE TRIGGER update_mitems_updated_at BEFORE UPDATE ON public.measurement_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MEASUREMENT CHECKLIST ============
CREATE TABLE public.measurement_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id UUID NOT NULL REFERENCES public.site_measurements(id) ON DELETE CASCADE,
  item_label TEXT NOT NULL,
  is_checked BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mchk_measurement ON public.measurement_checklist(measurement_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurement_checklist TO authenticated;
GRANT ALL ON public.measurement_checklist TO service_role;
ALTER TABLE public.measurement_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mchk_access" ON public.measurement_checklist FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.site_measurements m WHERE m.id = measurement_id
    AND (public.user_belongs_to_company(auth.uid(), m.company_id) OR public.is_saas_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.site_measurements m WHERE m.id = measurement_id
    AND (public.user_belongs_to_company(auth.uid(), m.company_id) OR public.is_saas_admin(auth.uid()))));

-- ============ MUNICIPIOS IBGE ============
CREATE TABLE public.municipios_ibge (
  codigo_ibge TEXT PRIMARY KEY,
  nome_municipio TEXT NOT NULL,
  uf_codigo TEXT NOT NULL,
  uf_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_muni_uf ON public.municipios_ibge(uf_codigo);
CREATE INDEX idx_muni_nome ON public.municipios_ibge(nome_municipio);

GRANT SELECT ON public.municipios_ibge TO anon, authenticated;
GRANT ALL ON public.municipios_ibge TO service_role;
ALTER TABLE public.municipios_ibge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "muni_read_all" ON public.municipios_ibge FOR SELECT USING (true);
CREATE POLICY "muni_admin_write" ON public.municipios_ibge FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid()))
  WITH CHECK (public.is_saas_admin(auth.uid()));

-- ============ RPC: calculate_sale_commission ============
CREATE OR REPLACE FUNCTION public.calculate_sale_commission(_sale_id UUID, _employee_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  emp RECORD;
  commission_amount NUMERIC;
  new_id UUID;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = _sale_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO emp FROM public.employees WHERE id = _employee_id;
  IF NOT FOUND OR NOT emp.commission_enabled THEN RETURN NULL; END IF;

  IF emp.commission_type = 'fixed' THEN
    commission_amount := emp.commission_percent;
  ELSE
    commission_amount := ROUND((COALESCE(s.total_amount, 0) * emp.commission_percent / 100)::numeric, 2);
  END IF;

  INSERT INTO public.employee_commissions (
    company_id, employee_id, sale_id, base_amount, percent, amount, status
  ) VALUES (
    s.company_id, _employee_id, _sale_id,
    COALESCE(s.total_amount, 0), emp.commission_percent, commission_amount, 'pending'
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;
