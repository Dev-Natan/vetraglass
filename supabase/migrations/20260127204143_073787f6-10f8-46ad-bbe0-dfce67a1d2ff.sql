
-- Fix: Remove date filter from get_user_open_cash_register
-- Cash register should be visible as long as status is 'open', regardless of opened_at date
CREATE OR REPLACE FUNCTION public.get_user_open_cash_register(_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  opened_by uuid,
  opened_at timestamptz,
  opening_amount numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.company_id,
    cr.opened_by,
    cr.opened_at,
    cr.opening_amount,
    cr.status
  FROM public.cash_registers cr
  WHERE cr.company_id = _company_id
    AND cr.opened_by = auth.uid()
    AND cr.status IN ('open', 'pending_audit')
  LIMIT 1;
END;
$$;
