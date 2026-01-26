-- Create table for global module control (SaaS admin manages this)
CREATE TABLE public.system_module_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key text UNIQUE NOT NULL,
  module_name text NOT NULL,
  description text,
  icon text,
  is_enabled boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_module_settings ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read module settings (needed for sidebar rendering)
CREATE POLICY "Anyone can read module settings"
ON public.system_module_settings
FOR SELECT
TO authenticated
USING (true);

-- SaaS admins can manage (using profiles table - checked via metadata or dedicated admin check)
-- For now, allow only service_role to modify (admin panel uses service role or we add a separate admin table)
CREATE POLICY "Service role can manage module settings"
ON public.system_module_settings
FOR ALL
TO service_role
USING (true);

-- Insert all current modules with their default state
INSERT INTO public.system_module_settings (module_key, module_name, description, icon, is_enabled, sort_order) VALUES
  ('dashboard', 'Dashboard', 'Visão geral do sistema', 'LayoutDashboard', true, 1),
  ('clientes', 'Clientes', 'Gestão de clientes', 'Users', true, 2),
  ('orcamentos', 'Orçamentos', 'Criação e gestão de orçamentos', 'FileText', true, 3),
  ('ordens-servico', 'Ordens de Serviço', 'Acompanhamento de OS', 'ClipboardList', true, 4),
  ('agenda', 'Agenda', 'Agendamentos e compromissos', 'Calendar', true, 5),
  ('medicoes', 'Medições', 'Registro de medições', 'Ruler', true, 6),
  ('plano-corte', 'Plano de Corte', 'Otimização de corte', 'Scissors', true, 7),
  ('produtos', 'Produtos', 'Catálogo de produtos', 'Package', true, 8),
  ('precos', 'Preços', 'Gestão de preços', 'DollarSign', true, 9),
  ('estoque', 'Estoque', 'Controle de estoque', 'Boxes', true, 10),
  ('pedidos-compra', 'Pedidos de Compra', 'Gestão de compras', 'ShoppingCart', true, 11),
  ('caixa-vendas', 'Caixa e Vendas', 'PDV e controle de caixa', 'ShoppingBag', true, 12),
  ('financeiro', 'Financeiro', 'Gestão financeira', 'Wallet', true, 13),
  ('notas-fiscais', 'Notas Fiscais', 'Emissão de NF-e', 'Receipt', true, 14),
  ('funcionarios', 'Funcionários', 'Gestão de equipe', 'UserCog', true, 15),
  ('relatorios', 'Relatórios', 'Relatórios gerenciais', 'BarChart3', true, 16),
  ('configuracoes', 'Configurações', 'Configurações do sistema', 'Settings', true, 17);

-- Create function to check if module is enabled
CREATE OR REPLACE FUNCTION public.is_module_enabled(_module_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_enabled FROM public.system_module_settings WHERE module_key = _module_key),
    true
  );
$$;