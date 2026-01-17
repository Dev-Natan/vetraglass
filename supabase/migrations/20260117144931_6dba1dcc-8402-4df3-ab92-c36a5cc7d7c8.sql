-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'funcionarios', 'aluguel', 'energia', 'agua', 'internet', 'outros'
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'overdue', 'cancelled'
  payment_method TEXT,
  recurrence TEXT DEFAULT 'none', -- 'none', 'monthly', 'weekly', 'yearly'
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL, -- for employee-related expenses
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view expenses from their company"
  ON public.expenses
  FOR SELECT
  USING (company_id IN (SELECT unnest(get_user_company_ids(auth.uid()))));

CREATE POLICY "Users with elevated role can insert expenses"
  ON public.expenses
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

CREATE POLICY "Users with elevated role can update expenses"
  ON public.expenses
  FOR UPDATE
  USING (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

CREATE POLICY "Users with elevated role can delete expenses"
  ON public.expenses
  FOR DELETE
  USING (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

-- Create trigger for updated_at
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for better query performance
CREATE INDEX idx_expenses_company_id ON public.expenses(company_id);
CREATE INDEX idx_expenses_category ON public.expenses(category);
CREATE INDEX idx_expenses_status ON public.expenses(status);
CREATE INDEX idx_expenses_due_date ON public.expenses(due_date);