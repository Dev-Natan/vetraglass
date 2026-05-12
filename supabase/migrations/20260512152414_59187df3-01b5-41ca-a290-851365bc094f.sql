CREATE OR REPLACE FUNCTION public.submit_cash_closing_for_audit(
  _cash_register_id UUID,
  _counts JSONB,
  _notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_register RECORD;
  v_expected_amount NUMERIC;
  v_total_counted NUMERIC;
  v_difference NUMERIC;
  v_audit_id UUID;
  v_operator_name TEXT;
BEGIN
  SELECT * INTO v_register FROM cash_registers
  WHERE id = _cash_register_id AND status = 'open' FOR UPDATE;
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado ou já fechado');
  END IF;
  
  IF v_register.opened_by != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o operador pode submeter o fechamento');
  END IF;
  
  SELECT COALESCE(e.name, p.full_name, 'Operador') INTO v_operator_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.user_id
  WHERE p.user_id = auth.uid();
  
  SELECT v_register.opening_amount + 
    COALESCE((SELECT SUM(total_amount) FROM sales 
              WHERE cash_register_id = _cash_register_id 
              AND payment_method = 'dinheiro' AND payment_status != 'cancelled'), 0) +
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM cash_movements WHERE cash_register_id = _cash_register_id;
  
  SELECT COALESCE(SUM((item->>'amount')::NUMERIC), 0) INTO v_total_counted
  FROM jsonb_array_elements(_counts) AS item;
  
  v_difference := v_total_counted - v_expected_amount;
  
  DELETE FROM cash_counts WHERE cash_register_id = _cash_register_id;
  INSERT INTO cash_counts (cash_register_id, user_id, payment_method, valor_informado)
  SELECT _cash_register_id, auth.uid(), item->>'payment_method', (item->>'amount')::NUMERIC
  FROM jsonb_array_elements(_counts) AS item;
  
  INSERT INTO cash_register_audits (
    cash_register_id, company_id, operator_id, operator_name,
    counts_submitted, total_counted, expected_amount, difference,
    operator_notes, status
  ) VALUES (
    _cash_register_id, v_register.company_id, auth.uid(), v_operator_name,
    _counts, v_total_counted, v_expected_amount, v_difference,
    _notes, 'pending'
  ) RETURNING id INTO v_audit_id;
  
  UPDATE cash_registers
  SET status = 'pending_audit',
      operator_id = auth.uid(),
      closing_requested_at = now(),
      closing_amount = v_expected_amount,
      actual_amount = v_total_counted,
      difference = v_difference,
      notes = _notes
  WHERE id = _cash_register_id;
  
  INSERT INTO company_notifications (
    company_id, type, title, message, to_role, from_user_id, metadata
  ) VALUES (
    v_register.company_id,
    'cash_audit_request',
    'Fechamento de Caixa Aguardando Auditoria',
    format('O operador %s finalizou a contagem. Diferença: R$ %s', 
      v_operator_name, 
      CASE WHEN v_difference >= 0 THEN '+' ELSE '' END || v_difference
    ),
    'admin',
    auth.uid(),
    jsonb_build_object(
      'cash_register_id', _cash_register_id,
      'audit_id', v_audit_id,
      'operator_name', v_operator_name,
      'total_counted', v_total_counted,
      'expected', v_expected_amount,
      'difference', v_difference
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'audit_id', v_audit_id,
    'expected_amount', v_expected_amount,
    'total_counted', v_total_counted,
    'difference', v_difference,
    'message', 'Fechamento enviado para auditoria. Aguarde aprovação do gerente.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_cash_audit(
  _audit_id UUID,
  _action TEXT,
  _notes TEXT DEFAULT NULL,
  _adjustment_amount NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_audit RECORD;
  v_register RECORD;
  v_final_amount NUMERIC;
  v_final_difference NUMERIC;
  v_close_result JSONB;
  v_auditor_name TEXT;
BEGIN
  SELECT * INTO v_audit FROM cash_register_audits
  WHERE id = _audit_id AND status = 'pending' FOR UPDATE;
  
  IF v_audit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auditoria não encontrada ou já processada');
  END IF;
  
  IF NOT user_has_elevated_role_in_company(auth.uid(), v_audit.company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas gerentes podem aprovar auditorias');
  END IF;
  
  SELECT COALESCE(e.name, p.full_name, 'Auditor') INTO v_auditor_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.user_id
  WHERE p.user_id = auth.uid();
  
  UPDATE cash_register_audits
  SET auditor_id = auth.uid(),
      auditor_name = v_auditor_name,
      auditor_action = _action,
      auditor_notes = _notes,
      adjustment_amount = _adjustment_amount,
      audited_at = now(),
      status = CASE WHEN _action = 'rejected' THEN 'rejected' ELSE 'approved' END,
      updated_at = now()
  WHERE id = _audit_id;

  IF _action = 'approved' THEN
    SELECT * INTO v_register FROM cash_registers WHERE id = v_audit.cash_register_id;
    v_final_amount := COALESCE(_adjustment_amount, v_audit.total_counted);
    v_final_difference := v_final_amount - v_audit.expected_amount;
    
    UPDATE cash_registers
    SET status = 'closed',
        closed_at = now(),
        closed_by = auth.uid(),
        actual_amount = v_final_amount,
        difference = v_final_difference,
        audit_status = 'approved'
    WHERE id = v_audit.cash_register_id;
  ELSIF _action = 'rejected' THEN
    UPDATE cash_registers
    SET status = 'open',
        closing_requested_at = NULL,
        audit_status = 'rejected'
    WHERE id = v_audit.cash_register_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'action', _action);
END;
$$;