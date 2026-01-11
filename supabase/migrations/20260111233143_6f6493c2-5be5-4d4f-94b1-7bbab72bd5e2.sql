-- Remove the old check constraint and add a new one that includes 'cancelled'
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;

ALTER TABLE public.sales ADD CONSTRAINT sales_payment_status_check 
CHECK (payment_status IN ('paid', 'pending', 'cancelled', 'refunded'));