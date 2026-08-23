-- Phase 3E: one company-owned source for item cost, markup, sale price and variants.
-- Existing legacy pricing tables are intentionally preserved, but are no longer
-- authoritative. No catalog or operational row is deleted by this migration.

ALTER TABLE public.company_items
  ADD COLUMN IF NOT EXISTS markup_percent numeric,
  ADD COLUMN IF NOT EXISTS pricing_unit text,
  ADD COLUMN IF NOT EXISTS pricing_configured_at timestamptz;

UPDATE public.company_items
SET cost = CASE
      WHEN COALESCE(cost, 0) > 0 THEN cost
      WHEN COALESCE(cost_per_meter, 0) > 0 THEN cost_per_meter
      ELSE cost
    END,
    sale_price = CASE
      WHEN COALESCE(sale_price, 0) > 0 THEN sale_price
      WHEN COALESCE(sale_price_per_meter, 0) > 0 THEN sale_price_per_meter
      ELSE sale_price
    END,
    pricing_unit = COALESCE(
      pricing_unit,
      CASE
        WHEN lower(type) = 'profile' THEN 'm'
        WHEN lower(type) = 'glass' THEN 'm²'
        ELSE unit
      END
    );

UPDATE public.company_items
SET markup_percent = CASE
      WHEN COALESCE(cost, 0) > 0 AND COALESCE(sale_price, 0) > 0
        THEN round(((sale_price / cost) - 1) * 100, 4)
      WHEN sale_margin_percent IS NOT NULL THEN sale_margin_percent
      ELSE NULL
    END,
    pricing_configured_at = CASE
      WHEN COALESCE(cost, 0) > 0 AND COALESCE(sale_price, 0) > 0 THEN COALESCE(updated_at, now())
      ELSE pricing_configured_at
    END;

ALTER TABLE public.company_items
  DROP CONSTRAINT IF EXISTS company_items_markup_percent_check;
ALTER TABLE public.company_items
  ADD CONSTRAINT company_items_markup_percent_check
    CHECK (markup_percent IS NULL OR markup_percent >= -100);

ALTER TABLE public.company_items
  DROP CONSTRAINT IF EXISTS company_items_pricing_values_check;
ALTER TABLE public.company_items
  ADD CONSTRAINT company_items_pricing_values_check
    CHECK ((cost IS NULL OR cost >= 0) AND (sale_price IS NULL OR sale_price >= 0));

CREATE OR REPLACE FUNCTION public.phase3e_sync_company_item_pricing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_cost_changed boolean;
  v_markup_changed boolean;
  v_sale_changed boolean;
  v_expected numeric;
BEGIN
  NEW.pricing_unit := COALESCE(NULLIF(btrim(NEW.pricing_unit), ''),
    CASE
      WHEN lower(NEW.type) = 'profile' THEN 'm'
      WHEN lower(NEW.type) = 'glass' THEN 'm²'
      ELSE NEW.unit
    END);

  v_cost_changed := TG_OP = 'INSERT' OR NEW.cost IS DISTINCT FROM OLD.cost;
  v_markup_changed := TG_OP = 'INSERT' OR NEW.markup_percent IS DISTINCT FROM OLD.markup_percent;
  v_sale_changed := TG_OP = 'INSERT' OR NEW.sale_price IS DISTINCT FROM OLD.sale_price;

  IF COALESCE(NEW.cost, 0) > 0 THEN
    IF TG_OP = 'UPDATE' AND v_sale_changed AND NOT v_markup_changed THEN
      IF COALESCE(NEW.sale_price, 0) > 0 THEN
        NEW.markup_percent := round(((NEW.sale_price / NEW.cost) - 1) * 100, 4);
      ELSE
        NEW.markup_percent := NULL;
      END IF;
    ELSIF NEW.markup_percent IS NOT NULL AND (v_cost_changed OR v_markup_changed) AND NOT v_sale_changed THEN
      NEW.sale_price := round(NEW.cost * (1 + NEW.markup_percent / 100), 4);
    ELSIF TG_OP = 'INSERT' AND NEW.markup_percent IS NOT NULL AND COALESCE(NEW.sale_price, 0) <= 0 THEN
      NEW.sale_price := round(NEW.cost * (1 + NEW.markup_percent / 100), 4);
    ELSIF NEW.markup_percent IS NULL AND COALESCE(NEW.sale_price, 0) > 0 THEN
      NEW.markup_percent := round(((NEW.sale_price / NEW.cost) - 1) * 100, 4);
    ELSIF NEW.markup_percent IS NOT NULL AND COALESCE(NEW.sale_price, 0) > 0 THEN
      v_expected := round(NEW.cost * (1 + NEW.markup_percent / 100), 4);
      IF abs(v_expected - NEW.sale_price) > 0.01 THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PRICING_INCONSISTENT',
          DETAIL = NEW.name;
      END IF;
    END IF;
  ELSE
    NEW.markup_percent := NULL;
  END IF;

  -- Compatibility mirrors. Canonical readers must use cost/markup_percent/sale_price.
  NEW.sale_margin_percent := NEW.markup_percent;
  IF NEW.pricing_unit IN ('m', 'ml') THEN
    NEW.cost_per_meter := NEW.cost;
    NEW.sale_price_per_meter := NEW.sale_price;
  END IF;
  IF COALESCE(NEW.cost, 0) > 0 AND COALESCE(NEW.sale_price, 0) > 0 THEN
    NEW.pricing_configured_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_company_item_sale_price ON public.company_items;
DROP TRIGGER IF EXISTS trg_phase3e_sync_company_item_pricing ON public.company_items;
CREATE TRIGGER trg_phase3e_sync_company_item_pricing
BEFORE INSERT OR UPDATE OF cost, sale_price, markup_percent, pricing_unit, type, unit
ON public.company_items
FOR EACH ROW EXECUTE FUNCTION public.phase3e_sync_company_item_pricing();

CREATE TABLE IF NOT EXISTS public.company_item_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_item_id uuid NOT NULL REFERENCES public.company_items(id) ON DELETE CASCADE,
  variant_type text NOT NULL CHECK (variant_type IN ('GLASS', 'PROFILE')),
  glass_type text,
  glass_color text,
  glass_thickness_mm numeric,
  profile_color text,
  profile_finish text,
  cost numeric,
  markup_percent numeric,
  sale_price numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_item_variants_values_check CHECK (
    (cost IS NULL OR cost >= 0)
    AND (sale_price IS NULL OR sale_price >= 0)
    AND (markup_percent IS NULL OR markup_percent >= -100)
  ),
  CONSTRAINT company_item_variants_shape_check CHECK (
    (variant_type = 'GLASS' AND glass_color IS NOT NULL AND glass_thickness_mm IS NOT NULL
      AND profile_color IS NULL AND profile_finish IS NULL)
    OR
    (variant_type = 'PROFILE' AND profile_color IS NOT NULL
      AND glass_type IS NULL AND glass_color IS NULL AND glass_thickness_mm IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS company_item_variants_canonical_key
ON public.company_item_variants (
  company_item_id,
  variant_type,
  lower(COALESCE(glass_type, '')),
  lower(COALESCE(glass_color, '')),
  COALESCE(glass_thickness_mm, -1),
  lower(COALESCE(profile_color, '')),
  lower(COALESCE(profile_finish, ''))
);
CREATE INDEX IF NOT EXISTS company_item_variants_company_idx
  ON public.company_item_variants(company_id, company_item_id) WHERE is_active;

CREATE OR REPLACE FUNCTION public.phase3e_sync_company_item_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_item_company uuid;
  v_cost_changed boolean;
  v_markup_changed boolean;
  v_sale_changed boolean;
  v_expected numeric;
BEGIN
  SELECT ci.company_id INTO v_item_company
  FROM public.company_items ci WHERE ci.id = NEW.company_item_id;
  IF v_item_company IS NULL OR v_item_company <> NEW.company_id THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_VARIANT',
      DETAIL = 'company_item does not belong to company';
  END IF;
  NEW.glass_type := NULLIF(btrim(NEW.glass_type), '');
  NEW.glass_color := NULLIF(btrim(NEW.glass_color), '');
  NEW.profile_color := NULLIF(btrim(NEW.profile_color), '');
  NEW.profile_finish := NULLIF(btrim(NEW.profile_finish), '');

  v_cost_changed := TG_OP = 'INSERT' OR NEW.cost IS DISTINCT FROM OLD.cost;
  v_markup_changed := TG_OP = 'INSERT' OR NEW.markup_percent IS DISTINCT FROM OLD.markup_percent;
  v_sale_changed := TG_OP = 'INSERT' OR NEW.sale_price IS DISTINCT FROM OLD.sale_price;
  IF COALESCE(NEW.cost, 0) > 0 THEN
    IF TG_OP = 'UPDATE' AND v_sale_changed AND NOT v_markup_changed THEN
      IF COALESCE(NEW.sale_price, 0) > 0 THEN
        NEW.markup_percent := round(((NEW.sale_price / NEW.cost) - 1) * 100, 4);
      ELSE
        NEW.markup_percent := NULL;
      END IF;
    ELSIF NEW.markup_percent IS NOT NULL AND (v_cost_changed OR v_markup_changed) AND NOT v_sale_changed THEN
      NEW.sale_price := round(NEW.cost * (1 + NEW.markup_percent / 100), 4);
    ELSIF TG_OP = 'INSERT' AND NEW.markup_percent IS NOT NULL AND COALESCE(NEW.sale_price, 0) <= 0 THEN
      NEW.sale_price := round(NEW.cost * (1 + NEW.markup_percent / 100), 4);
    ELSIF NEW.markup_percent IS NULL AND COALESCE(NEW.sale_price, 0) > 0 THEN
      NEW.markup_percent := round(((NEW.sale_price / NEW.cost) - 1) * 100, 4);
    ELSIF NEW.markup_percent IS NOT NULL AND COALESCE(NEW.sale_price, 0) > 0 THEN
      v_expected := round(NEW.cost * (1 + NEW.markup_percent / 100), 4);
      IF abs(v_expected - NEW.sale_price) > 0.01 THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PRICING_INCONSISTENT';
      END IF;
    END IF;
  ELSE
    NEW.markup_percent := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase3e_sync_company_item_variant ON public.company_item_variants;
CREATE TRIGGER trg_phase3e_sync_company_item_variant
BEFORE INSERT OR UPDATE ON public.company_item_variants
FOR EACH ROW EXECUTE FUNCTION public.phase3e_sync_company_item_variant();

CREATE OR REPLACE FUNCTION public.phase3e_can_manage_pricing(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.user_has_role_in_company(_user_id, _company_id, 'admin'::public.app_role)
    OR public.user_has_role_in_company(_user_id, _company_id, 'manager'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.get_user_permission_profile(_user_id, _company_id) p
      WHERE COALESCE(p.can_manage_stock, false)
         OR COALESCE((p.permissions->'estoque'->>'edit')::boolean, false)
         OR COALESCE((p.permissions->'produtos'->>'edit')::boolean, false)
    )
  );
$$;

ALTER TABLE public.company_item_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_item_variants_select ON public.company_item_variants;
DROP POLICY IF EXISTS company_item_variants_manage ON public.company_item_variants;
CREATE POLICY company_item_variants_select ON public.company_item_variants
FOR SELECT TO authenticated
USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY company_item_variants_manage ON public.company_item_variants
FOR ALL TO authenticated
USING (public.phase3e_can_manage_pricing(auth.uid(), company_id))
WITH CHECK (public.phase3e_can_manage_pricing(auth.uid(), company_id));

-- Link existing stock rows only where the company+template mapping is unique.
UPDATE public.company_stock cs
SET company_item_id = ci.id
FROM public.company_items ci
WHERE cs.company_item_id IS NULL
  AND cs.company_id = ci.company_id
  AND cs.item_template_id = ci.item_template_id;

-- Fix the real source of `malformed array literal: "pricing_type"` before the
-- canonical-mode normalization below fires this trigger.
CREATE OR REPLACE FUNCTION public.trg_flag_company_product_overrides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fields text[] := ARRAY[]::text[];
  v_new_arr jsonb;
BEGIN
  IF NEW.product_template_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.commercial_name IS DISTINCT FROM OLD.commercial_name THEN v_fields := array_append(v_fields, 'commercial_name'); END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN v_fields := array_append(v_fields, 'description'); END IF;
  IF NEW.image_url IS DISTINCT FROM OLD.image_url THEN v_fields := array_append(v_fields, 'image_url'); END IF;
  IF NEW.linha IS DISTINCT FROM OLD.linha THEN v_fields := array_append(v_fields, 'linha'); END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN v_fields := array_append(v_fields, 'category'); END IF;
  IF NEW.base_price IS DISTINCT FROM OLD.base_price THEN v_fields := array_append(v_fields, 'base_price'); END IF;
  IF NEW.price_per_sqm IS DISTINCT FROM OLD.price_per_sqm THEN v_fields := array_append(v_fields, 'price_per_sqm'); END IF;
  IF NEW.cost_per_sqm IS DISTINCT FROM OLD.cost_per_sqm THEN v_fields := array_append(v_fields, 'cost_per_sqm'); END IF;
  IF NEW.margin_percent IS DISTINCT FROM OLD.margin_percent THEN v_fields := array_append(v_fields, 'margin_percent'); END IF;
  IF NEW.pricing_type IS DISTINCT FROM OLD.pricing_type THEN v_fields := array_append(v_fields, 'pricing_type'); END IF;
  IF cardinality(v_fields) = 0 THEN RETURN NEW; END IF;
  SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
  INTO v_new_arr
  FROM jsonb_array_elements_text(
    COALESCE(NEW.overridden_fields, '[]'::jsonb) || to_jsonb(v_fields)
  ) AS x;
  NEW.overridden_fields := v_new_arr;
  NEW.customized_at := COALESCE(NEW.customized_at, now());
  NEW.is_custom := true;
  RETURN NEW;
END;
$$;

UPDATE public.company_products
SET pricing_type = CASE lower(pricing_type)
  WHEN 'composition' THEN 'COMPOSITION'
  WHEN 'none' THEN 'COMPOSITION'
  WHEN 'fixed' THEN 'FIXED_PER_SQM'
  WHEN 'price_per_sqm' THEN 'FIXED_PER_SQM'
  WHEN 'per_sqm' THEN 'FIXED_PER_SQM'
  WHEN 'sqm' THEN 'FIXED_PER_SQM'
  WHEN 'glass' THEN CASE WHEN COALESCE(price_per_sqm, 0) > 0 THEN 'FIXED_PER_SQM' ELSE 'COMPOSITION' END
  WHEN 'aluminum' THEN CASE WHEN COALESCE(price_per_sqm, 0) > 0 THEN 'FIXED_PER_SQM' ELSE 'COMPOSITION' END
  ELSE pricing_type
END;

ALTER TABLE public.company_products
  DROP CONSTRAINT IF EXISTS company_products_pricing_type_check;
ALTER TABLE public.company_products
  ADD CONSTRAINT company_products_pricing_type_check
    CHECK (pricing_type IN ('COMPOSITION', 'FIXED_PER_SQM'));
ALTER TABLE public.company_products
  DROP CONSTRAINT IF EXISTS company_products_fixed_price_check;
ALTER TABLE public.company_products
  ADD CONSTRAINT company_products_fixed_price_check
    CHECK (price_per_sqm IS NULL OR price_per_sqm >= 0);

CREATE OR REPLACE FUNCTION public.save_company_item_pricing(
  _company_id uuid,
  _company_item_id uuid,
  _cost numeric,
  _basis text,
  _value numeric,
  _pricing_unit text DEFAULT NULL
)
RETURNS public.company_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result public.company_items;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF _cost IS NULL OR _cost <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_COST';
  END IF;
  IF upper(_basis) NOT IN ('MARKUP', 'SALE_PRICE') OR _value IS NULL OR _value < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_INPUT';
  END IF;

  IF upper(_basis) = 'MARKUP' THEN
    UPDATE public.company_items
    SET cost = _cost, markup_percent = _value,
        sale_price = round(_cost * (1 + _value / 100), 4),
        pricing_unit = COALESCE(NULLIF(btrim(_pricing_unit), ''), pricing_unit)
    WHERE id = _company_item_id AND company_id = _company_id
    RETURNING * INTO v_result;
  ELSE
    IF _value <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_PRICE';
    END IF;
    UPDATE public.company_items
    SET cost = _cost, sale_price = _value,
        markup_percent = round(((_value / _cost) - 1) * 100, 4),
        pricing_unit = COALESCE(NULLIF(btrim(_pricing_unit), ''), pricing_unit)
    WHERE id = _company_item_id AND company_id = _company_id
    RETURNING * INTO v_result;
  END IF;
  IF v_result.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MISSING_COMPANY_ITEM',
      DETAIL = _company_item_id::text;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_item_variant(
  _company_id uuid,
  _company_item_id uuid,
  _variant_type text,
  _attributes jsonb,
  _cost numeric,
  _basis text,
  _value numeric
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result public.company_item_variants;
  v_glass_type text := NULLIF(btrim(_attributes->>'glass_type'), '');
  v_glass_color text := NULLIF(btrim(_attributes->>'glass_color'), '');
  v_glass_thickness numeric;
  v_profile_color text := NULLIF(btrim(_attributes->>'profile_color'), '');
  v_profile_finish text := NULLIF(btrim(_attributes->>'profile_finish'), '');
  v_markup numeric;
  v_sale numeric;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF upper(_variant_type) = 'GLASS' THEN
    BEGIN v_glass_thickness := (_attributes->>'glass_thickness_mm')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
    END;
    IF v_glass_color IS NULL OR v_glass_thickness IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
    END IF;
  ELSIF upper(_variant_type) = 'PROFILE' THEN
    IF v_profile_color IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
  END IF;
  IF _cost IS NULL OR _cost <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_COST';
  END IF;
  IF upper(_basis) = 'MARKUP' AND _value IS NOT NULL AND _value >= 0 THEN
    v_markup := _value; v_sale := round(_cost * (1 + _value / 100), 4);
  ELSIF upper(_basis) = 'SALE_PRICE' AND _value IS NOT NULL AND _value > 0 THEN
    v_sale := _value; v_markup := round(((_value / _cost) - 1) * 100, 4);
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_INPUT';
  END IF;

  UPDATE public.company_item_variants
  SET cost = _cost, markup_percent = v_markup, sale_price = v_sale,
      is_active = true, updated_at = now()
  WHERE company_id = _company_id
    AND company_item_id = _company_item_id
    AND variant_type = upper(_variant_type)
    AND lower(COALESCE(glass_type, '')) = lower(COALESCE(v_glass_type, ''))
    AND lower(COALESCE(glass_color, '')) = lower(COALESCE(v_glass_color, ''))
    AND COALESCE(glass_thickness_mm, -1) = COALESCE(v_glass_thickness, -1)
    AND lower(COALESCE(profile_color, '')) = lower(COALESCE(v_profile_color, ''))
    AND lower(COALESCE(profile_finish, '')) = lower(COALESCE(v_profile_finish, ''))
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    INSERT INTO public.company_item_variants (
    company_id, company_item_id, variant_type, glass_type, glass_color,
    glass_thickness_mm, profile_color, profile_finish, cost, markup_percent, sale_price
    ) VALUES (
      _company_id, _company_item_id, upper(_variant_type), v_glass_type, v_glass_color,
      v_glass_thickness, v_profile_color, v_profile_finish, _cost, v_markup, v_sale
    ) RETURNING * INTO v_result;
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_product_pricing(
  _company_id uuid,
  _company_product_id uuid,
  _pricing_type text,
  _fixed_price_per_sqm numeric DEFAULT NULL
)
RETURNS public.company_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result public.company_products;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF upper(_pricing_type) NOT IN ('COMPOSITION', 'FIXED_PER_SQM') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_MODE';
  END IF;
  IF upper(_pricing_type) = 'FIXED_PER_SQM' AND COALESCE(_fixed_price_per_sqm, 0) <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_PRICE',
      DETAIL = 'fixed_price_per_sqm';
  END IF;
  UPDATE public.company_products
  SET pricing_type = upper(_pricing_type),
      price_per_sqm = CASE WHEN upper(_pricing_type) = 'FIXED_PER_SQM' THEN _fixed_price_per_sqm ELSE NULL END
  WHERE id = _company_product_id AND company_id = _company_id
  RETURNING * INTO v_result;
  IF v_result.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PRODUCT_NOT_FOUND';
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_company_stock(
  _company_id uuid,
  _company_item_id uuid,
  _delta numeric,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item public.company_items;
  v_stock public.company_stock;
  v_new_quantity numeric;
  v_movement_id uuid;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF _delta IS NULL OR _delta = 0 OR NULLIF(btrim(_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'STOCK_ADJUSTMENT_FAILED',
      DETAIL = 'delta and reason are required';
  END IF;
  SELECT * INTO v_item FROM public.company_items
  WHERE id = _company_item_id AND company_id = _company_id AND is_active FOR UPDATE;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MISSING_COMPANY_ITEM';
  END IF;
  SELECT * INTO v_stock FROM public.company_stock
  WHERE company_id = _company_id AND company_item_id = _company_item_id FOR UPDATE;
  IF v_stock.id IS NULL THEN
    INSERT INTO public.company_stock(company_id, company_item_id, item_template_id, quantity)
    VALUES (_company_id, _company_item_id, v_item.item_template_id, 0)
    RETURNING * INTO v_stock;
  END IF;
  v_new_quantity := v_stock.quantity + _delta;
  IF v_new_quantity < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'STOCK_ADJUSTMENT_FAILED',
      DETAIL = 'physical stock cannot be negative';
  END IF;
  UPDATE public.company_stock SET quantity = v_new_quantity WHERE id = v_stock.id;
  INSERT INTO public.stock_movements(
    company_id, company_item_id, item_template_id, type, category, quantity,
    unit_cost, description, created_by, reference_type
  ) VALUES (
    _company_id, _company_item_id, v_item.item_template_id,
    CASE WHEN _delta > 0 THEN 'entrada' ELSE 'saida' END,
    CASE WHEN _delta > 0 THEN 'ajuste_positivo' ELSE 'ajuste_negativo' END,
    abs(_delta), NULLIF(v_item.cost, 0), btrim(_reason), auth.uid(), 'manual_adjustment'
  ) RETURNING id INTO v_movement_id;
  RETURN jsonb_build_object('stock_id', v_stock.id, 'movement_id', v_movement_id,
    'previous_quantity', v_stock.quantity, 'new_quantity', v_new_quantity);
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%STOCK_ADJUSTMENT_FAILED%' OR SQLERRM LIKE '%UNAUTHORIZED%'
     OR SQLERRM LIKE '%MISSING_COMPANY_ITEM%' THEN RAISE; END IF;
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STOCK_ADJUSTMENT_FAILED', DETAIL = SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_company_product_pricing(
  _company_id uuid,
  _company_product_id uuid,
  _width_mm numeric,
  _height_mm numeric,
  _quantity integer DEFAULT 1,
  _variants jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product public.company_products;
  v_component record;
  v_variant public.company_item_variants;
  v_materials jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_width numeric;
  v_height numeric;
  v_pieces numeric;
  v_multiplier numeric;
  v_pricing_qty numeric;
  v_stock_qty numeric;
  v_loss numeric;
  v_cost numeric;
  v_sale numeric;
  v_total_cost numeric := 0;
  v_composition_sale numeric := 0;
  v_total_sale numeric;
  v_area numeric;
  v_reserved numeric;
  v_physical numeric;
  v_profile_color text := NULLIF(btrim(_variants->>'profile_color'), '');
  v_profile_finish text := NULLIF(btrim(_variants->>'profile_finish'), '');
  v_glass_type text := NULLIF(btrim(_variants->>'glass_type'), '');
  v_glass_color text := NULLIF(btrim(_variants->>'glass_color'), '');
  v_glass_thickness numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF COALESCE(_width_mm, 0) <= 0 OR COALESCE(_height_mm, 0) <= 0 OR COALESCE(_quantity, 0) <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;
  IF _variants ? 'glass_thickness_mm' THEN
    BEGIN v_glass_thickness := (_variants->>'glass_thickness_mm')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
    END;
  END IF;
  SELECT * INTO v_product FROM public.company_products
  WHERE id = _company_product_id AND company_id = _company_id AND is_active;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PRODUCT_NOT_FOUND';
  END IF;
  IF v_product.pricing_type NOT IN ('COMPOSITION', 'FIXED_PER_SQM') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_MODE',
      DETAIL = v_product.pricing_type;
  END IF;

  FOR v_component IN
    SELECT cpi.*, ci.name item_name, ci.type item_type, ci.unit stock_unit,
      ci.company_id item_company_id, ci.pricing_unit, ci.cost base_cost, ci.sale_price base_sale,
      ci.bar_length_mm, ci.item_template_id canonical_template_id
    FROM public.company_product_items cpi
    LEFT JOIN public.company_items ci ON ci.id = cpi.company_item_id
    WHERE cpi.company_product_id = _company_product_id
    ORDER BY cpi.sort_order, cpi.id
  LOOP
    IF v_component.company_item_id IS NULL OR v_component.item_name IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM',
        DETAIL = COALESCE(v_component.item_template_id::text, v_component.id::text);
    END IF;
    IF v_component.item_company_id <> _company_id
       OR (v_component.company_id IS NOT NULL AND v_component.company_id <> _company_id) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
    END IF;
    v_width := CASE WHEN NULLIF(btrim(COALESCE(v_component.width_formula, '')), '') IS NULL
      THEN NULL ELSE public.phase2a_eval_formula(v_component.width_formula, _width_mm, _height_mm) END;
    v_height := CASE WHEN NULLIF(btrim(COALESCE(v_component.height_formula, '')), '') IS NULL
      THEN NULL ELSE public.phase2a_eval_formula(v_component.height_formula, _width_mm, _height_mm) END;
    v_pieces := GREATEST(COALESCE(v_component.pieces_quantity, 1), 1);
    IF NULLIF(btrim(COALESCE(v_component.pieces_formula, '')), '') IS NOT NULL THEN
      v_pieces := GREATEST(ceil(public.phase2a_eval_formula(v_component.pieces_formula, _width_mm, _height_mm)), 0);
    END IF;
    v_multiplier := 1;
    IF v_width IS NULL AND v_height IS NULL
       AND NULLIF(btrim(COALESCE(v_component.quantity_formula, '')), '') IS NOT NULL THEN
      v_multiplier := public.phase2a_eval_formula(v_component.quantity_formula, _width_mm, _height_mm);
    ELSIF btrim(COALESCE(v_component.quantity_formula, '1')) ~ '^[0-9]+([.,][0-9]+)?$' THEN
      v_multiplier := replace(btrim(v_component.quantity_formula), ',', '.')::numeric;
    END IF;
    v_loss := 1 + COALESCE(v_component.loss_percent, 0) / 100;
    IF lower(v_component.item_type) = 'glass' THEN
      IF v_width IS NULL OR v_height IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE', DETAIL = v_component.item_name;
      END IF;
      v_pricing_qty := round((v_width * v_height / 1000000) * v_pieces * v_multiplier * _quantity * v_loss, 6);
      v_stock_qty := v_pricing_qty;
    ELSIF lower(v_component.item_type) = 'profile' THEN
      IF COALESCE(v_width, v_height) IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE', DETAIL = v_component.item_name;
      END IF;
      v_pricing_qty := round((COALESCE(v_width, v_height) / 1000) * v_pieces * v_multiplier * _quantity * v_loss, 6);
      v_stock_qty := CASE WHEN lower(COALESCE(v_component.stock_unit, '')) IN ('barra', 'bar')
        THEN ceil((COALESCE(v_width, v_height) * v_pieces * v_multiplier * _quantity * v_loss)
          / NULLIF(COALESCE(v_component.bar_length_mm, 6000), 0))
        ELSE v_pricing_qty END;
    ELSE
      v_pricing_qty := round(v_pieces * v_multiplier * _quantity * v_loss, 6);
      v_stock_qty := v_pricing_qty;
    END IF;
    IF v_pricing_qty <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE', DETAIL = v_component.item_name;
    END IF;

    v_variant := NULL;
    IF lower(v_component.item_type) = 'glass'
       AND (v_glass_color IS NOT NULL OR v_glass_thickness IS NOT NULL OR v_glass_type IS NOT NULL) THEN
      IF v_glass_color IS NULL OR v_glass_thickness IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT', DETAIL = v_component.item_name;
      END IF;
      SELECT * INTO v_variant FROM public.company_item_variants civ
      WHERE civ.company_id = _company_id AND civ.company_item_id = v_component.company_item_id
        AND civ.variant_type = 'GLASS' AND civ.is_active
        AND lower(civ.glass_color) = lower(v_glass_color)
        AND civ.glass_thickness_mm = v_glass_thickness
        AND (v_glass_type IS NULL OR lower(COALESCE(civ.glass_type, '')) = lower(v_glass_type))
      ORDER BY civ.id LIMIT 1;
      IF v_variant.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
          DETAIL = v_component.item_name || ' | vidro=' || COALESCE(v_glass_type, '*') ||
            ' | cor=' || v_glass_color || ' | espessura=' || v_glass_thickness::text;
      END IF;
    ELSIF lower(v_component.item_type) = 'profile'
       AND (v_profile_color IS NOT NULL OR v_profile_finish IS NOT NULL) THEN
      IF v_profile_color IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT', DETAIL = v_component.item_name;
      END IF;
      SELECT * INTO v_variant FROM public.company_item_variants civ
      WHERE civ.company_id = _company_id AND civ.company_item_id = v_component.company_item_id
        AND civ.variant_type = 'PROFILE' AND civ.is_active
        AND lower(civ.profile_color) = lower(v_profile_color)
        AND (v_profile_finish IS NULL OR lower(COALESCE(civ.profile_finish, '')) = lower(v_profile_finish))
      ORDER BY civ.id LIMIT 1;
      IF v_variant.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
          DETAIL = v_component.item_name || ' | perfil=' || v_profile_color ||
            ' | acabamento=' || COALESCE(v_profile_finish, '*');
      END IF;
    END IF;
    v_cost := COALESCE(v_variant.cost, v_component.base_cost);
    v_sale := COALESCE(v_variant.sale_price, v_component.base_sale);
    IF COALESCE(v_cost, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_COST',
        DETAIL = v_component.item_name || ' | company_item=' || v_component.company_item_id::text;
    END IF;
    IF COALESCE(v_sale, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE',
        DETAIL = v_component.item_name || ' | company_item=' || v_component.company_item_id::text;
    END IF;

    SELECT COALESCE(cs.quantity, 0), COALESCE((
      SELECT sum(sr.quantity_reserved) FROM public.stock_reservations sr
      WHERE sr.company_id = _company_id AND sr.company_item_id = v_component.company_item_id
        AND sr.status = 'reserved'
    ), 0) INTO v_physical, v_reserved
    FROM (SELECT 1) seed
    LEFT JOIN public.company_stock cs ON cs.company_id = _company_id
      AND cs.company_item_id = v_component.company_item_id AND cs.is_active;
    IF (v_physical - v_reserved) < v_stock_qty THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'code', 'MISSING_STOCK', 'company_item_id', v_component.company_item_id,
        'item_name', v_component.item_name, 'required', v_stock_qty,
        'available', v_physical - v_reserved
      ));
    END IF;
    v_materials := v_materials || jsonb_build_array(jsonb_build_object(
      'key', v_component.id, 'source_item_id', v_component.id,
      'item_template_id', v_component.canonical_template_id,
      'company_item_id', v_component.company_item_id, 'item_name', v_component.item_name,
      'material_type', v_component.item_type, 'unit', v_component.pricing_unit,
      'quantity', v_pricing_qty, 'stock_quantity', v_stock_qty,
      'unit_cost', v_cost, 'unit_sale_price', v_sale,
      'cost', round(v_pricing_qty * v_cost, 2),
      'sale_price', round(v_pricing_qty * v_sale, 2),
      'variant_id', v_variant.id, 'variant', _variants,
      'width_mm', v_width, 'height_mm', v_height,
      'physical_stock', v_physical, 'reserved_stock', v_reserved,
      'available_stock', v_physical - v_reserved
    ));
    v_total_cost := v_total_cost + round(v_pricing_qty * v_cost, 2);
    v_composition_sale := v_composition_sale + round(v_pricing_qty * v_sale, 2);
  END LOOP;
  IF jsonb_array_length(v_materials) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_COMPANY_ITEM', DETAIL = 'product composition is empty';
  END IF;
  v_area := round((_width_mm * _height_mm / 1000000) * _quantity, 6);
  IF v_product.pricing_type = 'FIXED_PER_SQM' THEN
    IF COALESCE(v_product.price_per_sqm, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE', DETAIL = 'fixed_price_per_sqm';
    END IF;
    v_total_sale := round(v_area * v_product.price_per_sqm, 2);
  ELSE
    v_total_sale := round(v_composition_sale, 2);
  END IF;
  RETURN jsonb_build_object(
    'composition_mode', 'fixed', 'engine_version', 3, 'snapshot_version', 3,
    'pricing_mode', v_product.pricing_type, 'company_id', _company_id,
    'company_product_id', v_product.id, 'product_template_id', v_product.product_template_id,
    'inputs', jsonb_build_object('L', _width_mm, 'A', _height_mm, 'width_mm', _width_mm,
      'height_mm', _height_mm, 'quantity', _quantity, 'variants', _variants),
    'variants', _variants, 'materials', v_materials, 'glass_pieces', '[]'::jsonb,
    'cuts', '[]'::jsonb, 'rules', '[]'::jsonb,
    'totals', jsonb_build_object(
      'area_m2', v_area, 'cost', round(v_total_cost, 2),
      'composition_sale_price', round(v_composition_sale, 2),
      'sale_price', v_total_sale, 'profit', round(v_total_sale - v_total_cost, 2),
      'margin_percent', CASE WHEN v_total_sale > 0 THEN round(((v_total_sale - v_total_cost) / v_total_sale) * 100, 2) ELSE NULL END,
      'fixed_price_per_sqm', CASE WHEN v_product.pricing_type = 'FIXED_PER_SQM' THEN v_product.price_per_sqm ELSE NULL END
    ),
    'warnings', v_warnings, 'ready_for_quote', true, 'frozen_at', now()
  );
END;
$$;

REVOKE ALL ON TABLE public.company_item_variants FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.company_item_variants TO authenticated;
REVOKE ALL ON FUNCTION public.phase3e_can_manage_pricing(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_company_item_pricing(uuid, uuid, numeric, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_company_item_variant(uuid, uuid, text, jsonb, numeric, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_company_product_pricing(uuid, uuid, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_company_stock(uuid, uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_company_product_pricing(uuid, uuid, numeric, numeric, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase3e_can_manage_pricing(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_company_item_pricing(uuid, uuid, numeric, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_company_item_variant(uuid, uuid, text, jsonb, numeric, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_company_product_pricing(uuid, uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_company_stock(uuid, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_company_product_pricing(uuid, uuid, numeric, numeric, integer, jsonb) TO authenticated;

COMMENT ON COLUMN public.company_items.cost IS 'Canonical current company cost in pricing_unit; purchase method is explicit last-cost update.';
COMMENT ON COLUMN public.company_items.markup_percent IS 'Canonical markup over cost. This is not gross margin.';
COMMENT ON COLUMN public.company_items.sale_price IS 'Canonical company sale price in pricing_unit.';
COMMENT ON TABLE public.company_item_variants IS 'Company-owned canonical cost/markup/sale overrides for commercial glass/profile variants.';
COMMENT ON FUNCTION public.resolve_company_product_pricing(uuid, uuid, numeric, numeric, integer, jsonb)
  IS 'Canonical Phase 3E calculator and immutable quote snapshot source. Stock shortage is a warning, not a pricing error.';

NOTIFY pgrst, 'reload schema';
