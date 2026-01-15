-- =============================================
-- SISTEMA DE PROTEÇÃO CONTRA ATAQUES E INVASÃO
-- =============================================

-- 1. TABELA DE TENTATIVAS DE LOGIN (Rate Limiting)
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  user_agent text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca rápida por email e data
CREATE INDEX idx_login_attempts_email_created ON public.login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip_created ON public.login_attempts(ip_address, created_at DESC);

-- RLS para login_attempts (apenas inserção permitida, sem leitura direta)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Política: qualquer um pode inserir (para registrar tentativas)
CREATE POLICY "Allow insert login attempts"
ON public.login_attempts FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Política: apenas admins SaaS podem ver logs
CREATE POLICY "SaaS admins can view login attempts"
ON public.login_attempts FOR SELECT
TO authenticated
USING (public.is_saas_admin(auth.uid()));

-- 2. TABELA DE AUDIT LOGS
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('view', 'create', 'update', 'delete', 'login', 'logout', 'export')),
  table_name text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: apenas admins da empresa podem ver logs de auditoria (usando ordem correta de parâmetros)
CREATE POLICY "Company admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  public.is_saas_admin(auth.uid()) OR
  (company_id IS NOT NULL AND public.user_has_role_in_company(auth.uid(), company_id, 'admin'::app_role))
);

-- Política: sistema pode inserir logs (via trigger)
CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. VIEW SEGURA PARA COMPANIES (oculta dados sensíveis)
CREATE VIEW public.companies_safe
WITH (security_invoker=on) AS
SELECT 
  id,
  name,
  cnpj,
  phone,
  email,
  address,
  logo_url,
  logo_size,
  modo_fiscal_ativo,
  regime_tributario,
  codigo_municipio_ibge,
  created_at,
  updated_at
FROM public.companies;

-- 4. VIEW SEGURA PARA CLIENTS (máscara dados sensíveis baseado no role)
CREATE VIEW public.clients_safe
WITH (security_invoker=on) AS
SELECT 
  c.id,
  c.company_id,
  c.name,
  -- Máscara email para funcionários comuns
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), c.company_id) 
    THEN c.email 
    ELSE CASE WHEN c.email IS NOT NULL THEN '***@***' ELSE NULL END
  END as email,
  -- Máscara telefone para funcionários comuns
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), c.company_id) 
    THEN c.phone 
    ELSE CASE WHEN c.phone IS NOT NULL THEN '****-****' ELSE NULL END
  END as phone,
  -- Máscara documento para funcionários comuns
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), c.company_id) 
    THEN c.document 
    ELSE CASE WHEN c.document IS NOT NULL THEN '***.***.***-**' ELSE NULL END
  END as document,
  c.document_type,
  c.city,
  c.state,
  -- Endereço completo apenas para managers/admins
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), c.company_id) 
    THEN c.address 
    ELSE NULL
  END as address,
  c.zip_code,
  c.notes,
  c.is_active,
  c.created_at,
  c.updated_at
FROM public.clients c
WHERE public.user_belongs_to_company(auth.uid(), c.company_id);

-- 5. FUNÇÃO PARA REGISTRAR AUDIT LOG
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _table_name text,
  _record_id uuid DEFAULT NULL,
  _old_data jsonb DEFAULT NULL,
  _new_data jsonb DEFAULT NULL,
  _company_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    company_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    _company_id,
    _action,
    _table_name,
    _record_id,
    _old_data,
    _new_data,
    _metadata,
    now()
  );
END;
$$;

-- 6. FUNÇÃO PARA VERIFICAR RATE LIMITING DE LOGIN
CREATE OR REPLACE FUNCTION public.check_login_rate_limit(
  _email text,
  _max_attempts integer DEFAULT 5,
  _window_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _failed_attempts integer;
  _last_attempt timestamptz;
  _is_blocked boolean;
  _remaining_seconds integer;
BEGIN
  -- Conta tentativas falhas nos últimos X minutos
  SELECT 
    COUNT(*),
    MAX(created_at)
  INTO _failed_attempts, _last_attempt
  FROM public.login_attempts
  WHERE email = _email
    AND success = false
    AND created_at > (now() - (_window_minutes || ' minutes')::interval);
  
  _is_blocked := _failed_attempts >= _max_attempts;
  
  IF _is_blocked AND _last_attempt IS NOT NULL THEN
    _remaining_seconds := EXTRACT(EPOCH FROM (
      _last_attempt + (_window_minutes || ' minutes')::interval - now()
    ))::integer;
  ELSE
    _remaining_seconds := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'is_blocked', _is_blocked,
    'failed_attempts', _failed_attempts,
    'max_attempts', _max_attempts,
    'remaining_seconds', GREATEST(0, _remaining_seconds)
  );
END;
$$;

-- 7. FUNÇÃO PARA REGISTRAR TENTATIVA DE LOGIN
CREATE OR REPLACE FUNCTION public.record_login_attempt(
  _email text,
  _success boolean,
  _ip_address text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.login_attempts (email, success, ip_address, user_agent)
  VALUES (_email, _success, _ip_address, _user_agent);
  
  -- Se login foi bem sucedido, limpa tentativas antigas
  IF _success THEN
    DELETE FROM public.login_attempts
    WHERE email = _email AND success = false;
  END IF;
END;
$$;

-- 8. TRIGGER PARA AUDITORIA AUTOMÁTICA EM TABELAS SENSÍVEIS

-- Função genérica de auditoria
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id uuid;
  _action text;
  _record_id uuid;
BEGIN
  -- Determina a ação
  IF TG_OP = 'INSERT' THEN
    _action := 'create';
    _record_id := NEW.id;
    _company_id := NEW.company_id;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'update';
    _record_id := NEW.id;
    _company_id := NEW.company_id;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'delete';
    _record_id := OLD.id;
    _company_id := OLD.company_id;
  END IF;
  
  -- Insere log de auditoria
  INSERT INTO public.audit_logs (
    user_id,
    company_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    auth.uid(),
    _company_id,
    _action,
    TG_TABLE_NAME,
    _record_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Aplica trigger em tabelas sensíveis
CREATE TRIGGER audit_clients_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_quotes_changes
AFTER INSERT OR UPDATE OR DELETE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_sales_changes
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_notas_fiscais_changes
AFTER INSERT OR UPDATE OR DELETE ON public.notas_fiscais
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER audit_ordens_servico_changes
AFTER INSERT OR UPDATE OR DELETE ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 9. ATUALIZAR POLÍTICA DE PROFILES PARA MAIOR SEGURANÇA
-- Remove política antiga que permite enumerar perfis
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Nova política: usuários só podem ver seu próprio perfil ou perfis de colegas de empresa
CREATE POLICY "Users can view own profile and company colleagues"
ON public.profiles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_companies uc1
    JOIN public.user_companies uc2 ON uc1.company_id = uc2.company_id
    WHERE uc1.user_id = auth.uid()
    AND uc2.user_id = profiles.user_id
    AND uc1.is_active = true
    AND uc2.is_active = true
  )
);

-- 10. LIMPEZA AUTOMÁTICA DE LOGS ANTIGOS (mantém últimos 90 dias)
CREATE OR REPLACE FUNCTION public.cleanup_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove tentativas de login antigas (mais de 30 dias)
  DELETE FROM public.login_attempts
  WHERE created_at < (now() - interval '30 days');
  
  -- Remove audit logs muito antigos (mais de 90 dias)
  DELETE FROM public.audit_logs
  WHERE created_at < (now() - interval '90 days');
END;
$$;