
-- 1) Trigger: recalcula preço final quando custo ou markup mudam.
--    Respeita override manual: se o usuário grava sale_price/sale_price_per_meter
--    na mesma operação (valor != antigo), não sobrescreve.
CREATE OR REPLACE FUNCTION public.recompute_company_item_sale_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  margin numeric;
BEGIN
  margin := COALESCE(NEW.sale_margin_percent, 0);

  -- preço por metro (perfis)
  IF NEW.cost_per_meter IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR NEW.cost_per_meter IS DISTINCT FROM OLD.cost_per_meter
          OR NEW.sale_margin_percent IS DISTINCT FROM OLD.sale_margin_percent)
     AND (TG_OP = 'INSERT'
          OR NEW.sale_price_per_meter IS NOT DISTINCT FROM OLD.sale_price_per_meter)
  THEN
    NEW.sale_price_per_meter := ROUND((NEW.cost_per_meter * (1 + margin/100))::numeric, 4);
  END IF;

  -- preço unitário genérico
  IF NEW.cost IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR NEW.cost IS DISTINCT FROM OLD.cost
          OR NEW.sale_margin_percent IS DISTINCT FROM OLD.sale_margin_percent)
     AND (TG_OP = 'INSERT'
          OR NEW.sale_price IS NOT DISTINCT FROM OLD.sale_price)
  THEN
    NEW.sale_price := ROUND((NEW.cost * (1 + margin/100))::numeric, 4);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_company_item_sale_price ON public.company_items;
CREATE TRIGGER trg_recompute_company_item_sale_price
BEFORE INSERT OR UPDATE OF cost, cost_per_meter, sale_margin_percent
ON public.company_items
FOR EACH ROW EXECUTE FUNCTION public.recompute_company_item_sale_price();

-- 2) RPC: reajuste em lote sobre o CUSTO (trigger propaga preço final).
CREATE OR REPLACE FUNCTION public.bulk_adjust_item_cost(
  p_company_id uuid,
  p_percent numeric,
  p_type text DEFAULT NULL,
  p_linha text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  factor numeric;
  affected integer;
BEGIN
  IF NOT public.user_belongs_to_company(p_company_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa';
  END IF;

  IF p_percent IS NULL THEN
    RAISE EXCEPTION 'Percentual obrigatório';
  END IF;

  factor := 1 + (p_percent / 100.0);

  UPDATE public.company_items
     SET cost            = CASE WHEN cost IS NOT NULL            THEN ROUND((cost * factor)::numeric, 4)            ELSE cost            END,
         cost_per_meter  = CASE WHEN cost_per_meter IS NOT NULL  THEN ROUND((cost_per_meter * factor)::numeric, 4)  ELSE cost_per_meter  END,
         updated_at      = now()
   WHERE company_id = p_company_id
     AND is_active = true
     AND (p_type  IS NULL OR type  = p_type)
     AND (p_linha IS NULL OR linha = p_linha);

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_adjust_item_cost(uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_adjust_item_cost(uuid, numeric, text, text) TO authenticated;

-- 3) Índice para lookup do motor de orçamento
CREATE INDEX IF NOT EXISTS idx_company_items_company_template
  ON public.company_items (company_id, item_template_id)
  WHERE item_template_id IS NOT NULL;
