-- Phase 4B.1: canonical inventory hierarchy, linear conversions and transparent
-- default locations. physical_stock_balances remains the only physical truth.

ALTER TABLE public.item_templates
  ADD COLUMN category_id uuid,
  ADD COLUMN line_id uuid;

ALTER TABLE public.company_item_variants
  ADD COLUMN aluminum_color_id uuid;

ALTER TABLE public.inventory_item_units
  ADD COLUMN sale_unit text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'item_templates_category_id_fkey'
      AND conrelid = 'public.item_templates'::regclass
  ) THEN
    ALTER TABLE public.item_templates
      ADD CONSTRAINT item_templates_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.item_types(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'item_templates_line_id_fkey'
      AND conrelid = 'public.item_templates'::regclass
  ) THEN
    ALTER TABLE public.item_templates
      ADD CONSTRAINT item_templates_line_id_fkey
      FOREIGN KEY (line_id) REFERENCES public.product_linhas(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_item_variants_aluminum_color_id_fkey'
      AND conrelid = 'public.company_item_variants'::regclass
  ) THEN
    ALTER TABLE public.company_item_variants
      ADD CONSTRAINT company_item_variants_aluminum_color_id_fkey
      FOREIGN KEY (aluminum_color_id)
      REFERENCES public.admin_aluminum_colors(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'inventory_item_units_sale_unit_check'
      AND conrelid = 'public.inventory_item_units'::regclass
  ) THEN
    ALTER TABLE public.inventory_item_units
      ADD CONSTRAINT inventory_item_units_sale_unit_check
      CHECK (sale_unit IS NULL OR btrim(sale_unit) <> '');
  END IF;
END;
$$;

CREATE INDEX item_templates_category_id_idx
  ON public.item_templates(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX item_templates_line_id_idx
  ON public.item_templates(line_id) WHERE line_id IS NOT NULL;
CREATE INDEX company_item_variants_aluminum_color_id_idx
  ON public.company_item_variants(aluminum_color_id) WHERE aluminum_color_id IS NOT NULL;
CREATE UNIQUE INDEX company_item_variants_profile_color_uidx
  ON public.company_item_variants(company_item_id, aluminum_color_id)
  WHERE aluminum_color_id IS NOT NULL;

-- Only deterministic legacy labels are normalized. No semantic guesses.
UPDATE public.item_templates it
SET category_id = t.id
FROM public.item_types t
WHERE it.category_id IS NULL
  AND lower(t.slug) = lower(it.type::text);

UPDATE public.item_templates it
SET line_id = l.id
FROM public.product_linhas l
WHERE it.line_id IS NULL
  AND NULLIF(lower(btrim(COALESCE(it.linha, ''))), '') IS NOT NULL
  AND lower(btrim(it.linha)) <> 'sem linha'
  AND (
    lower(btrim(it.linha)) = lower(l.slug)
    OR lower(btrim(it.linha)) = lower(l.name)
  );

UPDATE public.inventory_item_units iu
SET sale_unit = CASE
  WHEN iu.physical_dimension = 'LENGTH' THEN 'M'
  WHEN iu.physical_dimension = 'AREA' THEN 'M2'
  WHEN iu.physical_dimension = 'MASS' THEN 'KG'
  ELSE 'UNIT'
END
WHERE iu.sale_unit IS NULL;

COMMENT ON COLUMN public.item_templates.category_id IS
  'Canonical inventory category identity; item_templates.type remains compatibility text.';
COMMENT ON COLUMN public.item_templates.line_id IS
  'Canonical product/inventory line identity; item_templates.linha remains compatibility text.';
COMMENT ON COLUMN public.company_item_variants.aluminum_color_id IS
  'Stable global aluminum-color identity for tenant-owned profile variants.';
COMMENT ON COLUMN public.inventory_item_units.sale_unit IS
  'Default commercial display/sale unit; physical quantities remain canonical.';

-- Every company gets one transparent operational location. Historical balances
-- in LEGACY_REVIEW are deliberately not moved.
INSERT INTO public.stock_locations(
  company_id, code, name, kind, is_active, is_system, needs_review
)
SELECT c.id, 'DEFAULT_STOCK', 'Estoque principal', 'WAREHOUSE', true, true, false
FROM public.companies c
ON CONFLICT (company_id, code) DO UPDATE
SET is_active = true, is_system = true, needs_review = false,
    name = EXCLUDED.name, updated_at = now();

CREATE OR REPLACE FUNCTION public.phase4b1_create_default_stock_location()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.stock_locations(
    company_id, code, name, kind, is_active, is_system, needs_review
  ) VALUES (
    NEW.id, 'DEFAULT_STOCK', 'Estoque principal', 'WAREHOUSE', true, true, false
  ) ON CONFLICT (company_id, code) DO UPDATE
  SET is_active = true, is_system = true, needs_review = false,
      name = EXCLUDED.name, updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase4b1_default_stock_location ON public.companies;
CREATE TRIGGER trg_phase4b1_default_stock_location
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.phase4b1_create_default_stock_location();

REVOKE ALL ON FUNCTION public.phase4b1_create_default_stock_location() FROM PUBLIC, anon, authenticated;

-- Linear conversions derive from one canonical MM balance. Weight is an
-- enterprise override when present, otherwise the global template default.
CREATE OR REPLACE FUNCTION public.phase3f_unit_factor(
  _company_item_id uuid,
  _unit text,
  _width_mm numeric DEFAULT NULL,
  _height_mm numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config public.inventory_item_units;
  v_item public.company_items;
  v_unit text := public.phase3f_normalize_unit(_unit);
  v_weight_per_meter numeric;
BEGIN
  SELECT * INTO v_config
  FROM public.inventory_item_units
  WHERE company_item_id = _company_item_id;
  IF v_config.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_CONVERSION';
  END IF;
  IF v_config.legacy_status = 'AMBIGUOUS' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AMBIGUOUS_LEGACY_STOCK';
  END IF;
  IF v_unit IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_UNIT', DETAIL = COALESCE(_unit, 'NULL');
  END IF;

  SELECT ci.* INTO v_item
  FROM public.company_items ci
  WHERE ci.id = _company_item_id;

  IF v_config.physical_dimension = 'LENGTH' AND v_config.canonical_unit = 'MM' THEN
    SELECT COALESCE(NULLIF(v_item.weight_per_meter, 0), NULLIF(it.weight_per_meter, 0))
      INTO v_weight_per_meter
    FROM public.item_templates it
    WHERE it.id = v_item.item_template_id;

    IF v_unit = 'MM' THEN RETURN 1; END IF;
    IF v_unit = 'M' THEN RETURN 1000; END IF;
    IF v_unit = 'BAR' THEN
      IF COALESCE(v_config.nominal_length_mm, 0) <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_NOMINAL_LENGTH';
      END IF;
      RETURN v_config.nominal_length_mm;
    END IF;
    IF v_unit IN ('KG', 'G') THEN
      IF COALESCE(v_weight_per_meter, 0) <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_LINEAR_WEIGHT';
      END IF;
      IF v_unit = 'KG' THEN RETURN 1000 / v_weight_per_meter; END IF;
      RETURN 1 / v_weight_per_meter;
    END IF;
  END IF;

  IF v_unit = 'SHEET' THEN
    IF COALESCE(_width_mm, 0) <= 0 OR COALESCE(_height_mm, 0) <= 0
       OR v_config.canonical_unit <> 'MM2' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_DIMENSIONS';
    END IF;
    RETURN _width_mm * _height_mm;
  END IF;
  IF v_unit = public.phase3f_normalize_unit(v_config.purchase_unit) THEN
    IF v_config.purchase_to_canonical_factor IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_CONVERSION';
    END IF;
    RETURN v_config.purchase_to_canonical_factor;
  ELSIF v_unit = public.phase3f_normalize_unit(v_config.stock_unit) THEN
    IF v_config.stock_to_canonical_factor IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_CONVERSION';
    END IF;
    RETURN v_config.stock_to_canonical_factor;
  ELSIF v_unit = public.phase3f_normalize_unit(v_config.consumption_unit) THEN
    IF v_config.consumption_to_canonical_factor IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_CONVERSION';
    END IF;
    RETURN v_config.consumption_to_canonical_factor;
  ELSIF v_unit = v_config.canonical_unit THEN
    RETURN 1;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_UNIT',
    DETAIL = format('%s is not configured for company_item %s', _unit, _company_item_id);
END;
$$;

REVOKE ALL ON FUNCTION public.phase3f_unit_factor(uuid,text,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase3f_unit_factor(uuid,text,numeric,numeric) TO authenticated, service_role;

-- Stable tenant-owned profile variants. Global colors never contain prices.
CREATE OR REPLACE FUNCTION public.set_company_profile_variant_active(
  _company_id uuid,
  _company_item_id uuid,
  _aluminum_color_id uuid,
  _is_active boolean,
  _cost numeric DEFAULT NULL,
  _sale_price numeric DEFAULT NULL
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.company_items;
  v_color public.admin_aluminum_colors;
  v_variant public.company_item_variants;
  v_old jsonb;
BEGIN
  IF v_user_id IS NULL OR NOT public.phase3e_can_manage_pricing(v_user_id, _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  SELECT * INTO v_item FROM public.company_items
  WHERE id = _company_item_id AND company_id = _company_id FOR UPDATE;
  IF v_item.id IS NULL OR lower(v_item.type) NOT IN ('profile','perfil') THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
  END IF;
  SELECT * INTO v_color FROM public.admin_aluminum_colors
  WHERE id = _aluminum_color_id AND is_active;
  IF v_color.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_PROFILE_COLOR';
  END IF;
  IF COALESCE(_cost, 0) < 0 OR COALESCE(_sale_price, 0) < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICE';
  END IF;

  SELECT * INTO v_variant FROM public.company_item_variants
  WHERE company_item_id = _company_item_id
    AND aluminum_color_id = _aluminum_color_id
  FOR UPDATE;
  v_old := CASE WHEN v_variant.id IS NULL THEN NULL ELSE to_jsonb(v_variant) END;

  IF v_variant.id IS NULL THEN
    INSERT INTO public.company_item_variants(
      company_id, company_item_id, variant_type, profile_color,
      cost, sale_price, is_active, pricing_basis, attributes,
      attribute_signature, aluminum_color_id
    ) VALUES (
      _company_id, _company_item_id, 'PROFILE', v_color.name,
      _cost, _sale_price, _is_active, 'LENGTH',
      jsonb_build_object('color_id', v_color.id, 'color', upper(v_color.slug)),
      'COLOR_ID=' || v_color.id::text, v_color.id
    ) RETURNING * INTO v_variant;
  ELSE
    UPDATE public.company_item_variants
    SET profile_color = v_color.name,
        cost = COALESCE(_cost, cost),
        sale_price = COALESCE(_sale_price, sale_price),
        is_active = _is_active,
        pricing_basis = 'LENGTH',
        attributes = jsonb_build_object('color_id', v_color.id, 'color', upper(v_color.slug)),
        attribute_signature = 'COLOR_ID=' || v_color.id::text,
        updated_at = now()
    WHERE id = v_variant.id
    RETURNING * INTO v_variant;
  END IF;

  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,old_data,new_data,metadata)
  VALUES (v_user_id,_company_id,'update','company_item_variants',v_variant.id,v_old,to_jsonb(v_variant),
    jsonb_build_object('source','phase4b1_profile_variant_activation'));
  RETURN v_variant;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_profile_variant_active(uuid,uuid,uuid,boolean,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_profile_variant_active(uuid,uuid,uuid,boolean,numeric,numeric) TO authenticated, service_role;

-- One derived read model by tenant/item/variant. No quantity is persisted here.
CREATE OR REPLACE VIEW public.inventory_variant_summary
WITH (security_invoker = true)
AS
WITH entities AS (
  SELECT ci.company_id, ci.id AS company_item_id, civ.id AS variant_id
  FROM public.company_items ci
  JOIN public.company_item_variants civ
    ON civ.company_id = ci.company_id AND civ.company_item_id = ci.id
  WHERE ci.is_active AND civ.is_active
  UNION ALL
  SELECT ci.company_id, ci.id, NULL::uuid
  FROM public.company_items ci
  WHERE ci.is_active AND (
    NOT EXISTS (
      SELECT 1 FROM public.company_item_variants civ
      WHERE civ.company_id = ci.company_id AND civ.company_item_id = ci.id AND civ.is_active
    ) OR EXISTS (
      SELECT 1 FROM public.physical_stock_balances pb
      WHERE pb.company_id = ci.company_id AND pb.company_item_id = ci.id
        AND pb.variant_id IS NULL AND pb.canonical_quantity > 0
    )
  )
), balances AS (
  SELECT company_id, company_item_id, variant_id,
    sum(canonical_quantity) AS on_hand_canonical,
    sum(package_quantity) AS package_quantity,
    CASE WHEN bool_or(inventory_value IS NULL AND canonical_quantity > 0) THEN NULL
      ELSE COALESCE(sum(inventory_value),0) END AS inventory_value
  FROM public.physical_stock_balances
  GROUP BY company_id, company_item_id, variant_id
), reservations AS (
  SELECT company_id, company_item_id, variant_id,
    sum(canonical_quantity) AS reserved_canonical
  FROM public.stock_reservations
  WHERE status = 'reserved'
  GROUP BY company_id, company_item_id, variant_id
)
SELECT
  e.company_id, e.company_item_id, ci.item_template_id,
  it.category_id, cat.slug AS category_code, cat.name AS category_name,
  it.line_id, line.slug AS line_code, line.name AS line_name,
  ci.name AS item_name, ci.type AS legacy_type, ci.is_active AS item_active,
  e.variant_id, COALESCE(color.name,civ.profile_color,civ.glass_color) AS variant_name,
  color.id AS aluminum_color_id, color.slug AS color_code, civ.is_active AS variant_active,
  iu.physical_dimension, iu.purchase_unit, iu.stock_unit, iu.consumption_unit,
  iu.sale_unit, iu.canonical_unit, iu.nominal_length_mm, iu.cost_policy, iu.legacy_status,
  COALESCE(NULLIF(ci.weight_per_meter,0),NULLIF(it.weight_per_meter,0)) AS weight_per_meter_kg,
  CASE WHEN COALESCE(iu.nominal_length_mm,0) > 0
         AND COALESCE(NULLIF(ci.weight_per_meter,0),NULLIF(it.weight_per_meter,0)) > 0
    THEN iu.nominal_length_mm / 1000
      * COALESCE(NULLIF(ci.weight_per_meter,0),NULLIF(it.weight_per_meter,0)) END AS weight_per_bar_kg,
  COALESCE(b.on_hand_canonical,0) AS on_hand_canonical,
  COALESCE(r.reserved_canonical,0) AS reserved_canonical,
  GREATEST(COALESCE(b.on_hand_canonical,0)-COALESCE(r.reserved_canonical,0),0) AS available_canonical,
  CASE WHEN iu.canonical_unit='MM' THEN COALESCE(b.on_hand_canonical,0)/1000 END AS on_hand_meters,
  CASE WHEN iu.canonical_unit='MM' AND COALESCE(iu.nominal_length_mm,0)>0
    THEN COALESCE(b.on_hand_canonical,0)/iu.nominal_length_mm END AS on_hand_bars,
  CASE WHEN iu.canonical_unit='MM'
         AND COALESCE(NULLIF(ci.weight_per_meter,0),NULLIF(it.weight_per_meter,0))>0
    THEN COALESCE(b.on_hand_canonical,0)/1000
      * COALESCE(NULLIF(ci.weight_per_meter,0),NULLIF(it.weight_per_meter,0)) END AS on_hand_kg,
  CASE WHEN iu.canonical_unit='MM' THEN COALESCE(r.reserved_canonical,0)/1000 END AS reserved_meters,
  CASE WHEN iu.canonical_unit='MM' THEN GREATEST(COALESCE(b.on_hand_canonical,0)-COALESCE(r.reserved_canonical,0),0)/1000 END AS available_meters,
  CASE WHEN COALESCE(b.on_hand_canonical,0)>0 AND b.inventory_value IS NOT NULL
    THEN b.inventory_value/b.on_hand_canonical END AS average_cost_per_canonical,
  b.inventory_value,
  COALESCE(civ.cost,ci.cost) AS commercial_cost,
  COALESCE(civ.sale_price,ci.sale_price) AS commercial_sale_price,
  ci.pricing_unit
FROM entities e
JOIN public.company_items ci ON ci.id=e.company_item_id AND ci.company_id=e.company_id
LEFT JOIN public.item_templates it ON it.id=ci.item_template_id
LEFT JOIN public.item_types cat ON cat.id=it.category_id
LEFT JOIN public.product_linhas line ON line.id=it.line_id
JOIN public.inventory_item_units iu ON iu.company_item_id=ci.id AND iu.company_id=ci.company_id
LEFT JOIN public.company_item_variants civ ON civ.id=e.variant_id AND civ.company_id=e.company_id
LEFT JOIN public.admin_aluminum_colors color ON color.id=civ.aluminum_color_id
LEFT JOIN balances b ON b.company_id=e.company_id AND b.company_item_id=e.company_item_id
  AND b.variant_id IS NOT DISTINCT FROM e.variant_id
LEFT JOIN reservations r ON r.company_id=e.company_id AND r.company_item_id=e.company_item_id
  AND r.variant_id IS NOT DISTINCT FROM e.variant_id;

REVOKE ALL ON public.inventory_variant_summary FROM PUBLIC, anon;
GRANT SELECT ON public.inventory_variant_summary TO authenticated, service_role;

ALTER TABLE public.item_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_linhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_types_select ON public.item_types;
CREATE POLICY item_types_select ON public.item_types FOR SELECT TO authenticated
USING (true);
DROP POLICY IF EXISTS item_types_admin_manage ON public.item_types;
CREATE POLICY item_types_admin_manage ON public.item_types FOR ALL TO authenticated
USING ((SELECT public.is_saas_admin((SELECT auth.uid()))))
WITH CHECK ((SELECT public.is_saas_admin((SELECT auth.uid()))));

DROP POLICY IF EXISTS "Admins can manage product linhas" ON public.product_linhas;
DROP POLICY IF EXISTS "Anyone can read product linhas" ON public.product_linhas;
DROP POLICY IF EXISTS auth_read_product_linhas ON public.product_linhas;
DROP POLICY IF EXISTS product_linhas_select ON public.product_linhas;
CREATE POLICY product_linhas_select ON public.product_linhas FOR SELECT TO authenticated
USING (true);
DROP POLICY IF EXISTS product_linhas_admin_manage ON public.product_linhas;
CREATE POLICY product_linhas_admin_manage ON public.product_linhas FOR ALL TO authenticated
USING ((SELECT public.is_saas_admin((SELECT auth.uid()))))
WITH CHECK ((SELECT public.is_saas_admin((SELECT auth.uid()))));

REVOKE ALL ON public.item_types, public.product_linhas FROM anon;
GRANT SELECT ON public.item_types, public.product_linhas TO authenticated;

-- Remove privileged legacy stock entry points from public/anonymous execution.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'get_available_stock','adjust_company_stock','save_company_item_configuration'
    )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.signature);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.record_physical_stock_movement(
  uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_physical_stock_movement(
  uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb
) TO authenticated, service_role;
