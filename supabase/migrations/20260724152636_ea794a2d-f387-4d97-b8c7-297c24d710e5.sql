-- Garante que as colunas existem (idempotente) e recarrega o cache do PostgREST
ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS base_price NUMERIC,
  ADD COLUMN IF NOT EXISTS min_width NUMERIC,
  ADD COLUMN IF NOT EXISTS max_width NUMERIC,
  ADD COLUMN IF NOT EXISTS min_height NUMERIC,
  ADD COLUMN IF NOT EXISTS max_height NUMERIC;

-- Força reload do schema cache do PostgREST
NOTIFY pgrst, 'reload schema';