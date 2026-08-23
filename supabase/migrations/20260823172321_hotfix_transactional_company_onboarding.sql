-- HOTFIX: make first-company onboarding atomic, secure, and idempotent.
-- The RPC is the only writer for the mandatory company bootstrap records.

CREATE OR REPLACE FUNCTION public.create_company_and_assign_admin(
  _name text,
  _cnpj text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _address text DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_company public.companies;
  v_clean_cnpj text := regexp_replace(COALESCE(_cnpj, ''), '\D', '', 'g');
  v_trial_ends_at timestamptz;
  v_constraint_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'AUTHENTICATION_REQUIRED';
  END IF;

  IF NULLIF(btrim(COALESCE(_name, '')), '') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'COMPANY_NAME_REQUIRED';
  END IF;

  IF length(v_clean_cnpj) <> 14 THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'CNPJ_INVALIDO';
  END IF;

  -- Serializes concurrent submissions for the same CNPJ without a persistent lock row.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('company-onboarding:' || v_clean_cnpj, 0)
  );

  SELECT c.*
    INTO v_company
  FROM public.companies AS c
  WHERE c.cnpj = v_clean_cnpj
  FOR UPDATE;

  IF FOUND THEN
    -- A replay by the original company admin repairs only missing bootstrap rows.
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_companies AS uc
      WHERE uc.company_id = v_company.id
        AND uc.user_id = v_uid
        AND uc.role = 'admin'
        AND uc.is_active
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'CNPJ_JA_CADASTRADO',
        CONSTRAINT = 'companies_cnpj_key';
    END IF;

    IF v_company.trial_ends_at IS NULL THEN
      UPDATE public.companies
      SET trial_ends_at = COALESCE(v_company.created_at, pg_catalog.now()) + interval '14 days'
      WHERE id = v_company.id
      RETURNING * INTO v_company;
    END IF;

    INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
    VALUES (v_company.id, 0, 500)
    ON CONFLICT (company_id) DO NOTHING;

    INSERT INTO public.company_subscriptions (
      company_id,
      plan_name,
      plan_price,
      status,
      started_at,
      expires_at,
      notes
    )
    VALUES (
      v_company.id,
      'trial',
      0,
      'trial',
      COALESCE(v_company.created_at, pg_catalog.now()),
      v_company.trial_ends_at,
      'Teste grátis de 14 dias concedido no cadastro'
    )
    ON CONFLICT (company_id) DO NOTHING;

    RETURN v_company;
  END IF;

  v_trial_ends_at := pg_catalog.now() + interval '14 days';

  INSERT INTO public.companies (
    name,
    cnpj,
    phone,
    email,
    address,
    subscription_status,
    trial_ends_at
  )
  VALUES (
    btrim(_name),
    v_clean_cnpj,
    NULLIF(btrim(COALESCE(_phone, '')), ''),
    NULLIF(btrim(COALESCE(_email, '')), ''),
    NULLIF(btrim(COALESCE(_address, '')), ''),
    'trialing',
    v_trial_ends_at
  )
  RETURNING * INTO v_company;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_uid, v_company.id, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE
  SET role = 'admin', is_active = true;

  INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
  VALUES (v_company.id, 0, 500)
  ON CONFLICT (company_id) DO NOTHING;

  INSERT INTO public.company_subscriptions (
    company_id,
    plan_name,
    plan_price,
    status,
    started_at,
    expires_at,
    notes
  )
  VALUES (
    v_company.id,
    'trial',
    0,
    'trial',
    pg_catalog.now(),
    v_trial_ends_at,
    'Teste grátis de 14 dias concedido no cadastro'
  )
  ON CONFLICT (company_id) DO NOTHING;

  -- Existing company trigger also calls this; the function is idempotent.
  PERFORM public.create_default_permissions(v_company.id);

  RETURN v_company;
EXCEPTION
  WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name = 'companies_cnpj_key' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'CNPJ_JA_CADASTRADO',
        CONSTRAINT = v_constraint_name;
    END IF;
    RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_company_and_assign_admin(text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_company_and_assign_admin(text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_company_and_assign_admin(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_and_assign_admin(text, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.create_company_and_assign_admin(text, text, text, text, text)
IS 'Atomically and idempotently creates a company, its admin membership, cash bootstrap, and 14-day trial subscription.';
