BEGIN;

-- Fix overly permissive INSERT policy flagged by linter
DROP POLICY IF EXISTS "System can insert reminders" ON public.system_reminders;

CREATE POLICY "Service role can insert reminders"
ON public.system_reminders
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

COMMIT;