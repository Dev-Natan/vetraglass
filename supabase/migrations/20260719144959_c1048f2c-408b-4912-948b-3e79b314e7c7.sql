-- Cascade product_linhas.is_active changes to all dependent tables
-- Ensures activating/deactivating a linha in /admin/categorias propagates system-wide

CREATE OR REPLACE FUNCTION public.cascade_product_linha_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_keys text[];
BEGIN
  -- Only act when is_active actually changes
  IF NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  match_keys := ARRAY[lower(NEW.slug), lower(NEW.name)];

  -- Global templates
  UPDATE public.product_templates
     SET is_active = NEW.is_active
   WHERE lower(coalesce(linha, '')) = ANY(match_keys);

  UPDATE public.item_templates
     SET is_active = NEW.is_active
   WHERE lower(coalesce(linha, '')) = ANY(match_keys);

  -- Company-scoped instances
  UPDATE public.company_products
     SET is_active = NEW.is_active
   WHERE lower(coalesce(linha, '')) = ANY(match_keys);

  UPDATE public.company_items
     SET is_active = NEW.is_active
   WHERE lower(coalesce(linha, '')) = ANY(match_keys);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_product_linha_active_status ON public.product_linhas;

CREATE TRIGGER trg_cascade_product_linha_active_status
AFTER UPDATE OF is_active ON public.product_linhas
FOR EACH ROW
EXECUTE FUNCTION public.cascade_product_linha_active_status();