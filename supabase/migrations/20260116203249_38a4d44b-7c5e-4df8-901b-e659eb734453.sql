-- Add show_other_methods column to company_payment_settings
ALTER TABLE public.company_payment_settings 
ADD COLUMN IF NOT EXISTS show_other_methods boolean DEFAULT true;