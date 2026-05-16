-- ============================================================
-- COMPREHENSIVE SECURITY FIX MIGRATION
-- ============================================================

-- 1. Create a secure view for companies that hides sensitive fiscal data
-- Only admins can see certificate and full fiscal details
DROP VIEW IF EXISTS public.companies_safe;
CREATE VIEW public.companies_safe AS
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

-- Grant access to the view
GRANT SELECT ON public.companies_safe TO authenticated;

-- 2. Tighten login_attempts policies - only SaaS admins can view
-- The INSERT policy needs to use SECURITY DEFINER function since it's called before auth
DROP POLICY IF EXISTS "Allow insert own login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "SaaS admins can view login attempts" ON public.login_attempts;

-- Create a function to insert login attempts (called before user is authenticated)
CREATE OR REPLACE FUNCTION public.insert_login_attempt(
    _email text,
    _success boolean,
    _ip_address text DEFAULT NULL,
    _user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.login_attempts (email, success, ip_address, user_agent)
    VALUES (_email, _success, _ip_address, _user_agent);
    
    -- If login was successful, clean up old failed attempts
    IF _success THEN
        DELETE FROM public.login_attempts
        WHERE email = _email AND success = false;
    END IF;
END;
$$;

-- Revoke direct insert on login_attempts
REVOKE INSERT ON public.login_attempts FROM authenticated;
REVOKE INSERT ON public.login_attempts FROM anon;

-- Only SaaS admins can SELECT
CREATE POLICY "Only SaaS admins can view login attempts"
ON public.login_attempts FOR SELECT
USING (is_saas_admin(auth.uid()));

-- 3. Add comment explaining clients_safe view purpose
COMMENT ON VIEW public.clients_safe IS 
'Secure view that masks PII (document, email, phone, address) for non-admin/manager users. 
Use this view for general queries where full PII is not needed. 
Admin/Manager users see all fields, other users see masked sensitive data.';

-- 4. Add data retention - create function to clean old login attempts
CREATE OR REPLACE FUNCTION public.cleanup_login_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Remove login attempts older than 30 days
    DELETE FROM public.login_attempts
    WHERE created_at < (now() - interval '30 days');
END;
$$;