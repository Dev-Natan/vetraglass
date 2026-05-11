ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS show_measures_column boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_m2_column boolean NOT NULL DEFAULT true;