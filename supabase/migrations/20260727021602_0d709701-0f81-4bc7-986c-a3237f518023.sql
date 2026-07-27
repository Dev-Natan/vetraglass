
CREATE OR REPLACE FUNCTION public.revoke_saas_admin(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_email text;
  v_remaining int;
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Protect the designated master SaaS admin account
  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;
  IF lower(coalesce(v_email, '')) = 'natanjk7@gmail.com' THEN
    RETURN jsonb_build_object('success', false, 'error', 'master_admin_protected');
  END IF;

  -- Do not allow removing the last remaining SaaS admin
  SELECT COUNT(*) INTO v_remaining FROM public.saas_admins WHERE user_id <> _user_id;
  IF v_remaining < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_remove_last_admin');
  END IF;

  DELETE FROM public.saas_admins WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'saas_admin';
  RETURN jsonb_build_object('success', true);
END $function$;
