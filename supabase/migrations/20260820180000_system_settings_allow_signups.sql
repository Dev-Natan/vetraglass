-- Migration: 20260820180000_system_settings_allow_signups.sql
-- Description: Cria tabela de configurações do sistema para controle administrativo de flags como allow_new_signups

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Política de leitura: qualquer usuário (inclusive anônimo na tela de auth) pode ler configurações públicas
DROP POLICY IF EXISTS "Public can view system settings" ON public.system_settings;
CREATE POLICY "Public can view system settings"
  ON public.system_settings
  FOR SELECT
  USING (true);

-- Política de escrita: apenas SaaS Admins podem alterar configurações
DROP POLICY IF EXISTS "SaaS admins can update system settings" ON public.system_settings;
CREATE POLICY "SaaS admins can update system settings"
  ON public.system_settings
  FOR ALL
  USING (public.is_saas_admin(auth.uid()))
  WITH CHECK (public.is_saas_admin(auth.uid()));

-- Inserir flag allow_new_signups com valor true por padrão
INSERT INTO public.system_settings (key, value, description)
VALUES ('allow_new_signups', 'true'::jsonb, 'Permitir novos cadastros de usuários e empresas no sistema')
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now();

-- Função helper para leitura segura
CREATE OR REPLACE FUNCTION public.get_system_setting(p_key TEXT)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT value FROM public.system_settings WHERE key = p_key LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_system_setting(TEXT) TO anon, authenticated, service_role;

-- Recarregar cache de schema do PostgREST/Supabase
NOTIFY pgrst, 'reload schema';
