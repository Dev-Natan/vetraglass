-- RPC to create a company and assign current user as admin
CREATE OR REPLACE FUNCTION public.create_company_and_assign_admin(
  _name TEXT,
  _cnpj TEXT,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL
)
RETURNS public.companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.companies;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.companies (name, cnpj, phone, email, address)
  VALUES (
    _name,
    _cnpj,
    NULLIF(_phone, ''),
    NULLIF(_email, ''),
    NULLIF(_address, '')
  )
  RETURNING * INTO v_company;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_uid, v_company.id, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true;

  RETURN v_company;
END;
$$;

-- Lock down execution
REVOKE ALL ON FUNCTION public.create_company_and_assign_admin(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_and_assign_admin(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;