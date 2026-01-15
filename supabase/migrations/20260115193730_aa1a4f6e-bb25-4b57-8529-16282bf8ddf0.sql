-- Remover a view materializada anterior do public (se existir)
DROP MATERIALIZED VIEW IF EXISTS public.mv_company_daily_summary CASCADE;
DROP FUNCTION IF EXISTS public.refresh_daily_summary() CASCADE;

-- Criar schema analytics para views materializadas (fora da API)
CREATE SCHEMA IF NOT EXISTS analytics;

-- Criar view materializada no schema analytics
CREATE MATERIALIZED VIEW analytics.mv_company_daily_summary AS
SELECT 
  company_id,
  DATE_TRUNC('day', created_at)::date as sale_date,
  COUNT(*) as total_sales,
  SUM(total_amount) as total_revenue,
  SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as paid_revenue,
  SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END) as pending_revenue,
  payment_method,
  COUNT(DISTINCT client_id) as unique_clients
FROM public.sales
GROUP BY company_id, DATE_TRUNC('day', created_at)::date, payment_method;

-- Índice único para refresh concorrente
CREATE UNIQUE INDEX idx_mv_daily_summary_unique 
ON analytics.mv_company_daily_summary(company_id, sale_date, COALESCE(payment_method, 'none'));

-- Índice para consultas
CREATE INDEX idx_mv_daily_summary_company 
ON analytics.mv_company_daily_summary(company_id, sale_date DESC);

-- Função segura para acessar dados do dashboard
CREATE OR REPLACE FUNCTION public.get_company_daily_summary(
  _company_id uuid,
  _start_date date DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  _end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  sale_date date,
  total_sales bigint,
  total_revenue numeric,
  paid_revenue numeric,
  pending_revenue numeric,
  payment_method text,
  unique_clients bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se usuário pertence à empresa
  IF NOT user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  
  RETURN QUERY
  SELECT 
    s.sale_date,
    s.total_sales,
    s.total_revenue,
    s.paid_revenue,
    s.pending_revenue,
    s.payment_method,
    s.unique_clients
  FROM analytics.mv_company_daily_summary s
  WHERE s.company_id = _company_id
    AND s.sale_date BETWEEN _start_date AND _end_date
  ORDER BY s.sale_date DESC;
END;
$$;

-- Função para refresh da view materializada
CREATE OR REPLACE FUNCTION public.refresh_daily_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_company_daily_summary;
END;
$$;