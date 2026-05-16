
-- Fix overly permissive policy for companies INSERT
-- The current policy allows any authenticated user to create a company, which is correct
-- but we should ensure they can only create companies through the proper function

-- Drop the current permissive policy
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

-- Create a new policy that only allows inserts through the security definer function
-- Since create_company_and_assign_admin is SECURITY DEFINER, it bypasses RLS
-- Regular users should not be able to insert directly
CREATE POLICY "No direct inserts to companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (false);

-- Note: Company creation happens through create_company_and_assign_admin function
-- which is SECURITY DEFINER and bypasses RLS
