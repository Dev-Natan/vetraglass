CREATE OR REPLACE FUNCTION public.calculate_sale_commission(_sale_id uuid, _employee_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- NEW: Check commission trigger
  -- If trigger is 'payment' and sale is not paid, don't generate commission yet
  IF _employee.commission_trigger = 'payment' AND _sale.payment_status != 'paid' THEN
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
    sale_amount, commission_percent, commission_amount,
    status
  ) VALUES (
    _sale.company_id, _employee_id, _sale_id,
    _sale.total_amount, _employee.commission_percent, _commission_amount,
    'pending'
  )
  ON CONFLICT (employee_id, sale_id) DO UPDATE
    SET sale_amount = EXCLUDED.sale_amount,
        commission_percent = EXCLUDED.commission_percent,
        commission_amount = EXCLUDED.commission_amount,
        updated_at = now();
  
  RETURN _commission_amount;
END;
$function$;