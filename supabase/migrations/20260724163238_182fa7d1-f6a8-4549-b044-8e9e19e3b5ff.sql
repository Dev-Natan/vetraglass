ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS inscricao_estadual text,
  ADD COLUMN IF NOT EXISTS inscricao_municipal text,
  ADD COLUMN IF NOT EXISTS regime_tributario text;

NOTIFY pgrst, 'reload schema';