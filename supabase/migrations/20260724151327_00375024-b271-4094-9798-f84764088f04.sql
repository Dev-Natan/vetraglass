-- ============================================================
-- FASE 5.18 — Reconciliação complementar
-- ============================================================

-- ---------- COMPANIES ----------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS default_presentation_text text;

-- ---------- AUDIT_LOGS ----------
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS record_id uuid,
  ADD COLUMN IF NOT EXISTS old_data jsonb,
  ADD COLUMN IF NOT EXISTS new_data jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- ---------- QUOTE_ITEMS ----------
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'product',
  ADD COLUMN IF NOT EXISTS width_c numeric,
  ADD COLUMN IF NOT EXISTS height_c numeric,
  ADD COLUMN IF NOT EXISTS leaves_count integer,
  ADD COLUMN IF NOT EXISTS glasses_count integer,
  ADD COLUMN IF NOT EXISTS panels_count integer,
  ADD COLUMN IF NOT EXISTS sides_count integer,
  ADD COLUMN IF NOT EXISTS include_contramarco boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS excluded_optional_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

-- ---------- OS_MATERIALS ----------
ALTER TABLE public.os_materials
  ADD COLUMN IF NOT EXISTS waste_mm numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bar_length_mm numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS profile_name text;

-- ---------- MATERIAL_CONSUMPTION ----------
ALTER TABLE public.material_consumption
  ADD COLUMN IF NOT EXISTS os_item_id uuid,
  ADD COLUMN IF NOT EXISTS quote_item_id uuid,
  ADD COLUMN IF NOT EXISTS formula_used text,
  ADD COLUMN IF NOT EXISTS input_width numeric,
  ADD COLUMN IF NOT EXISTS input_height numeric,
  ADD COLUMN IF NOT EXISTS input_quantity numeric,
  ADD COLUMN IF NOT EXISTS quantity_calculated numeric;

-- ---------- OS_CUTTING_PLAN ----------
ALTER TABLE public.os_cutting_plan
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- ---------- COMPANY_NOTIFICATION_SETTINGS ----------
ALTER TABLE public.company_notification_settings
  ADD COLUMN IF NOT EXISTS email_new_quote boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_quote_approved boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_order_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_payment_received boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_low_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_expense_due boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_digest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_report boolean NOT NULL DEFAULT true;

-- ---------- COMPANY_SECURITY_SETTINGS ----------
ALTER TABLE public.company_security_settings
  ADD COLUMN IF NOT EXISTS require_strong_password boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS password_expiry_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lockout_duration_minutes integer NOT NULL DEFAULT 15;