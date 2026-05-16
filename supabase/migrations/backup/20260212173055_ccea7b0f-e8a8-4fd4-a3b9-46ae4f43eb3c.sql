
-- Function to cancel an approved quote and all related financial data
CREATE OR REPLACE FUNCTION public.cancel_approved_quote(_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_quote RECORD;
  v_company_id UUID;
  v_cancelled_receivables INTEGER := 0;
  v_cancelled_deposits INTEGER := 0;
  v_cancelled_sales INTEGER := 0;
  v_cancelled_os INTEGER := 0;
  v_cancelled_materials INTEGER := 0;
  v_os RECORD;
  v_sale RECORD;
BEGIN
  -- 1. Validate quote exists and is approved
  SELECT * INTO v_quote FROM quotes WHERE id = _quote_id;
  IF v_quote IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orçamento não encontrado');
  END IF;
  
  IF v_quote.status NOT IN ('approved', 'converted') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas orçamentos aprovados ou convertidos podem ser cancelados por esta função');
  END IF;

  v_company_id := v_quote.company_id;

  -- 2. Cancel all related OS and their materials/reservations
  FOR v_os IN SELECT id FROM ordens_servico WHERE quote_id = _quote_id AND status != 'cancelled'
  LOOP
    -- Cancel materials (only if not consumed)
    UPDATE material_consumption
    SET status = 'cancelled', updated_at = now()
    WHERE ordem_servico_id = v_os.id AND status IN ('pending', 'available');
    v_cancelled_materials := v_cancelled_materials + FOUND::int;

    -- Cancel stock reservations
    UPDATE stock_reservations
    SET status = 'cancelled', cancelled_at = now()
    WHERE ordem_servico_id = v_os.id AND status = 'reserved';

    -- Cancel the OS
    UPDATE ordens_servico SET status = 'cancelled', updated_at = now()
    WHERE id = v_os.id;
    v_cancelled_os := v_cancelled_os + 1;
  END LOOP;

  -- 3. Cancel all related sales
  FOR v_sale IN SELECT id FROM sales WHERE quote_id = _quote_id AND payment_status != 'cancelled'
  LOOP
    -- Cancel cash movements linked to this sale
    DELETE FROM cash_movements WHERE sale_id = v_sale.id;

    -- Cancel commissions
    UPDATE employee_commissions SET status = 'cancelled', updated_at = now()
    WHERE sale_id = v_sale.id;

    -- Cancel the sale
    UPDATE sales SET payment_status = 'cancelled', notes = COALESCE(notes, '') || ' [Cancelado via cancelamento do orçamento]', updated_at = now()
    WHERE id = v_sale.id;
    v_cancelled_sales := v_cancelled_sales + 1;
  END LOOP;

  -- 4. Cancel all accounts receivable
  UPDATE accounts_receivable
  SET status = 'cancelled', updated_at = now()
  WHERE quote_id = _quote_id AND status IN ('pending', 'overdue');
  GET DIAGNOSTICS v_cancelled_receivables = ROW_COUNT;

  -- 5. Cancel all quote deposits
  UPDATE quote_deposits
  SET status = 'cancelled', updated_at = now()
  WHERE quote_id = _quote_id AND status IN ('pending', 'received');
  GET DIAGNOSTICS v_cancelled_deposits = ROW_COUNT;

  -- 6. Update quote status to rejected
  UPDATE quotes SET status = 'rejected', updated_at = now()
  WHERE id = _quote_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_receivables', v_cancelled_receivables,
    'cancelled_deposits', v_cancelled_deposits,
    'cancelled_sales', v_cancelled_sales,
    'cancelled_os', v_cancelled_os,
    'cancelled_materials', v_cancelled_materials
  );
END;
$$;
