-- Drop existing view if exists and recreate with proper security
DROP VIEW IF EXISTS public.clients_safe;

-- Create a secure view that hides sensitive fields for regular employees
-- Only shows: id, name, company_id, city, state, is_active, created_at
CREATE VIEW public.clients_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  company_id,
  name,
  city,
  state,
  is_active,
  notes,
  created_at,
  updated_at,
  -- Sensitive fields hidden with NULL for non-elevated roles
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN document 
    ELSE NULL 
  END as document,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN document_type 
    ELSE NULL 
  END as document_type,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN email 
    ELSE NULL 
  END as email,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN phone 
    ELSE NULL 
  END as phone,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN address 
    ELSE NULL 
  END as address,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN zip_code 
    ELSE NULL 
  END as zip_code,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN latitude 
    ELSE NULL 
  END as latitude,
  CASE 
    WHEN public.user_has_elevated_role_in_company(auth.uid(), company_id) 
    THEN longitude 
    ELSE NULL 
  END as longitude
FROM public.clients;

-- Grant access to the view for authenticated users
GRANT SELECT ON public.clients_safe TO authenticated;

-- Add comment explaining the view purpose
COMMENT ON VIEW public.clients_safe IS 'Secure view of clients table. Sensitive fields (document, email, phone, address) are only visible to admin/manager roles.';