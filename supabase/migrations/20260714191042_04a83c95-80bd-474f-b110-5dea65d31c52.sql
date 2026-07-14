
CREATE OR REPLACE FUNCTION public.trg_freeze_quote_item_composition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.composition_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.company_product_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'source', 'company_product',
      'product_id', NEW.company_product_id,
      'frozen_at', now(),
      'items', COALESCE(jsonb_agg(to_jsonb(cpi)), '[]'::jsonb)
    )
    INTO NEW.composition_snapshot
    FROM public.company_product_items cpi
    WHERE cpi.company_product_id = NEW.company_product_id;
  ELSIF NEW.product_template_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'source', 'product_template',
      'product_id', NEW.product_template_id,
      'frozen_at', now(),
      'items', COALESCE(jsonb_agg(to_jsonb(pti)), '[]'::jsonb)
    )
    INTO NEW.composition_snapshot
    FROM public.product_template_items pti
    WHERE pti.product_template_id = NEW.product_template_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_quote_item_composition ON public.quote_items;
CREATE TRIGGER trg_freeze_quote_item_composition
BEFORE INSERT ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_freeze_quote_item_composition();
