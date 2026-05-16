
-- =====================================================
-- SECURITY FIX 1: Employee Commissions - restrict to own + elevated
-- Currently ALL company members can see ALL commissions
-- =====================================================

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view commissions from their company" ON public.employee_commissions;

-- Create two new policies: own commissions + elevated role
CREATE POLICY "Users can view own commissions"
ON public.employee_commissions
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Elevated can view all company commissions"
ON public.employee_commissions
FOR SELECT
USING (
  user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- =====================================================
-- SECURITY FIX 2: Notas Fiscais - remove duplicate permissive SELECT
-- There are TWO SELECT policies: one for elevated and one for ALL users
-- The "all users" policy makes the elevated-only one useless
-- =====================================================

DROP POLICY IF EXISTS "Users can view company notas fiscais" ON public.notas_fiscais;

-- Keep only "Elevated role can view invoices" which already exists

-- =====================================================
-- SECURITY FIX 3: Expenses - restrict to elevated roles only
-- Currently ALL company members can see ALL expenses
-- =====================================================

DROP POLICY IF EXISTS "Users can view expenses from their company" ON public.expenses;

CREATE POLICY "Elevated can view company expenses"
ON public.expenses
FOR SELECT
USING (
  user_has_elevated_role_in_company(auth.uid(), company_id)
);

-- Employees can view expenses they created
CREATE POLICY "Users can view own created expenses"
ON public.expenses
FOR SELECT
USING (
  created_by = auth.uid()
);

-- =====================================================
-- SECURITY FIX 4: Stock movements - restrict cost visibility
-- Add policy so only elevated roles see financial details
-- Regular users still need to see movements for production
-- We restrict via view instead, keeping RLS as-is for now
-- =====================================================

-- =====================================================
-- SECURITY FIX 5: Create employees_safe view if not exists
-- to mask sensitive compensation fields from non-admin users
-- =====================================================

CREATE OR REPLACE VIEW public.employees_safe 
WITH (security_invoker = on) AS
SELECT 
  id,
  company_id,
  name,
  email,
  phone,
  role,
  is_active,
  user_id,
  photo_url,
  username,
  permission_profile_id,
  created_at,
  updated_at,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id) 
      OR user_id = auth.uid()
    THEN commission_enabled
    ELSE NULL
  END AS commission_enabled,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
      OR user_id = auth.uid()
    THEN commission_percent
    ELSE NULL
  END AS commission_percent,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
      OR user_id = auth.uid()
    THEN commission_type
    ELSE NULL
  END AS commission_type,
  CASE
    WHEN user_has_elevated_role_in_company(auth.uid(), company_id)
      OR user_id = auth.uid()
    THEN hourly_rate
    ELSE NULL
  END AS hourly_rate
FROM public.employees
WHERE user_belongs_to_company(auth.uid(), company_id);
