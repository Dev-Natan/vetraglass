-- Atualiza a função que busca o caixa aberto do usuário para incluir o status 'pending_audit'
-- Isso permite que a interface mostre o resumo do caixa mesmo enquanto aguarda auditoria
CREATE OR REPLACE FUNCTION public.get_user_open_cash_register(_company_id uuid)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  opened_by uuid,
  opened_at timestamptz,
  opening_amount numeric,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    cr.company_id,
    cr.opened_by,
    cr.opened_at,
    cr.opening_amount,
    cr.status
  FROM public.cash_registers cr
  WHERE cr.company_id = _company_id
    AND cr.opened_by = auth.uid()
    AND cr.status IN ('open', 'pending_audit')
  ORDER BY cr.opened_at DESC
  LIMIT 1;
END;
$$;

-- Refina a submissão de auditoria para garantir integridade
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
  -- Bloqueia o registro para evitar alterações simultâneas
  SELECT * INTO v_register FROM cash_registers
  WHERE id = _cash_register_id AND status = 'open' FOR UPDATE;
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado ou já está em processo de fechamento');
  END IF;
  
  -- Busca nome do operador
  SELECT COALESCE(e.name, p.full_name, 'Operador') INTO v_operator_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.user_id
  WHERE p.user_id = auth.uid();
  
  -- Calcula saldo esperado no momento EXATO da solicitação
  SELECT v_register.opening_amount + 
    COALESCE((SELECT SUM(total_amount) FROM sales 
              WHERE cash_register_id = _cash_register_id 
              AND payment_method = 'dinheiro' AND payment_status != 'cancelled'), 0) +
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = _cash_register_id AND type = 'entrada'), 0) -
    COALESCE((SELECT SUM(amount) FROM cash_movements WHERE cash_register_id = _cash_register_id AND type = 'saida'), 0)
  INTO v_expected_amount;
  
  -- Calcula total contado a partir do JSON
  SELECT COALESCE(SUM((item->>'amount')::NUMERIC), 0) INTO v_total_counted
  FROM jsonb_array_elements(_counts) AS item;
  
  v_difference := v_total_counted - v_expected_amount;
  
  -- Registra contagens físicas para histórico
  DELETE FROM cash_counts WHERE cash_register_id = _cash_register_id;
  INSERT INTO cash_counts (cash_register_id, user_id, payment_method, valor_informado)
  SELECT _cash_register_id, auth.uid(), item->>'payment_method', (item->>'amount')::NUMERIC
  FROM jsonb_array_elements(_counts) AS item;
  
  -- Cria registro de auditoria
  INSERT INTO cash_register_audits (
    cash_register_id, company_id, operator_id, operator_name,
    counts_submitted, total_counted, expected_amount, difference,
    operator_notes, status
  ) VALUES (
    _cash_register_id, v_register.company_id, auth.uid(), v_operator_name,
    _counts, v_total_counted, v_expected_amount, v_difference,
    _notes, 'pending'
  ) RETURNING id INTO v_audit_id;
  
  -- Atualiza caixa para aguardando auditoria (congelando valores)
  UPDATE cash_registers
  SET status = 'pending_audit',
      operator_id = auth.uid(),
      closing_requested_at = now(),
      closing_amount = v_expected_amount,
      actual_amount = v_total_counted,
      difference = v_difference,
      notes = _notes
  WHERE id = _cash_register_id;
  
  -- Notifica administradores
  INSERT INTO company_notifications (
    company_id, type, title, message, to_role, from_user_id, metadata
  ) VALUES (
    v_register.company_id,
    'cash_audit_request',
    'Auditoria de Caixa Pendente',
    format('O operador %s solicitou o fechamento. Diferença: R$ %s', 
      v_operator_name, 
      v_difference
    ),
    'admin',
    auth.uid(),
    jsonb_build_object(
      'cash_register_id', _cash_register_id,
      'audit_id', v_audit_id,
      'difference', v_difference
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'audit_id', v_audit_id,
    'message', 'Fechamento enviado para auditoria. O caixa permanecerá restrito até a aprovação.'
  );
END;
$$;