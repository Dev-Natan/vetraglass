-- Adicionar token único para cada empresa
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS login_token TEXT UNIQUE;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_companies_login_token 
ON public.companies(login_token);

-- Gerar tokens para empresas existentes (primeiras 5 letras do nome, sem vogais, maiúsculas)
UPDATE public.companies 
SET login_token = UPPER(
  LEFT(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g'),
      '[aeiouAEIOU]', '', 'g'
    ), 
    5
  )
) || SUBSTRING(id::TEXT, 1, 2)
WHERE login_token IS NULL;

-- Atualizar função de lookup para usar o novo formato simplificado
CREATE OR REPLACE FUNCTION public.get_employee_login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_internal_email TEXT;
BEGIN
  -- Find the employee by username (now stored as nome + TOKEN, ex: joaoVETRA)
  SELECT user_id, company_id INTO v_user_id, v_company_id
  FROM employees
  WHERE LOWER(username) = LOWER(p_username)
    AND is_active = true
    AND user_id IS NOT NULL
  LIMIT 1;
  
  -- If not found, return null (will fall back to direct email login for admins)
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Construct the internal email format: username@internal.vetra
  v_internal_email := LOWER(p_username) || '@internal.vetra';
  
  RETURN v_internal_email;
END;
$$;

-- Função para verificar se um username já existe (para evitar duplicatas)
CREATE OR REPLACE FUNCTION public.check_employee_username_exists(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM employees
    WHERE LOWER(username) = LOWER(p_username)
      AND user_id IS NOT NULL
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_employee_username_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_employee_username_exists(TEXT) TO authenticated;