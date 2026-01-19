
-- =====================================================
-- SISTEMA DE CAIXA MULTIUSUÁRIO - CORREÇÃO
-- =====================================================

-- 16. Índice para buscar caixas por usuário (sem função DATE)
DROP INDEX IF EXISTS idx_cash_registers_opened_by_date;

CREATE INDEX idx_cash_registers_opened_by_status 
  ON public.cash_registers(company_id, opened_by, status, opened_at DESC) 
  WHERE status = 'open';

-- Atualizar as funções que usam DATE() para usar comparação de intervalo

-- 9. Função para abrir caixa multiusuário (corrigida)
CREATE OR REPLACE FUNCTION public.open_daily_cash_multiuser(
  _company_id UUID,
  _opening_amount NUMERIC,
  _user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_cash RECORD;
  v_existing_register RECORD;
  v_user_settings RECORD;
  v_fixed_fund NUMERIC;
  v_new_register public.cash_registers;
  v_movement public.company_cash_movements;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  -- Definir início e fim do dia atual
  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + interval '1 day';

  -- Verificar se ESTE USUÁRIO já tem caixa aberto hoje
  SELECT * INTO v_existing_register
  FROM public.cash_registers
  WHERE company_id = _company_id 
    AND opened_by = _user_id 
    AND status = 'open'
    AND opened_at >= v_today_start
    AND opened_at < v_today_end;

  IF v_existing_register IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Você já possui um caixa aberto hoje.',
      'cash_register_id', v_existing_register.id
    );
  END IF;

  -- Buscar configuração de fundo fixo do usuário (ou padrão da empresa)
  SELECT fixed_fund INTO v_fixed_fund
  FROM public.user_cash_settings
  WHERE company_id = _company_id AND user_id = _user_id AND is_active = true;

  -- Se não tem configuração específica, usar o fundo fixo padrão da empresa
  IF v_fixed_fund IS NULL THEN
    SELECT fixed_fund INTO v_fixed_fund
    FROM public.company_cash
    WHERE company_id = _company_id;
  END IF;

  v_fixed_fund := COALESCE(v_fixed_fund, 500);

  -- Se opening_amount não foi especificado, usar o fundo fixo
  IF _opening_amount IS NULL OR _opening_amount <= 0 THEN
    _opening_amount := v_fixed_fund;
  END IF;

  -- Buscar caixa da empresa
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = _company_id
  FOR UPDATE;

  IF v_company_cash IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa da empresa não configurado. Configure em Configurações.'
    );
  END IF;

  -- Verificar saldo suficiente
  IF v_company_cash.current_balance < _opening_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Saldo insuficiente no caixa da empresa. Disponível: R$ %s, Solicitado: R$ %s', 
        v_company_cash.current_balance, _opening_amount)
    );
  END IF;

  -- Registrar saída do caixa da empresa
  INSERT INTO public.company_cash_movements (
    company_id, type, category, amount,
    balance_before, balance_after, description, created_by
  ) VALUES (
    _company_id, 'saida', 'abertura_caixa', _opening_amount,
    v_company_cash.current_balance, 
    v_company_cash.current_balance - _opening_amount,
    format('Abertura de caixa - Usuário: %s', _user_id),
    _user_id
  )
  RETURNING * INTO v_movement;

  -- Atualizar saldo da empresa
  UPDATE public.company_cash
  SET current_balance = current_balance - _opening_amount,
      last_movement_at = now(),
      updated_at = now()
  WHERE company_id = _company_id;

  -- Criar caixa do dia para o usuário
  INSERT INTO public.cash_registers (
    company_id, opened_by, opening_amount, status
  ) VALUES (
    _company_id, _user_id, _opening_amount, 'open'
  )
  RETURNING * INTO v_new_register;

  RETURN jsonb_build_object(
    'success', true,
    'cash_register_id', v_new_register.id,
    'opening_amount', _opening_amount,
    'fixed_fund', v_fixed_fund,
    'company_balance_after', v_company_cash.current_balance - _opening_amount
  );
END;
$$;

-- 12. Função para verificar se usuário pode abrir caixa (corrigida)
CREATE OR REPLACE FUNCTION public.can_user_open_cash(_company_id UUID, _user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_register RECORD;
  v_company_cash RECORD;
  v_user_fixed_fund NUMERIC;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + interval '1 day';

  -- Verificar se usuário já tem caixa aberto hoje
  SELECT * INTO v_existing_register
  FROM public.cash_registers
  WHERE company_id = _company_id 
    AND opened_by = _user_id 
    AND status = 'open'
    AND opened_at >= v_today_start
    AND opened_at < v_today_end;

  IF v_existing_register IS NOT NULL THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', 'Você já possui um caixa aberto hoje',
      'existing_register_id', v_existing_register.id
    );
  END IF;

  -- Buscar caixa da empresa
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = _company_id;

  IF v_company_cash IS NULL THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', 'Caixa da empresa não configurado'
    );
  END IF;

  -- Buscar fundo fixo do usuário
  SELECT fixed_fund INTO v_user_fixed_fund
  FROM public.user_cash_settings
  WHERE company_id = _company_id AND user_id = _user_id AND is_active = true;

  v_user_fixed_fund := COALESCE(v_user_fixed_fund, v_company_cash.fixed_fund);

  IF v_company_cash.current_balance < v_user_fixed_fund THEN
    RETURN jsonb_build_object(
      'can_open', false,
      'reason', format('Saldo insuficiente. Disponível: R$ %s', v_company_cash.current_balance),
      'company_balance', v_company_cash.current_balance,
      'required', v_user_fixed_fund
    );
  END IF;

  RETURN jsonb_build_object(
    'can_open', true,
    'company_balance', v_company_cash.current_balance,
    'fixed_fund', v_user_fixed_fund,
    'suggested_amount', v_user_fixed_fund
  );
END;
$$;

-- 13. Função para buscar caixa aberto do usuário atual (corrigida)
CREATE OR REPLACE FUNCTION public.get_user_open_cash_register(_company_id UUID)
RETURNS TABLE(
  id UUID,
  company_id UUID,
  opened_by UUID,
  opened_at TIMESTAMPTZ,
  opening_amount NUMERIC,
  status TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + interval '1 day';

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
    AND cr.status = 'open'
    AND cr.opened_at >= v_today_start
    AND cr.opened_at < v_today_end
  LIMIT 1;
END;
$$;

-- 14. Função para listar todos os caixas abertos da empresa (corrigida)
CREATE OR REPLACE FUNCTION public.get_all_open_cash_registers(_company_id UUID)
RETURNS TABLE(
  id UUID,
  opened_by UUID,
  opened_by_name TEXT,
  opened_at TIMESTAMPTZ,
  opening_amount NUMERIC,
  current_balance NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  -- Verificar permissão
  IF NOT user_has_elevated_role_in_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_today_start := date_trunc('day', now());
  v_today_end := v_today_start + interval '1 day';

  RETURN QUERY
  SELECT 
    cr.id,
    cr.opened_by,
    COALESCE(p.full_name, 'Usuário') as opened_by_name,
    cr.opened_at,
    cr.opening_amount,
    cr.opening_amount + 
      COALESCE((
        SELECT SUM(CASE WHEN cm.type = 'entrada' THEN cm.amount ELSE -cm.amount END)
        FROM public.cash_movements cm
        WHERE cm.cash_register_id = cr.id
      ), 0) as current_balance
  FROM public.cash_registers cr
  LEFT JOIN public.profiles p ON p.user_id = cr.opened_by
  WHERE cr.company_id = _company_id
    AND cr.status = 'open'
    AND cr.opened_at >= v_today_start
    AND cr.opened_at < v_today_end
  ORDER BY cr.opened_at;
END;
$$;
