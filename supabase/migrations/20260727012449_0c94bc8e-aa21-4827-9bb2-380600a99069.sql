ALTER TABLE public.company_products
  ADD COLUMN IF NOT EXISTS acabamento text,
  ADD COLUMN IF NOT EXISTS cor_componentes text,
  ADD COLUMN IF NOT EXISTS reforco text,
  ADD COLUMN IF NOT EXISTS contramarco text,
  ADD COLUMN IF NOT EXISTS corte_contramarco text,
  ADD COLUMN IF NOT EXISTS arremate text,
  ADD COLUMN IF NOT EXISTS composition_finished boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';