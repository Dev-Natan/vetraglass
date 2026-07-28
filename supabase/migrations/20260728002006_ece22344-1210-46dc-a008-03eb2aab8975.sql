
DROP POLICY IF EXISTS company_cash_access ON public.company_cash;

-- Leitura para membros da empresa
CREATE POLICY company_cash_select ON public.company_cash
FOR SELECT TO authenticated
USING (public.user_belongs_to_company(auth.uid(), company_id));

-- Nenhuma policy de INSERT/UPDATE/DELETE: mutações só via SECURITY DEFINER
-- (open_daily_cash, close_cash_register_direct, register_company_cash_movement, initialize_company_cash)
