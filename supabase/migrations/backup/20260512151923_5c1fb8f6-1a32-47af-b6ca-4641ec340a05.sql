ALTER TABLE public.employees 
ADD COLUMN commission_trigger TEXT DEFAULT 'sale' CHECK (commission_trigger IN ('sale', 'payment'));

COMMENT ON COLUMN public.employees.commission_trigger IS 'Define quando a comissão é gerada: sale (no momento da venda) ou payment (quando o cliente paga).';