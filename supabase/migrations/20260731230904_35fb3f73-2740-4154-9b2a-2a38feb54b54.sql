CREATE OR REPLACE FUNCTION public.sync_company_subscription_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rem RECORD;
  v_status text;
  v_plan text;
  v_is_trial boolean;
  v_expired boolean;
  v_new_status text;
BEGIN
  -- Procura outro plano remanescente para a mesma empresa (mais recente)
  SELECT cs.status, cs.plan_name, cs.expires_at
    INTO rem
    FROM public.company_subscriptions cs
   WHERE cs.company_id = OLD.company_id
     AND cs.id <> OLD.id
   ORDER BY cs.created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.companies
       SET subscription_status = 'expired',
           trial_ends_at = NULL,
           updated_at = now()
     WHERE id = OLD.company_id;
    RETURN OLD;
  END IF;

  v_status := lower(coalesce(rem.status, ''));
  v_plan := lower(coalesce(rem.plan_name, ''));
  v_is_trial := v_plan IN ('trial', 'trialing', 'teste') OR v_status IN ('trial', 'trialing', 'teste');
  v_expired := rem.expires_at IS NOT NULL AND rem.expires_at < now();

  IF v_status IN ('active', 'ativo', 'trial', 'trialing', 'teste') AND NOT v_expired THEN
    v_new_status := CASE WHEN v_is_trial THEN 'trialing' ELSE 'active' END;
  ELSIF v_status IN ('suspended', 'cancelled', 'canceled', 'inactive') THEN
    v_new_status := 'suspended';
  ELSE
    v_new_status := 'expired';
  END IF;

  UPDATE public.companies
     SET subscription_status = v_new_status,
         trial_ends_at = CASE WHEN v_is_trial THEN rem.expires_at ELSE NULL END,
         updated_at = now()
   WHERE id = OLD.company_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_subscription_on_delete ON public.company_subscriptions;

CREATE TRIGGER trg_sync_company_subscription_on_delete
AFTER DELETE ON public.company_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_company_subscription_on_delete();

-- Cancelamentos/suspensões também limpam a data de teste no update
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
         trial_ends_at = CASE
           WHEN v_new_status IN ('suspended', 'expired') THEN NULL
           WHEN v_is_trial THEN NEW.expires_at
           ELSE trial_ends_at
         END,
         updated_at = now()
   WHERE id = NEW.company_id;

  RETURN NEW;
END;
$$;