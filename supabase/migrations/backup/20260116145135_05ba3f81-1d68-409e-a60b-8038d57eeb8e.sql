-- Drop the flawed policy that allows cross-company viewing
DROP POLICY IF EXISTS "Users can view own profile and company colleagues" ON public.profiles;

-- Drop duplicate policy if exists
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a corrected policy that properly restricts access
-- Users can only see: their own profile OR profiles of colleagues in companies where BOTH are active members
CREATE POLICY "Users can view own profile and active company colleagues"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can always view their own profile
  user_id = auth.uid()
  OR
  -- User can view colleagues only if they share an active membership in the same company
  EXISTS (
    SELECT 1 
    FROM public.user_companies viewer_uc
    INNER JOIN public.user_companies target_uc 
      ON viewer_uc.company_id = target_uc.company_id
    WHERE viewer_uc.user_id = auth.uid()
      AND viewer_uc.is_active = true
      AND target_uc.user_id = profiles.user_id
      AND target_uc.is_active = true
  )
);