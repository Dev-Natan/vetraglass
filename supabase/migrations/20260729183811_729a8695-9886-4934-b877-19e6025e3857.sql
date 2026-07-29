-- Backfill: create cash_movements for existing sales via PIX/cartão that don't have a matching movement
INSERT INTO public.cash_movements (
  company_id, cash_register_id, type, category, amount, description,
  payment_method, sale_id, created_by, origem, created_at
)
SELECT
  s.company_id,
  s.cash_register_id,
  'entrada',
  'venda',
  s.total_amount,
  'Venda #' || LPAD(COALESCE(s.sale_number::text,'0'),4,'0') || COALESCE(' - ' || s.customer_name,''),
  s.payment_method,
  s.id,
  NULL,
  'venda',
  s.created_at
FROM public.sales s
WHERE s.cash_register_id IS NOT NULL
  AND s.payment_status <> 'cancelled'
  AND s.payment_method IN ('pix','cartao','cartao_debito','cartao_credito')
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_movements m
    WHERE m.sale_id = s.id
      AND m.category IN ('venda','recebimento_parcial','entrada_orcamento')
  );