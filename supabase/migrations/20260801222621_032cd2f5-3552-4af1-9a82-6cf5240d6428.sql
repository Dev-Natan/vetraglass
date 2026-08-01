ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT 'cliente' CHECK (client_type IN ('cliente', 'fornecedor'));
COMMENT ON COLUMN public.clients.client_type IS 'Type of the registry: cliente (customer) or fornecedor (supplier)';
UPDATE public.clients SET client_type = 'cliente' WHERE client_type IS NULL;
ALTER TABLE public.clients ALTER COLUMN client_type SET NOT NULL;
