-- Drop and recreate the clients_safe view with security_invoker option
DROP VIEW IF EXISTS public.clients_safe;

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
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN document
        ELSE NULL::text
    END AS document,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN document_type
        ELSE NULL::text
    END AS document_type,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN email
        ELSE NULL::text
    END AS email,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN phone
        ELSE NULL::text
    END AS phone,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN address
        ELSE NULL::text
    END AS address,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN zip_code
        ELSE NULL::text
    END AS zip_code,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN latitude
        ELSE NULL::numeric
    END AS latitude,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN longitude
        ELSE NULL::numeric
    END AS longitude
FROM public.clients
WHERE user_belongs_to_company(auth.uid(), company_id);

-- Grant access to authenticated users only
GRANT SELECT ON public.clients_safe TO authenticated;
REVOKE ALL ON public.clients_safe FROM anon;