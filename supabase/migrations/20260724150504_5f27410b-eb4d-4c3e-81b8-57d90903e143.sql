
ALTER TABLE public.company_cash ADD COLUMN IF NOT EXISTS fixed_fund numeric NOT NULL DEFAULT 0;

ALTER TABLE public.company_cash_movements ADD COLUMN IF NOT EXISTS balance_after numeric;
ALTER TABLE public.cash_movements ADD COLUMN IF NOT EXISTS balance_after numeric;

ALTER TABLE public.cash_registers
  ADD COLUMN IF NOT EXISTS excess_collected numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS difference numeric GENERATED ALWAYS AS (COALESCE(closing_amount,0) - COALESCE(expected_amount,0)) STORED;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS paid_amount numeric,
  ADD COLUMN IF NOT EXISTS document_number text;
-- adicionar alias parent_payable_id via view? preferir renomear/adicionar coluna real
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS parent_payable_id uuid REFERENCES public.expenses(id) ON DELETE SET NULL;
UPDATE public.expenses SET parent_payable_id = parent_expense_id WHERE parent_payable_id IS NULL AND parent_expense_id IS NOT NULL;

ALTER TABLE public.employee_commissions ADD COLUMN IF NOT EXISTS sale_amount numeric;
UPDATE public.employee_commissions SET sale_amount = base_amount WHERE sale_amount IS NULL;

ALTER TABLE public.company_products
  ADD COLUMN IF NOT EXISTS leaves_count integer,
  ADD COLUMN IF NOT EXISTS glasses_count integer,
  ADD COLUMN IF NOT EXISTS panels_count integer,
  ADD COLUMN IF NOT EXISTS sides_count integer;

ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS default_leaves_count integer,
  ADD COLUMN IF NOT EXISTS default_glasses_count integer,
  ADD COLUMN IF NOT EXISTS default_panels_count integer,
  ADD COLUMN IF NOT EXISTS default_sides_count integer;

ALTER TABLE public.quote_deposits ADD COLUMN IF NOT EXISTS customer_phone text;
