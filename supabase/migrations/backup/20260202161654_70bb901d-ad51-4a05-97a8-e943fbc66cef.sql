-- Recriar a VIEW com SECURITY INVOKER para respeitar as políticas RLS do usuário
DROP VIEW IF EXISTS public.quote_financial_status;

CREATE VIEW public.quote_financial_status
WITH (security_invoker = on)
AS
SELECT
    q.id AS quote_id,
    q.company_id,
    q.quote_number,
    q.customer_name,
    q.final_amount AS quote_total,
    q.status AS quote_status,
    q.created_at,

    -- Total de entradas recebidas
    COALESCE((
        SELECT SUM(qd.amount)
        FROM public.quote_deposits qd
        WHERE qd.quote_id = q.id
          AND qd.status IN ('received', 'billed')
    ), 0) AS total_deposits,

    -- Total já vendido/faturado
    COALESCE((
        SELECT SUM(s.total_amount)
        FROM public.sales s
        WHERE s.quote_id = q.id
          AND s.payment_status != 'cancelled'
    ), 0) AS total_sold,

    -- Saldo real disponível para faturamento
    q.final_amount
    - COALESCE((
        SELECT SUM(qd.amount)
        FROM public.quote_deposits qd
        WHERE qd.quote_id = q.id
          AND qd.status IN ('received', 'billed')
    ), 0)
    - COALESCE((
        SELECT SUM(s.total_amount)
        FROM public.sales s
        WHERE s.quote_id = q.id
          AND s.payment_status != 'cancelled'
    ), 0) AS pending_amount,

    -- Status financeiro inteligente
    CASE
        WHEN (
            q.final_amount
            - COALESCE((
                SELECT SUM(qd.amount)
                FROM public.quote_deposits qd
                WHERE qd.quote_id = q.id
                  AND qd.status IN ('received', 'billed')
            ), 0)
            - COALESCE((
                SELECT SUM(s.total_amount)
                FROM public.sales s
                WHERE s.quote_id = q.id
                  AND s.payment_status != 'cancelled'
            ), 0)
        ) <= 0 THEN 'fully_paid'

        WHEN (
            COALESCE((
                SELECT SUM(qd.amount)
                FROM public.quote_deposits qd
                WHERE qd.quote_id = q.id
                  AND qd.status IN ('received', 'billed')
            ), 0)
            +
            COALESCE((
                SELECT SUM(s.total_amount)
                FROM public.sales s
                WHERE s.quote_id = q.id
                  AND s.payment_status != 'cancelled'
            ), 0)
        ) > 0 THEN 'partially_paid'

        ELSE 'pending'
    END AS financial_status

FROM public.quotes q
WHERE q.status = 'approved';

COMMENT ON VIEW public.quote_financial_status IS 'View com SECURITY INVOKER que calcula o status financeiro de orçamentos aprovados';