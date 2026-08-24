BEGIN;

-- Phase 4A evolves the Phase 3E sources in place. No parallel price table is
-- introduced: company_items remains the material price source and
-- company_item_variants remains the variant price source.

CREATE OR REPLACE FUNCTION public.phase4a_pricing_basis_for_unit(
  _pricing_unit text,
  _item_type text DEFAULT NULL
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN lower(btrim(COALESCE(_pricing_unit, ''))) IN ('m²','m2','sqm','square_meter','square_metre')
      OR lower(btrim(COALESCE(_item_type, ''))) IN ('glass','mirror','espelho','acm') THEN 'AREA'
    WHEN lower(btrim(COALESCE(_pricing_unit, ''))) IN ('m','ml','mm','cm','meter','metre') THEN 'LENGTH'
    WHEN lower(btrim(COALESCE(_pricing_unit, ''))) IN ('kg','g') THEN 'WEIGHT'
    WHEN lower(btrim(COALESCE(_pricing_unit, ''))) IN ('l','ml_volume') THEN 'VOLUME'
    ELSE 'UNIT'
  END;
$$;

CREATE OR REPLACE FUNCTION public.phase4a_normalize_variant_attributes(_attributes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_key text;
  v_canonical_key text;
  v_value jsonb;
  v_text text;
  v_thickness numeric;
BEGIN
  IF _attributes IS NULL OR _attributes = 'null'::jsonb THEN
    RETURN v_result;
  END IF;
  IF jsonb_typeof(_attributes) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT',
      DETAIL = 'attributes must be a JSON object';
  END IF;

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(_attributes)
  LOOP
    v_canonical_key := CASE lower(btrim(v_key))
      WHEN 'glass_type' THEN 'type'
      WHEN 'glass_color' THEN 'color'
      WHEN 'glass_thickness_mm' THEN 'thickness_mm'
      WHEN 'profile_color' THEN 'color'
      WHEN 'profile_finish' THEN 'finish'
      ELSE lower(btrim(v_key))
    END;
    IF v_canonical_key = '' OR v_value = 'null'::jsonb THEN
      CONTINUE;
    END IF;

    IF v_canonical_key = 'thickness_mm' THEN
      BEGIN
        v_thickness := (v_value #>> '{}')::numeric;
      EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT',
          DETAIL = 'thickness_mm must be numeric';
      END;
      IF v_thickness <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT',
          DETAIL = 'thickness_mm must be greater than zero';
      END IF;
      v_result := v_result || jsonb_build_object(v_canonical_key, v_thickness);
    ELSIF jsonb_typeof(v_value) = 'string' THEN
      v_text := upper(btrim(v_value #>> '{}'));
      IF v_text <> '' THEN
        v_result := v_result || jsonb_build_object(v_canonical_key, v_text);
      END IF;
    ELSE
      v_result := v_result || jsonb_build_object(v_canonical_key, v_value);
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

ALTER TABLE public.company_items
  ADD COLUMN pricing_basis text,
  ADD COLUMN variant_attribute_schema jsonb;

ALTER TABLE public.company_item_variants
  ADD COLUMN pricing_basis text,
  ADD COLUMN attributes jsonb;

UPDATE public.company_items
SET pricing_basis = public.phase4a_pricing_basis_for_unit(pricing_unit, type),
    variant_attribute_schema = CASE
      WHEN lower(type) = 'glass' THEN jsonb_build_array(
        jsonb_build_object('key','type','label','Tipo','kind','select','catalog','glass_types','required',true),
        jsonb_build_object('key','color','label','Cor','kind','select','catalog','admin_glass_colors','required',true),
        jsonb_build_object('key','thickness_mm','label','Espessura','kind','select','catalog','admin_glass_thicknesses','required',true),
        jsonb_build_object('key','finish','label','Acabamento','kind','text','required',false)
      )
      ELSE '[]'::jsonb
    END;

UPDATE public.company_item_variants civ
SET pricing_basis = ci.pricing_basis
FROM public.company_items ci
WHERE ci.id = civ.company_item_id;

-- Correct the authorized typo only when no effectively equivalent 8 mm row
-- exists for the same item and legacy attribute identity.
DO $$
DECLARE
  v_target public.company_item_variants;
  v_corrected public.company_item_variants;
  v_target_count integer;
BEGIN
  SELECT count(*) INTO v_target_count
  FROM public.company_item_variants civ
  JOIN public.company_items ci ON ci.id = civ.company_item_id
  WHERE upper(ci.name) = 'VIDRO FIXO'
    AND civ.variant_type = 'GLASS'
    AND upper(COALESCE(civ.glass_color, '')) = 'INCOLOR'
    AND civ.glass_thickness_mm = 80;

  IF v_target_count <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AREA_PRICE_DATA_CORRECTION_ABORTED',
      DETAIL = format('expected one VIDRO FIXO/Incolor/80 mm row, found %s', v_target_count);
  END IF;

  SELECT civ.* INTO v_target
  FROM public.company_item_variants civ
  JOIN public.company_items ci ON ci.id = civ.company_item_id
  WHERE upper(ci.name) = 'VIDRO FIXO'
    AND civ.variant_type = 'GLASS'
    AND upper(COALESCE(civ.glass_color, '')) = 'INCOLOR'
    AND civ.glass_thickness_mm = 80;

  IF EXISTS (
    SELECT 1 FROM public.company_item_variants other
    WHERE other.id <> v_target.id
      AND other.company_item_id = v_target.company_item_id
      AND other.variant_type = v_target.variant_type
      AND lower(COALESCE(other.glass_type, '')) = lower(COALESCE(v_target.glass_type, ''))
      AND lower(COALESCE(other.glass_color, '')) = lower(COALESCE(v_target.glass_color, ''))
      AND other.glass_thickness_mm = 8
      AND lower(COALESCE(other.profile_color, '')) = lower(COALESCE(v_target.profile_color, ''))
      AND lower(COALESCE(other.profile_finish, '')) = lower(COALESCE(v_target.profile_finish, ''))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'AREA_PRICE_VARIANT_CONFLICT',
      DETAIL = format('variant %s already has an effectively equivalent 8 mm row', v_target.id);
  END IF;

  UPDATE public.company_item_variants
  SET glass_thickness_mm = 8
  WHERE id = v_target.id
  RETURNING * INTO v_corrected;

  INSERT INTO public.audit_logs(
    user_id, company_id, action, table_name, record_id, old_data, new_data, metadata
  ) VALUES (
    NULL, v_target.company_id, 'update', 'company_item_variants', v_target.id,
    to_jsonb(v_target), to_jsonb(v_corrected),
    jsonb_build_object('source','phase4a_migration','reason','authorized typo correction 80 mm -> 8 mm')
  );
END;
$$;

UPDATE public.company_item_variants
SET attributes = public.phase4a_normalize_variant_attributes(
  CASE variant_type
    WHEN 'GLASS' THEN jsonb_build_object(
      'type', glass_type,
      'color', glass_color,
      'thickness_mm', glass_thickness_mm
    )
    WHEN 'PROFILE' THEN jsonb_build_object(
      'color', profile_color,
      'finish', profile_finish
    )
    ELSE '{}'::jsonb
  END
);

ALTER TABLE public.company_items
  ALTER COLUMN pricing_basis SET DEFAULT 'UNIT',
  ALTER COLUMN pricing_basis SET NOT NULL,
  ALTER COLUMN variant_attribute_schema SET DEFAULT '[]'::jsonb,
  ALTER COLUMN variant_attribute_schema SET NOT NULL;

ALTER TABLE public.company_item_variants
  ALTER COLUMN pricing_basis SET NOT NULL,
  ALTER COLUMN attributes SET DEFAULT '{}'::jsonb,
  ALTER COLUMN attributes SET NOT NULL;

ALTER TABLE public.company_items
  ADD CONSTRAINT company_items_pricing_basis_check
    CHECK (pricing_basis IN ('AREA','LENGTH','UNIT','WEIGHT','VOLUME')),
  ADD CONSTRAINT company_items_variant_attribute_schema_check
    CHECK (jsonb_typeof(variant_attribute_schema) = 'array');

ALTER TABLE public.company_item_variants
  DROP CONSTRAINT company_item_variants_variant_type_check,
  DROP CONSTRAINT company_item_variants_shape_check,
  DROP CONSTRAINT company_item_variants_values_check;

ALTER TABLE public.company_item_variants
  ADD CONSTRAINT company_item_variants_variant_type_check
    CHECK (variant_type = upper(btrim(variant_type)) AND btrim(variant_type) <> ''),
  ADD CONSTRAINT company_item_variants_pricing_basis_check
    CHECK (pricing_basis IN ('AREA','LENGTH','UNIT','WEIGHT','VOLUME')),
  ADD CONSTRAINT company_item_variants_attributes_check
    CHECK (jsonb_typeof(attributes) = 'object' AND attributes <> '{}'::jsonb),
  ADD CONSTRAINT company_item_variants_values_check
    CHECK ((cost IS NULL OR cost > 0) AND (sale_price IS NULL OR sale_price > 0)
      AND (markup_percent IS NULL OR markup_percent >= 0));

DROP INDEX public.company_item_variants_canonical_key;
CREATE UNIQUE INDEX company_item_variants_canonical_key
  ON public.company_item_variants(company_item_id, pricing_basis, attributes);
CREATE INDEX company_item_variants_area_lookup_idx
  ON public.company_item_variants(company_id, company_item_id, attributes)
  WHERE pricing_basis = 'AREA' AND is_active;

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
  IF NEW.pricing_basis IS NULL
     OR btrim(NEW.pricing_basis) = ''
     OR (TG_OP = 'INSERT' AND NEW.pricing_basis = 'UNIT'
       AND public.phase4a_pricing_basis_for_unit(NEW.pricing_unit, NEW.type) <> 'UNIT') THEN
    NEW.pricing_basis := public.phase4a_pricing_basis_for_unit(NEW.pricing_unit, NEW.type);
  ELSE
    NEW.pricing_basis := upper(btrim(NEW.pricing_basis));
  END IF;
  NEW.variant_attribute_schema := COALESCE(NEW.variant_attribute_schema, '[]'::jsonb);
  IF jsonb_typeof(NEW.variant_attribute_schema) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT_SCHEMA';
  END IF;

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
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PRICING_INCONSISTENT', DETAIL = NEW.name;
      END IF;
    END IF;
  ELSE
    NEW.markup_percent := NULL;
  END IF;

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

CREATE OR REPLACE FUNCTION public.phase3e_sync_company_item_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_item_company uuid;
  v_item_basis text;
  v_cost_changed boolean;
  v_markup_changed boolean;
  v_sale_changed boolean;
  v_expected numeric;
BEGIN
  SELECT ci.company_id, ci.pricing_basis INTO v_item_company, v_item_basis
  FROM public.company_items ci WHERE ci.id = NEW.company_item_id;
  IF v_item_company IS NULL OR v_item_company <> NEW.company_id THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_VARIANT',
      DETAIL = 'company_item does not belong to company';
  END IF;

  NEW.variant_type := upper(btrim(NEW.variant_type));
  NEW.pricing_basis := COALESCE(NULLIF(upper(btrim(NEW.pricing_basis)), ''), v_item_basis);
  IF NEW.pricing_basis <> v_item_basis THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INVALID_PRICING_BASIS',
      DETAIL = 'variant basis must match company item basis';
  END IF;

  IF NEW.attributes IS NULL OR NEW.attributes = '{}'::jsonb THEN
    NEW.attributes := CASE NEW.variant_type
      WHEN 'GLASS' THEN jsonb_build_object(
        'type', NULLIF(btrim(NEW.glass_type), ''),
        'color', NULLIF(btrim(NEW.glass_color), ''),
        'thickness_mm', NEW.glass_thickness_mm
      )
      WHEN 'PROFILE' THEN jsonb_build_object(
        'color', NULLIF(btrim(NEW.profile_color), ''),
        'finish', NULLIF(btrim(NEW.profile_finish), '')
      )
      ELSE '{}'::jsonb
    END;
  END IF;
  NEW.attributes := public.phase4a_normalize_variant_attributes(NEW.attributes);
  IF NEW.attributes = '{}'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT',
      DETAIL = 'at least one effective attribute is required';
  END IF;

  IF NEW.variant_type = 'GLASS' THEN
    NEW.glass_type := NEW.attributes->>'type';
    NEW.glass_color := NEW.attributes->>'color';
    BEGIN NEW.glass_thickness_mm := (NEW.attributes->>'thickness_mm')::numeric;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
    END;
    NEW.profile_color := NULL;
    NEW.profile_finish := NULL;
    IF NEW.glass_color IS NULL OR NEW.glass_thickness_mm IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT',
        DETAIL = 'glass requires color and thickness_mm';
    END IF;
  ELSIF NEW.variant_type = 'PROFILE' THEN
    NEW.profile_color := NEW.attributes->>'color';
    NEW.profile_finish := NEW.attributes->>'finish';
    NEW.glass_type := NULL;
    NEW.glass_color := NULL;
    NEW.glass_thickness_mm := NULL;
    IF NEW.profile_color IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT',
        DETAIL = 'profile requires color';
    END IF;
  ELSE
    NEW.glass_type := NULL;
    NEW.glass_color := NULL;
    NEW.glass_thickness_mm := NULL;
    NEW.profile_color := NULL;
    NEW.profile_finish := NULL;
  END IF;

  v_cost_changed := TG_OP = 'INSERT' OR NEW.cost IS DISTINCT FROM OLD.cost;
  v_markup_changed := TG_OP = 'INSERT' OR NEW.markup_percent IS DISTINCT FROM OLD.markup_percent;
  v_sale_changed := TG_OP = 'INSERT' OR NEW.sale_price IS DISTINCT FROM OLD.sale_price;
  IF NEW.cost IS NOT NULL THEN
    IF NEW.cost <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_COST';
    END IF;
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
  IF NEW.markup_percent IS NOT NULL AND NEW.markup_percent < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_INPUT';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
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
  v_item public.company_items;
  v_attributes jsonb;
  v_variant_type text := upper(btrim(COALESCE(_variant_type, '')));
  v_markup numeric;
  v_sale numeric;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  SELECT * INTO v_item FROM public.company_items
  WHERE id = _company_item_id AND company_id = _company_id AND is_active;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MISSING_COMPANY_ITEM';
  END IF;
  IF v_variant_type = '' THEN
    v_variant_type := CASE WHEN v_item.pricing_basis = 'AREA' THEN 'AREA' ELSE upper(v_item.type) END;
  END IF;
  v_attributes := public.phase4a_normalize_variant_attributes(COALESCE(_attributes, '{}'::jsonb));
  IF v_attributes = '{}'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
  END IF;
  IF v_variant_type = 'GLASS'
     AND (v_attributes->>'color' IS NULL OR v_attributes->>'thickness_mm' IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT',
      DETAIL = 'glass requires color and thickness_mm';
  END IF;
  IF _cost IS NULL OR _cost <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_COST';
  END IF;
  IF upper(_basis) = 'MARKUP' AND _value IS NOT NULL AND _value >= 0 THEN
    v_markup := _value;
    v_sale := round(_cost * (1 + _value / 100), 4);
  ELSIF upper(_basis) = 'SALE_PRICE' AND _value IS NOT NULL AND _value > 0 THEN
    v_sale := _value;
    v_markup := round(((_value / _cost) - 1) * 100, 4);
    IF v_markup < 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_INPUT',
        DETAIL = 'sale price cannot be below cost';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_INPUT';
  END IF;

  UPDATE public.company_item_variants
  SET variant_type = v_variant_type,
      cost = _cost,
      markup_percent = v_markup,
      sale_price = v_sale,
      is_active = true,
      updated_at = now()
  WHERE company_id = _company_id
    AND company_item_id = _company_item_id
    AND pricing_basis = v_item.pricing_basis
    AND attributes = v_attributes
  RETURNING * INTO v_result;

  IF v_result.id IS NULL THEN
    INSERT INTO public.company_item_variants(
      company_id, company_item_id, variant_type, pricing_basis, attributes,
      cost, markup_percent, sale_price
    ) VALUES (
      _company_id, _company_item_id, v_variant_type, v_item.pricing_basis, v_attributes,
      _cost, v_markup, v_sale
    ) RETURNING * INTO v_result;
  END IF;
  RETURN v_result;
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
  v_requested_attributes jsonb;
  v_legacy_glass_attributes jsonb;
  v_legacy_profile_attributes jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF COALESCE(_width_mm, 0) <= 0 OR COALESCE(_height_mm, 0) <= 0 OR COALESCE(_quantity, 0) <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;
  IF jsonb_typeof(COALESCE(_variants, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_VARIANT';
  END IF;

  v_legacy_glass_attributes := public.phase4a_normalize_variant_attributes(jsonb_build_object(
    'type', _variants->>'glass_type',
    'color', _variants->>'glass_color',
    'thickness_mm', _variants->'glass_thickness_mm',
    'finish', _variants->>'glass_finish'
  ));
  v_legacy_profile_attributes := public.phase4a_normalize_variant_attributes(jsonb_build_object(
    'color', _variants->>'profile_color',
    'finish', _variants->>'profile_finish'
  ));

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
      ci.company_id item_company_id, ci.pricing_unit, ci.pricing_basis,
      ci.variant_attribute_schema, ci.cost base_cost, ci.sale_price base_sale,
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

    IF v_component.pricing_basis = 'AREA' THEN
      IF v_width IS NULL OR v_height IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE',
          DETAIL = v_component.item_name;
      END IF;
      v_pricing_qty := round((v_width * v_height / 1000000) * v_pieces * v_multiplier * _quantity * v_loss, 6);
      v_stock_qty := v_pricing_qty;
    ELSIF v_component.pricing_basis = 'LENGTH' THEN
      IF COALESCE(v_width, v_height) IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE',
          DETAIL = v_component.item_name;
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
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE',
        DETAIL = v_component.item_name;
    END IF;

    v_requested_attributes := '{}'::jsonb;
    IF jsonb_typeof(_variants->'by_item') = 'object'
       AND (_variants->'by_item') ? v_component.company_item_id::text THEN
      v_requested_attributes := public.phase4a_normalize_variant_attributes(
        _variants #> ARRAY['by_item', v_component.company_item_id::text]
      );
    ELSIF lower(v_component.item_type) = 'glass' AND v_legacy_glass_attributes <> '{}'::jsonb THEN
      v_requested_attributes := v_legacy_glass_attributes;
    ELSIF lower(v_component.item_type) = 'profile' AND v_legacy_profile_attributes <> '{}'::jsonb THEN
      v_requested_attributes := v_legacy_profile_attributes;
    END IF;

    v_variant := NULL;
    IF v_requested_attributes <> '{}'::jsonb THEN
      SELECT * INTO v_variant
      FROM public.company_item_variants civ
      WHERE civ.company_id = _company_id
        AND civ.company_item_id = v_component.company_item_id
        AND civ.pricing_basis = v_component.pricing_basis
        AND civ.attributes = v_requested_attributes
        AND civ.is_active
      ORDER BY civ.id
      LIMIT 1;
      IF v_variant.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
          DETAIL = v_component.item_name || ' | atributos=' || v_requested_attributes::text;
      END IF;
    END IF;

    v_cost := CASE WHEN v_variant.id IS NULL THEN v_component.base_cost ELSE v_variant.cost END;
    v_sale := CASE WHEN v_variant.id IS NULL THEN v_component.base_sale ELSE v_variant.sale_price END;
    IF v_cost IS NULL OR v_cost <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_COST',
        DETAIL = v_component.item_name || ' | company_item=' || v_component.company_item_id::text;
    END IF;
    IF v_sale IS NULL OR v_sale <= 0 THEN
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
      'material_type', v_component.item_type, 'pricing_basis', v_component.pricing_basis,
      'unit', v_component.pricing_unit, 'quantity', v_pricing_qty, 'stock_quantity', v_stock_qty,
      'unit_cost', v_cost, 'unit_sale_price', v_sale,
      'cost', round(v_pricing_qty * v_cost, 2),
      'sale_price', round(v_pricing_qty * v_sale, 2),
      'variant_id', v_variant.id,
      'variant', CASE WHEN v_variant.id IS NULL THEN v_requested_attributes ELSE v_variant.attributes END,
      'width_mm', v_width, 'height_mm', v_height,
      'physical_stock', v_physical, 'reserved_stock', v_reserved,
      'available_stock', v_physical - v_reserved
    ));
    v_total_cost := v_total_cost + round(v_pricing_qty * v_cost, 2);
    v_composition_sale := v_composition_sale + round(v_pricing_qty * v_sale, 2);
  END LOOP;

  IF jsonb_array_length(v_materials) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_COMPANY_ITEM',
      DETAIL = 'product composition is empty';
  END IF;
  v_area := round((_width_mm * _height_mm / 1000000) * _quantity, 6);
  IF v_product.pricing_type = 'FIXED_PER_SQM' THEN
    IF COALESCE(v_product.price_per_sqm, 0) <= 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE',
        DETAIL = 'fixed_price_per_sqm';
    END IF;
    v_total_sale := round(v_area * v_product.price_per_sqm, 2);
  ELSE
    v_total_sale := round(v_composition_sale, 2);
  END IF;

  RETURN jsonb_build_object(
    'composition_mode', 'fixed', 'engine_version', 4, 'snapshot_version', 3,
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
      'margin_percent', CASE WHEN v_total_sale > 0
        THEN round(((v_total_sale - v_total_cost) / v_total_sale) * 100, 2) ELSE NULL END,
      'fixed_price_per_sqm', CASE WHEN v_product.pricing_type = 'FIXED_PER_SQM'
        THEN v_product.price_per_sqm ELSE NULL END
    ),
    'warnings', v_warnings, 'ready_for_quote', true, 'frozen_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.phase4a_pricing_basis_for_unit(text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase4a_normalize_variant_attributes(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase4a_pricing_basis_for_unit(text,text)
  TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase4a_normalize_variant_attributes(jsonb)
  TO authenticated,service_role;

COMMENT ON COLUMN public.company_items.pricing_basis IS
  'Canonical commercial measurement basis. AREA materials are managed by Meus Precos.';
COMMENT ON COLUMN public.company_items.variant_attribute_schema IS
  'Configuration-driven attribute schema consumed by area pricing UI; editor belongs to Phase 4D.';
COMMENT ON COLUMN public.company_item_variants.attributes IS
  'Canonical normalized commercial variant identity. Legacy GLASS/PROFILE columns are compatibility mirrors.';
COMMENT ON COLUMN public.company_item_variants.pricing_basis IS
  'Variant basis copied from its canonical company_item.';
COMMENT ON FUNCTION public.resolve_company_product_pricing(uuid,uuid,numeric,numeric,integer,jsonb) IS
  'Canonical product resolver supporting generic attributes under variants.by_item while preserving Phase 3E legacy keys and immutable snapshot version 3.';

NOTIFY pgrst,'reload schema';

COMMIT;
