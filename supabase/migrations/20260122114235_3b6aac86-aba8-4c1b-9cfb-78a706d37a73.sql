-- Function to get internal email for login (bypasses RLS securely)
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
  -- Find the employee by username
  SELECT user_id, company_id INTO v_user_id, v_company_id
  FROM employees
  WHERE username = LOWER(p_username)
    AND is_active = true
    AND user_id IS NOT NULL
  LIMIT 1;
  
  -- If not found, return null (will fall back to direct email login)
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Construct the internal email format
  v_internal_email := LOWER(p_username) || '@' || v_company_id::TEXT || '.internal';
  
  RETURN v_internal_email;
END;
$$;

-- Grant execute to anon (needed for login)
GRANT EXECUTE ON FUNCTION public.get_employee_login_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_login_email(TEXT) TO authenticated;