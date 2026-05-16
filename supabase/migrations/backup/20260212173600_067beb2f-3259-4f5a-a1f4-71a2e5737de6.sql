
-- 1. Unique constraint: one OS per quote
CREATE UNIQUE INDEX uq_ordens_servico_quote_id 
ON public.ordens_servico (quote_id) 
WHERE quote_id IS NOT NULL AND status != 'cancelled';

-- 2. Unique constraint: one receivable per quote+installment (excluding cancelled)
CREATE UNIQUE INDEX uq_accounts_receivable_quote_installment 
ON public.accounts_receivable (quote_id, installment_number) 
WHERE quote_id IS NOT NULL AND status != 'cancelled';

-- 3. Unique constraint: one sale per quote+type (excluding cancelled)
CREATE UNIQUE INDEX uq_sales_quote_type 
ON public.sales (quote_id, sale_type) 
WHERE quote_id IS NOT NULL AND payment_status != 'cancelled';
