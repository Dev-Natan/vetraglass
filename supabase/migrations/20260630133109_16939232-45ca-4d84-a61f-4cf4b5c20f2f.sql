
-- ============================================================
-- Phase 2: DRE + Cash Flow + Backfill legacy expenses
-- ============================================================

-- 1) Backfill expenses.category_id from legacy `category` text
DO $$
DECLARE
  r RECORD;
  v_cat_id UUID;
  v_map TEXT;
BEGIN
  FOR r IN SELECT e.id, e.company_id, e.category FROM public.expenses e WHERE e.category_id IS NULL LOOP
    v_map := CASE lower(coalesce(r.category,''))
      WHEN 'aluguel' THEN 'Aluguel'
      WHEN 'agua' THEN 'Água'
      WHEN 'água' THEN 'Água'
      WHEN 'energia' THEN 'Energia Elétrica'
      WHEN 'luz' THEN 'Energia Elétrica'
      WHEN 'internet' THEN 'Internet / Telefone'
      WHEN 'telefone' THEN 'Internet / Telefone'
      WHEN 'materiais' THEN 'Compra de Alumínio'
      WHEN 'vidro' THEN 'Compra de Vidro'
      WHEN 'aluminio' THEN 'Compra de Alumínio'
      WHEN 'alumínio' THEN 'Compra de Alumínio'
      WHEN 'ferragens' THEN 'Ferragens / Acessórios'
      WHEN 'frete' THEN 'Frete e Entrega'
      WHEN 'funcionarios' THEN 'Salários e Encargos'
      WHEN 'funcionários' THEN 'Salários e Encargos'
      WHEN 'salarios' THEN 'Salários e Encargos'
      WHEN 'comissao' THEN 'Comissões de Vendas'
      WHEN 'comissão' THEN 'Comissões de Vendas'
      WHEN 'comissoes' THEN 'Comissões de Vendas'
      WHEN 'marketing' THEN 'Marketing e Publicidade'
      WHEN 'combustivel' THEN 'Combustível / Veículos'
      WHEN 'combustível' THEN 'Combustível / Veículos'
      WHEN 'manutencao' THEN 'Manutenção / Equipamentos'
      WHEN 'manutenção' THEN 'Manutenção / Equipamentos'
      WHEN 'software' THEN 'Software / Assinaturas'
      WHEN 'tarifas' THEN 'Tarifas Bancárias'
      WHEN 'juros' THEN 'Juros e Multas'
      WHEN 'emprestimo' THEN 'Empréstimos / Financ.'
      WHEN 'empréstimo' THEN 'Empréstimos / Financ.'
      WHEN 'das' THEN 'Simples Nacional / DAS'
      WHEN 'simples' THEN 'Simples Nacional / DAS'
      WHEN 'icms' THEN 'ICMS'
      WHEN 'iss' THEN 'ISS'
      ELSE 'Outras Despesas'
    END;

    SELECT id INTO v_cat_id
    FROM public.financial_categories
    WHERE company_id = r.company_id AND name = v_map AND kind = 'despesa'
    LIMIT 1;

    IF v_cat_id IS NULL THEN
      SELECT id INTO v_cat_id FROM public.financial_categories
      WHERE company_id = r.company_id AND name = 'Outras Despesas' LIMIT 1;
    END IF;

    IF v_cat_id IS NOT NULL THEN
      UPDATE public.expenses SET category_id = v_cat_id WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- 2) Backfill accounts_receivable.category_id with default "Vendas de Produtos"
UPDATE public.accounts_receivable ar
SET category_id = fc.id
FROM public.financial_categories fc
WHERE ar.category_id IS NULL
  AND fc.company_id = ar.company_id
  AND fc.kind = 'receita'
  AND fc.name = CASE WHEN ar.ordem_servico_id IS NOT NULL THEN 'Prestação de Serviços' ELSE 'Vendas de Produtos' END;

-- 3) DRE report function (grouped by dre_group + category)
CREATE OR REPLACE FUNCTION public.get_dre_report(
  p_company_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE (
  kind TEXT,
  dre_group TEXT,
  category_id UUID,
  category_name TEXT,
  category_color TEXT,
  amount NUMERIC,
  count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Receitas: accounts_receivable pagos no período
  SELECT
    'receita'::TEXT AS kind,
    COALESCE(fc.dre_group, 'receita_bruta') AS dre_group,
    fc.id AS category_id,
    COALESCE(fc.name, 'Sem categoria') AS category_name,
    COALESCE(fc.color, '#10b981') AS category_color,
    SUM(COALESCE(ar.paid_amount, ar.total_amount))::NUMERIC AS amount,
    COUNT(*)::BIGINT AS count
  FROM public.accounts_receivable ar
  LEFT JOIN public.financial_categories fc ON fc.id = ar.category_id
  WHERE ar.company_id = p_company_id
    AND ar.status IN ('paid','partial')
    AND ar.paid_date BETWEEN p_start AND p_end
  GROUP BY fc.id, fc.dre_group, fc.name, fc.color

  UNION ALL

  -- Despesas: expenses pagas no período
  SELECT
    'despesa'::TEXT,
    COALESCE(fc.dre_group, 'outras_despesas'),
    fc.id,
    COALESCE(fc.name, 'Sem categoria'),
    COALESCE(fc.color, '#ef4444'),
    SUM(COALESCE(e.amount, 0))::NUMERIC,
    COUNT(*)::BIGINT
  FROM public.expenses e
  LEFT JOIN public.financial_categories fc ON fc.id = e.category_id
  WHERE e.company_id = p_company_id
    AND e.status = 'paid'
    AND e.paid_date BETWEEN p_start AND p_end
  GROUP BY fc.id, fc.dre_group, fc.name, fc.color
$$;

GRANT EXECUTE ON FUNCTION public.get_dre_report(UUID, DATE, DATE) TO authenticated;

-- 4) Cash flow projection (daily realized + projected)
CREATE OR REPLACE FUNCTION public.get_cash_flow_projection(
  p_company_id UUID,
  p_start DATE,
  p_end DATE
)
RETURNS TABLE (
  date DATE,
  realized_in NUMERIC,
  realized_out NUMERIC,
  projected_in NUMERIC,
  projected_out NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH days AS (
    SELECT generate_series(p_start, p_end, '1 day'::interval)::date AS d
  ),
  rec_in AS (
    SELECT paid_date AS d, SUM(COALESCE(paid_amount, total_amount)) AS v
    FROM public.accounts_receivable
    WHERE company_id = p_company_id AND status IN ('paid','partial') AND paid_date BETWEEN p_start AND p_end
    GROUP BY paid_date
  ),
  rec_out AS (
    SELECT paid_date AS d, SUM(amount) AS v
    FROM public.expenses
    WHERE company_id = p_company_id AND status = 'paid' AND paid_date BETWEEN p_start AND p_end
    GROUP BY paid_date
  ),
  proj_in AS (
    SELECT due_date AS d, SUM(total_amount - COALESCE(paid_amount,0)) AS v
    FROM public.accounts_receivable
    WHERE company_id = p_company_id AND status IN ('pending','partial','overdue') AND due_date BETWEEN p_start AND p_end
    GROUP BY due_date
  ),
  proj_out AS (
    SELECT due_date AS d, SUM(amount - COALESCE(paid_amount,0)) AS v
    FROM public.expenses
    WHERE company_id = p_company_id AND status IN ('pending','overdue') AND due_date BETWEEN p_start AND p_end
    GROUP BY due_date
  )
  SELECT
    days.d,
    COALESCE(rec_in.v, 0)::NUMERIC,
    COALESCE(rec_out.v, 0)::NUMERIC,
    COALESCE(proj_in.v, 0)::NUMERIC,
    COALESCE(proj_out.v, 0)::NUMERIC
  FROM days
  LEFT JOIN rec_in ON rec_in.d = days.d
  LEFT JOIN rec_out ON rec_out.d = days.d
  LEFT JOIN proj_in ON proj_in.d = days.d
  LEFT JOIN proj_out ON proj_out.d = days.d
  ORDER BY days.d
$$;

GRANT EXECUTE ON FUNCTION public.get_cash_flow_projection(UUID, DATE, DATE) TO authenticated;
