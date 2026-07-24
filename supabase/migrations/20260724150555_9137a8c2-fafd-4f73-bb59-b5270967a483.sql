
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_size text;
ALTER TABLE public.service_appointments ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL;

ALTER TABLE public.quote_items ALTER COLUMN glass_thickness TYPE text USING glass_thickness::text;

ALTER TABLE public.company_payment_settings
  ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS custom_conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS show_fees_to_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'summary';
