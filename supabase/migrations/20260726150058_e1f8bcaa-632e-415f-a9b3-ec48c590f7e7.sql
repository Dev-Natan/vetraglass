ALTER TABLE public.company_payment_settings
  ADD COLUMN IF NOT EXISTS show_other_methods boolean NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';