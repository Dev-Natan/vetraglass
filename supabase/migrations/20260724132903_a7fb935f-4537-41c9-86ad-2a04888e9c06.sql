
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('saas_admin', 'admin', 'manager', 'employee');
CREATE TYPE public.company_role AS ENUM ('admin', 'manager', 'employee');

-- ============ HELPER: updated_at trigger ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SAAS ADMINS ============
CREATE TABLE public.saas_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_admins TO authenticated;
GRANT ALL ON public.saas_admins TO service_role;
ALTER TABLE public.saas_admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_saas_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.saas_admins WHERE user_id = _user_id);
$$;

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT,
  logo_url TEXT,
  address TEXT,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT,
  address_city TEXT,
  address_state TEXT,
  address_cep TEXT,
  phone TEXT,
  email TEXT,
  login_token TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'trial',
  subscription_plan TEXT,
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  modo_fiscal_ativo BOOLEAN NOT NULL DEFAULT false,
  presentation_template TEXT DEFAULT 'tradicional',
  presentation_enabled BOOLEAN NOT NULL DEFAULT false,
  presentation_data JSONB DEFAULT '{}'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER_COMPANIES ============
CREATE TABLE public.user_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.company_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);
CREATE INDEX idx_user_companies_user ON public.user_companies(user_id);
CREATE INDEX idx_user_companies_company ON public.user_companies(company_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_companies TO authenticated;
GRANT ALL ON public.user_companies TO service_role;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER user_companies_updated_at BEFORE UPDATE ON public.user_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HELPERS que dependem de user_companies ============
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = _user_id AND company_id = _company_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_companies
  WHERE user_id = _user_id AND is_active = true
  ORDER BY created_at ASC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.user_role_in_company(_user_id UUID, _company_id UUID)
RETURNS public.company_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_companies
  WHERE user_id = _user_id AND company_id = _company_id AND is_active = true
  LIMIT 1;
$$;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============ PERMISSION_PROFILES ============
CREATE TABLE public.permission_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_profiles TO authenticated;
GRANT ALL ON public.permission_profiles TO service_role;
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER permission_profiles_updated_at BEFORE UPDATE ON public.permission_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ROLE_PERMISSIONS ============
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.company_role NOT NULL,
  module TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, role, module)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER role_permissions_updated_at BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUDIT_LOGS ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_company ON public.audit_logs(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ LOGIN_ATTEMPTS ============
CREATE TABLE public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email, created_at DESC);
GRANT SELECT, INSERT ON public.login_attempts TO authenticated;
GRANT SELECT, INSERT ON public.login_attempts TO anon;
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- ============ COMPANY_MEMBER_AUDIT ============
CREATE TABLE public.company_member_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_company_member_audit_company ON public.company_member_audit(company_id, created_at DESC);
GRANT SELECT, INSERT ON public.company_member_audit TO authenticated;
GRANT ALL ON public.company_member_audit TO service_role;
ALTER TABLE public.company_member_audit ENABLE ROW LEVEL SECURITY;

-- ============ ANNOUNCEMENTS ============
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  severity TEXT NOT NULL DEFAULT 'info',
  is_active BOOLEAN NOT NULL DEFAULT true,
  target_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER announcements_updated_at BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ANNOUNCEMENT_DISMISSALS ============
CREATE TABLE public.announcement_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (announcement_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.announcement_dismissals TO authenticated;
GRANT ALL ON public.announcement_dismissals TO service_role;
ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_saas_admin(auth.uid()));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_saas_admin(auth.uid()));

-- saas_admins
CREATE POLICY "saas_admins_select_self_or_admin" ON public.saas_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_saas_admin(auth.uid()));
CREATE POLICY "saas_admins_manage_by_admin" ON public.saas_admins FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

-- companies
CREATE POLICY "companies_select_members_or_admin" ON public.companies FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), id) OR public.is_saas_admin(auth.uid()));
CREATE POLICY "companies_insert_authenticated" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "companies_update_admin_or_saas" ON public.companies FOR UPDATE TO authenticated
  USING (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), id) IN ('admin','manager')
  )
  WITH CHECK (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), id) IN ('admin','manager')
  );
CREATE POLICY "companies_delete_saas" ON public.companies FOR DELETE TO authenticated
  USING (public.is_saas_admin(auth.uid()));

-- user_companies
CREATE POLICY "user_companies_select_self_or_admin" ON public.user_companies FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager')
  );
CREATE POLICY "user_companies_insert_admin" ON public.user_companies FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) = 'admin'
  );
CREATE POLICY "user_companies_update_admin" ON public.user_companies FOR UPDATE TO authenticated
  USING (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) = 'admin'
  )
  WITH CHECK (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) = 'admin'
  );
CREATE POLICY "user_companies_delete_admin" ON public.user_companies FOR DELETE TO authenticated
  USING (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) = 'admin'
  );

-- user_roles
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_saas_admin(auth.uid()));
CREATE POLICY "user_roles_manage_saas" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

-- permission_profiles
CREATE POLICY "permission_profiles_company_members" ON public.permission_profiles FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()));
CREATE POLICY "permission_profiles_manage_admin" ON public.permission_profiles FOR ALL TO authenticated
  USING (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) = 'admin'
  )
  WITH CHECK (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) = 'admin'
  );

-- role_permissions
CREATE POLICY "role_permissions_company_members" ON public.role_permissions FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id) OR public.is_saas_admin(auth.uid()));
CREATE POLICY "role_permissions_manage_admin" ON public.role_permissions FOR ALL TO authenticated
  USING (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) = 'admin'
  )
  WITH CHECK (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) = 'admin'
  );

-- audit_logs
CREATE POLICY "audit_logs_select_own_or_admin" ON public.audit_logs FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_saas_admin(auth.uid())
    OR (company_id IS NOT NULL AND public.user_role_in_company(auth.uid(), company_id) = 'admin')
  );
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- login_attempts
CREATE POLICY "login_attempts_insert_all" ON public.login_attempts FOR INSERT TO authenticated, anon
  WITH CHECK (true);
CREATE POLICY "login_attempts_select_admin" ON public.login_attempts FOR SELECT TO authenticated
  USING (public.is_saas_admin(auth.uid()));

-- company_member_audit
CREATE POLICY "company_member_audit_select" ON public.company_member_audit FOR SELECT TO authenticated
  USING (
    public.is_saas_admin(auth.uid())
    OR public.user_role_in_company(auth.uid(), company_id) IN ('admin','manager')
  );
CREATE POLICY "company_member_audit_insert" ON public.company_member_audit FOR INSERT TO authenticated
  WITH CHECK (
    public.is_saas_admin(auth.uid())
    OR public.user_belongs_to_company(auth.uid(), company_id)
  );

-- announcements
CREATE POLICY "announcements_select_all" ON public.announcements FOR SELECT TO authenticated
  USING (is_active = true OR public.is_saas_admin(auth.uid()));
CREATE POLICY "announcements_manage_saas" ON public.announcements FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid())) WITH CHECK (public.is_saas_admin(auth.uid()));

-- announcement_dismissals
CREATE POLICY "announcement_dismissals_own" ON public.announcement_dismissals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ company_members_view ============
CREATE OR REPLACE VIEW public.company_members_view AS
SELECT
  uc.id,
  uc.user_id,
  uc.company_id,
  uc.role,
  uc.is_active,
  uc.created_at,
  p.full_name,
  p.avatar_url,
  p.email
FROM public.user_companies uc
LEFT JOIN public.profiles p ON p.user_id = uc.user_id;

GRANT SELECT ON public.company_members_view TO authenticated;
