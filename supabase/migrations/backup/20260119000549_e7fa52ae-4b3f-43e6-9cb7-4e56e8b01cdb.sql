
-- Função para registrar a contagem de caixa (obrigatória no fechamento)
CREATE OR REPLACE FUNCTION public.register_cash_count(
  _cash_register_id UUID,
  _counts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_register RECORD;
  v_count RECORD;
BEGIN
  -- Verificar se o caixa existe e está aberto
  SELECT * INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id AND status = 'open';
  
  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;
  
  -- Verificar permissão (apenas o dono do caixa pode fechar)
  IF v_register.opened_by != auth.uid() THEN
    -- Permitir admin/manager fechar qualquer caixa
    IF NOT user_has_elevated_role_in_company(auth.uid(), v_register.company_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Você não tem permissão para fechar este caixa'
      );
    END IF;
  END IF;
  
  -- Limpar contagens anteriores deste caixa
  DELETE FROM public.cash_counts WHERE cash_register_id = _cash_register_id;
  
  -- Inserir novas contagens
  FOR v_count IN SELECT * FROM jsonb_to_recordset(_counts) AS x(payment_method TEXT, amount NUMERIC)
  LOOP
    INSERT INTO public.cash_counts (
      cash_register_id, user_id, payment_method, valor_informado
    ) VALUES (
      _cash_register_id, auth.uid(), v_count.payment_method, COALESCE(v_count.amount, 0)
    );
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Contagem registrada com sucesso'
  );
END;
$function$;

-- Função principal de fechamento multiusuário
CREATE OR REPLACE FUNCTION public.close_daily_cash_multiuser(
  _cash_register_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_register RECORD;
  v_company_cash RECORD;
  v_opening_amount NUMERIC;
  v_fixed_fund NUMERIC;
  v_expected_amount NUMERIC;
  v_actual_amount NUMERIC;
  v_difference NUMERIC;
  v_gross_excess NUMERIC;
  v_compensation_result JSONB;
  v_net_excess NUMERIC;
  v_closing_below_fund BOOLEAN;
  v_company_balance NUMERIC;
  v_shortage_id UUID;
  v_user_id UUID;
BEGIN
  -- Buscar caixa aberto
  SELECT * INTO v_register
  FROM public.cash_registers
  WHERE id = _cash_register_id AND status = 'open'
  FOR UPDATE;

  IF v_register IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Caixa não encontrado ou já fechado'
    );
  END IF;
  
  v_user_id := v_register.opened_by;
  
  -- Verificar permissão
  IF v_register.opened_by != auth.uid() THEN
    IF NOT user_has_elevated_role_in_company(auth.uid(), v_register.company_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Você não tem permissão para fechar este caixa'
      );
    END IF;
  END IF;

  -- Verificar se a contagem foi feita
  IF NOT EXISTS (SELECT 1 FROM public.cash_counts WHERE cash_register_id = _cash_register_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Contagem de caixa obrigatória. Informe os valores por forma de pagamento.'
    );
  END IF;

  -- Buscar company_cash
  SELECT * INTO v_company_cash
  FROM public.company_cash
  WHERE company_id = v_register.company_id
  FOR UPDATE;

  IF v_company_cash IS NULL THEN
    INSERT INTO public.company_cash (company_id, current_balance, fixed_fund)
    VALUES (v_register.company_id, 0, v_register.opening_amount)
    RETURNING * INTO v_company_cash;
  END IF;

  v_company_balance := COALESCE(v_company_cash.current_balance, 0);
  v_opening_amount := v_register.opening_amount;
  v_fixed_fund := COALESCE(v_company_cash.fixed_fund, v_opening_amount);

  -- Calcular saldo esperado (abertura + vendas em dinheiro + entradas - saídas)
  SELECT 
    v_opening_amount + 
    COALESCE((
      SELECT SUM(total_amount) 
      FROM public.sales 
      WHERE cash_register_id = _cash_register_id 
        AND payment_method = 'dinheiro'
        AND payment_status != 'cancelled'
    ), 0) +
    COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0)
  INTO v_expected_amount
  FROM public.cash_movements
  WHERE cash_register_id = _cash_register_id;

  -- Buscar valor contado (total informado na contagem)
  SELECT COALESCE(SUM(valor_informado), 0)
  INTO v_actual_amount
  FROM public.cash_counts
  WHERE cash_register_id = _cash_register_id;

  v_difference := v_actual_amount - v_expected_amount;
  v_gross_excess := GREATEST(0, v_actual_amount - v_fixed_fund);
  v_closing_below_fund := v_actual_amount < v_fixed_fund;

  -- Regra: Se fechamento abaixo do fundo fixo, exigir justificativa
  IF v_closing_below_fund AND (COALESCE(_notes, '') = '') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fechamento abaixo do fundo fixo requer justificativa obrigatória'
    );
  END IF;
  
  -- Se houver FALTA (diferença negativa), registrar como shortage para compensação futura
  IF v_difference < 0 THEN
    INSERT INTO public.cash_shortages (
      company_id, user_id, cash_register_id, amount, reason, status
    ) VALUES (
      v_register.company_id, v_user_id, _cash_register_id, 
      ABS(v_difference), COALESCE(_notes, 'Falta no fechamento de caixa'), 'pending'
    )
    RETURNING id INTO v_shortage_id;
  END IF;

  -- Compensar adiantamentos pendentes se houver excedente
  IF v_gross_excess > 0 THEN
    v_compensation_result := compensate_advances_on_closing(
      v_register.company_id,
      _cash_register_id,
      v_gross_excess
    );
    v_net_excess := (v_compensation_result->>'net_excess')::NUMERIC;
  ELSE
    v_compensation_result := NULL;
    v_net_excess := 0;
  END IF;

  -- Se há excedente líquido, transferir para caixa da empresa
  IF v_net_excess > 0 THEN
    INSERT INTO public.company_cash_movements (
      company_id, type, category, amount,
      balance_before, balance_after, description,
      cash_register_id, created_by
    ) VALUES (
      v_register.company_id, 'entrada', 'fechamento_caixa', v_net_excess,
      v_company_balance, v_company_balance + v_net_excess,
      format('Recolhimento do caixa - Usuário: %s', v_user_id),
      _cash_register_id, auth.uid()
    );

    UPDATE public.company_cash
    SET current_balance = current_balance + v_net_excess,
        last_movement_at = now(),
        updated_at = now()
    WHERE company_id = v_register.company_id;
  END IF;

  -- Atualizar e fechar o caixa
  UPDATE public.cash_registers
  SET status = 'closed',
      closed_at = now(),
      closed_by = auth.uid(),
      closing_amount = v_expected_amount,
      actual_amount = v_actual_amount,
      difference = v_difference,
      notes = _notes,
      fixed_fund_at_close = v_fixed_fund,
      excess_collected = v_net_excess,
      closing_justification = CASE WHEN v_closing_below_fund OR v_difference < 0 THEN _notes ELSE NULL END
  WHERE id = _cash_register_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected_amount', v_expected_amount,
    'actual_amount', v_actual_amount,
    'difference', v_difference,
    'fixed_fund', v_fixed_fund,
    'gross_excess', v_gross_excess,
    'compensation', v_compensation_result,
    'net_excess', v_net_excess,
    'closing_below_fund', v_closing_below_fund,
    'shortage_id', v_shortage_id
  );
END;
$function$;

-- Criar tabela cash_shortages se não existir (para compensação futura de faltas)
CREATE TABLE IF NOT EXISTS public.cash_shortages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  user_id UUID NOT NULL,
  cash_register_id UUID REFERENCES public.cash_registers(id),
  amount NUMERIC NOT NULL,
  compensated_amount NUMERIC DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'compensated')),
  compensated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cash_shortages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cash_shortages
CREATE POLICY "Users can view their company shortages" ON public.cash_shortages
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Users can insert shortages" ON public.cash_shortages
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
  );

CREATE POLICY "Admins can update shortages" ON public.cash_shortages
  FOR UPDATE USING (
    user_has_elevated_role_in_company(auth.uid(), company_id)
  );

-- Criar tabela cash_counts se não existir
CREATE TABLE IF NOT EXISTS public.cash_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  payment_method TEXT NOT NULL,
  valor_informado NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cash_counts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cash_counts
CREATE POLICY "Users can view their company counts" ON public.cash_counts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cash_registers cr
      WHERE cr.id = cash_counts.cash_register_id
      AND cr.company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
    )
  );

CREATE POLICY "Users can insert counts for their registers" ON public.cash_counts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cash_registers cr
      WHERE cr.id = cash_counts.cash_register_id
      AND cr.company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
    )
  );

CREATE POLICY "Users can delete counts for their registers" ON public.cash_counts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.cash_registers cr
      WHERE cr.id = cash_counts.cash_register_id
      AND cr.company_id IN (SELECT company_id FROM public.user_companies WHERE user_id = auth.uid() AND is_active = true)
    )
  );
