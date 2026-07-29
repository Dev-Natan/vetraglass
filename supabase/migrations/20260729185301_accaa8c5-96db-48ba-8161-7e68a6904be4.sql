
CREATE OR REPLACE FUNCTION public.apply_vale_to_salary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense RECORD;
  v_new_paid numeric;
  v_month_start date;
  v_month_end date;
  v_ref_date date;
BEGIN
  IF NEW.type <> 'saida'
     OR NEW.category NOT IN ('vale_funcionario', 'vale', 'adiantamento')
     OR NEW.funcionario_id IS NULL
     OR COALESCE(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  v_ref_date := COALESCE(NEW.created_at::date, CURRENT_DATE);
  v_month_start := date_trunc('month', v_ref_date)::date;
  v_month_end := (date_trunc('month', v_ref_date) + interval '1 month - 1 day')::date;

  -- Localiza salário do mês vigente do funcionário
  SELECT * INTO v_expense
  FROM public.expenses
  WHERE company_id = NEW.company_id
    AND employee_id = NEW.funcionario_id
    AND status IN ('pending', 'overdue')
    AND due_date BETWEEN v_month_start AND v_month_end
  ORDER BY due_date ASC
  LIMIT 1;

  -- Se não achou no mês corrente, tenta o próximo salário em aberto
  IF v_expense.id IS NULL THEN
    SELECT * INTO v_expense
    FROM public.expenses
    WHERE company_id = NEW.company_id
      AND employee_id = NEW.funcionario_id
      AND status IN ('pending', 'overdue')
    ORDER BY due_date ASC
    LIMIT 1;
  END IF;

  IF v_expense.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_new_paid := COALESCE(v_expense.paid_amount, 0) + NEW.amount;

  IF v_new_paid >= v_expense.amount THEN
    UPDATE public.expenses
       SET paid_amount = v_expense.amount,
           status = 'paid',
           paid_date = CURRENT_DATE,
           paid_at = now(),
           updated_at = now()
     WHERE id = v_expense.id;
  ELSE
    UPDATE public.expenses
       SET paid_amount = v_new_paid,
           updated_at = now()
     WHERE id = v_expense.id;
  END IF;

  -- Vincula o movimento à despesa (sem sobrescrever se já veio setado)
  IF NEW.expense_id IS NULL THEN
    UPDATE public.cash_movements
       SET expense_id = v_expense.id
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_vale_to_salary ON public.cash_movements;
CREATE TRIGGER trg_apply_vale_to_salary
AFTER INSERT ON public.cash_movements
FOR EACH ROW
EXECUTE FUNCTION public.apply_vale_to_salary();
