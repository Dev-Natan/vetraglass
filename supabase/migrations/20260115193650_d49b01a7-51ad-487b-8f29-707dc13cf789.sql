-- =====================================================
-- FASE 2: ÍNDICES COMPOSTOS PARA CONSULTAS FREQUENTES
-- =====================================================

-- Índices para quotes (consultas por empresa + status + data)
CREATE INDEX IF NOT EXISTS idx_quotes_company_status ON public.quotes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_company_created ON public.quotes(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_company_number ON public.quotes(company_id, quote_number DESC);

-- Índices para sales (relatórios financeiros)
CREATE INDEX IF NOT EXISTS idx_sales_company_created ON public.sales(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_company_payment ON public.sales(company_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_sales_company_status ON public.sales(company_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_cash_register ON public.sales(cash_register_id, created_at DESC);

-- Índices para ordens de serviço
CREATE INDEX IF NOT EXISTS idx_ordens_company_status ON public.ordens_servico(company_id, status);
CREATE INDEX IF NOT EXISTS idx_ordens_company_created ON public.ordens_servico(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_quote ON public.ordens_servico(quote_id);

-- Índices para agendamentos
CREATE INDEX IF NOT EXISTS idx_appointments_company_date ON public.service_appointments(company_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_appointments_company_status ON public.service_appointments(company_id, status);

-- Índices para clientes
CREATE INDEX IF NOT EXISTS idx_clients_company_active ON public.clients(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_id, name);

-- Índices para estoque
CREATE INDEX IF NOT EXISTS idx_stock_company_active ON public.company_stock(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_stock_company_item ON public.company_stock(company_id, item_template_id);

-- Índices para notas fiscais
CREATE INDEX IF NOT EXISTS idx_notas_company_status ON public.notas_fiscais(company_id, status);
CREATE INDEX IF NOT EXISTS idx_notas_company_created ON public.notas_fiscais(company_id, created_at DESC);

-- Índices para item_templates (busca por linha/tipo)
CREATE INDEX IF NOT EXISTS idx_items_linha_active ON public.item_templates(linha, is_active);
CREATE INDEX IF NOT EXISTS idx_items_type_active ON public.item_templates(type, is_active);

-- Índices para product_templates
CREATE INDEX IF NOT EXISTS idx_products_linha_active ON public.product_templates(linha, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON public.product_templates(category, is_active);

-- Índices para company_item_prices
CREATE INDEX IF NOT EXISTS idx_item_prices_company ON public.company_item_prices(company_id, item_template_id);

-- Índices para audit_logs (consultas de histórico)
CREATE INDEX IF NOT EXISTS idx_audit_company_created ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table_action ON public.audit_logs(table_name, action);

-- Índices para login_attempts (rate limiting)
CREATE INDEX IF NOT EXISTS idx_login_email_created ON public.login_attempts(email, created_at DESC);

-- =====================================================
-- FUNÇÃO HELPER PARA OTIMIZAR RLS
-- =====================================================

-- Função que retorna array de company_ids do usuário
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(company_id)
  FROM public.user_companies
  WHERE user_id = _user_id
    AND is_active = true
$$;

-- =====================================================
-- VIEW MATERIALIZADA PARA DASHBOARD FINANCEIRO
-- =====================================================

-- View materializada para resumo financeiro por empresa/dia
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_company_daily_summary AS
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_summary_unique 
ON public.mv_company_daily_summary(company_id, sale_date, payment_method);

-- Índice para consultas
CREATE INDEX IF NOT EXISTS idx_mv_daily_summary_company 
ON public.mv_company_daily_summary(company_id, sale_date DESC);

-- Função para refresh da view materializada
CREATE OR REPLACE FUNCTION public.refresh_daily_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_company_daily_summary;
END;
$$;