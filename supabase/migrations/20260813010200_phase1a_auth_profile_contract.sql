-- VetraGlass Phase 1A: make the auth.users -> profiles contract deterministic.
-- Existing orphan profiles are intentionally preserved for later reconciliation.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
      NULLIF(btrim(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
      'Usuário'
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
      AND c.conkey = ARRAY[
        (SELECT a.attnum::smallint
         FROM pg_attribute AS a
         WHERE a.attrelid = 'public.profiles'::regclass
           AND a.attname = 'user_id')
      ]::smallint[]
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_auth_users_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users (id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_user_id_auth_users_fkey'
  ) THEN
    COMMENT ON CONSTRAINT profiles_user_id_auth_users_fkey ON public.profiles IS
      'NOT VALID until the five pre-existing orphan profiles identified in Phase 0 are reconciled.';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
      AND tgname = 'on_auth_user_created'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;
