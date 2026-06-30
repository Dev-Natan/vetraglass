
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), p_company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    'receita'::TEXT,
    COALESCE(fc.dre_group, 'receita_bruta'),
    fc.id,
    COALESCE(fc.name, 'Sem categoria'),
    COALESCE(fc.color, '#10b981'),
    SUM(COALESCE(ar.paid_amount, ar.total_amount))::NUMERIC,
    COUNT(*)::BIGINT
  FROM public.accounts_receivable ar
  LEFT JOIN public.financial_categories fc ON fc.id = ar.category_id
  WHERE ar.company_id = p_company_id
    AND ar.status IN ('paid','partial')
    AND ar.paid_date BETWEEN p_start AND p_end
  GROUP BY fc.id, fc.dre_group, fc.name, fc.color

  UNION ALL

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
  GROUP BY fc.id, fc.dre_group, fc.name, fc.color;
END $$;

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_belongs_to_company(auth.uid(), p_company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
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
  ORDER BY days.d;
END $$;

GRANT EXECUTE ON FUNCTION public.get_dre_report(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_flow_projection(UUID, DATE, DATE) TO authenticated;
