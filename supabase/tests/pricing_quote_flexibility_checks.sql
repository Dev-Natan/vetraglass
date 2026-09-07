-- Pricing follow-up: canonical glass activation and tenant isolation.
-- Every mutation is scoped to this transaction and rolled back.
BEGIN;

CREATE TEMP TABLE pricing_flex_results(test text PRIMARY KEY, passed boolean NOT NULL);
CREATE OR REPLACE FUNCTION pg_temp.pricing_flex_ok(_condition boolean, _test text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO pricing_flex_results VALUES (_test, COALESCE(_condition, false));
  IF NOT COALESCE(_condition, false) THEN
    RAISE EXCEPTION 'PRICING_FLEX_TEST_FAILED: %', _test;
  END IF;
END;
$$;

CREATE TEMP TABLE pricing_flex_ctx(k text PRIMARY KEY, v uuid NOT NULL);
INSERT INTO pricing_flex_ctx
SELECT 'user_a', u.id FROM auth.users u ORDER BY u.created_at LIMIT 1;
INSERT INTO pricing_flex_ctx
SELECT 'user_b', u.id FROM auth.users u
WHERE u.id<>(SELECT v FROM pricing_flex_ctx WHERE k='user_a') ORDER BY u.created_at LIMIT 1;

WITH inserted AS (
  INSERT INTO public.companies(name)
  VALUES('PRICING FLEX TENANT A '||gen_random_uuid()) RETURNING id
)
INSERT INTO pricing_flex_ctx SELECT 'company_a',id FROM inserted;
INSERT INTO public.user_companies(user_id,company_id,role,is_active)
VALUES((SELECT v FROM pricing_flex_ctx WHERE k='user_a'),
  (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),'admin',true);

INSERT INTO pricing_flex_ctx
SELECT 'line', pl.id FROM public.product_linhas pl
WHERE pl.is_active ORDER BY pl.created_at,pl.id LIMIT 1;
INSERT INTO pricing_flex_ctx
SELECT 'profile_color_a', cc.id FROM public.company_colors cc
WHERE cc.company_id=(SELECT v FROM pricing_flex_ctx WHERE k='company_a') AND cc.is_active
ORDER BY cc.created_at LIMIT 1;

INSERT INTO pricing_flex_ctx
SELECT 'glass_incolor_10', definition_id FROM (
  SELECT d.id definition_id,
    max(CASE WHEN a.attribute_code='TYPE' THEN o.canonical_value#>>'{}' END) glass_type,
    max(CASE WHEN a.attribute_code='COLOR' THEN o.canonical_value#>>'{}' END) glass_color,
    max(CASE WHEN a.attribute_code='THICKNESS_MM' THEN (o.canonical_value#>>'{}')::numeric END) thickness_mm,
    max(CASE WHEN a.attribute_code='FINISH' THEN o.canonical_value#>>'{}' END) finish
  FROM public.item_template_variant_definitions d
  JOIN public.item_templates it ON it.id=d.item_template_id
  JOIN public.item_template_variant_definition_options link ON link.definition_id=d.id
  JOIN public.item_template_attributes a ON a.id=link.attribute_id
  JOIN public.item_template_attribute_options o ON o.id=link.option_id
  WHERE d.is_active AND it.company_id IS NULL AND it.commercial_material_family='GLASS'
  GROUP BY d.id
) catalog
WHERE glass_type='TEMPERADO' AND glass_color='INCOLOR' AND thickness_mm=10 AND finish='PADRAO';

INSERT INTO pricing_flex_ctx
SELECT 'glass_fume_10', definition_id FROM (
  SELECT d.id definition_id,
    max(CASE WHEN a.attribute_code='TYPE' THEN o.canonical_value#>>'{}' END) glass_type,
    max(CASE WHEN a.attribute_code='COLOR' THEN o.canonical_value#>>'{}' END) glass_color,
    max(CASE WHEN a.attribute_code='THICKNESS_MM' THEN (o.canonical_value#>>'{}')::numeric END) thickness_mm,
    max(CASE WHEN a.attribute_code='FINISH' THEN o.canonical_value#>>'{}' END) finish
  FROM public.item_template_variant_definitions d
  JOIN public.item_templates it ON it.id=d.item_template_id
  JOIN public.item_template_variant_definition_options link ON link.definition_id=d.id
  JOIN public.item_template_attributes a ON a.id=link.attribute_id
  JOIN public.item_template_attribute_options o ON o.id=link.option_id
  WHERE d.is_active AND it.company_id IS NULL AND it.commercial_material_family='GLASS'
  GROUP BY d.id
) catalog
WHERE glass_type='TEMPERADO' AND glass_color='FUME' AND thickness_mm=10 AND finish='PADRAO';

DO $$ BEGIN
  IF (SELECT count(*) FROM pricing_flex_ctx)<>7 THEN
    RAISE EXCEPTION 'PRICING_FLEX_CONTEXT_MISSING';
  END IF;
END $$;

INSERT INTO public.company_items(company_id,name,type,unit,cost,sale_price,is_active,pricing_basis,catalog_origin)
VALUES((SELECT v FROM pricing_flex_ctx WHERE k='company_a'),'PRICING FLEX COMPONENT','accessory','un',10,20,true,'UNIT','PRIVATE')
RETURNING id;
INSERT INTO pricing_flex_ctx SELECT 'component_a',id FROM public.company_items
WHERE company_id=(SELECT v FROM pricing_flex_ctx WHERE k='company_a') AND name='PRICING FLEX COMPONENT';
INSERT INTO public.company_products(company_id,commercial_name,is_active,is_custom,pricing_type,linha,product_line_id)
SELECT (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),'PRICING FLEX PRODUCT',true,true,'COMPOSITION',pl.slug,pl.id
FROM public.product_linhas pl WHERE pl.id=(SELECT v FROM pricing_flex_ctx WHERE k='line')
RETURNING id;
INSERT INTO pricing_flex_ctx SELECT 'product_test',id FROM public.company_products
WHERE company_id=(SELECT v FROM pricing_flex_ctx WHERE k='company_a') AND commercial_name='PRICING FLEX PRODUCT';
INSERT INTO public.company_product_items(company_product_id,company_item_id,company_id,quantity_formula,pieces_quantity)
VALUES((SELECT v FROM pricing_flex_ctx WHERE k='product_test'),(SELECT v FROM pricing_flex_ctx WHERE k='component_a'),
  (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),'1',1);

SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub',(SELECT v FROM pricing_flex_ctx WHERE k='user_a'),'role','authenticated'
)::text, true);

SELECT public.set_company_material_combination_active(
  (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_flex_ctx WHERE k='glass_incolor_10'), true);
SELECT public.set_company_material_combination_active(
  (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_flex_ctx WHERE k='glass_fume_10'), true);

SELECT pg_temp.pricing_flex_ok((SELECT count(*)=2
  FROM public.company_item_variants civ
  WHERE civ.company_id=(SELECT v FROM pricing_flex_ctx WHERE k='company_a')
    AND civ.variant_definition_id IN (
      (SELECT v FROM pricing_flex_ctx WHERE k='glass_incolor_10'),
      (SELECT v FROM pricing_flex_ctx WHERE k='glass_fume_10'))
    AND civ.is_active),'V01_V02');

SELECT pg_temp.pricing_flex_ok((SELECT count(*)=2
  FROM public.get_company_line_pricing_options(
    (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_flex_ctx WHERE k='line')) options,
    LATERAL jsonb_array_elements(options->'glass_variants') variant
  WHERE (variant->>'id')::uuid IN (
    (SELECT v FROM pricing_flex_ctx WHERE k='glass_incolor_10'),
    (SELECT v FROM pricing_flex_ctx WHERE k='glass_fume_10'))),'V03');

INSERT INTO pricing_flex_ctx
SELECT 'band_a', public.save_company_line_price_band(
  (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_flex_ctx WHERE k='line'), '10 mm transacional', 1500,
  ARRAY[(SELECT v FROM pricing_flex_ctx WHERE k='glass_incolor_10'),
        (SELECT v FROM pricing_flex_ctx WHERE k='glass_fume_10')],
  ARRAY[(SELECT v FROM pricing_flex_ctx WHERE k='profile_color_a')], ARRAY['PADRAO'], NULL);

SELECT public.save_company_product_pricing_method(
  (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_flex_ctx WHERE k='product_test'),
  'LINE_PRICE_PER_M2',(SELECT v FROM pricing_flex_ctx WHERE k='line'));

SELECT pg_temp.pricing_flex_ok((public.resolve_company_final_product_pricing(
  (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_flex_ctx WHERE k='product_test'),1000,1000,1,
  jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',10,
    'glass_finish','PADRAO','profile_company_color_id',(SELECT v FROM pricing_flex_ctx WHERE k='profile_color_a'),
    'profile_finish','PADRAO'))#>>'{totals,sale_price}')::numeric=20
  AND (public.resolve_company_final_product_pricing(
    (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_flex_ctx WHERE k='product_test'),1000,1000,1,'{}')::jsonb
      ->>'commercial_pricing_method')='COMPOSITION'
  AND EXISTS(SELECT 1 FROM public.company_product_price_lines
    WHERE id=(SELECT v FROM pricing_flex_ctx WHERE k='band_a') AND price=1500),'V04');

DO $$ BEGIN
  BEGIN
    PERFORM public.save_company_line_price_band(
      (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
      (SELECT v FROM pricing_flex_ctx WHERE k='line'),'Overlap transacional',1700,
      ARRAY[(SELECT v FROM pricing_flex_ctx WHERE k='glass_incolor_10')],
      ARRAY[(SELECT v FROM pricing_flex_ctx WHERE k='profile_color_a')],ARRAY['PADRAO'],NULL);
    RAISE EXCEPTION 'EXPECTED_OVERLAP';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM NOT LIKE '%PRICE_BAND_OVERLAP%' THEN RAISE; END IF;
  END;
END $$;
SELECT pg_temp.pricing_flex_ok(true,'V12');

INSERT INTO public.companies(name) VALUES ('PRICING FLEX TENANT B '||gen_random_uuid()) RETURNING id;
INSERT INTO pricing_flex_ctx SELECT 'company_b',id FROM public.companies
WHERE name LIKE 'PRICING FLEX TENANT B %' ORDER BY created_at DESC LIMIT 1;
INSERT INTO public.user_companies(user_id,company_id,role,is_active)
VALUES((SELECT v FROM pricing_flex_ctx WHERE k='user_b'),(SELECT v FROM pricing_flex_ctx WHERE k='company_b'),'admin',true);

SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub',(SELECT v FROM pricing_flex_ctx WHERE k='user_b'),'role','authenticated'
)::text, true);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_company_material_combination_active(
      (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
      (SELECT v FROM pricing_flex_ctx WHERE k='glass_incolor_10'),true);
    RAISE EXCEPTION 'EXPECTED_CROSS_COMPANY_DENIAL';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT pg_temp.pricing_flex_ok(true,'V08_V09');

SELECT public.set_company_material_combination_active(
  (SELECT v FROM pricing_flex_ctx WHERE k='company_b'),
  (SELECT v FROM pricing_flex_ctx WHERE k='glass_incolor_10'),true);
SELECT pg_temp.pricing_flex_ok((SELECT count(*)=2 FROM public.company_item_variants civ
  WHERE civ.variant_definition_id=(SELECT v FROM pricing_flex_ctx WHERE k='glass_incolor_10')
    AND civ.company_id IN ((SELECT v FROM pricing_flex_ctx WHERE k='company_a'),
      (SELECT v FROM pricing_flex_ctx WHERE k='company_b'))),'V10');

SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub',(SELECT v FROM pricing_flex_ctx WHERE k='user_a'),'role','authenticated'
)::text, true);
INSERT INTO pricing_flex_ctx
SELECT 'private_color_a', id FROM public.create_private_company_color(
  (SELECT v FROM pricing_flex_ctx WHERE k='company_a'),'Cor privada transacional','PRIVATE_PRICING_FLEX','#123456');
SELECT pg_temp.pricing_flex_ok((SELECT catalog_origin='PRIVATE'
  FROM public.company_colors WHERE id=(SELECT v FROM pricing_flex_ctx WHERE k='private_color_a')
    AND company_id=(SELECT v FROM pricing_flex_ctx WHERE k='company_a')),'V11');

SELECT pg_temp.pricing_flex_ok((SELECT count(*)=7 FROM pricing_flex_results),'SUITE');
SELECT * FROM pricing_flex_results ORDER BY test;
ROLLBACK;
