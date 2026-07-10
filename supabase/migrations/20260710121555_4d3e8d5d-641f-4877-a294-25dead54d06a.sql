ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS admission_date DATE,
  ADD COLUMN IF NOT EXISTS salary_payment_day SMALLINT CHECK (salary_payment_day BETWEEN 1 AND 31);