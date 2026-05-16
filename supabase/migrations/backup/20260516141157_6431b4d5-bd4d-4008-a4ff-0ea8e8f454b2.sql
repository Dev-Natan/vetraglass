ALTER TABLE public.cash_movements 
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ordem_servico_id UUID REFERENCES public.ordens_servico(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cash_movements_quote_id ON public.cash_movements(quote_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_os_id ON public.cash_movements(ordem_servico_id);