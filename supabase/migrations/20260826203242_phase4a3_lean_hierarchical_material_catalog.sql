-- Phase 4A.3: lean default catalog while preserving the generic material engine.
-- Global definitions remain the catalog authority; tenant prices remain exclusively
-- in company_item_variants.

DO $$
DECLARE
  v_glass_id uuid;
  v_mirror_id uuid;
  v_acm_id uuid;
  v_type_attribute uuid;
  v_color_attribute uuid;
  v_thickness_attribute uuid;
  v_finish_attribute uuid;
  v_composition_attribute uuid;
  v_option_ids uuid[];
  v_signature text;
  v_definition_id uuid;
  v_spec record;
  v_company_variants_before text;
  v_company_variants_after text;
  v_company_variant_count bigint;
BEGIN
  SELECT md5(COALESCE(jsonb_agg(to_jsonb(civ) ORDER BY civ.id)::text, '[]')),
         count(*)
  INTO v_company_variants_before, v_company_variant_count
  FROM public.company_item_variants civ;

  SELECT id INTO v_glass_id
  FROM public.item_templates
  WHERE company_id IS NULL AND is_commercial_area_material
    AND upper(commercial_material_family) = 'GLASS';
  SELECT id INTO v_mirror_id
  FROM public.item_templates
  WHERE company_id IS NULL AND is_commercial_area_material
    AND upper(commercial_material_family) = 'MIRROR';
  SELECT id INTO v_acm_id
  FROM public.item_templates
  WHERE company_id IS NULL AND is_commercial_area_material
    AND upper(commercial_material_family) = 'ACM';

  IF v_glass_id IS NULL OR v_mirror_id IS NULL OR v_acm_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PHASE4A3_MATERIAL_FAMILY_MISSING';
  END IF;

  SELECT id INTO v_type_attribute FROM public.item_template_attributes
  WHERE item_template_id = v_glass_id AND attribute_code = 'TYPE' AND is_active;
  SELECT id INTO v_color_attribute FROM public.item_template_attributes
  WHERE item_template_id = v_glass_id AND attribute_code = 'COLOR' AND is_active;
  SELECT id INTO v_thickness_attribute FROM public.item_template_attributes
  WHERE item_template_id = v_glass_id AND attribute_code = 'THICKNESS_MM' AND is_active;
  SELECT id INTO v_finish_attribute FROM public.item_template_attributes
  WHERE item_template_id = v_glass_id AND attribute_code = 'FINISH' AND is_active;

  IF v_type_attribute IS NULL OR v_color_attribute IS NULL
     OR v_thickness_attribute IS NULL OR v_finish_attribute IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PHASE4A3_GLASS_SCHEMA_INCOMPLETE';
  END IF;

  -- Commercial composition is descriptive identity, not a BOM or stock rule.
  INSERT INTO public.item_template_attributes(
    item_template_id, attribute_code, label, data_type, is_required, sort_order, is_active
  ) VALUES (
    v_glass_id, 'COMPOSITION', 'Composição comercial', 'SELECT', false, 35, true
  )
  ON CONFLICT (item_template_id, attribute_code) DO NOTHING;

  SELECT id INTO v_composition_attribute
  FROM public.item_template_attributes
  WHERE item_template_id = v_glass_id AND attribute_code = 'COMPOSITION';

  INSERT INTO public.item_template_attribute_options(
    attribute_id, option_code, label, canonical_value, sort_order, is_active
  ) VALUES
    (v_composition_attribute, '4_PLUS_4', '4+4', to_jsonb('4+4'::text), 10, true),
    (v_composition_attribute, '6_PLUS_6', '6+6', to_jsonb('6+6'::text), 20, true)
  ON CONFLICT (attribute_id, option_code) DO NOTHING;

  -- Mirror and ACM receive only structural thickness options. No commercial
  -- definition is inferred without an explicitly approved full combination.
  SELECT id INTO v_thickness_attribute FROM public.item_template_attributes
  WHERE item_template_id = v_mirror_id AND attribute_code = 'THICKNESS_MM' AND is_active;
  IF v_thickness_attribute IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PHASE4A3_MIRROR_THICKNESS_ATTRIBUTE_MISSING';
  END IF;
  INSERT INTO public.item_template_attribute_options(
    attribute_id, option_code, label, canonical_value, sort_order, is_active
  ) VALUES
    (v_thickness_attribute, 'MM_2', '2mm', to_jsonb(2), 1, true),
    (v_thickness_attribute, 'MM_3', '3mm', to_jsonb(3), 2, true)
  ON CONFLICT (attribute_id, option_code) DO NOTHING;

  SELECT id INTO v_thickness_attribute FROM public.item_template_attributes
  WHERE item_template_id = v_acm_id AND attribute_code = 'THICKNESS_MM' AND is_active;
  IF v_thickness_attribute IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PHASE4A3_ACM_THICKNESS_ATTRIBUTE_MISSING';
  END IF;
  INSERT INTO public.item_template_attribute_options(
    attribute_id, option_code, label, canonical_value, sort_order, is_active
  ) VALUES
    (v_thickness_attribute, 'MM_3', '3mm', to_jsonb(3), 1, true),
    (v_thickness_attribute, 'MM_4', '4mm', to_jsonb(4), 2, true)
  ON CONFLICT (attribute_id, option_code) DO NOTHING;

  -- The four legacy 4 mm definitions have no tenant link in the audited state.
  -- Abort instead of silently changing availability if that precondition drifts.
  IF EXISTS (
    SELECT 1
    FROM public.item_template_variant_definitions d
    JOIN public.company_item_variants civ ON civ.variant_definition_id = d.id
    WHERE d.item_template_id = v_glass_id
      AND EXISTS (
        SELECT 1
        FROM public.item_template_variant_definition_options link
        JOIN public.item_template_attributes a ON a.id = link.attribute_id
        JOIN public.item_template_attribute_options o ON o.id = link.option_id
        WHERE link.definition_id = d.id AND a.attribute_code = 'THICKNESS_MM'
          AND o.canonical_value = to_jsonb(4)
      )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PHASE4A3_4MM_TENANT_REFERENCE_FOUND';
  END IF;

  UPDATE public.item_template_variant_definitions d
  SET is_active = false, updated_at = now()
  WHERE d.item_template_id = v_glass_id
    AND d.is_active
    AND EXISTS (
      SELECT 1
      FROM public.item_template_variant_definition_options link
      JOIN public.item_template_attributes a ON a.id = link.attribute_id
      JOIN public.item_template_attribute_options o ON o.id = link.option_id
      WHERE link.definition_id = d.id AND a.attribute_code = 'TYPE'
        AND o.option_code IN ('COMUM', 'TEMPERADO')
    )
    AND EXISTS (
      SELECT 1
      FROM public.item_template_variant_definition_options link
      JOIN public.item_template_attributes a ON a.id = link.attribute_id
      JOIN public.item_template_attribute_options o ON o.id = link.option_id
      WHERE link.definition_id = d.id AND a.attribute_code = 'THICKNESS_MM'
        AND o.canonical_value = to_jsonb(4)
    );

  -- Add only missing members of the approved lean matrix.
  FOR v_spec IN
    SELECT * FROM (VALUES
      ('TEMPERADO','VERDE',6,NULL::text,526),
      ('TEMPERADO','VERDE',10,NULL::text,530),
      ('TEMPERADO','FUME',6,NULL::text,626),
      ('TEMPERADO','FUME',8,NULL::text,628),
      ('TEMPERADO','FUME',10,NULL::text,630),
      ('LAMINADO','INCOLOR',8,'4_PLUS_4',718),
      ('LAMINADO','INCOLOR',12,'6_PLUS_6',722)
    ) AS s(type_code, color_code, thickness_mm, composition_code, sort_order)
  LOOP
    SELECT array_agg(o.id ORDER BY a.sort_order, a.id)
    INTO v_option_ids
    FROM public.item_template_attributes a
    JOIN public.item_template_attribute_options o ON o.attribute_id = a.id
    WHERE a.item_template_id = v_glass_id AND o.is_active AND (
      (a.attribute_code = 'TYPE' AND o.option_code = v_spec.type_code) OR
      (a.attribute_code = 'COLOR' AND o.option_code = v_spec.color_code) OR
      (a.attribute_code = 'THICKNESS_MM' AND o.canonical_value = to_jsonb(v_spec.thickness_mm)) OR
      (a.attribute_code = 'FINISH' AND o.option_code = 'PADRAO') OR
      (a.attribute_code = 'COMPOSITION' AND o.option_code = v_spec.composition_code)
    );

    IF cardinality(v_option_ids) <> (CASE WHEN v_spec.composition_code IS NULL THEN 4 ELSE 5 END) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PHASE4A3_APPROVED_OPTION_MISSING',
        DETAIL = row_to_json(v_spec)::text;
    END IF;

    v_signature := public.phase4a_material_attribute_signature(v_glass_id, v_option_ids, true);
    INSERT INTO public.item_template_variant_definitions(
      item_template_id, attribute_signature, is_active, sort_order
    ) VALUES (v_glass_id, v_signature, true, v_spec.sort_order)
    ON CONFLICT (item_template_id, attribute_signature) DO UPDATE
      SET is_active = true, sort_order = EXCLUDED.sort_order, updated_at = now()
    RETURNING id INTO v_definition_id;

    INSERT INTO public.item_template_variant_definition_options(
      definition_id, item_template_id, attribute_id, option_id
    )
    SELECT v_definition_id, v_glass_id, o.attribute_id, o.id
    FROM public.item_template_attribute_options o
    WHERE o.id = ANY(v_option_ids)
    ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT md5(COALESCE(jsonb_agg(to_jsonb(civ) ORDER BY civ.id)::text, '[]'))
  INTO v_company_variants_after
  FROM public.company_item_variants civ;

  IF v_company_variants_before IS DISTINCT FROM v_company_variants_after
     OR (SELECT count(*) FROM public.company_item_variants) <> v_company_variant_count THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PHASE4A3_TENANT_PRICE_MUTATION_DETECTED';
  END IF;

  IF (
    SELECT count(*) FROM public.item_template_variant_definitions
    WHERE item_template_id = v_glass_id AND is_active
  ) <> 20 THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'PHASE4A3_EXPECTED_20_ACTIVE_GLASS_DEFINITIONS';
  END IF;
END;
$$;

COMMENT ON COLUMN public.item_template_attributes.attribute_code IS
  'Stable schema-driven attribute code. COMPOSITION is commercial metadata only and does not imply BOM or stock consumption.';
