
-- Função para listar SaaS Admins com email
CREATE OR REPLACE FUNCTION public.list_saas_admins()
RETURNS TABLE (user_id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas SaaS Admins podem listar administradores';
  END IF;

  RETURN QUERY
  SELECT sa.user_id, u.email::text, sa.created_at
  FROM public.saas_admins sa
  JOIN auth.users u ON u.id = sa.user_id
  ORDER BY sa.created_at ASC;
END;
$$;

-- Concede acesso de SaaS Admin para um email existente
CREATE OR REPLACE FUNCTION public.grant_saas_admin(_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas SaaS Admins podem conceder acesso';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com email % não encontrado. Peça para a pessoa criar uma conta primeiro.', _email;
  END IF;

  INSERT INTO public.saas_admins (user_id) VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_user_id;
END;
$$;

-- Revoga acesso de SaaS Admin com proteção da conta mestra
CREATE OR REPLACE FUNCTION public.revoke_saas_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_remaining int;
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas SaaS Admins podem revogar acesso';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = _user_id;

  IF lower(coalesce(v_email, '')) = 'natanjk7@gmail.com' THEN
    RAISE EXCEPTION 'A conta mestra natanjk7@gmail.com não pode ser removida';
  END IF;

  SELECT count(*) INTO v_remaining FROM public.saas_admins WHERE user_id <> _user_id;
  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'Não é possível remover o último SaaS Admin';
  END IF;

  DELETE FROM public.saas_admins WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_saas_admins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_saas_admin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_saas_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_saas_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_saas_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_saas_admin(uuid) TO authenticated;
