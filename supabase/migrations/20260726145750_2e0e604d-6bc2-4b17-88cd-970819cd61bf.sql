ALTER TABLE public.company_payment_settings ADD COLUMN IF NOT EXISTS show_installments boolean NOT NULL DEFAULT true;
NOTIFY pgrst, 'reload schema';