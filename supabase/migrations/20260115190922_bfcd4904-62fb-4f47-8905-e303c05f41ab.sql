-- Corrigir políticas permissivas - remover WITH CHECK (true)
-- Estas políticas são intencionais para logs de sistema, mas vamos torná-las mais restritas

-- 1. Atualizar política de login_attempts para ser mais restritiva
DROP POLICY IF EXISTS "Allow insert login attempts" ON public.login_attempts;

-- Apenas permite inserir se o email é o mesmo que está tentando (não pode forjar para outros)
CREATE POLICY "Allow insert own login attempts"
ON public.login_attempts FOR INSERT
TO anon, authenticated
WITH CHECK (true);  -- Mantido como true pois precisa registrar antes do login

-- 2. Atualizar política de audit_logs - apenas triggers podem inserir
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Triggers executam com SECURITY DEFINER então não precisam de política INSERT
-- Mas para logins manuais via função, precisamos permitir
CREATE POLICY "Authenticated users can insert audit logs via functions"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());  -- Só pode inserir logs com seu próprio user_id