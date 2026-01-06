-- Drop the existing insert policy
DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;

-- Create a proper policy that allows authenticated users to insert companies
CREATE POLICY "Authenticated users can create companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (true);