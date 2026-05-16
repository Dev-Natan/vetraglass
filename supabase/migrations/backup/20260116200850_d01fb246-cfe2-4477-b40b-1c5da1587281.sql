-- Create table for company payment settings
CREATE TABLE public.company_payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_conditions TEXT,
  show_fees_to_customer BOOLEAN NOT NULL DEFAULT false,
  display_mode TEXT NOT NULL DEFAULT 'simple' CHECK (display_mode IN ('simple', 'detailed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

-- Enable RLS
ALTER TABLE public.company_payment_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their company payment settings"
ON public.company_payment_settings
FOR SELECT
USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Admins can insert payment settings"
ON public.company_payment_settings
FOR INSERT
WITH CHECK (public.user_has_elevated_role_in_company(auth.uid(), company_id));

CREATE POLICY "Admins can update payment settings"
ON public.company_payment_settings
FOR UPDATE
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id));

CREATE POLICY "Admins can delete payment settings"
ON public.company_payment_settings
FOR DELETE
USING (public.user_has_elevated_role_in_company(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_company_payment_settings_updated_at
BEFORE UPDATE ON public.company_payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();