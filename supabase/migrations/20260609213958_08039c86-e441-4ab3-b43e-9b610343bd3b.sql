-- Remove backend audit/manager approval flow for cash closing.
-- Closure now always completes directly via close_cash_register_direct.

DROP FUNCTION IF EXISTS public.submit_cash_closing_for_audit(uuid, jsonb, text);
DROP FUNCTION IF EXISTS public.submit_cash_closing_for_audit(uuid, numeric, jsonb, text);
DROP FUNCTION IF EXISTS public.complete_cash_audit(uuid, text, text, numeric);
DROP FUNCTION IF EXISTS public.get_pending_cash_audits(uuid);