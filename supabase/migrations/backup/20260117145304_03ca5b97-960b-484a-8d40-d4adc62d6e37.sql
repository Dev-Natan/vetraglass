-- Create notification settings table
CREATE TABLE IF NOT EXISTS public.company_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Email notifications
  email_new_quote BOOLEAN DEFAULT true,
  email_quote_approved BOOLEAN DEFAULT true,
  email_order_status BOOLEAN DEFAULT true,
  email_payment_received BOOLEAN DEFAULT true,
  email_low_stock BOOLEAN DEFAULT true,
  email_expense_due BOOLEAN DEFAULT true,
  
  -- System notifications
  notify_overdue_orders BOOLEAN DEFAULT true,
  notify_pending_quotes BOOLEAN DEFAULT true,
  notify_low_stock BOOLEAN DEFAULT true,
  notify_expense_alerts BOOLEAN DEFAULT true,
  
  -- Digest settings
  daily_digest BOOLEAN DEFAULT false,
  weekly_report BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(company_id)
);

-- Create security settings table
CREATE TABLE IF NOT EXISTS public.company_security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Password policies
  require_strong_password BOOLEAN DEFAULT true,
  password_expiry_days INTEGER DEFAULT 0, -- 0 = never expires
  
  -- Session settings
  session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
  
  -- Two-factor auth
  two_factor_enabled BOOLEAN DEFAULT false,
  
  -- Login restrictions
  max_login_attempts INTEGER DEFAULT 5,
  lockout_duration_minutes INTEGER DEFAULT 15,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.company_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_security_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notification settings
CREATE POLICY "Users can view own company notification settings"
ON public.company_notification_settings FOR SELECT
USING (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

CREATE POLICY "Users can update own company notification settings"
ON public.company_notification_settings FOR UPDATE
USING (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

CREATE POLICY "Users can insert own company notification settings"
ON public.company_notification_settings FOR INSERT
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

-- RLS Policies for security settings
CREATE POLICY "Users can view own company security settings"
ON public.company_security_settings FOR SELECT
USING (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

CREATE POLICY "Users can update own company security settings"
ON public.company_security_settings FOR UPDATE
USING (company_id IN (SELECT id FROM public.companies WHERE id = company_id));

CREATE POLICY "Users can insert own company security settings"
ON public.company_security_settings FOR INSERT
WITH CHECK (company_id IN (SELECT id FROM public.companies WHERE id = company_id));