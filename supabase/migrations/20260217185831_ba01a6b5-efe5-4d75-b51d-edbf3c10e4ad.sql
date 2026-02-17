
-- Add detailed address fields to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS street text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS complement text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS zip_code text;
