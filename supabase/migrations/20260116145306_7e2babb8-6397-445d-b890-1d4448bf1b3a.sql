-- Drop and recreate companies_safe view with security_invoker
DROP VIEW IF EXISTS public.companies_safe;

CREATE VIEW public.companies_safe
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  cnpj,
  phone,
  email,
  address,
  logo_url,
  logo_size,
  modo_fiscal_ativo,
  regime_tributario,
  codigo_municipio_ibge,
  created_at,
  updated_at
FROM public.companies;

-- Grant access to authenticated users (RLS from companies table will be inherited)
GRANT SELECT ON public.companies_safe TO authenticated;

COMMENT ON VIEW public.companies_safe IS 'Secure view of companies table. Inherits RLS from base table via security_invoker. Excludes certificate-related sensitive fields.';