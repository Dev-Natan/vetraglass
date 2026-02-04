-- 1. Corrigir profiles_safe para respeitar RLS
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe 
WITH (security_invoker = on) AS
SELECT 
    id,
    user_id,
    full_name,
    avatar_url,
    created_at
FROM profiles
WHERE 
    -- Usuário pode ver seu próprio perfil
    user_id = auth.uid()
    OR 
    -- Ou perfis de colegas na mesma empresa ativa
    users_share_active_company(auth.uid(), user_id);

-- 2. Corrigir quote_financial_status para filtrar por empresa
DROP VIEW IF EXISTS public.quote_financial_status;
CREATE VIEW public.quote_financial_status 
WITH (security_invoker = on) AS
SELECT 
    q.id AS quote_id,
    q.company_id,
    q.quote_number,
    q.customer_name,
    q.final_amount AS quote_total,
    q.status AS quote_status,
    q.created_at,
    COALESCE((
        SELECT SUM(qd.amount)
        FROM quote_deposits qd
        WHERE qd.quote_id = q.id 
        AND qd.status IN ('received', 'billed')
    ), 0) AS total_deposits,
    COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE s.quote_id = q.id 
        AND s.payment_status <> 'cancelled'
    ), 0) AS total_sold,
    (q.final_amount - COALESCE((
        SELECT SUM(qd.amount)
        FROM quote_deposits qd
        WHERE qd.quote_id = q.id 
        AND qd.status IN ('received', 'billed')
    ), 0) - COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE s.quote_id = q.id 
        AND s.payment_status <> 'cancelled'
    ), 0)) AS pending_amount,
    CASE
        WHEN (q.final_amount - COALESCE((
            SELECT SUM(qd.amount)
            FROM quote_deposits qd
            WHERE qd.quote_id = q.id 
            AND qd.status IN ('received', 'billed')
        ), 0) - COALESCE((
            SELECT SUM(s.total_amount)
            FROM sales s
            WHERE s.quote_id = q.id 
            AND s.payment_status <> 'cancelled'
        ), 0)) <= 0 THEN 'fully_paid'
        WHEN (COALESCE((
            SELECT SUM(qd.amount)
            FROM quote_deposits qd
            WHERE qd.quote_id = q.id 
            AND qd.status IN ('received', 'billed')
        ), 0) + COALESCE((
            SELECT SUM(s.total_amount)
            FROM sales s
            WHERE s.quote_id = q.id 
            AND s.payment_status <> 'cancelled'
        ), 0)) > 0 THEN 'partially_paid'
        ELSE 'pending'
    END AS financial_status
FROM quotes q
WHERE q.status = 'approved'
AND user_belongs_to_company(auth.uid(), q.company_id);

-- 3. Criar view segura para ordens_servico que mascara dados sensíveis do cliente
CREATE OR REPLACE VIEW public.ordens_servico_safe 
WITH (security_invoker = on) AS
SELECT 
    id,
    company_id,
    quote_id,
    sale_id,
    os_number,
    status,
    priority,
    assigned_to,
    estimated_start,
    estimated_end,
    actual_start,
    actual_end,
    total_amount,
    paid_amount,
    pending_amount,
    notes,
    current_stage,
    stages,
    created_at,
    updated_at,
    -- Dados do cliente mascarados para funcionários comuns
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN customer_name
        ELSE split_part(customer_name, ' ', 1) -- Só primeiro nome
    END AS customer_name,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN customer_phone
        ELSE NULL
    END AS customer_phone,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN customer_email
        ELSE NULL
    END AS customer_email,
    CASE
        WHEN user_has_elevated_role_in_company(auth.uid(), company_id) THEN customer_address
        ELSE NULL
    END AS customer_address
FROM ordens_servico
WHERE user_belongs_to_company(auth.uid(), company_id);