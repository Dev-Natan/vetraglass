-- Fase 5.21

ALTER TABLE public.company_notification_settings
  ADD COLUMN IF NOT EXISTS notify_overdue_orders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_pending_quotes boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_low_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_expense_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_quote_expiring boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_overdue_receivables boolean NOT NULL DEFAULT true;

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS can_view boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_create boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_edit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete boolean NOT NULL DEFAULT false;

-- Converte order_number de purchase_orders para inteiro
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_orders' AND column_name='order_number' AND data_type='text') THEN
    ALTER TABLE public.purchase_orders ALTER COLUMN order_number TYPE bigint USING NULLIF(order_number,'')::bigint;
  END IF;
END $$;