-- ============================================================
-- MIGRAÇÃO: Auditoria de Fechamento de Caixa e Discrepâncias
-- ============================================================

-- 1. Adicionar colunas de auditoria em cash_registers
ALTER TABLE public.cash_registers 
ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS closing_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS audited_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS audit_notes TEXT,
ADD COLUMN IF NOT EXISTS previous_discrepancy NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_discrepancy_notes TEXT;

-- 2. Criar tabela de auditorias de fechamento
CREATE TABLE public.cash_register_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Dados do operador
  operator_id UUID NOT NULL REFERENCES auth.users(id),
  operator_name TEXT,
  counts_submitted JSONB NOT NULL,
  total_counted NUMERIC(12,2) NOT NULL,
  expected_amount NUMERIC(12,2) NOT NULL,
  difference NUMERIC(12,2) NOT NULL,
  operator_notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Dados da auditoria
  auditor_id UUID REFERENCES auth.users(id),
  auditor_name TEXT,
  auditor_action TEXT CHECK (auditor_action IN ('approved', 'rejected', 'adjusted')),
  auditor_notes TEXT,
  adjustment_amount NUMERIC(12,2),
  audited_at TIMESTAMPTZ,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para busca rápida
CREATE INDEX idx_cash_audits_pending ON cash_register_audits(company_id, status) WHERE status = 'pending';
CREATE INDEX idx_cash_audits_operator ON cash_register_audits(operator_id);
CREATE INDEX idx_cash_audits_register ON cash_register_audits(cash_register_id);

-- 3. Criar tabela de discrepâncias por operador
CREATE TABLE public.operator_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES auth.users(id),
  cash_register_id UUID NOT NULL REFERENCES cash_registers(id),
  
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN ('deficit', 'surplus')),
  amount NUMERIC(12,2) NOT NULL,
  notes TEXT,
  
  -- Status de compensação
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'compensated', 'written_off')),
  compensated_amount NUMERIC(12,2) DEFAULT 0,
  compensated_at TIMESTAMPTZ,
  compensated_in_register_id UUID REFERENCES cash_registers(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para buscar pendências do operador
CREATE INDEX idx_operator_discrepancies_pending 
ON operator_discrepancies(company_id, operator_id, status) 
WHERE status = 'pending';

-- 4. Habilitar RLS nas novas tabelas
ALTER TABLE public.cash_register_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_discrepancies ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para cash_register_audits
CREATE POLICY "Users can view audits from their company"
ON public.cash_register_audits FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can create audits for their company"
ON public.cash_register_audits FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Managers can update audits"
ON public.cash_register_audits FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'manager')
  )
);

-- 6. Políticas RLS para operator_discrepancies
CREATE POLICY "Users can view discrepancies from their company"
ON public.operator_discrepancies FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "System can create discrepancies"
ON public.operator_discrepancies FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Managers can update discrepancies"
ON public.operator_discrepancies FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM user_companies 
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'manager')
  )
);

-- 7. Função: Submeter fechamento para auditoria
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
  -- Buscar caixa aberto
  SELECT * INTO v_register FROM cash_registers
  WHERE id = _cash_register_id AND status = 'open' FOR UPDATE;
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado ou já fechado');
  END IF;
  
  -- Verificar se é o operador do caixa
  IF v_register.opened_by != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas o operador pode submeter o fechamento');
  END IF;
  
  -- Buscar nome do operador
  SELECT COALESCE(e.name, p.name, 'Operador') INTO v_operator_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.id
  WHERE p.id = auth.uid();
  
  -- Calcular valor esperado
  SELECT v_register.opening_amount + 
    COALESCE((SELECT SUM(total_amount) FROM sales 
              WHERE cash_register_id = _cash_register_id 
              AND payment_method = 'dinheiro' AND payment_status != 'cancelled'), 0) +
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM cash_movements WHERE cash_register_id = _cash_register_id;
  
  -- Calcular total contado
  SELECT COALESCE(SUM((item->>'amount')::NUMERIC), 0) INTO v_total_counted
  FROM jsonb_array_elements(_counts) AS item;
  
  v_difference := v_total_counted - v_expected_amount;
  
  -- Registrar contagens
  DELETE FROM cash_counts WHERE cash_register_id = _cash_register_id;
  INSERT INTO cash_counts (cash_register_id, user_id, payment_method, valor_informado)
  SELECT _cash_register_id, auth.uid(), item->>'payment_method', (item->>'amount')::NUMERIC
  FROM jsonb_array_elements(_counts) AS item;
  
  -- Criar registro de auditoria
  INSERT INTO cash_register_audits (
    cash_register_id, company_id, operator_id, operator_name,
    counts_submitted, total_counted, expected_amount, difference,
    operator_notes, status
  ) VALUES (
    _cash_register_id, v_register.company_id, auth.uid(), v_operator_name,
    _counts, v_total_counted, v_expected_amount, v_difference,
    _notes, 'pending'
  ) RETURNING id INTO v_audit_id;
  
  -- Atualizar status do caixa
  UPDATE cash_registers
  SET status = 'pending_audit',
      operator_id = auth.uid(),
      closing_requested_at = now(),
      closing_amount = v_expected_amount,
      actual_amount = v_total_counted,
      difference = v_difference,
      notes = _notes
  WHERE id = _cash_register_id;
  
  -- Notificar admins/gerentes
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

-- 8. Função: Aprovar/Rejeitar auditoria
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
  -- Buscar auditoria pendente
  SELECT * INTO v_audit FROM cash_register_audits
  WHERE id = _audit_id AND status = 'pending' FOR UPDATE;
  
  IF v_audit IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auditoria não encontrada ou já processada');
  END IF;
  
  -- Verificar permissão (apenas admin/manager)
  IF NOT user_has_elevated_role_in_company(auth.uid(), v_audit.company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas gerentes podem aprovar auditorias');
  END IF;
  
  -- Buscar nome do auditor
  SELECT COALESCE(e.name, p.name, 'Auditor') INTO v_auditor_name
  FROM profiles p
  LEFT JOIN employees e ON e.user_id = p.id
  WHERE p.id = auth.uid();
  
  -- Atualizar auditoria
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
  
  IF _action = 'approved' OR _action = 'adjusted' THEN
    -- Valor final: contado + ajuste do auditor
    v_final_amount := v_audit.total_counted + COALESCE(_adjustment_amount, 0);
    v_final_difference := v_final_amount - v_audit.expected_amount;
    
    -- Registrar discrepância do operador se houver diferença
    IF v_final_difference != 0 THEN
      INSERT INTO operator_discrepancies (
        company_id, operator_id, cash_register_id,
        discrepancy_type, amount, notes, status
      ) VALUES (
        v_audit.company_id, v_audit.operator_id, v_audit.cash_register_id,
        CASE WHEN v_final_difference < 0 THEN 'deficit' ELSE 'surplus' END,
        ABS(v_final_difference),
        COALESCE(_notes, v_audit.operator_notes),
        'pending'
      );
    END IF;
    
    -- Executar fechamento real
    SELECT close_daily_cash(
      v_audit.cash_register_id,
      v_final_amount,
      format('Auditado por %s. %s', v_auditor_name, COALESCE(_notes, '')),
      auth.uid()
    ) INTO v_close_result;
    
    -- Atualizar caixa com dados da auditoria
    UPDATE cash_registers
    SET audited_by = auth.uid(),
        audited_at = now(),
        audit_notes = _notes
    WHERE id = v_audit.cash_register_id;
    
    -- Notificar operador
    INSERT INTO company_notifications (
      company_id, type, title, message, to_role, from_user_id, metadata
    ) VALUES (
      v_audit.company_id,
      'cash_audit_approved',
      'Fechamento de Caixa Aprovado',
      format('Seu fechamento foi %s por %s', 
        CASE WHEN _action = 'adjusted' THEN 'ajustado e aprovado' ELSE 'aprovado' END,
        v_auditor_name
      ),
      'employee',
      auth.uid(),
      jsonb_build_object(
        'cash_register_id', v_audit.cash_register_id,
        'target_user_id', v_audit.operator_id,
        'difference', v_final_difference
      )
    );
    
    RETURN v_close_result || jsonb_build_object(
      'audit_action', _action,
      'final_difference', v_final_difference,
      'auditor', v_auditor_name
    );
  ELSE
    -- Rejeitar: voltar status para 'open'
    UPDATE cash_registers
    SET status = 'open',
        operator_id = NULL,
        closing_requested_at = NULL,
        closing_amount = NULL,
        actual_amount = NULL,
        difference = NULL,
        notes = NULL
    WHERE id = v_audit.cash_register_id;
    
    -- Limpar contagens
    DELETE FROM cash_counts WHERE cash_register_id = v_audit.cash_register_id;
    
    -- Notificar operador para refazer
    INSERT INTO company_notifications (
      company_id, type, title, message, to_role, from_user_id, metadata
    ) VALUES (
      v_audit.company_id,
      'cash_audit_rejected',
      'Fechamento de Caixa Rejeitado',
      format('Refaça a contagem. Motivo: %s', COALESCE(_notes, 'Não especificado')),
      'employee',
      auth.uid(),
      jsonb_build_object(
        'cash_register_id', v_audit.cash_register_id,
        'target_user_id', v_audit.operator_id,
        'rejection_reason', _notes
      )
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'audit_action', 'rejected',
      'message', 'Fechamento rejeitado. Operador notificado para refazer a contagem.'
    );
  END IF;
END;
$$;

-- 9. Função: Buscar pendências do operador na abertura
CREATE OR REPLACE FUNCTION public.get_operator_pending_discrepancies(
  _company_id UUID,
  _operator_id UUID
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_pending RECORD;
  v_total_deficit NUMERIC := 0;
  v_total_surplus NUMERIC := 0;
  v_discrepancies JSONB := '[]'::JSONB;
BEGIN
  -- Buscar todas as pendências do operador
  FOR v_pending IN
    SELECT od.*, cr.closed_at
    FROM operator_discrepancies od
    JOIN cash_registers cr ON cr.id = od.cash_register_id
    WHERE od.company_id = _company_id
      AND od.operator_id = _operator_id
      AND od.status = 'pending'
    ORDER BY od.created_at DESC
  LOOP
    IF v_pending.discrepancy_type = 'deficit' THEN
      v_total_deficit := v_total_deficit + (v_pending.amount - COALESCE(v_pending.compensated_amount, 0));
    ELSE
      v_total_surplus := v_total_surplus + (v_pending.amount - COALESCE(v_pending.compensated_amount, 0));
    END IF;
    
    v_discrepancies := v_discrepancies || jsonb_build_object(
      'id', v_pending.id,
      'type', v_pending.discrepancy_type,
      'amount', v_pending.amount - COALESCE(v_pending.compensated_amount, 0),
      'notes', v_pending.notes,
      'date', v_pending.closed_at
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'has_pending', v_total_deficit > 0 OR v_total_surplus > 0,
    'total_deficit', v_total_deficit,
    'total_surplus', v_total_surplus,
    'net_balance', v_total_surplus - v_total_deficit,
    'discrepancies', v_discrepancies
  );
END;
$$;

-- 10. Função: Buscar auditorias pendentes da empresa
CREATE OR REPLACE FUNCTION public.get_pending_cash_audits(
  _company_id UUID
) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_audits JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', cra.id,
      'cash_register_id', cra.cash_register_id,
      'operator_id', cra.operator_id,
      'operator_name', cra.operator_name,
      'total_counted', cra.total_counted,
      'expected_amount', cra.expected_amount,
      'difference', cra.difference,
      'operator_notes', cra.operator_notes,
      'submitted_at', cra.submitted_at,
      'counts_submitted', cra.counts_submitted
    ) ORDER BY cra.submitted_at ASC
  ), '[]'::jsonb) INTO v_audits
  FROM cash_register_audits cra
  WHERE cra.company_id = _company_id
    AND cra.status = 'pending';
  
  RETURN jsonb_build_object(
    'audits', v_audits,
    'count', jsonb_array_length(v_audits)
  );
END;
$$;