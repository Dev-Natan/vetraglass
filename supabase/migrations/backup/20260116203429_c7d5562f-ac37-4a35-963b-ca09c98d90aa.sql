-- Add column to toggle installment section visibility in PDF
ALTER TABLE public.company_payment_settings 
ADD COLUMN IF NOT EXISTS show_installments boolean DEFAULT true;