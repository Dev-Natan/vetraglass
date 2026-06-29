-- O serviço interno de storage precisa executar a função usada nas policies de storage.
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO supabase_storage_admin;
GRANT SELECT ON public.saas_admins TO supabase_storage_admin;

-- Mantém também as permissões auxiliares do helper usado por buckets com prefixo company_id.
GRANT EXECUTE ON FUNCTION public.user_belongs_to_company(uuid, uuid) TO supabase_storage_admin;
GRANT SELECT ON public.user_companies TO supabase_storage_admin;