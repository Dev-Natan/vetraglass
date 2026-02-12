
-- Fix: Excluir vendas parciais (que representam depósitos) do cálculo de total_sold
-- para evitar dupla contagem com total_deposits
CREATE OR REPLACE VIEW public.quote_financial_status AS
SELECT 
  id AS quote_id,
  company_id,
  quote_number,
  customer_name,
  final_amount AS quote_total,
  status AS quote_status,
  created_at,
  COALESCE((
    SELECT sum(qd.amount)
    FROM quote_deposits qd
    WHERE qd.quote_id = q.id AND qd.status IN ('received', 'billed')
  ), 0) AS total_deposits,
  COALESCE((
    SELECT sum(s.total_amount)
    FROM sales s
    WHERE s.quote_id = q.id 
      AND s.payment_status <> 'cancelled'
      AND s.sale_type <> 'partial'
  ), 0) AS total_sold,
  final_amount 
    - COALESCE((
        SELECT sum(qd.amount)
        FROM quote_deposits qd
        WHERE qd.quote_id = q.id AND qd.status IN ('received', 'billed')
      ), 0) 
    - COALESCE((
        SELECT sum(s.total_amount)
        FROM sales s
        WHERE s.quote_id = q.id 
          AND s.payment_status <> 'cancelled'
          AND s.sale_type <> 'partial'
      ), 0) AS pending_amount,
  CASE
    WHEN (final_amount 
      - COALESCE((SELECT sum(qd.amount) FROM quote_deposits qd WHERE qd.quote_id = q.id AND qd.status IN ('received', 'billed')), 0) 
      - COALESCE((SELECT sum(s.total_amount) FROM sales s WHERE s.quote_id = q.id AND s.payment_status <> 'cancelled' AND s.sale_type <> 'partial'), 0)
    ) <= 0 THEN 'fully_paid'
    WHEN (
      COALESCE((SELECT sum(qd.amount) FROM quote_deposits qd WHERE qd.quote_id = q.id AND qd.status IN ('received', 'billed')), 0) 
      + COALESCE((SELECT sum(s.total_amount) FROM sales s WHERE s.quote_id = q.id AND s.payment_status <> 'cancelled' AND s.sale_type <> 'partial'), 0)
    ) > 0 THEN 'partially_paid'
    ELSE 'pending'
  END AS financial_status
FROM quotes q
WHERE status = 'approved' AND user_belongs_to_company(auth.uid(), company_id);
