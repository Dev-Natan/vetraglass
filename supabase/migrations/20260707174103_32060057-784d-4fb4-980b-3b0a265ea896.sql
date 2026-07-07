ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS enable_presentation_page BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_presentation_text TEXT;