-- Add fields to track recurring expense relationships
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS parent_expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS recurrence_day INTEGER,
ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN DEFAULT false;

-- Create index for faster parent lookups
CREATE INDEX IF NOT EXISTS idx_expenses_parent_id ON public.expenses(parent_expense_id);

-- Create function to generate next recurring expense
CREATE OR REPLACE FUNCTION public.generate_next_recurring_expense(expense_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense RECORD;
  v_next_due_date DATE;
  v_new_expense_id UUID;
BEGIN
  -- Get the expense
  SELECT * INTO v_expense FROM expenses WHERE id = expense_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;
  
  -- Only generate for recurring expenses
  IF v_expense.recurrence = 'none' OR v_expense.recurrence IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Calculate next due date based on recurrence type
  IF v_expense.due_date IS NULL THEN
    v_next_due_date := CURRENT_DATE;
  ELSE
    CASE v_expense.recurrence
      WHEN 'weekly' THEN
        v_next_due_date := v_expense.due_date + INTERVAL '1 week';
      WHEN 'monthly' THEN
        -- Maintain the same day of month
        v_next_due_date := v_expense.due_date + INTERVAL '1 month';
      WHEN 'yearly' THEN
        v_next_due_date := v_expense.due_date + INTERVAL '1 year';
      ELSE
        RETURN NULL;
    END CASE;
  END IF;
  
  -- Check if next expense already exists
  SELECT id INTO v_new_expense_id 
  FROM expenses 
  WHERE parent_expense_id = expense_id 
    AND due_date = v_next_due_date 
    AND status = 'pending';
  
  IF FOUND THEN
    RETURN v_new_expense_id;
  END IF;
  
  -- Create next recurring expense
  INSERT INTO expenses (
    company_id,
    category,
    description,
    amount,
    due_date,
    status,
    recurrence,
    recurrence_day,
    employee_id,
    notes,
    created_by,
    parent_expense_id,
    is_auto_generated
  ) VALUES (
    v_expense.company_id,
    v_expense.category,
    v_expense.description,
    v_expense.amount,
    v_next_due_date,
    'pending',
    v_expense.recurrence,
    EXTRACT(DAY FROM v_next_due_date)::INTEGER,
    v_expense.employee_id,
    v_expense.notes,
    v_expense.created_by,
    expense_id,
    true
  ) RETURNING id INTO v_new_expense_id;
  
  RETURN v_new_expense_id;
END;
$$;

-- Add more expense categories
COMMENT ON TABLE public.expenses IS 'Categories: funcionarios, aluguel, condominio, energia, agua, internet, emprestimo, financiamento, impostos, manutencao, materiais, outros';