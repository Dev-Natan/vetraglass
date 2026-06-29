INSERT INTO public.saas_admins (user_id)
SELECT id FROM auth.users WHERE email = 'natan-sn@hotmail.com'
ON CONFLICT (user_id) DO NOTHING;