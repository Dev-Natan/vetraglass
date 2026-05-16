-- Trigger to auto-cancel accounts_receivable when a sale is cancelled
CREATE OR REPLACE FUNCTION public.auto_cancel_receivables_on_sale_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'cancelled' AND (OLD.payment_status IS DISTINCT FROM 'cancelled') THEN
    -- Cancel AR linked directly to this sale
    UPDATE public.accounts_receivable
    SET status = 'cancelled', updated_at = now()
    WHERE sale_id = NEW.id AND status IN ('pending', 'overdue');

    -- Cancel AR linked to the related OS
    IF NEW.ordem_servico_id IS NOT NULL THEN
      UPDATE public.accounts_receivable
      SET status = 'cancelled', updated_at = now()
      WHERE ordem_servico_id = NEW.ordem_servico_id AND status IN ('pending', 'overdue');
    END IF;

    -- Cancel AR linked to the related quote
    IF NEW.quote_id IS NOT NULL THEN
      UPDATE public.accounts_receivable
      SET status = 'cancelled', updated_at = now()
      WHERE quote_id = NEW.quote_id AND status IN ('pending', 'overdue');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_cancel_receivables ON public.sales;
CREATE TRIGGER trg_auto_cancel_receivables
AFTER UPDATE OF payment_status ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.auto_cancel_receivables_on_sale_cancel();

-- Backfill: cancel any stale receivables whose linked sale is already cancelled
UPDATE public.accounts_receivable ar
SET status = 'cancelled', updated_at = now()
FROM public.sales s
WHERE ar.status IN ('pending', 'overdue')
  AND s.payment_status = 'cancelled'
  AND (
    ar.sale_id = s.id
    OR (s.ordem_servico_id IS NOT NULL AND ar.ordem_servico_id = s.ordem_servico_id)
    OR (s.quote_id IS NOT NULL AND ar.quote_id = s.quote_id)
  );