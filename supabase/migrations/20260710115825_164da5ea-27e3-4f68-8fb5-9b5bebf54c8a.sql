
-- 1) Função de normalização: resolve string -> slug oficial em product_linhas
CREATE OR REPLACE FUNCTION public.resolve_product_linha_slug(_input text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm text;
  _slug text;
BEGIN
  IF _input IS NULL OR btrim(_input) = '' THEN
    RETURN NULL;
  END IF;

  _norm := lower(btrim(unaccent(_input)));

  SELECT slug INTO _slug FROM public.product_linhas
   WHERE lower(unaccent(slug)) = _norm
   LIMIT 1;
  IF _slug IS NOT NULL THEN RETURN _slug; END IF;

  SELECT slug INTO _slug FROM public.product_linhas
   WHERE lower(unaccent(name)) = _norm
   LIMIT 1;
  IF _slug IS NOT NULL THEN RETURN _slug; END IF;

  -- fallback: substituir espaços por underscore e tentar de novo
  SELECT slug INTO _slug FROM public.product_linhas
   WHERE lower(unaccent(slug)) = replace(_norm, ' ', '_')
   LIMIT 1;
  RETURN _slug;
END;
$$;

-- Garantir extensão unaccent
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Backfill dados sujos
UPDATE public.company_products
   SET linha = public.resolve_product_linha_slug(linha)
 WHERE linha IS NOT NULL
   AND linha IS DISTINCT FROM public.resolve_product_linha_slug(linha);

UPDATE public.product_templates
   SET linha = public.resolve_product_linha_slug(linha)
 WHERE linha IS NOT NULL
   AND linha IS DISTINCT FROM public.resolve_product_linha_slug(linha);

-- 3) Trigger de enforcement
CREATE OR REPLACE FUNCTION public.enforce_product_linha_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _resolved text;
BEGIN
  IF NEW.linha IS NULL OR btrim(NEW.linha) = '' THEN
    NEW.linha := NULL;
    RETURN NEW;
  END IF;

  _resolved := public.resolve_product_linha_slug(NEW.linha);
  IF _resolved IS NULL THEN
    RAISE EXCEPTION 'Linha "%" não cadastrada em product_linhas. Cadastre a linha no painel /admin antes de usá-la.', NEW.linha
      USING ERRCODE = '23514';
  END IF;

  NEW.linha := _resolved;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_linha_company_products ON public.company_products;
CREATE TRIGGER trg_enforce_linha_company_products
  BEFORE INSERT OR UPDATE OF linha ON public.company_products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_linha_slug();

DROP TRIGGER IF EXISTS trg_enforce_linha_product_templates ON public.product_templates;
CREATE TRIGGER trg_enforce_linha_product_templates
  BEFORE INSERT OR UPDATE OF linha ON public.product_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_linha_slug();
