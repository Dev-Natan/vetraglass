-- =====================================================
-- SISTEMA DE PERFIS DE PERMISSÃO (PERMISSION PROFILES)
-- =====================================================

-- 1. Criar enum para os tipos de perfil
DO $$ BEGIN
    CREATE TYPE public.permission_profile_type AS ENUM (
        'admin',
        'gerente', 
        'vendedor',
        'caixa',
        'almoxarifado',
        'producao',
        'instalador',
        'financeiro',
        'custom'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Criar tabela de perfis de permissão
CREATE TABLE IF NOT EXISTS public.permission_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    profile_type public.permission_profile_type NOT NULL DEFAULT 'custom',
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- true = predefinido, não pode ser editado
    -- Permissões por módulo (JSONB flexível)
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Restrições especiais
    hide_prices BOOLEAN DEFAULT false, -- Oculta preços/valores
    hide_costs BOOLEAN DEFAULT false, -- Oculta custos
    can_operate_cash BOOLEAN DEFAULT false, -- Pode operar caixa próprio
    can_approve_discounts BOOLEAN DEFAULT false, -- Pode aprovar descontos
    can_approve_refunds BOOLEAN DEFAULT false, -- Pode aprovar devoluções
    can_cancel_sales BOOLEAN DEFAULT false, -- Pode cancelar vendas
    can_manage_stock BOOLEAN DEFAULT false, -- Pode gerenciar estoque
    can_view_reports BOOLEAN DEFAULT false, -- Pode ver relatórios
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Atualizar tabela employees para usar perfil
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS permission_profile_id UUID REFERENCES public.permission_profiles(id);

-- 4. Adicionar índices
CREATE INDEX IF NOT EXISTS idx_permission_profiles_company 
ON public.permission_profiles(company_id);

CREATE INDEX IF NOT EXISTS idx_permission_profiles_type 
ON public.permission_profiles(profile_type);

CREATE INDEX IF NOT EXISTS idx_employees_profile 
ON public.employees(permission_profile_id);

-- 5. RLS para permission_profiles
ALTER TABLE public.permission_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles of their company"
ON public.permission_profiles FOR SELECT
USING (
    company_id IN (
        SELECT uc.company_id FROM public.user_companies uc 
        WHERE uc.user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage profiles"
ON public.permission_profiles FOR ALL
USING (
    company_id IN (
        SELECT uc.company_id FROM public.user_companies uc 
        WHERE uc.user_id = auth.uid() AND uc.role = 'admin'
    )
);

-- 6. Função para criar perfis padrão para uma empresa
CREATE OR REPLACE FUNCTION public.create_default_permission_profiles(_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _admin_permissions JSONB;
    _gerente_permissions JSONB;
    _vendedor_permissions JSONB;
    _caixa_permissions JSONB;
    _almoxarifado_permissions JSONB;
    _producao_permissions JSONB;
    _instalador_permissions JSONB;
    _financeiro_permissions JSONB;
BEGIN
    -- Definir permissões completas por módulo
    _admin_permissions := '{
        "dashboard": {"view": true, "create": true, "edit": true, "delete": true},
        "clientes": {"view": true, "create": true, "edit": true, "delete": true},
        "orcamentos": {"view": true, "create": true, "edit": true, "delete": true},
        "ordens-servico": {"view": true, "create": true, "edit": true, "delete": true},
        "agenda": {"view": true, "create": true, "edit": true, "delete": true},
        "medicoes": {"view": true, "create": true, "edit": true, "delete": true},
        "plano-corte": {"view": true, "create": true, "edit": true, "delete": true},
        "produtos": {"view": true, "create": true, "edit": true, "delete": true},
        "precos": {"view": true, "create": true, "edit": true, "delete": true},
        "estoque": {"view": true, "create": true, "edit": true, "delete": true},
        "caixa-vendas": {"view": true, "create": true, "edit": true, "delete": true},
        "financeiro": {"view": true, "create": true, "edit": true, "delete": true},
        "notas-fiscais": {"view": true, "create": true, "edit": true, "delete": true},
        "funcionarios": {"view": true, "create": true, "edit": true, "delete": true},
        "configuracoes": {"view": true, "create": true, "edit": true, "delete": true}
    }'::jsonb;

    _gerente_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": true, "delete": false},
        "orcamentos": {"view": true, "create": true, "edit": true, "delete": true},
        "ordens-servico": {"view": true, "create": true, "edit": true, "delete": false},
        "agenda": {"view": true, "create": true, "edit": true, "delete": true},
        "medicoes": {"view": true, "create": true, "edit": true, "delete": true},
        "plano-corte": {"view": true, "create": true, "edit": true, "delete": true},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": true, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": true, "edit": true, "delete": false},
        "caixa-vendas": {"view": true, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": true, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": true, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": true, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _vendedor_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": true, "delete": false},
        "orcamentos": {"view": true, "create": true, "edit": true, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": false, "delete": false},
        "agenda": {"view": true, "create": true, "edit": true, "delete": false},
        "medicoes": {"view": true, "create": true, "edit": true, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": true, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": false, "edit": false, "delete": false},
        "caixa-vendas": {"view": true, "create": true, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _caixa_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": false, "delete": false},
        "orcamentos": {"view": false, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": false, "create": false, "edit": false, "delete": false},
        "agenda": {"view": false, "create": false, "edit": false, "delete": false},
        "medicoes": {"view": false, "create": false, "edit": false, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": true, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": false, "edit": false, "delete": false},
        "caixa-vendas": {"view": true, "create": true, "edit": true, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _almoxarifado_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": false, "create": false, "edit": false, "delete": false},
        "orcamentos": {"view": false, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": false, "delete": false},
        "agenda": {"view": false, "create": false, "edit": false, "delete": false},
        "medicoes": {"view": false, "create": false, "edit": false, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": false, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": true, "edit": true, "delete": false},
        "caixa-vendas": {"view": false, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _producao_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": false, "create": false, "edit": false, "delete": false},
        "orcamentos": {"view": false, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": true, "delete": false},
        "agenda": {"view": true, "create": false, "edit": false, "delete": false},
        "medicoes": {"view": false, "create": false, "edit": false, "delete": false},
        "plano-corte": {"view": true, "create": true, "edit": true, "delete": false},
        "produtos": {"view": true, "create": false, "edit": false, "delete": false},
        "precos": {"view": false, "create": false, "edit": false, "delete": false},
        "estoque": {"view": true, "create": false, "edit": true, "delete": false},
        "caixa-vendas": {"view": false, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _instalador_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": false, "edit": false, "delete": false},
        "orcamentos": {"view": false, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": true, "delete": false},
        "agenda": {"view": true, "create": false, "edit": true, "delete": false},
        "medicoes": {"view": true, "create": true, "edit": true, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": false, "create": false, "edit": false, "delete": false},
        "precos": {"view": false, "create": false, "edit": false, "delete": false},
        "estoque": {"view": false, "create": false, "edit": false, "delete": false},
        "caixa-vendas": {"view": false, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "notas-fiscais": {"view": false, "create": false, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    _financeiro_permissions := '{
        "dashboard": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": false, "edit": false, "delete": false},
        "orcamentos": {"view": true, "create": false, "edit": false, "delete": false},
        "ordens-servico": {"view": true, "create": false, "edit": false, "delete": false},
        "agenda": {"view": false, "create": false, "edit": false, "delete": false},
        "medicoes": {"view": false, "create": false, "edit": false, "delete": false},
        "plano-corte": {"view": false, "create": false, "edit": false, "delete": false},
        "produtos": {"view": false, "create": false, "edit": false, "delete": false},
        "precos": {"view": true, "create": false, "edit": false, "delete": false},
        "estoque": {"view": false, "create": false, "edit": false, "delete": false},
        "caixa-vendas": {"view": true, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": true, "create": true, "edit": true, "delete": false},
        "notas-fiscais": {"view": true, "create": true, "edit": false, "delete": false},
        "funcionarios": {"view": false, "create": false, "edit": false, "delete": false},
        "configuracoes": {"view": false, "create": false, "edit": false, "delete": false}
    }'::jsonb;

    -- Inserir perfis padrão
    INSERT INTO public.permission_profiles (company_id, name, profile_type, description, is_system, permissions, hide_prices, hide_costs, can_operate_cash, can_approve_discounts, can_approve_refunds, can_cancel_sales, can_manage_stock, can_view_reports)
    VALUES
        (_company_id, 'Administrador', 'admin', 'Acesso total ao sistema', true, _admin_permissions, false, false, true, true, true, true, true, true),
        (_company_id, 'Gerente', 'gerente', 'Visualiza tudo, aprova operações, não opera caixa diretamente', true, _gerente_permissions, false, false, false, true, true, true, true, true),
        (_company_id, 'Vendedor', 'vendedor', 'Orçamentos, vendas, clientes. Opera seu próprio caixa', true, _vendedor_permissions, false, false, true, false, false, false, false, false),
        (_company_id, 'Caixa', 'caixa', 'Opera vendas, recebimentos e fechamento de caixa próprio', true, _caixa_permissions, false, false, true, false, false, false, false, false),
        (_company_id, 'Almoxarifado', 'almoxarifado', 'Entrada/saída de material. NÃO vê valores financeiros', true, _almoxarifado_permissions, true, true, false, false, false, false, true, false),
        (_company_id, 'Produção', 'producao', 'Ordens de produção, consumo de materiais. NÃO vê preços', true, _producao_permissions, true, true, false, false, false, false, false, false),
        (_company_id, 'Instalador', 'instalador', 'Visualiza OS, marca conclusão, anexa fotos', true, _instalador_permissions, true, true, false, false, false, false, false, false),
        (_company_id, 'Financeiro', 'financeiro', 'Contas a pagar/receber, relatórios, fluxo de caixa', true, _financeiro_permissions, false, false, false, false, false, false, false, true)
    ON CONFLICT DO NOTHING;
END;
$$;

-- 7. Função para verificar se usuário pode ver preços
CREATE OR REPLACE FUNCTION public.user_can_see_prices(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _hide_prices BOOLEAN;
BEGIN
    -- Check if user is admin via user_companies
    IF EXISTS (
        SELECT 1 FROM user_companies 
        WHERE user_id = _user_id 
        AND company_id = _company_id 
        AND role = 'admin'
    ) THEN
        RETURN true;
    END IF;

    -- Check employee's permission profile
    SELECT pp.hide_prices INTO _hide_prices
    FROM employees e
    JOIN permission_profiles pp ON pp.id = e.permission_profile_id
    WHERE e.user_id = _user_id 
    AND e.company_id = _company_id
    AND e.is_active = true;

    -- If no profile found or hide_prices is false, allow
    RETURN COALESCE(_hide_prices, false) = false;
END;
$$;

-- 8. Função para verificar se usuário pode operar caixa
CREATE OR REPLACE FUNCTION public.user_can_operate_cash(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _can_operate BOOLEAN;
BEGIN
    -- Check if user is admin
    IF EXISTS (
        SELECT 1 FROM user_companies 
        WHERE user_id = _user_id 
        AND company_id = _company_id 
        AND role = 'admin'
    ) THEN
        RETURN true;
    END IF;

    -- Check employee's permission profile
    SELECT pp.can_operate_cash INTO _can_operate
    FROM employees e
    JOIN permission_profiles pp ON pp.id = e.permission_profile_id
    WHERE e.user_id = _user_id 
    AND e.company_id = _company_id
    AND e.is_active = true;

    RETURN COALESCE(_can_operate, false);
END;
$$;

-- 9. Função para obter permissões do usuário
CREATE OR REPLACE FUNCTION public.get_user_permission_profile(_user_id UUID, _company_id UUID)
RETURNS TABLE (
    profile_id UUID,
    profile_name TEXT,
    profile_type public.permission_profile_type,
    permissions JSONB,
    hide_prices BOOLEAN,
    hide_costs BOOLEAN,
    can_operate_cash BOOLEAN,
    can_approve_discounts BOOLEAN,
    can_cancel_sales BOOLEAN,
    can_manage_stock BOOLEAN,
    can_view_reports BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if admin first
    IF EXISTS (
        SELECT 1 FROM user_companies 
        WHERE user_id = _user_id 
        AND company_id = _company_id 
        AND role = 'admin'
    ) THEN
        RETURN QUERY
        SELECT 
            pp.id,
            pp.name,
            pp.profile_type,
            pp.permissions,
            pp.hide_prices,
            pp.hide_costs,
            pp.can_operate_cash,
            pp.can_approve_discounts,
            pp.can_cancel_sales,
            pp.can_manage_stock,
            pp.can_view_reports
        FROM permission_profiles pp
        WHERE pp.company_id = _company_id 
        AND pp.profile_type = 'admin'
        LIMIT 1;
        RETURN;
    END IF;

    -- Return employee's profile
    RETURN QUERY
    SELECT 
        pp.id,
        pp.name,
        pp.profile_type,
        pp.permissions,
        pp.hide_prices,
        pp.hide_costs,
        pp.can_operate_cash,
        pp.can_approve_discounts,
        pp.can_cancel_sales,
        pp.can_manage_stock,
        pp.can_view_reports
    FROM employees e
    JOIN permission_profiles pp ON pp.id = e.permission_profile_id
    WHERE e.user_id = _user_id 
    AND e.company_id = _company_id
    AND e.is_active = true
    LIMIT 1;
END;
$$;

-- 10. Trigger para criar perfis padrão quando empresa é criada
CREATE OR REPLACE FUNCTION public.trigger_create_default_profiles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.create_default_permission_profiles(NEW.id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_company_created_profiles ON public.companies;
CREATE TRIGGER on_company_created_profiles
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_create_default_profiles();