-- Phase 2C: Consolidate single company cash register
-- Migration: 20260820000000_phase2c_single_company_cash_register.sql
--
-- Regras implementadas:
-- 1. Máximo de 1 cash_register com status='open' por company_id
-- 2. open_daily_cash: idempotência financeira completa
-- 3. close_cash_register_direct: saldo calculado pelo backend, idempotência de fechamento
-- 4. get_dre_report: transferências internas excluídas, sem dupla contagem
-- 5. receive_quote_deposit_transactional: vincular receivable_id em cash_movements

-- ============================================================
-- PARTE 1: LIMPEZA DE CAIXAS DUPLICADOS (auditável e determinística)
-- Preserva o mais recente; fecha os excedentes com nota de auditoria.
-- ============================================================
DO $$
DECLARE
  rec RECORD;
  keeper_id uuid;
  excess_ids uuid[];
  excess_id uuid;
  total_found int;
BEGIN
  FOR rec IN
    SELECT company_id, count(*) AS cnt
    FROM public.cash_registers
    WHERE status = 'open'
    GROUP BY company_id
    HAVING count(*) > 1
  LOOP
    -- Determina o caixa a preservar: mais recente (opened_at DESC, id DESC)
    SELECT id INTO keeper_id
    FROM public.cash_registers
    WHERE company_id = rec.company_id AND status = 'open'
    ORDER BY opened_at DESC, id DESC
    LIMIT 1;

    -- Lista os excedentes
    SELECT array_agg(id) INTO excess_ids
    FROM public.cash_registers
    WHERE company_id = rec.company_id
      AND status = 'open'
      AND id <> keeper_id;

    total_found := array_length(excess_ids, 1);

    -- Fecha os excedentes de forma auditável
    UPDATE public.cash_registers
    SET
      status = 'closed',
      closed_at = now(),
      closed_by = NULL,
      notes = COALESCE(notes, '') ||
        format(E'\n[AUTO-CLOSE 2026-08-20] Fechado automaticamente pela migration '
               'phase2c_single_company_cash_register para garantir caixa único. '
               'Caixa preservado: %s', keeper_id),
      audit_status = 'auto_closed',
      updated_at = now()
    WHERE id = ANY(excess_ids);

    RAISE NOTICE 'DUPLICIDADE company_id=% — encontrados=% — preservado=% — fechados=%',
      rec.company_id, rec.cnt, keeper_id, excess_ids;
  END LOOP;
END $$;

-- ============================================================
-- PARTE 2: ÍNDICE ÚNICO — UM CAIXA ABERTO POR EMPRESA
-- ============================================================

-- Remove o índice antigo (por usuário) se existir
DROP INDEX IF EXISTS public.uq_cash_registers_open_user_company;

-- Cria o novo índice exclusivo por empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_registers_open_company_only
  ON public.cash_registers(company_id)
  WHERE status = 'open';

-- ============================================================
-- PARTE 3: REESCREVER RPC open_daily_cash
-- Regras:
--   a) Se já existe caixa aberto para a empresa → retornar idempotente (sem mover dinheiro)
--   b) Se não existe → criar caixa, retirar opening_amount do cofre central
--   c) Concorrência: tratar unique_violation como replay idempotente
-- ============================================================
CREATE OR REPLACE FUNCTION public.open_daily_cash(
  _company_id uuid,
  _opening_amount numeric,
  _user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_cash public.company_cash%ROWTYPE;
  v_register public.cash_registers%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  IF NOT public.user_belongs_to_company(v_user_id, _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;
  IF _opening_amount IS NULL OR _opening_amount < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid opening amount';
  END IF;

  -- --------------------------------------------------------
  -- Verificar se já existe caixa aberto para a empresa
  -- (qualquer usuário — caixa é único por empresa)
  -- --------------------------------------------------------
  SELECT * INTO v_register
  FROM public.cash_registers
  WHERE company_id = _company_id AND status = 'open'
  FOR UPDATE;

  IF FOUND THEN
    -- REPLAY IDEMPOTENTE: retornar o caixa existente sem mover dinheiro
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'cash_register_id', v_register.id,
      'opening_amount', v_register.opening_amount
    );
  END IF;

  -- --------------------------------------------------------
  -- Criar novo caixa — retirar abertura do cofre central
  -- --------------------------------------------------------
  SELECT * INTO v_cash
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Company cash not configured. Please initialize the company cash first.';
  END IF;

  IF _opening_amount > 0 AND v_cash.current_balance < _opening_amount THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'Insufficient company cash balance for cash register opening';
  END IF;

  INSERT INTO public.cash_registers(
    company_id, opened_by, operator_id, opening_amount, status
  ) VALUES (
    _company_id, v_user_id, v_user_id, _opening_amount, 'open'
  ) RETURNING * INTO v_register;

  -- Deduzir do cofre central (somente se houver valor de abertura)
  IF _opening_amount > 0 THEN
    UPDATE public.company_cash
    SET
      current_balance = current_balance - _opening_amount,
      last_movement_at = now(),
      updated_at = now()
    WHERE id = v_cash.id;

    INSERT INTO public.company_cash_movements(
      company_id, type, category, amount,
      balance_before, balance_after,
      description, cash_register_id, created_by
    ) VALUES (
      _company_id, 'saida', 'abertura_caixa', _opening_amount,
      v_cash.current_balance, v_cash.current_balance - _opening_amount,
      'Transferência para caixa do operador (abertura)',
      v_register.id, v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'cash_register_id', v_register.id,
    'opening_amount', _opening_amount,
    'company_balance_after', v_cash.current_balance - _opening_amount
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Concorrência: outro processo criou o caixa ao mesmo tempo
    SELECT * INTO v_register
    FROM public.cash_registers
    WHERE company_id = _company_id AND status = 'open';

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'cash_register_id', v_register.id,
      'opening_amount', v_register.opening_amount
    );
END;
$$;

-- ============================================================
-- PARTE 4: REESCREVER RPC close_cash_register_direct
-- Regras:
--   a) Se caixa já fechado → retornar idempotente (sem mover dinheiro)
--   b) Backend calcula saldo canônico da gaveta (não confia no frontend)
--   c) Transferir saldo calculado de volta ao cofre central
--   d) Registrar um único company_cash_movement correspondente
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_cash_register_direct(
  _cash_register_id uuid,
  _counts jsonb,
  _notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_register public.cash_registers%ROWTYPE;
  v_cash public.company_cash%ROWTYPE;
  -- Saldo canônico calculado pelo backend
  v_canonical_balance numeric;
  -- Valor contado fisicamente pelo operador
  v_counted numeric;
  v_difference numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;

  SELECT * INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Cash register not found';
  END IF;
  IF NOT public.user_belongs_to_company(v_user_id, v_register.company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  -- --------------------------------------------------------
  -- IDEMPOTÊNCIA: caixa já fechado → retornar sem agir
  -- --------------------------------------------------------
  IF v_register.status = 'closed' THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'canonical_balance', v_register.closing_amount,
      'total_counted', v_register.actual_amount,
      'difference', v_register.difference
    );
  END IF;

  IF v_register.status <> 'open' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Cash register cannot be closed';
  END IF;

  -- --------------------------------------------------------
  -- Backend calcula o saldo canônico da gaveta
  -- (saldo inicial + entradas - saídas registradas no caixa)
  -- O frontend NÃO é a autoridade sobre este valor.
  -- --------------------------------------------------------
  SELECT
    v_register.opening_amount
    + COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE -amount END), 0)
  INTO v_canonical_balance
  FROM public.cash_movements
  WHERE cash_register_id = v_register.id;

  -- Valor contado fisicamente (informado pelo frontend — usado apenas para auditoria)
  SELECT COALESCE(SUM((value->>'amount')::numeric), 0)
  INTO v_counted
  FROM jsonb_array_elements(_counts);

  v_difference := v_counted - v_canonical_balance;

  -- Registrar a contagem física para auditoria
  DELETE FROM public.cash_counts WHERE cash_register_id = v_register.id;
  INSERT INTO public.cash_counts(cash_register_id, user_id, payment_method, valor_informado)
  SELECT v_register.id, v_user_id,
         value->>'payment_method',
         (value->>'amount')::numeric
  FROM jsonb_array_elements(_counts);

  -- Fechar o caixa com o saldo canônico
  UPDATE public.cash_registers
  SET
    status = 'closed',
    closed_at = now(),
    closed_by = v_user_id,
    operator_id = COALESCE(operator_id, v_user_id),
    closing_requested_at = now(),
    closing_amount = v_canonical_balance,
    actual_amount = v_counted,
    difference = v_difference,
    notes = _notes,
    audit_status = 'approved',
    updated_at = now()
  WHERE id = v_register.id;

  -- --------------------------------------------------------
  -- Transferir saldo canônico de volta ao cofre central
  -- --------------------------------------------------------
  SELECT * INTO v_cash
  FROM public.company_cash
  WHERE company_id = v_register.company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Inicializar cofre se não existir (cenário de primeiro uso)
    INSERT INTO public.company_cash(company_id, current_balance, fixed_fund)
    VALUES (v_register.company_id, 0, v_register.opening_amount)
    RETURNING * INTO v_cash;
  END IF;

  IF v_canonical_balance > 0 THEN
    UPDATE public.company_cash
    SET
      current_balance = current_balance + v_canonical_balance,
      last_movement_at = now(),
      updated_at = now()
    WHERE id = v_cash.id;

    INSERT INTO public.company_cash_movements(
      company_id, type, category, amount,
      balance_before, balance_after,
      description, cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'fechamento_caixa', v_canonical_balance,
      v_cash.current_balance, v_cash.current_balance + v_canonical_balance,
      'Retorno do fechamento do caixa (saldo calculado pelo sistema)',
      v_register.id, v_user_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'canonical_balance', v_canonical_balance,
    'total_counted', v_counted,
    'difference', v_difference
  );
END;
$$;

-- Manter o alias close_daily_cash apontando para close_cash_register_direct
CREATE OR REPLACE FUNCTION public.close_daily_cash(
  _cash_register_id uuid,
  _actual_amount numeric,
  _notes text DEFAULT NULL,
  _user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN public.close_cash_register_direct(
    _cash_register_id,
    jsonb_build_array(
      jsonb_build_object('payment_method', 'total', 'amount', _actual_amount)
    ),
    _notes
  );
END;
$$;

-- ============================================================
-- PARTE 5: CORRIGIR get_dre_report
-- Regras:
--   a) Transferências internas (abertura/fechamento cofre↔caixa) excluídas
--   b) Sem dupla contagem: movimentos com receivable_id/expense_id já
--      representados por entidades canônicas; movimentos manuais sem vínculo
--      contados separadamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_dre_report(
  p_company_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE(
  kind text,
  dre_group text,
  category_id uuid,
  category_name text,
  category_color text,
  amount numeric,
  count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  -- RECEITAS: entradas vinculadas a um recebível canônico
  SELECT
    'receita'::text,
    COALESCE(fc.dre_group, 'receita_bruta'),
    fc.id,
    COALESCE(fc.name, 'Sem categoria'),
    COALESCE(fc.color, '#10b981'),
    SUM(cm.amount)::numeric,
    COUNT(*)::bigint
  FROM public.cash_movements cm
  LEFT JOIN public.accounts_receivable ar ON ar.id = cm.receivable_id
  LEFT JOIN public.financial_categories fc ON fc.id = ar.category_id
  WHERE cm.company_id = p_company_id
    AND public.user_belongs_to_company(auth.uid(), p_company_id)
    AND cm.type = 'entrada'
    AND cm.receivable_id IS NOT NULL
    AND cm.created_at::date BETWEEN p_start AND p_end
  GROUP BY fc.id, fc.dre_group, fc.name, fc.color

  UNION ALL

  -- RECEITAS MANUAIS: entradas sem receivable_id, sem vínculo canônico,
  -- e que não sejam transferências internas (abertura do caixa)
  SELECT
    'receita'::text,
    'outras_receitas',
    NULL::uuid,
    'Entradas Avulsas',
    '#10b981',
    SUM(cm.amount)::numeric,
    COUNT(*)::bigint
  FROM public.cash_movements cm
  WHERE cm.company_id = p_company_id
    AND public.user_belongs_to_company(auth.uid(), p_company_id)
    AND cm.type = 'entrada'
    AND cm.receivable_id IS NULL
    -- Excluir transferências internas de abertura de caixa
    AND cm.category NOT IN ('abertura_caixa', 'abertura', 'suprimento')
    AND cm.created_at::date BETWEEN p_start AND p_end
  HAVING SUM(cm.amount) > 0

  UNION ALL

  -- DESPESAS: saídas vinculadas a uma despesa canônica
  SELECT
    'despesa'::text,
    COALESCE(fc.dre_group, 'outras_despesas'),
    fc.id,
    COALESCE(fc.name, 'Sem categoria'),
    COALESCE(fc.color, '#ef4444'),
    SUM(cm.amount)::numeric,
    COUNT(*)::bigint
  FROM public.cash_movements cm
  LEFT JOIN public.expenses e ON e.id = cm.expense_id
  LEFT JOIN public.financial_categories fc ON fc.id = e.category_id
  WHERE cm.company_id = p_company_id
    AND public.user_belongs_to_company(auth.uid(), p_company_id)
    AND cm.type = 'saida'
    AND cm.expense_id IS NOT NULL
    AND cm.created_at::date BETWEEN p_start AND p_end
  GROUP BY fc.id, fc.dre_group, fc.name, fc.color

  UNION ALL

  -- DESPESAS MANUAIS: saídas sem expense_id (comissões, saídas manuais),
  -- excluindo transferências internas de fechamento de caixa
  SELECT
    'despesa'::text,
    CASE cm.category
      WHEN 'comissao' THEN 'despesas_pessoal'
      ELSE 'outras_despesas'
    END,
    NULL::uuid,
    CASE cm.category
      WHEN 'comissao' THEN 'Comissões'
      WHEN 'sangria' THEN 'Sangria'
      ELSE 'Despesas Avulsas'
    END,
    '#ef4444',
    SUM(cm.amount)::numeric,
    COUNT(*)::bigint
  FROM public.cash_movements cm
  WHERE cm.company_id = p_company_id
    AND public.user_belongs_to_company(auth.uid(), p_company_id)
    AND cm.type = 'saida'
    AND cm.expense_id IS NULL
    -- Excluir transferências internas de fechamento de caixa e estornos internos
    AND cm.category NOT IN ('abertura_caixa', 'abertura', 'fechamento_caixa', 'recolhimento')
    AND cm.created_at::date BETWEEN p_start AND p_end
  GROUP BY cm.category
  HAVING SUM(cm.amount) > 0;
$$;

-- ============================================================
-- PARTE 6: CORRIGIR receive_quote_deposit_transactional
-- Vincular receivable_id em cash_movements para que entradas
-- de orçamento apareçam corretamente no DRE
-- ============================================================
CREATE OR REPLACE FUNCTION public.receive_quote_deposit_transactional(
  _deposit_id uuid,
  _payment_method text,
  _cash_register_id uuid,
  _operation_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deposit public.quote_deposits%ROWTYPE;
  v_register public.cash_registers%ROWTYPE;
  v_receivable_id uuid;
  v_movement_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Authentication required';
  END IF;
  IF _operation_key IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Operation key is required';
  END IF;

  SELECT * INTO v_deposit FROM public.quote_deposits WHERE id = _deposit_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Quote deposit not found';
  END IF;
  IF NOT public.user_belongs_to_company(v_user_id, v_deposit.company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden company scope';
  END IF;

  -- Idempotência via financial_operation_keys
  INSERT INTO public.financial_operation_keys(
    company_id, operation_key, operation_type, reference_id, created_by
  ) VALUES (
    v_deposit.company_id, _operation_key, 'quote_deposit', _deposit_id, v_user_id
  ) ON CONFLICT(company_id, operation_key) DO NOTHING;

  IF NOT FOUND THEN
    SELECT result INTO v_result FROM public.financial_operation_keys
    WHERE company_id = v_deposit.company_id AND operation_key = _operation_key;
    RETURN COALESCE(v_result, '{}'::jsonb) || jsonb_build_object('success', true, 'idempotent', true);
  END IF;

  IF v_deposit.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Deposit already processed or cancelled';
  END IF;

  SELECT * INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id AND company_id = v_deposit.company_id AND status = 'open'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'An open company cash register is required';
  END IF;

  -- Buscar o receivable canônico do depósito para vincular no movimento
  SELECT id INTO v_receivable_id
  FROM public.accounts_receivable
  WHERE quote_id = v_deposit.quote_id
    AND receivable_type = 'entrada_orcamento'
    AND status IN ('pending', 'partial', 'overdue')
  ORDER BY created_at ASC
  LIMIT 1;

  -- Inserir o movimento de caixa com receivable_id vinculado
  INSERT INTO public.cash_movements(
    company_id, cash_register_id, type, category, amount, description, payment_method,
    receivable_id, quote_id, ordem_servico_id, created_by, origem, operation_key
  ) VALUES (
    v_deposit.company_id, v_register.id, 'entrada', 'entrada_orcamento', v_deposit.amount,
    format('Entrada - %s', v_deposit.customer_name), _payment_method,
    v_receivable_id, v_deposit.quote_id, v_deposit.ordem_servico_id,
    v_user_id, 'orcamento', _operation_key
  ) RETURNING id INTO v_movement_id;

  UPDATE public.quote_deposits
  SET
    status = 'received',
    received_at = now(),
    cash_register_id = v_register.id,
    cash_movement_id = v_movement_id,
    payment_method = _payment_method,
    updated_at = now()
  WHERE id = v_deposit.id;

  UPDATE public.accounts_receivable
  SET
    status = 'paid',
    paid_amount = total_amount,
    paid_date = current_date,
    payment_method = _payment_method,
    updated_at = now()
  WHERE quote_id = v_deposit.quote_id
    AND receivable_type = 'entrada_orcamento'
    AND status IN ('pending', 'partial', 'overdue');

  UPDATE public.quotes
  SET deposit_status = 'received', updated_at = now()
  WHERE id = v_deposit.quote_id;

  IF v_deposit.ordem_servico_id IS NOT NULL THEN
    UPDATE public.ordens_servico
    SET
      paid_amount = LEAST(total_amount, COALESCE(paid_amount, 0) + v_deposit.amount),
      pending_amount = GREATEST(0, total_amount - (COALESCE(paid_amount, 0) + v_deposit.amount)),
      updated_at = now()
    WHERE id = v_deposit.ordem_servico_id;
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'deposit_id', v_deposit.id,
    'movement_id', v_movement_id,
    'receivable_id', v_receivable_id
  );

  UPDATE public.financial_operation_keys SET result = v_result
  WHERE company_id = v_deposit.company_id AND operation_key = _operation_key;

  RETURN v_result;
END;
$$;

-- ============================================================
-- PARTE 7: GRANTS
-- ============================================================
REVOKE ALL ON FUNCTION public.open_daily_cash(uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_daily_cash(uuid, numeric, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.close_cash_register_direct(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_cash_register_direct(uuid, jsonb, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.close_daily_cash(uuid, numeric, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_daily_cash(uuid, numeric, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_dre_report(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dre_report(uuid, date, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.receive_quote_deposit_transactional(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_quote_deposit_transactional(uuid, text, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.open_daily_cash IS
  'Phase 2C: Abre caixa operacional diário único por empresa. '
  'Idempotente financeiramente: replay retorna o mesmo caixa sem mover dinheiro novamente.';

COMMENT ON FUNCTION public.close_cash_register_direct IS
  'Phase 2C: Fecha caixa operacional calculando saldo canônico no backend. '
  'Idempotente: replay retorna sem mover dinheiro novamente. '
  'Frontend não é autoridade sobre o saldo financeiro final.';

COMMENT ON FUNCTION public.get_dre_report IS
  'Phase 2C: DRE sem dupla contagem. '
  'Transferências internas cofre↔caixa são excluídas. '
  'Operações econômicas reais contadas uma única vez.';
