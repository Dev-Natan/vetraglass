
DO $$
DECLARE v_company uuid := '14a346d9-dc3d-4d14-865d-58bc5d5f62bf';
BEGIN
  DELETE FROM public.cash_register_advances WHERE company_id = v_company;
  DELETE FROM public.cash_movements WHERE company_id = v_company;
  DELETE FROM public.cash_registers WHERE company_id = v_company;
  DELETE FROM public.company_cash_movements WHERE company_id = v_company;
  DELETE FROM public.accounts_receivable WHERE company_id = v_company;
  DELETE FROM public.expenses WHERE company_id = v_company;

  UPDATE public.company_cash
     SET current_balance = 0, updated_at = now()
   WHERE company_id = v_company;
END $$;
