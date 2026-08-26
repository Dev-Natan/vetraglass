-- Phase 4A: seed only the explicitly authorized global material combinations.
-- Tenant activation and pricing remain lazy and are intentionally untouched.

DO $$
DECLARE
  v_family_id uuid;
  v_type_attribute_id uuid;
  v_color_attribute_id uuid;
  v_thickness_attribute_id uuid;
  v_finish_attribute_id uuid;
  v_standard_finish_id uuid;
  v_tempered_id uuid;
  v_green_id uuid;
  v_mm8_id uuid;
  v_legacy_signature text;
  v_canonical_signature text;
  v_legacy_definition_id uuid;
  v_canonical_definition_id uuid;
  v_definition_id uuid;
  v_option_ids uuid[];
  v_signature text;
  v_spec record;
  v_company_variants_before text;
  v_company_variants_after text;
BEGIN
  SELECT md5(COALESCE(jsonb_agg(to_jsonb(civ) ORDER BY civ.id)::text, '[]'))
  INTO v_company_variants_before
  FROM public.company_item_variants civ;

  SELECT id INTO v_family_id
  FROM public.item_templates
  WHERE company_id IS NULL
    AND is_commercial_area_material
    AND upper(commercial_material_family) = 'GLASS';

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'GLASS_MATERIAL_FAMILY_NOT_FOUND';
  END IF;

  SELECT id INTO v_type_attribute_id
  FROM public.item_template_attributes
  WHERE item_template_id = v_family_id AND attribute_code = 'TYPE' AND is_active;
  SELECT id INTO v_color_attribute_id
  FROM public.item_template_attributes
  WHERE item_template_id = v_family_id AND attribute_code = 'COLOR' AND is_active;
  SELECT id INTO v_thickness_attribute_id
  FROM public.item_template_attributes
  WHERE item_template_id = v_family_id AND attribute_code = 'THICKNESS_MM' AND is_active;
  SELECT id INTO v_finish_attribute_id
  FROM public.item_template_attributes
  WHERE item_template_id = v_family_id AND attribute_code = 'FINISH' AND is_active;

  IF v_type_attribute_id IS NULL OR v_color_attribute_id IS NULL
     OR v_thickness_attribute_id IS NULL OR v_finish_attribute_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'GLASS_MATERIAL_ATTRIBUTES_INCOMPLETE';
  END IF;

  -- JATEADO remains preserved as a legacy color, but new canonical combinations
  -- may use it only through the FINISH attribute after explicit Admin creation.
  INSERT INTO public.item_template_attribute_options(
    attribute_id, option_code, label, canonical_value, sort_order, is_active
  ) VALUES (
    v_finish_attribute_id, 'JATEADO', 'Jateado', to_jsonb('JATEADO'::text), 10, true
  )
  ON CONFLICT (attribute_id, option_code) DO NOTHING;

  SELECT id INTO v_standard_finish_id
  FROM public.item_template_attribute_options
  WHERE attribute_id = v_finish_attribute_id AND option_code = 'PADRAO' AND is_active;
  SELECT id INTO v_tempered_id
  FROM public.item_template_attribute_options
  WHERE attribute_id = v_type_attribute_id AND option_code = 'TEMPERADO' AND is_active;
  SELECT id INTO v_green_id
  FROM public.item_template_attribute_options
  WHERE attribute_id = v_color_attribute_id AND option_code = 'VERDE' AND is_active;
  SELECT id INTO v_mm8_id
  FROM public.item_template_attribute_options
  WHERE attribute_id = v_thickness_attribute_id AND option_code = 'MM_8' AND is_active;

  IF v_standard_finish_id IS NULL OR v_tempered_id IS NULL
     OR v_green_id IS NULL OR v_mm8_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AUTHORIZED_GLASS_OPTIONS_INCOMPLETE';
  END IF;

  -- Normalize the already-existing TEMPERADO / VERDE / 8 definition in place.
  -- It currently has no tenant variant, so completing PADRAO cannot alter a price.
  v_legacy_signature := public.phase4a_material_attribute_signature(
    v_family_id, ARRAY[v_tempered_id, v_green_id, v_mm8_id], true
  );
  v_canonical_signature := public.phase4a_material_attribute_signature(
    v_family_id, ARRAY[v_tempered_id, v_green_id, v_mm8_id, v_standard_finish_id], true
  );

  SELECT id INTO v_legacy_definition_id
  FROM public.item_template_variant_definitions
  WHERE item_template_id = v_family_id AND attribute_signature = v_legacy_signature;
  SELECT id INTO v_canonical_definition_id
  FROM public.item_template_variant_definitions
  WHERE item_template_id = v_family_id AND attribute_signature = v_canonical_signature;

  IF v_legacy_definition_id IS NOT NULL AND v_canonical_definition_id IS NOT NULL
     AND v_legacy_definition_id <> v_canonical_definition_id THEN
    RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'DUPLICATE_TEMPERED_GREEN_8_DEFINITION';
  END IF;

  IF v_legacy_definition_id IS NOT NULL AND v_canonical_definition_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.company_item_variants
      WHERE variant_definition_id = v_legacy_definition_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'TEMPERED_GREEN_8_HAS_TENANT_HISTORY';
    END IF;

    INSERT INTO public.item_template_variant_definition_options(
      definition_id, item_template_id, attribute_id, option_id
    ) VALUES (
      v_legacy_definition_id, v_family_id, v_finish_attribute_id, v_standard_finish_id
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.item_template_variant_definitions
    SET attribute_signature = v_canonical_signature, updated_at = now()
    WHERE id = v_legacy_definition_id;
  END IF;

  FOR v_spec IN
    SELECT * FROM (VALUES
      ('COMUM',      'INCOLOR', 4,  110),
      ('COMUM',      'INCOLOR', 6,  120),
      ('COMUM',      'INCOLOR', 8,  130),
      ('COMUM',      'INCOLOR', 10, 140),
      ('COMUM',      'VERDE',   4,  210),
      ('COMUM',      'VERDE',   6,  220),
      ('COMUM',      'VERDE',   8,  230),
      ('COMUM',      'VERDE',   10, 240),
      ('COMUM',      'FUME',    4,  310),
      ('COMUM',      'FUME',    6,  320),
      ('COMUM',      'FUME',    8,  330),
      ('COMUM',      'FUME',    10, 340),
      ('TEMPERADO',  'INCOLOR', 4,  410),
      ('TEMPERADO',  'INCOLOR', 6,  420),
      ('TEMPERADO',  'INCOLOR', 8,  430),
      ('TEMPERADO',  'INCOLOR', 10, 440),
      ('TEMPERADO',  'VERDE',   8,  510)
    ) AS authorized(type_code, color_code, thickness_mm, sort_order)
  LOOP
    SELECT ARRAY[
      (SELECT id FROM public.item_template_attribute_options
       WHERE attribute_id = v_type_attribute_id AND option_code = v_spec.type_code AND is_active),
      (SELECT id FROM public.item_template_attribute_options
       WHERE attribute_id = v_color_attribute_id AND option_code = v_spec.color_code AND is_active),
      (SELECT id FROM public.item_template_attribute_options
       WHERE attribute_id = v_thickness_attribute_id
         AND option_code = 'MM_' || v_spec.thickness_mm::text AND is_active),
      v_standard_finish_id
    ]::uuid[] INTO v_option_ids;

    IF array_position(v_option_ids, NULL) IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AUTHORIZED_GLASS_OPTION_NOT_FOUND',
        DETAIL = format('%s/%s/%s', v_spec.type_code, v_spec.color_code, v_spec.thickness_mm);
    END IF;

    v_signature := public.phase4a_material_attribute_signature(v_family_id, v_option_ids, true);

    INSERT INTO public.item_template_variant_definitions(
      item_template_id, attribute_signature, is_active, sort_order
    ) VALUES (
      v_family_id, v_signature, true, v_spec.sort_order
    )
    ON CONFLICT (item_template_id, attribute_signature) DO NOTHING;

    SELECT id INTO v_definition_id
    FROM public.item_template_variant_definitions
    WHERE item_template_id = v_family_id AND attribute_signature = v_signature;

    INSERT INTO public.item_template_variant_definition_options(
      definition_id, item_template_id, attribute_id, option_id
    )
    SELECT v_definition_id, v_family_id, option_row.attribute_id, option_row.id
    FROM public.item_template_attribute_options option_row
    WHERE option_row.id = ANY(v_option_ids)
    ON CONFLICT DO NOTHING;
  END LOOP;

  SELECT md5(COALESCE(jsonb_agg(to_jsonb(civ) ORDER BY civ.id)::text, '[]'))
  INTO v_company_variants_after
  FROM public.company_item_variants civ;

  IF v_company_variants_after IS DISTINCT FROM v_company_variants_before THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'SEED_CHANGED_TENANT_VARIANTS';
  END IF;
END;
$$;
