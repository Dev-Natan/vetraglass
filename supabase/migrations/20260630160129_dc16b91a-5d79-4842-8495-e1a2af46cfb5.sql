REVOKE EXECUTE ON FUNCTION public.is_saas_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_saas_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO supabase_storage_admin;