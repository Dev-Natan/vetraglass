-- Fix SECURITY DEFINER view issue by using SECURITY INVOKER (default)
-- Drop and recreate views with proper security

-- 1. Recreate companies_safe with SECURITY INVOKER (which is the default)
DROP VIEW IF EXISTS public.companies_safe;
CREATE VIEW public.companies_safe 
WITH (security_invoker = true)
AS
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
    created_at,
    updated_at,
    -- Sensitive fields only visible to admins
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN inscricao_estadual ELSE NULL END AS inscricao_estadual,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN inscricao_municipal ELSE NULL END AS inscricao_municipal,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN regime_tributario ELSE NULL END AS regime_tributario,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN ambiente_fiscal ELSE NULL END AS ambiente_fiscal,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN codigo_municipio_ibge ELSE NULL END AS codigo_municipio_ibge,
    -- Certificate data - admin only
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_url ELSE NULL END AS certificado_digital_url,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_nome ELSE NULL END AS certificado_digital_nome,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_digital_validade ELSE NULL END AS certificado_digital_validade,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_status ELSE NULL END AS certificado_status,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_cnpj ELSE NULL END AS certificado_cnpj,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_emissor ELSE NULL END AS certificado_emissor,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_serial ELSE NULL END AS certificado_serial,
    CASE WHEN user_has_role_in_company(auth.uid(), id, 'admin') 
         THEN certificado_ultima_verificacao ELSE NULL END AS certificado_ultima_verificacao
FROM public.companies
WHERE user_belongs_to_company(auth.uid(), id) OR is_saas_admin(auth.uid());

GRANT SELECT ON public.companies_safe TO authenticated;

COMMENT ON VIEW public.companies_safe IS 
'Secure view for companies that masks sensitive fiscal data (certificates, tax IDs) for non-admin users. Uses SECURITY INVOKER to respect RLS policies of the querying user.';

-- 2. Recreate clients_safe with SECURITY INVOKER
DROP VIEW IF EXISTS public.clients_safe;
CREATE VIEW public.clients_safe
WITH (security_invoker = true)
AS
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
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN document ELSE NULL END AS document,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN document_type ELSE NULL END AS document_type,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN email ELSE NULL END AS email,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN phone ELSE NULL END AS phone,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN address ELSE NULL END AS address,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN zip_code ELSE NULL END AS zip_code,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN latitude ELSE NULL END AS latitude,
    CASE WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
         THEN longitude ELSE NULL END AS longitude
FROM public.clients
WHERE user_belongs_to_company(auth.uid(), company_id);

GRANT SELECT ON public.clients_safe TO authenticated;

COMMENT ON VIEW public.clients_safe IS 
'Secure view that masks PII (document, email, phone, address) for non-admin/manager users. Uses SECURITY INVOKER to respect RLS policies of the querying user.';