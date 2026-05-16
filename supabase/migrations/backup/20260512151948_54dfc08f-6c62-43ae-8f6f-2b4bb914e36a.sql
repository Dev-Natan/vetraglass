CREATE OR REPLACE FUNCTION public.trigger_calculate_commission_on_paid()
RETURNS TRIGGER AS $$
DECLARE
  _employee RECORD;
BEGIN
  -- Se o status mudou para 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    -- Tenta encontrar o vendedor da venda
    -- Assume-se que o vendedor está no campo sold_by ou similar
    -- Se não houver campo específico, podemos tentar buscar quem criou a venda ou o funcionário vinculado
    
    -- Como a função calculate_sale_commission pede _employee_id, precisamos saber quem é o funcionário
    -- Se o user_id da venda tiver um funcionário vinculado, usamos ele.
    
    FOR _employee IN SELECT id FROM employees WHERE user_id = NEW.sold_by AND company_id = NEW.company_id AND commission_enabled = true LOOP
        PERFORM public.calculate_sale_commission(NEW.id, _employee.id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_sale_paid_calculate_commission
AFTER UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.trigger_calculate_commission_on_paid();