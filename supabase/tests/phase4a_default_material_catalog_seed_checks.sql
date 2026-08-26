-- Run inside a transaction. The caller must ROLLBACK every fixture.

CREATE TEMP TABLE phase4a_seed_ctx(
  user_existing uuid,
  user_new uuid,
  company_existing uuid,
  company_new uuid,
  family_glass uuid,
  definition_lazy uuid
) ON COMMIT DROP;

INSERT INTO phase4a_seed_ctx(user_existing, company_existing, family_glass)
SELECT uc.user_id, civ.company_id, it.id
FROM public.company_item_variants civ
JOIN public.company_items ci ON ci.id = civ.company_item_id
JOIN public.item_templates it ON it.id = ci.item_template_id
JOIN public.user_companies uc ON uc.company_id = civ.company_id
  AND uc.is_active AND uc.role = 'admin'
WHERE it.commercial_material_family = 'GLASS'
  AND civ.sale_price = 336
  AND civ.variant_definition_id IS NOT NULL
ORDER BY uc.created_at
LIMIT 1;

UPDATE phase4a_seed_ctx
SET user_new = (
  SELECT id FROM auth.users
  WHERE id <> phase4a_seed_ctx.user_existing
    AND NOT EXISTS (
      SELECT 1 FROM public.user_companies uc
      WHERE uc.user_id = auth.users.id
        AND uc.company_id = phase4a_seed_ctx.company_existing
        AND uc.is_active
    )
  ORDER BY created_at LIMIT 1
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM phase4a_seed_ctx
    WHERE user_existing IS NOT NULL AND user_new IS NOT NULL
      AND company_existing IS NOT NULL AND family_glass IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'T00_CONTEXT_MISSING';
  END IF;
END;
$$;

DO $$
DECLARE
  c phase4a_seed_ctx;
  v_count integer;
  v_current_price record;
BEGIN
  SELECT * INTO c FROM phase4a_seed_ctx;

  -- T01-T07/T17: exact authorized catalog, no duplicate signature, every
  -- combination has PADRAO and no unauthorized type/color pair was created.
  SELECT count(*) INTO v_count
  FROM public.item_template_variant_definitions
  WHERE item_template_id = c.family_glass AND is_active;
  IF v_count <> 17 THEN RAISE EXCEPTION 'T01_EXPECTED_17_COMBINATIONS: %', v_count; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.item_template_attributes a
    JOIN public.item_template_attribute_options o ON o.attribute_id = a.id
    WHERE a.item_template_id = c.family_glass AND a.attribute_code = 'TYPE'
      AND o.option_code = 'LAMINADO' AND o.is_active
  ) THEN RAISE EXCEPTION 'T04_LAMINATED_STRUCTURAL_OPTION_MISSING'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.item_template_attributes a
    JOIN public.item_template_attribute_options o ON o.attribute_id = a.id
    WHERE a.item_template_id = c.family_glass AND a.attribute_code = 'FINISH'
      AND o.option_code = 'JATEADO' AND o.is_active
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.item_template_attributes a
    JOIN public.item_template_attribute_options o ON o.attribute_id = a.id
    WHERE a.item_template_id = c.family_glass AND a.attribute_code = 'COLOR'
      AND o.option_code = 'JATEADO'
  ) THEN RAISE EXCEPTION 'T07_JATEADO_COMPATIBILITY'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.item_template_variant_definitions d
    JOIN public.item_templates it ON it.id = d.item_template_id
    WHERE upper(it.commercial_material_family) IN ('MIRROR', 'ACM')
  ) THEN RAISE EXCEPTION 'T04_MIRROR_ACM_COMBINATION_CREATED'; END IF;

  IF EXISTS (
    SELECT attribute_signature FROM public.item_template_variant_definitions
    WHERE item_template_id = c.family_glass
    GROUP BY attribute_signature HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'T17_DUPLICATE_SIGNATURE'; END IF;

  WITH definitions AS (
    SELECT d.id,
      jsonb_object_agg(lower(a.attribute_code), COALESCE(o.canonical_value, to_jsonb(o.option_code))) attrs
    FROM public.item_template_variant_definitions d
    JOIN public.item_template_variant_definition_options link ON link.definition_id = d.id
    JOIN public.item_template_attributes a ON a.id = link.attribute_id
    JOIN public.item_template_attribute_options o ON o.id = link.option_id
    WHERE d.item_template_id = c.family_glass AND d.is_active
    GROUP BY d.id
  )
  SELECT count(*) INTO v_count FROM definitions
  WHERE attrs->>'type' = 'COMUM';
  IF v_count <> 12 THEN RAISE EXCEPTION 'T02_COMMON_COUNT: %', v_count; END IF;

  WITH definitions AS (
    SELECT d.id,
      jsonb_object_agg(lower(a.attribute_code), COALESCE(o.canonical_value, to_jsonb(o.option_code))) attrs
    FROM public.item_template_variant_definitions d
    JOIN public.item_template_variant_definition_options link ON link.definition_id = d.id
    JOIN public.item_template_attributes a ON a.id = link.attribute_id
    JOIN public.item_template_attribute_options o ON o.id = link.option_id
    WHERE d.item_template_id = c.family_glass AND d.is_active
    GROUP BY d.id
  )
  SELECT count(*) INTO v_count FROM definitions
  WHERE attrs->>'type' = 'TEMPERADO';
  IF v_count <> 5 THEN RAISE EXCEPTION 'T03_TEMPERED_COUNT: %', v_count; END IF;

  WITH definitions AS (
    SELECT d.id,
      jsonb_object_agg(lower(a.attribute_code), COALESCE(o.canonical_value, to_jsonb(o.option_code))) attrs
    FROM public.item_template_variant_definitions d
    JOIN public.item_template_variant_definition_options link ON link.definition_id = d.id
    JOIN public.item_template_attributes a ON a.id = link.attribute_id
    JOIN public.item_template_attribute_options o ON o.id = link.option_id
    WHERE d.item_template_id = c.family_glass AND d.is_active
    GROUP BY d.id
  )
  SELECT count(*) INTO v_count FROM definitions
  WHERE attrs->>'type' = 'TEMPERADO' AND attrs->>'color' = 'VERDE'
    AND (attrs->>'thickness_mm')::numeric = 8 AND attrs->>'finish' = 'PADRAO';
  IF v_count <> 1 THEN RAISE EXCEPTION 'T08_GREEN_8_NOT_NORMALIZED: %', v_count; END IF;

  WITH definitions AS (
    SELECT d.id,
      jsonb_object_agg(lower(a.attribute_code), COALESCE(o.canonical_value, to_jsonb(o.option_code))) attrs
    FROM public.item_template_variant_definitions d
    JOIN public.item_template_variant_definition_options link ON link.definition_id = d.id
    JOIN public.item_template_attributes a ON a.id = link.attribute_id
    JOIN public.item_template_attribute_options o ON o.id = link.option_id
    WHERE d.item_template_id = c.family_glass AND d.is_active
    GROUP BY d.id
  )
  SELECT count(*) INTO v_count FROM definitions
  WHERE attrs->>'finish' <> 'PADRAO'
     OR attrs->>'type' NOT IN ('COMUM', 'TEMPERADO')
     OR attrs->>'color' NOT IN ('INCOLOR', 'VERDE', 'FUME')
     OR (attrs->>'type' = 'TEMPERADO' AND attrs->>'color' = 'VERDE'
         AND (attrs->>'thickness_mm')::numeric <> 8)
     OR (attrs->>'type' = 'TEMPERADO' AND attrs->>'color' = 'FUME');
  IF v_count <> 0 THEN RAISE EXCEPTION 'T04_T07_UNAUTHORIZED_COMBINATION: %', v_count; END IF;

  SELECT civ.cost, civ.sale_price, civ.is_active INTO v_current_price
  FROM public.company_item_variants civ
  JOIN public.item_template_variant_definitions d ON d.id = civ.variant_definition_id
  JOIN public.item_template_variant_definition_options lt ON lt.definition_id = d.id
  JOIN public.item_template_attributes at ON at.id = lt.attribute_id AND at.attribute_code = 'TYPE'
  JOIN public.item_template_attribute_options ot ON ot.id = lt.option_id AND ot.option_code = 'TEMPERADO'
  JOIN public.item_template_variant_definition_options lc ON lc.definition_id = d.id
  JOIN public.item_template_attributes ac ON ac.id = lc.attribute_id AND ac.attribute_code = 'COLOR'
  JOIN public.item_template_attribute_options oc ON oc.id = lc.option_id AND oc.option_code = 'INCOLOR'
  JOIN public.item_template_variant_definition_options lh ON lh.definition_id = d.id
  JOIN public.item_template_attributes ah ON ah.id = lh.attribute_id AND ah.attribute_code = 'THICKNESS_MM'
  JOIN public.item_template_attribute_options oh ON oh.id = lh.option_id AND oh.option_code = 'MM_8'
  JOIN public.item_template_variant_definition_options lf ON lf.definition_id = d.id
  JOIN public.item_template_attributes af ON af.id = lf.attribute_id AND af.attribute_code = 'FINISH'
  JOIN public.item_template_attribute_options ofn ON ofn.id = lf.option_id AND ofn.option_code = 'PADRAO'
  WHERE civ.company_id = c.company_existing;
  IF v_current_price.cost <> 210 OR v_current_price.sale_price <> 336 OR NOT v_current_price.is_active
  THEN RAISE EXCEPTION 'T09_EXISTING_PRICE_NOT_PRESERVED'; END IF;

  SELECT count(*) INTO v_count FROM public.company_item_variants
  WHERE variant_definition_id IN (
    SELECT id FROM public.item_template_variant_definitions WHERE item_template_id = c.family_glass
  ) AND (cost IS NOT NULL OR sale_price IS NOT NULL);
  IF v_count <> 1 THEN RAISE EXCEPTION 'T10_NEW_PRICE_CREATED: %', v_count; END IF;
END;
$$;

SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', (SELECT user_existing FROM phase4a_seed_ctx), 'role', 'authenticated'
)::text, true);

DO $$
DECLARE
  c phase4a_seed_ctx;
  v_count integer;
BEGIN
  SELECT * INTO c FROM phase4a_seed_ctx;
  SELECT count(*) INTO v_count
  FROM public.list_company_material_family_combinations(c.company_existing, c.family_glass);
  IF v_count <> 17 THEN RAISE EXCEPTION 'T11_EXISTING_COMPANY_CATALOG: %', v_count; END IF;
END;
$$;

INSERT INTO public.companies(name)
VALUES ('PHASE4A SEED NEW COMPANY ' || gen_random_uuid());
UPDATE phase4a_seed_ctx
SET company_new = (
  SELECT id FROM public.companies
  WHERE name LIKE 'PHASE4A SEED NEW COMPANY %'
  ORDER BY created_at DESC LIMIT 1
);
INSERT INTO public.user_companies(user_id, company_id, role, is_active)
SELECT user_new, company_new, 'admin', true FROM phase4a_seed_ctx;

SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', (SELECT user_new FROM phase4a_seed_ctx), 'role', 'authenticated'
)::text, true);

DO $$
DECLARE
  c phase4a_seed_ctx;
  v_count integer;
  v_state jsonb;
BEGIN
  SELECT * INTO c FROM phase4a_seed_ctx;
  SELECT count(*) INTO v_count
  FROM public.list_company_material_family_combinations(c.company_new, c.family_glass);
  IF v_count <> 17 THEN RAISE EXCEPTION 'T12_NEW_COMPANY_CATALOG: %', v_count; END IF;
  IF EXISTS (
    SELECT 1 FROM public.list_company_material_family_combinations(c.company_new, c.family_glass)
    WHERE status <> 'INACTIVE'
  ) THEN RAISE EXCEPTION 'T13_NEW_COMPANY_INHERITED_ACTIVATION'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.company_item_variants WHERE company_id = c.company_new
  ) THEN RAISE EXCEPTION 'T13_NEW_COMPANY_INHERITED_PRICE'; END IF;

  SELECT d.id INTO c.definition_lazy
  FROM public.item_template_variant_definitions d
  JOIN public.item_template_variant_definition_options link ON link.definition_id = d.id
  JOIN public.item_template_attribute_options o ON o.id = link.option_id AND o.option_code = 'COMUM'
  WHERE d.item_template_id = c.family_glass LIMIT 1;
  UPDATE phase4a_seed_ctx SET definition_lazy = c.definition_lazy;
  v_state := public.set_company_material_combination_active(c.company_new, c.definition_lazy, true);
  IF v_state->>'status' <> 'ACTIVE_UNPRICED' THEN RAISE EXCEPTION 'T14_NOT_LAZY_UNPRICED'; END IF;
  IF (SELECT count(*) FROM public.company_item_variants
      WHERE company_id = c.company_new AND variant_definition_id = c.definition_lazy) <> 1
  THEN RAISE EXCEPTION 'T14_LAZY_DUPLICATE'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.company_item_variants
    WHERE company_id = c.company_existing AND variant_definition_id = c.definition_lazy
  ) THEN RAISE EXCEPTION 'T15_CROSS_COMPANY_ACTIVATION'; END IF;

  BEGIN
    PERFORM 1 FROM public.list_company_material_family_combinations(c.company_existing, c.family_glass);
    RAISE EXCEPTION 'T19_CROSS_COMPANY_RPC_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

GRANT SELECT ON phase4a_seed_ctx TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c phase4a_seed_ctx;
BEGIN
  SELECT * INTO c FROM phase4a_seed_ctx;
  IF EXISTS (
    SELECT 1 FROM public.company_item_variants
    WHERE company_id = c.company_existing
  ) THEN RAISE EXCEPTION 'T19_CROSS_COMPANY_RLS_ALLOWED'; END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.item_template_variant_definitions', 'select')
     OR has_table_privilege('authenticated', 'public.item_template_variant_definitions', 'insert')
     OR has_table_privilege('authenticated', 'public.item_template_variant_definitions', 'truncate')
     OR has_function_privilege('anon', 'public.set_company_material_combination_active(uuid,uuid,boolean)', 'execute')
  THEN RAISE EXCEPTION 'T19_GRANTS_REGRESSION'; END IF;
END;
$$;
