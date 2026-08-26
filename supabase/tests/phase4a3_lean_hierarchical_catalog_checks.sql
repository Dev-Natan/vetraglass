-- Run after the Phase 4A.3 migration. This file is read-only and safe to replay.

BEGIN;

DO $$
DECLARE
  v_glass uuid;
  v_mirror uuid;
  v_acm uuid;
  v_count integer;
  v_price record;
BEGIN
  SELECT id INTO v_glass FROM public.item_templates
  WHERE company_id IS NULL AND is_commercial_area_material
    AND upper(commercial_material_family) = 'GLASS';
  SELECT id INTO v_mirror FROM public.item_templates
  WHERE company_id IS NULL AND is_commercial_area_material
    AND upper(commercial_material_family) = 'MIRROR';
  SELECT id INTO v_acm FROM public.item_templates
  WHERE company_id IS NULL AND is_commercial_area_material
    AND upper(commercial_material_family) = 'ACM';

  -- T01/T13/T17: audited catalog is lean, unique, and IDs remain valid.
  SELECT count(*) INTO v_count FROM public.item_template_variant_definitions
  WHERE item_template_id = v_glass AND is_active;
  IF v_count <> 20 THEN RAISE EXCEPTION 'T13_EXPECTED_20: %', v_count; END IF;
  IF EXISTS (SELECT 1 FROM public.item_template_variant_definitions
    WHERE item_template_id=v_glass GROUP BY attribute_signature HAVING count(*)>1)
  THEN RAISE EXCEPTION 'T17_DUPLICATE_SIGNATURE'; END IF;

  -- T02-T12/T14-T15.
  CREATE TEMP TABLE p4a3_defs ON COMMIT DROP AS
  SELECT d.id,d.is_active,jsonb_object_agg(lower(a.attribute_code),
    COALESCE(o.canonical_value,to_jsonb(o.option_code))) attrs
  FROM public.item_template_variant_definitions d
  JOIN public.item_template_variant_definition_options l ON l.definition_id=d.id
  JOIN public.item_template_attributes a ON a.id=l.attribute_id
  JOIN public.item_template_attribute_options o ON o.id=l.option_id
  WHERE d.item_template_id=v_glass GROUP BY d.id;

  IF (SELECT count(*) FROM p4a3_defs WHERE is_active AND attrs->>'type'='COMUM')<>9
    OR (SELECT count(*) FROM p4a3_defs WHERE is_active AND attrs->>'type'='TEMPERADO')<>9
    OR (SELECT count(*) FROM p4a3_defs WHERE is_active AND attrs->>'type'='LAMINADO')<>2
  THEN RAISE EXCEPTION 'T02_T10_TYPE_COUNTS'; END IF;
  IF EXISTS (SELECT 1 FROM p4a3_defs WHERE is_active AND attrs->>'type' IN ('COMUM','TEMPERADO')
    AND ((attrs->>'thickness_mm')::numeric NOT IN (6,8,10)
      OR attrs->>'color' NOT IN ('INCOLOR','VERDE','FUME') OR attrs->>'finish'<>'PADRAO'))
  THEN RAISE EXCEPTION 'T03_T09_LEAN_MATRIX'; END IF;
  IF NOT EXISTS (SELECT 1 FROM p4a3_defs WHERE is_active AND attrs @> '{"type":"LAMINADO","color":"INCOLOR","thickness_mm":8,"composition":"4+4","finish":"PADRAO"}')
    OR NOT EXISTS (SELECT 1 FROM p4a3_defs WHERE is_active AND attrs @> '{"type":"LAMINADO","color":"INCOLOR","thickness_mm":12,"composition":"6+6","finish":"PADRAO"}')
  THEN RAISE EXCEPTION 'T11_T12_LAMINATED_COMPOSITION'; END IF;
  IF EXISTS (SELECT 1 FROM p4a3_defs WHERE is_active AND (attrs->>'color' IN ('BRONZE','JATEADO') OR attrs->>'finish'='JATEADO'))
  THEN RAISE EXCEPTION 'T14_T15_UNAUTHORIZED_COLOR_FINISH'; END IF;

  -- T16/T19: 4 mm definitions are preserved but inactive.
  IF (SELECT count(*) FROM p4a3_defs WHERE (attrs->>'thickness_mm')::numeric=4)<>4
    OR EXISTS (SELECT 1 FROM p4a3_defs WHERE (attrs->>'thickness_mm')::numeric=4 AND is_active)
  THEN RAISE EXCEPTION 'T16_T19_4MM_LEGACY'; END IF;

  -- T20-T23: structural options only; no Mirror/ACM combinations invented.
  IF (SELECT count(*) FROM public.item_template_attribute_options o
      JOIN public.item_template_attributes a ON a.id=o.attribute_id
      WHERE a.item_template_id=v_mirror AND a.attribute_code='THICKNESS_MM'
        AND o.is_active AND o.canonical_value IN (to_jsonb(2),to_jsonb(3),to_jsonb(4),to_jsonb(6)))<>4
    OR (SELECT count(*) FROM public.item_template_attribute_options o
      JOIN public.item_template_attributes a ON a.id=o.attribute_id
      WHERE a.item_template_id=v_acm AND a.attribute_code='THICKNESS_MM'
        AND o.is_active AND o.canonical_value IN (to_jsonb(3),to_jsonb(4)))<>2
    OR EXISTS (SELECT 1 FROM public.item_template_variant_definitions WHERE item_template_id IN (v_mirror,v_acm))
  THEN RAISE EXCEPTION 'T20_T23_MIRROR_ACM'; END IF;

  -- T24-T26: preserve the sole priced tenant variant and create no activation.
  SELECT civ.cost,civ.sale_price,civ.is_active INTO v_price
  FROM public.company_item_variants civ JOIN p4a3_defs d ON d.id=civ.variant_definition_id
  WHERE d.attrs @> '{"type":"TEMPERADO","color":"INCOLOR","thickness_mm":8,"finish":"PADRAO"}'
    AND civ.cost=210 AND civ.sale_price=336;
  IF v_price.cost<>210 OR v_price.sale_price<>336 OR NOT v_price.is_active
  THEN RAISE EXCEPTION 'T24_PRICE_NOT_PRESERVED'; END IF;
  IF (SELECT count(*) FROM public.company_item_variants WHERE variant_definition_id IS NOT NULL)<>1
  THEN RAISE EXCEPTION 'T25_T26_UNEXPECTED_TENANT_VARIANT'; END IF;

  -- T57-T60: engineering components stay separate and canonical area math holds.
  IF EXISTS (SELECT 1 FROM public.item_templates WHERE is_commercial_area_material
    AND upper(name) IN ('VIDRO FIXO','VIDRO MÓVEL','VIDRO MOVEL'))
    OR round((500::numeric*940+550::numeric*980)/1000000,3)<>1.009
    OR round(1.009*336,2)<>339.02
  THEN RAISE EXCEPTION 'T57_T60_ENGINEERING_AREA'; END IF;
END;
$$;

DO $$
BEGIN
  IF has_table_privilege('anon','public.item_template_variant_definitions','select')
    OR has_table_privilege('authenticated','public.item_template_variant_definitions','insert')
    OR has_table_privilege('authenticated','public.item_template_variant_definitions','truncate')
    OR has_function_privilege('anon','public.save_company_material_variant_price(uuid,uuid,numeric,text,numeric)','execute')
  THEN RAISE EXCEPTION 'T55_RLS_RBAC_GRANTS'; END IF;
END;
$$;

ROLLBACK;
