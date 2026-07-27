
-- 1) Rotate master admin password to a random value (not stored in migration text)
DO $$
DECLARE v_pwd text := encode(gen_random_bytes(24), 'base64');
BEGIN
  UPDATE auth.users
     SET encrypted_password = crypt(v_pwd, gen_salt('bf')),
         updated_at = now()
   WHERE email = 'natanjk7@gmail.com';
END $$;

-- 2) Restrict catalog SELECT policies from public -> authenticated
DROP POLICY IF EXISTS "admin_glass_colors read" ON public.admin_glass_colors;
CREATE POLICY "admin_glass_colors read" ON public.admin_glass_colors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_glass_thicknesses read" ON public.admin_glass_thicknesses;
CREATE POLICY "admin_glass_thicknesses read" ON public.admin_glass_thicknesses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "glass_types read" ON public.glass_types;
CREATE POLICY "glass_types read" ON public.glass_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "item_types read" ON public.item_types;
CREATE POLICY "item_types read" ON public.item_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "muni_read_all" ON public.municipios_ibge;
CREATE POLICY "muni_read_all" ON public.municipios_ibge FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "product_categories read" ON public.product_categories;
CREATE POLICY "product_categories read" ON public.product_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "product_linhas read" ON public.product_linhas;
CREATE POLICY "product_linhas read" ON public.product_linhas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sms read" ON public.system_module_settings;
CREATE POLICY "sms read" ON public.system_module_settings FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.admin_glass_colors, public.admin_glass_thicknesses, public.glass_types,
                 public.item_types, public.municipios_ibge, public.product_categories,
                 public.product_linhas, public.system_module_settings FROM anon;

-- 3) Harden login_attempts: no direct INSERT from anon/authenticated; only via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "login_attempts_insert_all" ON public.login_attempts;
REVOKE INSERT ON public.login_attempts FROM anon, authenticated;
-- record_login_attempt is SECURITY DEFINER; ensure anon/authenticated can call it
GRANT EXECUTE ON FUNCTION public.record_login_attempt(text, boolean, text, text) TO anon, authenticated;
