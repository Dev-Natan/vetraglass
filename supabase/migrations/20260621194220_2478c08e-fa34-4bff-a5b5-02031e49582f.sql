
-- 1) Fix Security Definer View
ALTER VIEW public.quote_financial_status SET (security_invoker = on);

-- 2) Revoke anon execute on all SECURITY DEFINER functions in public, then re-grant a minimal pre-login allowlist.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated, service_role', r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Re-grant to anon only the pre-login functions
GRANT EXECUTE ON FUNCTION public.accept_employee_invite(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.check_employee_username_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_login_rate_limit(text, integer, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_login_email(text) TO anon;
GRANT EXECUTE ON FUNCTION public.insert_login_attempt(text, boolean, text, text) TO anon;
