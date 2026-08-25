-- Phase 4A: evolve item_templates into the canonical dynamic material-family catalog.
-- Prices remain exclusively in company_item_variants and company_items are created lazily.
BEGIN;

ALTER TABLE public.item_templates
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS pricing_basis text,
  ADD COLUMN IF NOT EXISTS pricing_unit text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'item_templates_company_id_fkey'
      AND conrelid = 'public.item_templates'::regclass
  ) THEN
    ALTER TABLE public.item_templates
      ADD CONSTRAINT item_templates_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

ALTER TABLE public.item_templates
  DROP CONSTRAINT IF EXISTS item_templates_pricing_basis_check;
ALTER TABLE public.item_templates
  ADD CONSTRAINT item_templates_pricing_basis_check CHECK (
    pricing_basis IS NULL OR pricing_basis IN ('AREA', 'LENGTH', 'UNIT', 'WEIGHT', 'VOLUME')
  );

UPDATE public.item_templates
SET pricing_basis = COALESCE(pricing_basis, 'AREA'),
    pricing_unit = COALESCE(NULLIF(btrim(pricing_unit), ''), unit, 'm²'),
    sort_order = CASE upper(commercial_material_family)
      WHEN 'GLASS' THEN 10 WHEN 'MIRROR' THEN 20 WHEN 'ACM' THEN 30 ELSE sort_order END,
    updated_at = now()
WHERE is_commercial_area_material;

-- Global families are discovered directly. New tenants no longer require eager structural copies.
DROP TRIGGER IF EXISTS phase4a_seed_area_pricing_catalog ON public.companies;

DROP INDEX IF EXISTS public.item_templates_one_commercial_area_family_uidx;
CREATE UNIQUE INDEX item_templates_global_material_family_code_uidx
  ON public.item_templates (upper(commercial_material_family))
  WHERE is_commercial_area_material AND company_id IS NULL;
CREATE UNIQUE INDEX item_templates_private_material_family_code_uidx
  ON public.item_templates (company_id, upper(commercial_material_family))
  WHERE is_commercial_area_material AND company_id IS NOT NULL;
CREATE INDEX item_templates_material_family_catalog_idx
  ON public.item_templates (company_id, is_active, sort_order, name)
  WHERE is_commercial_area_material;

CREATE TABLE public.item_template_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_template_id uuid NOT NULL REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  attribute_code text NOT NULL,
  label text NOT NULL,
  data_type text NOT NULL DEFAULT 'SELECT',
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_template_attributes_code_check CHECK (
    attribute_code = upper(btrim(attribute_code)) AND attribute_code ~ '^[A-Z][A-Z0-9_]*$'
  ),
  CONSTRAINT item_template_attributes_label_check CHECK (NULLIF(btrim(label), '') IS NOT NULL),
  CONSTRAINT item_template_attributes_data_type_check CHECK (
    data_type IN ('SELECT', 'TEXT', 'NUMBER', 'BOOLEAN')
  ),
  CONSTRAINT item_template_attributes_family_code_key UNIQUE (item_template_id, attribute_code),
  CONSTRAINT item_template_attributes_id_family_key UNIQUE (id, item_template_id)
);

CREATE INDEX item_template_attributes_family_active_idx
  ON public.item_template_attributes (item_template_id, is_active, sort_order, id);

CREATE TABLE public.item_template_attribute_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES public.item_template_attributes(id) ON DELETE RESTRICT,
  option_code text NOT NULL,
  label text NOT NULL,
  canonical_value jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_template_attribute_options_code_check CHECK (
    option_code = upper(btrim(option_code)) AND option_code ~ '^[A-Z0-9][A-Z0-9_]*$'
  ),
  CONSTRAINT item_template_attribute_options_label_check CHECK (NULLIF(btrim(label), '') IS NOT NULL),
  CONSTRAINT item_template_attribute_options_attribute_code_key UNIQUE (attribute_id, option_code),
  CONSTRAINT item_template_attribute_options_id_attribute_key UNIQUE (id, attribute_id)
);

CREATE INDEX item_template_attribute_options_attribute_active_idx
  ON public.item_template_attribute_options (attribute_id, is_active, sort_order, id);

ALTER TABLE public.company_item_variants
  ADD COLUMN IF NOT EXISTS attribute_signature text;

CREATE TABLE public.company_item_variant_options (
  variant_id uuid NOT NULL REFERENCES public.company_item_variants(id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES public.item_template_attributes(id) ON DELETE RESTRICT,
  option_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant_id, attribute_id),
  CONSTRAINT company_item_variant_options_option_attribute_fkey
    FOREIGN KEY (option_id, attribute_id)
    REFERENCES public.item_template_attribute_options(id, attribute_id) ON DELETE RESTRICT,
  CONSTRAINT company_item_variant_options_variant_option_key UNIQUE (variant_id, option_id)
);

CREATE INDEX company_item_variant_options_option_idx
  ON public.company_item_variant_options (option_id, variant_id);
CREATE UNIQUE INDEX company_item_variants_attribute_signature_uidx
  ON public.company_item_variants (company_item_id, pricing_basis, attribute_signature)
  WHERE attribute_signature IS NOT NULL;

ALTER TABLE public.item_template_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_template_attribute_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_item_variant_options ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.phase4a_normalize_catalog_code(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT trim(both '_' FROM upper(regexp_replace(btrim(COALESCE(_value, '')), '[^A-Za-z0-9]+', '_', 'g')))
$$;

REVOKE ALL ON FUNCTION public.phase4a_normalize_catalog_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase4a_normalize_catalog_code(text) TO service_role;

-- Backfill the current JSON schemas into relational attributes.
INSERT INTO public.item_template_attributes(
  item_template_id, attribute_code, label, data_type, is_required, sort_order
)
SELECT
  it.id,
  public.phase4a_normalize_catalog_code(schema_entry->>'key'),
  COALESCE(NULLIF(btrim(schema_entry->>'label'), ''), schema_entry->>'key'),
  CASE upper(COALESCE(schema_entry->>'kind', 'SELECT'))
    WHEN 'NUMBER' THEN 'NUMBER' WHEN 'TEXT' THEN 'TEXT' WHEN 'BOOLEAN' THEN 'BOOLEAN' ELSE 'SELECT' END,
  COALESCE((schema_entry->>'required')::boolean, false),
  schema_entry.ordinality::integer * 10
FROM public.item_templates it
CROSS JOIN LATERAL jsonb_array_elements(it.variant_attribute_schema)
  WITH ORDINALITY AS schema_entry(schema_entry, ordinality)
WHERE it.is_commercial_area_material
  AND NULLIF(schema_entry->>'key', '') IS NOT NULL
ON CONFLICT (item_template_id, attribute_code) DO UPDATE SET
  label = EXCLUDED.label,
  data_type = EXCLUDED.data_type,
  is_required = EXCLUDED.is_required,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- Existing specialized catalogs are compatibility inputs for the canonical option IDs.
INSERT INTO public.item_template_attribute_options(attribute_id, option_code, label, canonical_value, sort_order)
SELECT a.id, public.phase4a_normalize_catalog_code(gt.slug), gt.name, to_jsonb(public.phase4a_normalize_catalog_code(gt.slug)), COALESCE(gt.sort_order, 0)
FROM public.item_template_attributes a
JOIN public.item_templates it ON it.id = a.item_template_id
JOIN public.glass_types gt ON gt.is_active
WHERE upper(it.commercial_material_family) = 'GLASS' AND a.attribute_code = 'TYPE'
ON CONFLICT (attribute_id, option_code) DO UPDATE SET label = EXCLUDED.label, canonical_value = EXCLUDED.canonical_value, updated_at = now();

INSERT INTO public.item_template_attribute_options(attribute_id, option_code, label, canonical_value, sort_order)
SELECT a.id, public.phase4a_normalize_catalog_code(gc.slug), gc.name, to_jsonb(public.phase4a_normalize_catalog_code(gc.slug)), gc.sort_order
FROM public.item_template_attributes a
JOIN public.item_templates it ON it.id = a.item_template_id
JOIN public.admin_glass_colors gc ON gc.is_active
WHERE upper(it.commercial_material_family) IN ('GLASS', 'MIRROR') AND a.attribute_code = 'COLOR'
ON CONFLICT (attribute_id, option_code) DO UPDATE SET label = EXCLUDED.label, canonical_value = EXCLUDED.canonical_value, updated_at = now();

INSERT INTO public.item_template_attribute_options(attribute_id, option_code, label, canonical_value, sort_order)
SELECT a.id, 'MM_' || gt.thickness_mm::text, gt.label, to_jsonb(gt.thickness_mm), gt.sort_order
FROM public.item_template_attributes a
JOIN public.item_templates it ON it.id = a.item_template_id
JOIN public.admin_glass_thicknesses gt ON gt.is_active
WHERE upper(it.commercial_material_family) IN ('GLASS', 'MIRROR') AND a.attribute_code = 'THICKNESS_MM'
ON CONFLICT (attribute_id, option_code) DO UPDATE SET label = EXCLUDED.label, canonical_value = EXCLUDED.canonical_value, updated_at = now();

INSERT INTO public.item_template_attribute_options(attribute_id, option_code, label, canonical_value, sort_order)
SELECT a.id, public.phase4a_normalize_catalog_code(ac.slug), ac.name, to_jsonb(public.phase4a_normalize_catalog_code(ac.slug)), ac.sort_order
FROM public.item_template_attributes a
JOIN public.item_templates it ON it.id = a.item_template_id
JOIN public.admin_aluminum_colors ac ON ac.is_active
WHERE upper(it.commercial_material_family) = 'ACM' AND a.attribute_code = 'COLOR'
ON CONFLICT (attribute_id, option_code) DO UPDATE SET label = EXCLUDED.label, canonical_value = EXCLUDED.canonical_value, updated_at = now();

INSERT INTO public.item_template_attribute_options(attribute_id, option_code, label, canonical_value, sort_order)
SELECT a.id, 'PADRAO', 'Padrão', to_jsonb('PADRAO'::text), 0
FROM public.item_template_attributes a
WHERE a.attribute_code = 'FINISH'
ON CONFLICT (attribute_id, option_code) DO UPDATE SET label = EXCLUDED.label, canonical_value = EXCLUDED.canonical_value, updated_at = now();

-- Preserve any values already used by tenant variants, even when absent from a specialized catalog.
INSERT INTO public.item_template_attribute_options(attribute_id, option_code, label, canonical_value, sort_order)
SELECT DISTINCT
  a.id,
  CASE WHEN a.data_type = 'NUMBER' THEN 'VALUE_' || public.phase4a_normalize_catalog_code(civ.attributes->>lower(a.attribute_code))
       ELSE public.phase4a_normalize_catalog_code(civ.attributes->>lower(a.attribute_code)) END,
  civ.attributes->>lower(a.attribute_code),
  civ.attributes->lower(a.attribute_code),
  999
FROM public.company_item_variants civ
JOIN public.company_items ci ON ci.id = civ.company_item_id
JOIN public.item_template_attributes a ON a.item_template_id = ci.item_template_id
WHERE civ.attributes ? lower(a.attribute_code)
  AND NULLIF(btrim(civ.attributes->>lower(a.attribute_code)), '') IS NOT NULL
ON CONFLICT (attribute_id, option_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.phase4a_material_attribute_signature(
  _family_id uuid,
  _option_ids uuid[],
  _require_active boolean DEFAULT true
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_signature text;
  v_supplied_count integer;
  v_valid_count integer;
  v_distinct_attribute_count integer;
  v_required_count integer;
  v_required_selected integer;
BEGIN
  IF _family_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_MATERIAL_FAMILY';
  END IF;
  IF COALESCE(array_length(_option_ids, 1), 0) = 0 THEN
    SELECT count(*) INTO v_required_count
    FROM public.item_template_attributes
    WHERE item_template_id = _family_id AND is_active AND is_required;
    IF v_required_count > 0 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_REQUIRED_ATTRIBUTE';
    END IF;
    RETURN 'NO_ATTRIBUTES';
  END IF;

  SELECT count(DISTINCT option_id) INTO v_supplied_count FROM unnest(_option_ids) option_id;
  SELECT count(*), count(DISTINCT a.id),
    string_agg(a.id::text || '=' || o.id::text, '|' ORDER BY a.id, o.id)
  INTO v_valid_count, v_distinct_attribute_count, v_signature
  FROM public.item_template_attribute_options o
  JOIN public.item_template_attributes a ON a.id = o.attribute_id
  WHERE o.id = ANY(_option_ids)
    AND a.item_template_id = _family_id
    AND (NOT _require_active OR (a.is_active AND o.is_active));

  IF v_valid_count <> v_supplied_count OR v_distinct_attribute_count <> v_supplied_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ATTRIBUTE_COMBINATION';
  END IF;

  SELECT count(*) INTO v_required_count
  FROM public.item_template_attributes
  WHERE item_template_id = _family_id AND is_active AND is_required;
  SELECT count(DISTINCT a.id) INTO v_required_selected
  FROM public.item_template_attribute_options o
  JOIN public.item_template_attributes a ON a.id = o.attribute_id
  WHERE o.id = ANY(_option_ids) AND a.item_template_id = _family_id
    AND a.is_active AND a.is_required AND (NOT _require_active OR o.is_active);
  IF v_required_selected <> v_required_count THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_REQUIRED_ATTRIBUTE';
  END IF;
  RETURN v_signature;
END;
$$;

REVOKE ALL ON FUNCTION public.phase4a_material_attribute_signature(uuid, uuid[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase4a_material_attribute_signature(uuid, uuid[], boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.list_company_material_families(_company_id uuid)
RETURNS TABLE(
  id uuid, code text, name text, description text, pricing_basis text, pricing_unit text,
  sort_order integer, configured_variants bigint, total_combinations numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  RETURN QUERY
  SELECT it.id, it.commercial_material_family, it.name, it.description,
    COALESCE(it.pricing_basis, 'AREA'), COALESCE(it.pricing_unit, it.unit), it.sort_order,
    count(DISTINCT civ.id) FILTER (WHERE civ.is_active),
    CASE WHEN count(DISTINCT a.id) FILTER (WHERE a.is_active AND a.is_required) = 0 THEN 1
      ELSE COALESCE(exp(sum(ln(NULLIF(option_counts.option_count, 0)))), 0) END
  FROM public.item_templates it
  LEFT JOIN public.item_template_attributes a ON a.item_template_id = it.id AND a.is_active
  LEFT JOIN LATERAL (
    SELECT count(*)::numeric option_count FROM public.item_template_attribute_options o
    WHERE o.attribute_id = a.id AND o.is_active
  ) option_counts ON true
  LEFT JOIN public.company_items ci ON ci.company_id = _company_id AND ci.item_template_id = it.id
  LEFT JOIN public.company_item_variants civ ON civ.company_item_id = ci.id
  WHERE it.is_commercial_area_material AND it.is_active
    AND (it.company_id IS NULL OR it.company_id = _company_id)
  GROUP BY it.id, it.commercial_material_family, it.name, it.description,
    it.pricing_basis, it.pricing_unit, it.unit, it.sort_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_company_material_family_catalog(_company_id uuid, _family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.item_templates it
    WHERE it.id = _family_id AND it.is_commercial_area_material AND it.is_active
      AND (it.company_id IS NULL OR it.company_id = _company_id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MATERIAL_FAMILY_NOT_FOUND';
  END IF;

  SELECT jsonb_build_object(
    'family', jsonb_build_object(
      'id', it.id, 'code', it.commercial_material_family, 'name', it.name,
      'description', it.description, 'pricing_basis', it.pricing_basis,
      'pricing_unit', it.pricing_unit, 'sort_order', it.sort_order
    ),
    'attributes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'code', a.attribute_code, 'label', a.label,
        'data_type', a.data_type, 'required', a.is_required, 'sort_order', a.sort_order,
        'options', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', o.id, 'code', o.option_code, 'label', o.label,
            'value', o.canonical_value, 'sort_order', o.sort_order
          ) ORDER BY o.sort_order, o.label)
          FROM public.item_template_attribute_options o
          WHERE o.attribute_id = a.id AND o.is_active
        ), '[]'::jsonb)
      ) ORDER BY a.sort_order, a.label)
      FROM public.item_template_attributes a
      WHERE a.item_template_id = it.id AND a.is_active
    ), '[]'::jsonb),
    'variants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', civ.id, 'company_item_id', civ.company_item_id,
        'signature', civ.attribute_signature, 'cost', civ.cost,
        'markup_percent', civ.markup_percent, 'sale_price', civ.sale_price,
        'option_ids', COALESCE((SELECT jsonb_agg(civo.option_id ORDER BY civo.attribute_id)
          FROM public.company_item_variant_options civo WHERE civo.variant_id = civ.id), '[]'::jsonb)
      ) ORDER BY civ.created_at)
      FROM public.company_items ci
      JOIN public.company_item_variants civ ON civ.company_item_id = ci.id AND civ.is_active
      WHERE ci.company_id = _company_id AND ci.item_template_id = it.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.item_templates it WHERE it.id = _family_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_company_material_variant(
  _company_id uuid,
  _family_id uuid,
  _option_ids uuid[],
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
  v_family public.item_templates;
  v_item public.company_items;
  v_variant public.company_item_variants;
  v_signature text;
  v_attributes jsonb;
  v_markup numeric;
  v_sale numeric;
BEGIN
  IF NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  SELECT * INTO v_family FROM public.item_templates
  WHERE id = _family_id AND is_commercial_area_material AND is_active
    AND (company_id IS NULL OR company_id = _company_id);
  IF v_family.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MATERIAL_FAMILY_NOT_FOUND';
  END IF;
  v_signature := public.phase4a_material_attribute_signature(_family_id, _option_ids, true);

  SELECT COALESCE(jsonb_object_agg(lower(a.attribute_code), COALESCE(o.canonical_value, to_jsonb(o.option_code))), '{}'::jsonb)
  INTO v_attributes
  FROM public.item_template_attribute_options o
  JOIN public.item_template_attributes a ON a.id = o.attribute_id
  WHERE o.id = ANY(COALESCE(_option_ids, ARRAY[]::uuid[]));

  IF _cost IS NULL OR _cost <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_COST';
  END IF;
  IF upper(_basis) = 'MARKUP' AND _value IS NOT NULL AND _value >= 0 THEN
    v_markup := _value;
    v_sale := round(_cost * (1 + _value / 100), 4);
  ELSIF upper(_basis) = 'SALE_PRICE' AND _value IS NOT NULL AND _value >= _cost THEN
    v_sale := _value;
    v_markup := round(((_value / _cost) - 1) * 100, 4);
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_INPUT';
  END IF;

  INSERT INTO public.company_items(
    company_id, item_template_id, name, description, type, unit,
    pricing_basis, pricing_unit, variant_attribute_schema,
    is_custom, is_active, is_commercial_area_material, commercial_material_family,
    cost, markup_percent, sale_price
  ) VALUES (
    _company_id, v_family.id, v_family.name, v_family.description, v_family.type::text,
    v_family.unit, COALESCE(v_family.pricing_basis, 'AREA'),
    COALESCE(v_family.pricing_unit, v_family.unit), v_family.variant_attribute_schema,
    false, true, true, upper(v_family.commercial_material_family), NULL, NULL, NULL
  )
  ON CONFLICT (company_id, item_template_id) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, type = EXCLUDED.type,
    unit = EXCLUDED.unit, pricing_basis = EXCLUDED.pricing_basis,
    pricing_unit = EXCLUDED.pricing_unit, variant_attribute_schema = EXCLUDED.variant_attribute_schema,
    is_commercial_area_material = true, commercial_material_family = EXCLUDED.commercial_material_family,
    is_active = true, updated_at = now()
  RETURNING * INTO v_item;

  SELECT * INTO v_variant FROM public.company_item_variants
  WHERE company_item_id = v_item.id AND pricing_basis = v_item.pricing_basis
    AND (attribute_signature = v_signature OR (attribute_signature IS NULL AND attributes = v_attributes))
  ORDER BY attribute_signature NULLS LAST, updated_at DESC LIMIT 1 FOR UPDATE;

  IF v_variant.id IS NULL THEN
    INSERT INTO public.company_item_variants(
      company_id, company_item_id, variant_type, pricing_basis, attributes,
      attribute_signature, glass_type, glass_color, glass_thickness_mm,
      cost, markup_percent, sale_price, is_active
    ) VALUES (
      _company_id, v_item.id, upper(v_family.commercial_material_family), v_item.pricing_basis,
      v_attributes, v_signature, v_attributes->>'type', v_attributes->>'color',
      CASE WHEN v_attributes ? 'thickness_mm' THEN (v_attributes->>'thickness_mm')::numeric ELSE NULL END,
      _cost, v_markup, v_sale, true
    ) RETURNING * INTO v_variant;
  ELSE
    UPDATE public.company_item_variants SET
      variant_type = upper(v_family.commercial_material_family), attributes = v_attributes,
      attribute_signature = v_signature, glass_type = v_attributes->>'type',
      glass_color = v_attributes->>'color',
      glass_thickness_mm = CASE WHEN v_attributes ? 'thickness_mm' THEN (v_attributes->>'thickness_mm')::numeric ELSE NULL END,
      cost = _cost, markup_percent = v_markup, sale_price = v_sale,
      is_active = true, updated_at = now()
    WHERE id = v_variant.id RETURNING * INTO v_variant;
  END IF;

  DELETE FROM public.company_item_variant_options WHERE variant_id = v_variant.id;
  INSERT INTO public.company_item_variant_options(variant_id, attribute_id, option_id)
  SELECT v_variant.id, o.attribute_id, o.id
  FROM public.item_template_attribute_options o
  WHERE o.id = ANY(COALESCE(_option_ids, ARRAY[]::uuid[]));

  INSERT INTO public.audit_logs(user_id, company_id, action, table_name, record_id, new_data, metadata)
  VALUES (auth.uid(), _company_id, 'upsert', 'company_item_variants', v_variant.id,
    to_jsonb(v_variant), jsonb_build_object('source', 'save_company_material_variant', 'family_id', _family_id));
  RETURN v_variant;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_company_material_price(
  _company_id uuid,
  _family_id uuid,
  _option_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_signature text; v_variant public.company_item_variants; v_family public.item_templates;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  SELECT * INTO v_family FROM public.item_templates
  WHERE id = _family_id AND is_commercial_area_material AND is_active
    AND (company_id IS NULL OR company_id = _company_id);
  IF v_family.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MATERIAL_FAMILY_NOT_FOUND';
  END IF;
  v_signature := public.phase4a_material_attribute_signature(_family_id, _option_ids, true);
  SELECT civ.* INTO v_variant
  FROM public.company_items ci
  JOIN public.company_item_variants civ ON civ.company_item_id = ci.id
  WHERE ci.company_id = _company_id AND ci.item_template_id = _family_id
    AND civ.company_id = _company_id AND civ.pricing_basis = COALESCE(v_family.pricing_basis, 'AREA')
    AND civ.attribute_signature = v_signature AND civ.is_active;
  IF v_variant.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE_VARIANT',
      DETAIL = jsonb_build_object('family_id', _family_id, 'family', v_family.commercial_material_family,
        'option_ids', _option_ids)::text;
  END IF;
  RETURN jsonb_build_object(
    'family_id', _family_id, 'family', v_family.commercial_material_family,
    'company_id', _company_id, 'company_item_id', v_variant.company_item_id,
    'variant_id', v_variant.id, 'signature', v_signature,
    'cost', v_variant.cost, 'markup_percent', v_variant.markup_percent,
    'sale_price', v_variant.sale_price, 'pricing_basis', v_variant.pricing_basis,
    'pricing_unit', v_family.pricing_unit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_company_product_pricing_canonical(
  _company_id uuid,
  _company_product_id uuid,
  _width_mm numeric,
  _height_mm numeric,
  _quantity integer,
  _material_selections jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_selection jsonb;
  v_family public.item_templates;
  v_option_ids uuid[];
  v_attributes jsonb;
  v_by_material jsonb := '{}'::jsonb;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF jsonb_typeof(COALESCE(_material_selections, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_MATERIAL_SELECTIONS';
  END IF;
  FOR v_selection IN SELECT value FROM jsonb_array_elements(_material_selections)
  LOOP
    SELECT array_agg(value::text::uuid) INTO v_option_ids
    FROM jsonb_array_elements_text(COALESCE(v_selection->'option_ids', '[]'::jsonb));
    SELECT * INTO v_family FROM public.item_templates
    WHERE id = (v_selection->>'family_id')::uuid AND is_commercial_area_material
      AND (company_id IS NULL OR company_id = _company_id);
    IF v_family.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_FAMILY_NOT_FOUND';
    END IF;
    PERFORM public.resolve_company_material_price(_company_id, v_family.id, v_option_ids);
    SELECT COALESCE(jsonb_object_agg(lower(a.attribute_code), COALESCE(o.canonical_value, to_jsonb(o.option_code))), '{}'::jsonb)
    INTO v_attributes
    FROM public.item_template_attribute_options o
    JOIN public.item_template_attributes a ON a.id=o.attribute_id
    WHERE o.id=ANY(v_option_ids) AND a.item_template_id=v_family.id;
    v_by_material := v_by_material || jsonb_build_object(upper(v_family.commercial_material_family), v_attributes);
  END LOOP;
  v_result := public.resolve_company_product_pricing(
    _company_id, _company_product_id, _width_mm, _height_mm, _quantity,
    jsonb_build_object('by_material', v_by_material)
  );
  RETURN v_result || jsonb_build_object(
    'canonical_material_selections', _material_selections,
    'canonical_material_identity', true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_material_family(
  _id uuid, _code text, _name text, _description text,
  _pricing_basis text, _pricing_unit text, _sort_order integer, _active boolean
)
RETURNS public.item_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result public.item_templates; v_code text := public.phase4a_normalize_catalog_code(_code);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF NULLIF(v_code, '') IS NULL OR NULLIF(btrim(_name), '') IS NULL
     OR upper(_pricing_basis) NOT IN ('AREA', 'LENGTH', 'UNIT', 'WEIGHT', 'VOLUME')
     OR NULLIF(btrim(_pricing_unit), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_MATERIAL_FAMILY';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.item_templates(
      name, description, type, unit, is_active, company_id,
      is_commercial_area_material, commercial_material_family,
      pricing_basis, pricing_unit, sort_order, variant_attribute_schema
    ) VALUES (
      btrim(_name), NULLIF(btrim(_description), ''), 'sheet', btrim(_pricing_unit), COALESCE(_active, true), NULL,
      true, v_code, upper(_pricing_basis), btrim(_pricing_unit), COALESCE(_sort_order, 0), '[]'::jsonb
    ) RETURNING * INTO v_result;
  ELSE
    UPDATE public.item_templates SET
      name = btrim(_name), description = NULLIF(btrim(_description), ''),
      unit = btrim(_pricing_unit), is_active = COALESCE(_active, is_active),
      pricing_basis = upper(_pricing_basis),
      pricing_unit = btrim(_pricing_unit), sort_order = COALESCE(_sort_order, sort_order), updated_at = now()
    WHERE id = _id AND is_commercial_area_material AND company_id IS NULL
    RETURNING * INTO v_result;
  END IF;
  IF v_result.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MATERIAL_FAMILY_NOT_FOUND'; END IF;
  INSERT INTO public.audit_logs(user_id, action, table_name, record_id, new_data, metadata)
  VALUES (auth.uid(), 'upsert', 'item_templates', v_result.id, to_jsonb(v_result),
    jsonb_build_object('source', 'admin_upsert_material_family'));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_material_attribute(
  _id uuid, _family_id uuid, _code text, _label text, _data_type text,
  _required boolean, _sort_order integer, _active boolean
)
RETURNS public.item_template_attributes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result public.item_template_attributes; v_code text := public.phase4a_normalize_catalog_code(_code);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_saas_admin(auth.uid()) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.item_templates WHERE id=_family_id AND is_commercial_area_material AND company_id IS NULL)
     OR NULLIF(v_code,'') IS NULL OR NULLIF(btrim(_label),'') IS NULL
     OR upper(_data_type) NOT IN ('SELECT','TEXT','NUMBER','BOOLEAN') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_MATERIAL_ATTRIBUTE';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.item_template_attributes(item_template_id,attribute_code,label,data_type,is_required,sort_order,is_active)
    VALUES(_family_id,v_code,btrim(_label),upper(_data_type),COALESCE(_required,true),COALESCE(_sort_order,0),COALESCE(_active,true))
    RETURNING * INTO v_result;
  ELSE
    UPDATE public.item_template_attributes SET label=btrim(_label),data_type=upper(_data_type),
      is_required=COALESCE(_required,is_required),sort_order=COALESCE(_sort_order,sort_order),
      is_active=COALESCE(_active,is_active),updated_at=now()
    WHERE id=_id AND item_template_id=_family_id RETURNING * INTO v_result;
  END IF;
  IF v_result.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_ATTRIBUTE_NOT_FOUND'; END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),'upsert','item_template_attributes',v_result.id,to_jsonb(v_result),jsonb_build_object('family_id',_family_id));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_material_option(
  _id uuid, _attribute_id uuid, _code text, _label text, _value jsonb,
  _sort_order integer, _active boolean
)
RETURNS public.item_template_attribute_options
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result public.item_template_attribute_options; v_code text := public.phase4a_normalize_catalog_code(_code);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_saas_admin(auth.uid()) THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.item_template_attributes a JOIN public.item_templates it ON it.id=a.item_template_id
    WHERE a.id=_attribute_id AND it.is_commercial_area_material AND it.company_id IS NULL
  ) OR NULLIF(v_code,'') IS NULL OR NULLIF(btrim(_label),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_MATERIAL_OPTION';
  END IF;
  IF _id IS NULL THEN
    INSERT INTO public.item_template_attribute_options(attribute_id,option_code,label,canonical_value,sort_order,is_active)
    VALUES(_attribute_id,v_code,btrim(_label),COALESCE(_value,to_jsonb(v_code)),COALESCE(_sort_order,0),COALESCE(_active,true))
    RETURNING * INTO v_result;
  ELSE
    UPDATE public.item_template_attribute_options SET label=btrim(_label),
      canonical_value=COALESCE(_value,canonical_value),sort_order=COALESCE(_sort_order,sort_order),
      is_active=COALESCE(_active,is_active),updated_at=now()
    WHERE id=_id AND attribute_id=_attribute_id RETURNING * INTO v_result;
  END IF;
  IF v_result.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MATERIAL_OPTION_NOT_FOUND'; END IF;
  INSERT INTO public.audit_logs(user_id,action,table_name,record_id,new_data,metadata)
  VALUES(auth.uid(),'upsert','item_template_attribute_options',v_result.id,to_jsonb(v_result),jsonb_build_object('attribute_id',_attribute_id));
  RETURN v_result;
END;
$$;

-- Backfill canonical option links/signatures for compatible existing variants.
DO $$
DECLARE v record; v_ids uuid[]; v_signature text;
BEGIN
  FOR v IN
    SELECT civ.id, ci.item_template_id, civ.attributes
    FROM public.company_item_variants civ
    JOIN public.company_items ci ON ci.id = civ.company_item_id
    WHERE ci.item_template_id IS NOT NULL AND ci.is_commercial_area_material
  LOOP
    SELECT array_agg(o.id ORDER BY a.id) INTO v_ids
    FROM public.item_template_attributes a
    JOIN public.item_template_attribute_options o ON o.attribute_id = a.id
    WHERE a.item_template_id = v.item_template_id
      AND (
        upper(COALESCE(v.attributes->>lower(a.attribute_code), '')) = upper(COALESCE(o.canonical_value #>> '{}', o.option_code))
        OR public.phase4a_normalize_catalog_code(v.attributes->>lower(a.attribute_code)) = o.option_code
        OR (a.attribute_code = 'THICKNESS_MM' AND 'MM_' || (v.attributes->>lower(a.attribute_code)) = o.option_code)
      );
    BEGIN
      v_signature := public.phase4a_material_attribute_signature(v.item_template_id, v_ids, false);
      INSERT INTO public.company_item_variant_options(variant_id, attribute_id, option_id)
      SELECT v.id, o.attribute_id, o.id FROM public.item_template_attribute_options o WHERE o.id = ANY(v_ids)
      ON CONFLICT (variant_id, attribute_id) DO UPDATE SET option_id = EXCLUDED.option_id;
      UPDATE public.company_item_variants SET attribute_signature = v_signature WHERE id = v.id;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- legacy incomplete variants remain available through compatibility columns only.
    END;
  END LOOP;
END;
$$;

-- SaaS admin identity is table-driven; no email or user UUID is an authorization rule.
CREATE OR REPLACE FUNCTION public.is_saas_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.saas_admins sa WHERE sa.user_id = _user_id
  )
$$;

-- Replace broad policies with explicit authenticated policies.
DROP POLICY IF EXISTS "Authenticated can view item templates" ON public.item_templates;
DROP POLICY IF EXISTS "SaaS admins can manage item templates" ON public.item_templates;
CREATE POLICY item_templates_select ON public.item_templates FOR SELECT TO authenticated
USING (company_id IS NULL OR public.is_saas_admin((SELECT auth.uid())) OR public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY item_templates_admin_manage ON public.item_templates FOR ALL TO authenticated
USING (public.is_saas_admin((SELECT auth.uid())))
WITH CHECK (public.is_saas_admin((SELECT auth.uid())));

CREATE POLICY item_template_attributes_select ON public.item_template_attributes FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.item_templates it WHERE it.id=item_template_id
    AND (it.company_id IS NULL OR public.is_saas_admin((SELECT auth.uid())) OR public.user_belongs_to_company((SELECT auth.uid()), it.company_id))
));
CREATE POLICY item_template_attribute_options_select ON public.item_template_attribute_options FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.item_template_attributes a JOIN public.item_templates it ON it.id=a.item_template_id
  WHERE a.id=attribute_id AND (it.company_id IS NULL OR public.is_saas_admin((SELECT auth.uid())) OR public.user_belongs_to_company((SELECT auth.uid()), it.company_id))
));
CREATE POLICY company_item_variant_options_select ON public.company_item_variant_options FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.company_item_variants civ
  WHERE civ.id=variant_id AND public.user_belongs_to_company((SELECT auth.uid()), civ.company_id)
));

DROP POLICY IF EXISTS "Users can view company items" ON public.company_items;
DROP POLICY IF EXISTS "Users can insert company items" ON public.company_items;
DROP POLICY IF EXISTS "Users can update company items" ON public.company_items;
DROP POLICY IF EXISTS "Users can delete company items" ON public.company_items;
CREATE POLICY company_items_select ON public.company_items FOR SELECT TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY company_items_insert ON public.company_items FOR INSERT TO authenticated
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY company_items_update ON public.company_items FOR UPDATE TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));
CREATE POLICY company_items_delete ON public.company_items FOR DELETE TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));

REVOKE ALL ON TABLE public.item_templates, public.company_items, public.company_item_variants,
  public.item_template_attributes, public.item_template_attribute_options,
  public.company_item_variant_options FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.item_templates, public.company_items,
  public.company_item_variants FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.company_item_variants FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.item_templates, public.company_items TO authenticated;
GRANT SELECT ON TABLE public.company_item_variants, public.item_template_attributes,
  public.item_template_attribute_options, public.company_item_variant_options TO authenticated;

REVOKE ALL ON FUNCTION public.is_saas_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_saas_admin(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_company_material_families(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_company_material_family_catalog(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_company_material_variant(uuid, uuid, uuid[], numeric, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_company_material_price(uuid, uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_company_product_pricing_canonical(uuid, uuid, numeric, numeric, integer, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_material_family(uuid, text, text, text, text, text, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_material_attribute(uuid, uuid, text, text, text, boolean, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_material_option(uuid, uuid, text, text, jsonb, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_company_material_families(uuid),
  public.get_company_material_family_catalog(uuid, uuid),
  public.save_company_material_variant(uuid, uuid, uuid[], numeric, text, numeric),
  public.resolve_company_material_price(uuid, uuid, uuid[]),
  public.resolve_company_product_pricing_canonical(uuid, uuid, numeric, numeric, integer, jsonb),
  public.admin_upsert_material_family(uuid, text, text, text, text, text, integer, boolean),
  public.admin_upsert_material_attribute(uuid, uuid, text, text, text, boolean, integer, boolean),
  public.admin_upsert_material_option(uuid, uuid, text, text, jsonb, integer, boolean)
TO authenticated;

GRANT ALL ON TABLE public.item_template_attributes, public.item_template_attribute_options,
  public.company_item_variant_options TO service_role;
GRANT EXECUTE ON FUNCTION public.phase4a_material_attribute_signature(uuid, uuid[], boolean),
  public.list_company_material_families(uuid), public.get_company_material_family_catalog(uuid, uuid),
  public.save_company_material_variant(uuid, uuid, uuid[], numeric, text, numeric),
  public.resolve_company_material_price(uuid, uuid, uuid[]),
  public.resolve_company_product_pricing_canonical(uuid, uuid, numeric, numeric, integer, jsonb),
  public.admin_upsert_material_family(uuid, text, text, text, text, text, integer, boolean),
  public.admin_upsert_material_attribute(uuid, uuid, text, text, text, boolean, integer, boolean),
  public.admin_upsert_material_option(uuid, uuid, text, text, jsonb, integer, boolean)
TO service_role;

COMMENT ON TABLE public.item_template_attributes IS 'Relational attribute definitions subordinate to canonical material-family item_templates.';
COMMENT ON TABLE public.item_template_attribute_options IS 'Stable-ID options for canonical material-family attributes; labels may change without changing identity.';
COMMENT ON TABLE public.company_item_variant_options IS 'Canonical option identity links for tenant-owned company_item_variants; not a price source.';
COMMENT ON FUNCTION public.save_company_material_variant(uuid, uuid, uuid[], numeric, text, numeric)
  IS 'Transactional lazy company_item materialization plus canonical tenant price UPSERT by stable option-ID signature.';

NOTIFY pgrst, 'reload schema';
COMMIT;
