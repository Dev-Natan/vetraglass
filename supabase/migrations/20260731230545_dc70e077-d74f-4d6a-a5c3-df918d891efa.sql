CREATE OR REPLACE FUNCTION public.sync_company_subscription_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := lower(coalesce(NEW.status, ''));
  v_plan text := lower(coalesce(NEW.plan_name, ''));
  v_is_trial boolean;
  v_expired boolean;
  v_new_status text;
BEGIN
  v_is_trial := v_plan IN ('trial', 'trialing', 'teste') OR v_status IN ('trial', 'trialing', 'teste');
  v_expired := NEW.expires_at IS NOT NULL AND NEW.expires_at < now();

  IF v_status IN ('active', 'ativo', 'trial', 'trialing', 'teste') AND NOT v_expired THEN
    v_new_status := CASE WHEN v_is_trial THEN 'trialing' ELSE 'active' END;
  ELSIF v_status IN ('suspended', 'cancelled', 'canceled', 'inactive') THEN
    v_new_status := 'suspended';
  ELSE
    v_new_status := 'expired';
  END IF;

  UPDATE public.companies
     SET subscription_status = v_new_status,
         trial_ends_at = CASE WHEN v_is_trial THEN NEW.expires_at ELSE trial_ends_at END,
         updated_at = now()
   WHERE id = NEW.company_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_subscription_status ON public.company_subscriptions;

CREATE TRIGGER trg_sync_company_subscription_status
AFTER INSERT OR UPDATE OF status, plan_name, expires_at ON public.company_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_company_subscription_status();