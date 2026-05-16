-- Fix: Add 'cancelled' to quote_deposits_status_check constraint
-- The cancel_approved_quote RPC needs to set status to 'cancelled'
ALTER TABLE public.quote_deposits DROP CONSTRAINT quote_deposits_status_check;
ALTER TABLE public.quote_deposits ADD CONSTRAINT quote_deposits_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'received'::text, 'billed'::text, 'cancelled'::text]));