-- Create function to check if user has manager or admin role in company
CREATE OR REPLACE FUNCTION public.user_has_elevated_role_in_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies
    WHERE user_id = _user_id
      AND company_id = _company_id
      AND is_active = true
      AND role IN ('admin', 'manager')
  )
$$;