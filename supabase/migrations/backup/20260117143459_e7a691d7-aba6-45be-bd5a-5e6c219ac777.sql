-- 1. Adicionar coluna user_id na tabela employees para vincular funcionário ao login
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índice para busca por user_id
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);

-- 2. Criar tabela de convites para funcionários
CREATE TABLE public.employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'employee',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para a tabela de convites
CREATE INDEX idx_employee_invites_token ON public.employee_invites(token);
CREATE INDEX idx_employee_invites_employee_id ON public.employee_invites(employee_id);
CREATE INDEX idx_employee_invites_company_id ON public.employee_invites(company_id);

-- RLS para employee_invites
ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

-- Admins e managers podem ver convites da sua empresa
CREATE POLICY "Users can view invites from their company"
ON public.employee_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = employee_invites.company_id
    AND uc.role IN ('admin', 'manager')
    AND uc.is_active = true
  )
);

-- Admins e managers podem criar convites
CREATE POLICY "Admins and managers can create invites"
ON public.employee_invites
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = employee_invites.company_id
    AND uc.role IN ('admin', 'manager')
    AND uc.is_active = true
  )
);

-- Admins e managers podem atualizar convites (marcar como aceito)
CREATE POLICY "Admins and managers can update invites"
ON public.employee_invites
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = employee_invites.company_id
    AND uc.role IN ('admin', 'manager')
    AND uc.is_active = true
  )
);

-- 3. Criar tabela de permissões por role (configurável por empresa)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, role, module)
);

-- Índice para busca por empresa e role
CREATE INDEX idx_role_permissions_company_role ON public.role_permissions(company_id, role);

-- RLS para role_permissions
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver permissões da sua empresa
CREATE POLICY "Users can view permissions from their company"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = role_permissions.company_id
    AND uc.is_active = true
  )
);

-- Apenas admins podem gerenciar permissões
CREATE POLICY "Admins can manage permissions"
ON public.role_permissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = role_permissions.company_id
    AND uc.role = 'admin'
    AND uc.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_companies uc
    WHERE uc.user_id = auth.uid()
    AND uc.company_id = role_permissions.company_id
    AND uc.role = 'admin'
    AND uc.is_active = true
  )
);

-- 4. Função SECURITY DEFINER para verificar permissões
CREATE OR REPLACE FUNCTION public.user_has_permission(
  _user_id UUID, 
  _module TEXT, 
  _action TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
  _company_id UUID;
  _has_permission BOOLEAN;
BEGIN
  -- Busca o role do usuário na empresa ativa
  SELECT role, company_id INTO _role, _company_id
  FROM user_companies
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
  
  -- Se não encontrou, sem permissão
  IF _role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Admin tem todas as permissões
  IF _role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Verifica permissão específica na tabela role_permissions
  SELECT 
    CASE _action
      WHEN 'view' THEN can_view
      WHEN 'create' THEN can_create
      WHEN 'edit' THEN can_edit
      WHEN 'delete' THEN can_delete
      ELSE false
    END INTO _has_permission
  FROM role_permissions
  WHERE company_id = _company_id 
    AND role = _role 
    AND module = _module;
  
  RETURN COALESCE(_has_permission, false);
END;
$$;

-- 5. Função para obter o role do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role;
BEGIN
  SELECT role INTO _role
  FROM user_companies
  WHERE user_id = _user_id AND is_active = true
  LIMIT 1;
  
  RETURN _role;
END;
$$;

-- 6. Função para aceitar convite (usada pelo edge function)
CREATE OR REPLACE FUNCTION public.accept_employee_invite(
  _token TEXT,
  _user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _result JSON;
BEGIN
  -- Busca o convite válido
  SELECT * INTO _invite
  FROM employee_invites
  WHERE token = _token
    AND accepted_at IS NULL
    AND expires_at > now();
  
  IF _invite IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Convite inválido ou expirado');
  END IF;
  
  -- Atualiza o convite como aceito
  UPDATE employee_invites
  SET accepted_at = now()
  WHERE id = _invite.id;
  
  -- Vincula o user_id ao funcionário
  UPDATE employees
  SET user_id = _user_id
  WHERE id = _invite.employee_id;
  
  -- Cria o registro em user_companies
  INSERT INTO user_companies (user_id, company_id, role, is_active)
  VALUES (_user_id, _invite.company_id, _invite.role, true)
  ON CONFLICT (user_id, company_id) DO UPDATE
  SET role = _invite.role, is_active = true;
  
  RETURN json_build_object(
    'success', true, 
    'company_id', _invite.company_id,
    'employee_id', _invite.employee_id,
    'role', _invite.role
  );
END;
$$;

-- 7. Função para validar token de convite (pública, sem auth)
CREATE OR REPLACE FUNCTION public.validate_invite_token(_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _employee RECORD;
  _company RECORD;
BEGIN
  -- Busca o convite
  SELECT * INTO _invite
  FROM employee_invites
  WHERE token = _token
    AND accepted_at IS NULL
    AND expires_at > now();
  
  IF _invite IS NULL THEN
    RETURN json_build_object('valid', false, 'error', 'Convite inválido ou expirado');
  END IF;
  
  -- Busca dados do funcionário
  SELECT name, email INTO _employee
  FROM employees
  WHERE id = _invite.employee_id;
  
  -- Busca dados da empresa
  SELECT name INTO _company
  FROM companies
  WHERE id = _invite.company_id;
  
  RETURN json_build_object(
    'valid', true,
    'email', _invite.email,
    'employee_name', _employee.name,
    'company_name', _company.name,
    'role', _invite.role
  );
END;
$$;

-- 8. Inserir permissões padrão para cada empresa existente
-- Manager: pode ver e criar na maioria dos módulos
-- Employee: pode apenas ver alguns módulos

-- Função para criar permissões padrão para uma empresa
CREATE OR REPLACE FUNCTION public.create_default_permissions(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permissões do Manager
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (_company_id, 'manager', 'dashboard', true, false, false, false),
    (_company_id, 'manager', 'clientes', true, true, true, false),
    (_company_id, 'manager', 'orcamentos', true, true, true, false),
    (_company_id, 'manager', 'ordens-servico', true, true, true, false),
    (_company_id, 'manager', 'agenda', true, true, true, true),
    (_company_id, 'manager', 'medicoes', true, true, true, false),
    (_company_id, 'manager', 'plano-corte', true, true, true, false),
    (_company_id, 'manager', 'produtos', true, false, false, false),
    (_company_id, 'manager', 'precos', true, true, true, false),
    (_company_id, 'manager', 'estoque', true, true, true, false),
    (_company_id, 'manager', 'caixa-vendas', true, true, true, false),
    (_company_id, 'manager', 'financeiro', true, true, false, false),
    (_company_id, 'manager', 'notas-fiscais', true, true, false, false),
    (_company_id, 'manager', 'funcionarios', true, true, true, false),
    (_company_id, 'manager', 'configuracoes', true, false, false, false)
  ON CONFLICT (company_id, role, module) DO NOTHING;
  
  -- Permissões do Employee (mais restrito)
  INSERT INTO role_permissions (company_id, role, module, can_view, can_create, can_edit, can_delete)
  VALUES
    (_company_id, 'employee', 'dashboard', true, false, false, false),
    (_company_id, 'employee', 'clientes', true, true, false, false),
    (_company_id, 'employee', 'orcamentos', true, true, true, false),
    (_company_id, 'employee', 'ordens-servico', true, false, true, false),
    (_company_id, 'employee', 'agenda', true, false, false, false),
    (_company_id, 'employee', 'medicoes', true, true, true, false),
    (_company_id, 'employee', 'plano-corte', true, false, false, false),
    (_company_id, 'employee', 'produtos', true, false, false, false),
    (_company_id, 'employee', 'precos', true, false, false, false),
    (_company_id, 'employee', 'estoque', true, true, false, false),
    (_company_id, 'employee', 'caixa-vendas', true, true, false, false),
    (_company_id, 'employee', 'financeiro', false, false, false, false),
    (_company_id, 'employee', 'notas-fiscais', false, false, false, false),
    (_company_id, 'employee', 'funcionarios', false, false, false, false),
    (_company_id, 'employee', 'configuracoes', false, false, false, false)
  ON CONFLICT (company_id, role, module) DO NOTHING;
END;
$$;

-- Criar permissões padrão para todas as empresas existentes
DO $$
DECLARE
  _company RECORD;
BEGIN
  FOR _company IN SELECT id FROM companies LOOP
    PERFORM create_default_permissions(_company.id);
  END LOOP;
END;
$$;

-- Trigger para criar permissões padrão quando uma nova empresa é criada
CREATE OR REPLACE FUNCTION public.trigger_create_default_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_default_permissions(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_create_permissions ON public.companies;
CREATE TRIGGER on_company_created_create_permissions
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_permissions();