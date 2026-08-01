-- Migrating any potential data from suppliers to clients first (safety measure)
INSERT INTO public.clients (company_id, name, document, phone, email, client_type, is_active)
SELECT company_id, name, document, phone, email, 'fornecedor', true
FROM public.suppliers
ON CONFLICT DO NOTHING;

-- Drop the suppliers table
DROP TABLE IF EXISTS public.suppliers CASCADE;
