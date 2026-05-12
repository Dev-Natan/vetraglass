ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS audit_status text;
ALTER TABLE public.cash_registers ADD COLUMN IF NOT EXISTS closing_requested_at timestamptz;