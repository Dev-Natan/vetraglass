
-- 1. Create a security definer function to check if users share a company
CREATE OR REPLACE FUNCTION public.users_share_active_company(_viewer_id uuid, _target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies viewer_uc
    JOIN public.user_companies target_uc ON viewer_uc.company_id = target_uc.company_id
    WHERE viewer_uc.user_id = _viewer_id
      AND viewer_uc.is_active = true
      AND target_uc.user_id = _target_id
      AND target_uc.is_active = true
  )
$$;

-- 2. Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view own profile and active company colleagues" ON public.profiles;

-- 3. Create a more restrictive SELECT policy using the security definer function
CREATE POLICY "Users can only view own profile and active colleagues"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR public.users_share_active_company(auth.uid(), user_id)
);

-- 4. Create a safe view that limits exposed data (optional extra layer)
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = on)
AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;

-- 5. Grant access to the view
GRANT SELECT ON public.profiles_safe TO authenticated;
