-- Remover a constraint NOT NULL do campo cnpj para torná-lo opcional
ALTER TABLE public.companies ALTER COLUMN cnpj DROP NOT NULL;

-- Atualizar função RPC para aceitar CNPJ opcional e validar unicidade
CREATE OR REPLACE FUNCTION public.create_company_and_assign_admin(
  _name TEXT,
  _cnpj TEXT DEFAULT NULL,
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
  v_clean_cnpj TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Limpar CNPJ: se vazio ou apenas espaços, será NULL
  v_clean_cnpj := NULLIF(TRIM(_cnpj), '');
  
  -- Se CNPJ foi informado, verificar se já existe
  IF v_clean_cnpj IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.companies WHERE cnpj = v_clean_cnpj) THEN
      RAISE EXCEPTION 'CNPJ_JA_CADASTRADO';
    END IF;
  END IF;

  INSERT INTO public.companies (name, cnpj, phone, email, address)
  VALUES (
    _name,
    v_clean_cnpj,
    NULLIF(TRIM(_phone), ''),
    NULLIF(TRIM(_email), ''),
    NULLIF(TRIM(_address), '')
  )
  RETURNING * INTO v_company;

  INSERT INTO public.user_companies (user_id, company_id, role, is_active)
  VALUES (v_uid, v_company.id, 'admin', true)
  ON CONFLICT (user_id, company_id) DO UPDATE
    SET role = EXCLUDED.role, is_active = true;

  PERFORM create_default_permissions(v_company.id);
  
  RETURN v_company;
END;
$$;