-- Adicionar coluna client_id nas tabelas financeiras para garantir integridade e rastreabilidade
-- eliminando a necessidade de fallback por nome de cliente.

-- 1. quote_deposits
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quote_deposits' AND column_name = 'client_id') THEN
    ALTER TABLE public.quote_deposits ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. accounts_receivable
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts_receivable' AND column_name = 'client_id') THEN
    ALTER TABLE public.accounts_receivable ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Migração de dados legados baseada no customer_name + company_id
UPDATE public.quotes q
SET client_id = c.id
FROM public.clients c
WHERE q.client_id IS NULL 
  AND q.customer_name = c.name 
  AND q.company_id = c.company_id;

UPDATE public.ordens_servico os
SET client_id = c.id
FROM public.clients c
WHERE os.client_id IS NULL 
  AND os.customer_name = c.name 
  AND os.company_id = c.company_id;

UPDATE public.accounts_receivable ar
SET client_id = c.id
FROM public.clients c
WHERE ar.client_id IS NULL 
  AND ar.customer_name = c.name 
  AND ar.company_id = c.company_id;

UPDATE public.quote_deposits qd
SET client_id = c.id
FROM public.clients c
WHERE qd.client_id IS NULL 
  AND qd.customer_name = c.name 
  AND qd.company_id = c.company_id;

UPDATE public.sales s
SET client_id = c.id
FROM public.clients c
WHERE s.client_id IS NULL 
  AND s.customer_name = c.name 
  AND s.company_id = c.company_id;

UPDATE public.cash_movements cm
SET cliente_id = c.id
FROM public.clients c
WHERE cm.cliente_id IS NULL 
  AND cm.party_type = 'cliente'
  AND cm.party_name = c.name
  AND cm.company_id = c.company_id;

-- 4. GRANTs
GRANT SELECT, INSERT, UPDATE ON public.quote_deposits TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.accounts_receivable TO authenticated;
GRANT ALL ON public.quote_deposits TO service_role;
GRANT ALL ON public.accounts_receivable TO service_role;
