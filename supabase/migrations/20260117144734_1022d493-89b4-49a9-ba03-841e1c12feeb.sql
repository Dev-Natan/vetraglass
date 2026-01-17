-- Add commission fields to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS commission_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_type text DEFAULT 'sales'; -- 'sales' = sobre vendas, 'profit' = sobre lucro

-- Add comment for documentation
COMMENT ON COLUMN public.employees.commission_enabled IS 'Whether this employee receives commission';
COMMENT ON COLUMN public.employees.commission_percent IS 'Commission percentage (e.g., 5 = 5%)';
COMMENT ON COLUMN public.employees.commission_type IS 'Type of commission: sales (on total sales) or profit (on profit margin)';

-- Create table to track employee commissions on sales
CREATE TABLE IF NOT EXISTS public.employee_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  sale_amount numeric NOT NULL DEFAULT 0,
  commission_percent numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'cancelled'
  paid_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(employee_id, sale_id)
);

-- Enable RLS
ALTER TABLE public.employee_commissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view commissions from their company"
  ON public.employee_commissions
  FOR SELECT
  USING (company_id IN (SELECT unnest(get_user_company_ids(auth.uid()))));

CREATE POLICY "Admins can insert commissions"
  ON public.employee_commissions
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

CREATE POLICY "Admins can update commissions"
  ON public.employee_commissions
  FOR UPDATE
  USING (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

CREATE POLICY "Admins can delete commissions"
  ON public.employee_commissions
  FOR DELETE
  USING (
    company_id IN (SELECT unnest(get_user_company_ids(auth.uid())))
    AND user_has_elevated_role_in_company(auth.uid(), company_id)
  );

-- Create trigger for updated_at
CREATE TRIGGER update_employee_commissions_updated_at
  BEFORE UPDATE ON public.employee_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate and register commission when a sale is made
CREATE OR REPLACE FUNCTION public.calculate_sale_commission(_sale_id uuid, _employee_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sale RECORD;
  _employee RECORD;
  _commission_amount numeric;
BEGIN
  -- Get sale data
  SELECT * INTO _sale FROM sales WHERE id = _sale_id;
  IF _sale IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get employee with commission settings
  SELECT * INTO _employee 
  FROM employees 
  WHERE id = _employee_id 
    AND company_id = _sale.company_id
    AND commission_enabled = true;
    
  IF _employee IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate commission based on type
  IF _employee.commission_type = 'sales' THEN
    _commission_amount := _sale.total_amount * (_employee.commission_percent / 100);
  ELSE
    -- For profit-based, would need cost data - default to sales for now
    _commission_amount := _sale.total_amount * (_employee.commission_percent / 100);
  END IF;
  
  -- Insert or update commission record
  INSERT INTO employee_commissions (
    company_id, employee_id, sale_id, 
    sale_amount, commission_percent, commission_amount
  ) VALUES (
    _sale.company_id, _employee_id, _sale_id,
    _sale.total_amount, _employee.commission_percent, _commission_amount
  )
  ON CONFLICT (employee_id, sale_id) DO UPDATE
    SET sale_amount = EXCLUDED.sale_amount,
        commission_percent = EXCLUDED.commission_percent,
        commission_amount = EXCLUDED.commission_amount,
        updated_at = now();
  
  RETURN _commission_amount;
END;
$$;