-- Pricing materials/final-products acceptance suite. All fixtures roll back.
BEGIN;

CREATE TEMP TABLE pricing_phase_results(test text PRIMARY KEY, passed boolean NOT NULL, detail text);
CREATE OR REPLACE FUNCTION pg_temp.ok(_condition boolean,_test text,_detail text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO pricing_phase_results VALUES(_test,COALESCE(_condition,false),_detail);
  IF NOT COALESCE(_condition,false) THEN
    RAISE EXCEPTION 'PRICING_PHASE_TEST_FAILED: % (%)',_test,COALESCE(_detail,'');
  END IF;
END; $$;

CREATE TEMP TABLE pricing_phase_ctx(k text PRIMARY KEY,v uuid NOT NULL);
GRANT SELECT ON pricing_phase_ctx TO authenticated;
GRANT SELECT,INSERT,UPDATE ON pricing_phase_results TO authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean,text,text) TO authenticated;

-- Read only global technical catalog rows. Every mutable row used by this suite
-- belongs to a fresh transaction-only tenant.
INSERT INTO pricing_phase_ctx
SELECT 'source_template',pt.id
FROM public.product_templates pt
WHERE pt.is_active AND pt.company_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.product_template_items pti
    WHERE pti.product_template_id=pt.id
      AND pti.company_id IS NULL
      AND pti.item_template_id IS NOT NULL
  )
ORDER BY pt.created_at
LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'line',pl.id
FROM public.product_templates pt
JOIN public.product_linhas pl
  ON lower(pl.slug)=lower(pt.linha) OR lower(pl.name)=lower(pt.linha)
WHERE pt.id=(SELECT v FROM pricing_phase_ctx WHERE k='source_template')
LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'user_a',uc.user_id FROM public.user_companies uc
WHERE uc.role='admin' AND uc.is_active
ORDER BY uc.created_at LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'user_b',u.id FROM auth.users u
WHERE u.id<>(SELECT v FROM pricing_phase_ctx WHERE k='user_a') ORDER BY u.created_at LIMIT 1;

DO $$ BEGIN
  IF (SELECT count(*) FROM pricing_phase_ctx
      WHERE k IN ('source_template','line','user_a','user_b'))<>4 THEN
    RAISE EXCEPTION 'PRICING_PHASE_CONTEXT_MISSING';
  END IF;
END $$;

WITH inserted AS (
  INSERT INTO public.companies(name)
  VALUES('PRICING PHASE TENANT A '||gen_random_uuid())
  RETURNING id
)
INSERT INTO pricing_phase_ctx SELECT 'company_a',id FROM inserted;
INSERT INTO public.user_companies(user_id,company_id,role,is_active)
VALUES((SELECT v FROM pricing_phase_ctx WHERE k='user_a'),
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),'admin',true);

-- Materialize global aluminum colors into the isolated tenant.
INSERT INTO public.company_colors(company_id,admin_color_id,name,code,hex_color,catalog_origin,is_active)
SELECT (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),c.id,
  c.name,c.slug,c.hex_color,'GLOBAL',true
FROM public.admin_aluminum_colors c
WHERE lower(c.slug) IN ('branco','preto','bronze','amadeirado','natural')
  AND c.is_active
  AND NOT EXISTS (
    SELECT 1 FROM public.company_colors existing
    WHERE existing.company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a')
      AND existing.admin_color_id=c.id
  );
INSERT INTO pricing_phase_ctx SELECT 'color_white',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='branco' LIMIT 1;
INSERT INTO pricing_phase_ctx SELECT 'color_black',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='preto' LIMIT 1;
INSERT INTO pricing_phase_ctx SELECT 'color_bronze',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='bronze' LIMIT 1;
INSERT INTO pricing_phase_ctx SELECT 'color_wood',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='amadeirado' LIMIT 1;
INSERT INTO pricing_phase_ctx SELECT 'color_natural',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='natural' LIMIT 1;

-- Materialize an isolated product from the global technical template.
WITH source AS (
  SELECT pt.* FROM public.product_templates pt
  WHERE pt.id=(SELECT v FROM pricing_phase_ctx WHERE k='source_template')
), inserted AS (
  INSERT INTO public.company_products(
    company_id,product_template_id,commercial_name,description,is_active,is_custom,
    category,linha,uses_glass,pricing_type,product_line_id,
    commercial_pricing_method
  )
  SELECT (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),id,
    'PRICING PHASE PRODUCT A '||gen_random_uuid(),description,true,false,
    category,linha,true,'COMPOSITION',
    (SELECT v FROM pricing_phase_ctx WHERE k='line'),'COMPOSITION'
  FROM source
  ON CONFLICT (company_id,product_template_id) DO UPDATE
  SET is_active=true,product_line_id=EXCLUDED.product_line_id
  RETURNING id
)
INSERT INTO pricing_phase_ctx SELECT 'product_a',id FROM inserted;

CREATE TEMP TABLE pricing_phase_item_map(
  source_id uuid PRIMARY KEY,
  target_id uuid NOT NULL UNIQUE
);
INSERT INTO pricing_phase_item_map(source_id,target_id)
SELECT DISTINCT it.id,
  COALESCE((
    SELECT target.id FROM public.company_items target
    WHERE target.company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a')
      AND target.item_template_id=it.id
    LIMIT 1
  ),gen_random_uuid())
FROM public.product_template_items pti
JOIN public.item_templates it ON it.id=pti.item_template_id
WHERE pti.product_template_id=(SELECT v FROM pricing_phase_ctx WHERE k='source_template')
  AND pti.company_id IS NULL;

UPDATE public.company_items target
SET name=source.name,description=source.description,type=source.type::text,unit=source.unit,
    cost=COALESCE(NULLIF(source.default_cost,0),10),
    sale_price=COALESCE(NULLIF(source.default_sale_price,0),NULLIF(source.default_price,0),20),
    specifications=source.specifications,linha=source.linha,is_custom=false,is_active=true,
    bar_length_mm=source.bar_length_mm,weight_per_meter=source.weight_per_meter,
    pricing_basis=COALESCE(source.pricing_basis,'UNIT'),
    variant_attribute_schema=source.variant_attribute_schema,
    is_commercial_area_material=source.is_commercial_area_material,
    commercial_material_family=source.commercial_material_family,
    catalog_origin='GLOBAL'
FROM pricing_phase_item_map map
JOIN public.item_templates source ON source.id=map.source_id
WHERE target.id=map.target_id;

INSERT INTO public.company_items(
  id,company_id,item_template_id,name,description,type,unit,cost,sale_price,
  specifications,linha,is_custom,is_active,glass_thickness,glass_color,
  glass_type_detail,bar_length_mm,weight_kg,weight_per_meter,pricing_basis,
  variant_attribute_schema,is_commercial_area_material,commercial_material_family,
  catalog_origin,code
)
SELECT map.target_id,(SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
  source.id,source.name,source.description,source.type::text,source.unit,
  COALESCE(NULLIF(source.default_cost,0),10),
  COALESCE(NULLIF(source.default_sale_price,0),NULLIF(source.default_price,0),20),
  source.specifications,source.linha,false,true,
  NULL,NULL,NULL,
  source.bar_length_mm,NULL,source.weight_per_meter,COALESCE(source.pricing_basis,'UNIT'),
  source.variant_attribute_schema,source.is_commercial_area_material,
  source.commercial_material_family,'GLOBAL',NULL
FROM pricing_phase_item_map map
JOIN public.item_templates source ON source.id=map.source_id
WHERE NOT EXISTS(SELECT 1 FROM public.company_items target WHERE target.id=map.target_id);

UPDATE public.company_items
SET cost=COALESCE(NULLIF(cost,0),10),
    sale_price=COALESCE(NULLIF(sale_price,0),20),
    is_active=true
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a')
  AND id IN (SELECT target_id FROM pricing_phase_item_map);

-- The isolated fixture must exercise the current area-material resolver even
-- when the legacy global engineering template still labels a glass component
-- as UNIT. This tenant-scoped normalization is rolled back with the suite.
UPDATE public.company_items
SET pricing_basis='AREA', pricing_unit='m²',
    commercial_material_family='GLASS'
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a')
  AND id IN (SELECT target_id FROM pricing_phase_item_map)
  AND lower(type)='glass';

DELETE FROM public.company_product_items
WHERE company_product_id=(SELECT v FROM pricing_phase_ctx WHERE k='product_a');
INSERT INTO public.company_product_items(
  company_product_id,item_template_id,quantity_formula,width_formula,height_formula,
  is_optional,notes,sort_order,company_item_id,cut_angle,pieces_quantity,loss_percent,
  section,side,calculation_type,applies_to,pieces_formula,cut_angle_start,cut_angle_end,
  company_id
)
SELECT (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),cpi.item_template_id,
  cpi.quantity_formula,cpi.width_formula,cpi.height_formula,cpi.is_optional,cpi.notes,
  row_number() over(order by cpi.created_at,cpi.id)::integer,map.target_id,
  cpi.cut_angle,cpi.pieces_quantity,cpi.loss_percent,
  cpi.section,cpi.side,cpi.calculation_type,cpi.applies_to,cpi.pieces_formula,
  cpi.cut_angle_start,cpi.cut_angle_end,(SELECT v FROM pricing_phase_ctx WHERE k='company_a')
FROM public.product_template_items cpi
JOIN pricing_phase_item_map map ON map.source_id=cpi.item_template_id
WHERE cpi.product_template_id=(SELECT v FROM pricing_phase_ctx WHERE k='source_template')
  AND cpi.company_id IS NULL;

CREATE TEMP TABLE pricing_phase_glass_catalog AS
SELECT d.id definition_id,
  max(CASE WHEN a.attribute_code='TYPE' THEN o.canonical_value#>>'{}' END) glass_type,
  max(CASE WHEN a.attribute_code='COLOR' THEN o.canonical_value#>>'{}' END) glass_color,
  max(CASE WHEN a.attribute_code='THICKNESS_MM'
    THEN (o.canonical_value#>>'{}')::numeric END) thickness_mm,
  max(CASE WHEN a.attribute_code='FINISH' THEN o.canonical_value#>>'{}' END) finish
FROM public.item_template_variant_definitions d
JOIN public.item_templates it ON it.id=d.item_template_id
JOIN public.item_template_variant_definition_options link ON link.definition_id=d.id
JOIN public.item_template_attributes a ON a.id=link.attribute_id
JOIN public.item_template_attribute_options o ON o.id=link.option_id
WHERE d.is_active AND it.company_id IS NULL AND it.commercial_material_family='GLASS'
GROUP BY d.id;
INSERT INTO pricing_phase_ctx SELECT 'glass_incolor_8',definition_id FROM pricing_phase_glass_catalog
WHERE glass_type='TEMPERADO' AND glass_color='INCOLOR' AND thickness_mm=8 AND finish='PADRAO' LIMIT 1;
INSERT INTO pricing_phase_ctx SELECT 'glass_green_6',definition_id FROM pricing_phase_glass_catalog
WHERE glass_type='TEMPERADO' AND glass_color='VERDE' AND thickness_mm=6 AND finish='PADRAO' LIMIT 1;
INSERT INTO pricing_phase_ctx SELECT 'glass_green_8',definition_id FROM pricing_phase_glass_catalog
WHERE glass_type='TEMPERADO' AND glass_color='VERDE' AND thickness_mm=8 AND finish='PADRAO' LIMIT 1;
INSERT INTO pricing_phase_ctx SELECT 'glass_fume_6',definition_id FROM pricing_phase_glass_catalog
WHERE glass_type='TEMPERADO' AND glass_color='FUME' AND thickness_mm=6 AND finish='PADRAO' LIMIT 1;
INSERT INTO pricing_phase_ctx SELECT 'glass_fume_8',definition_id FROM pricing_phase_glass_catalog
WHERE glass_type='TEMPERADO' AND glass_color='FUME' AND thickness_mm=8 AND finish='PADRAO' LIMIT 1;

SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',(SELECT v FROM pricing_phase_ctx WHERE k='user_a'),'role','authenticated'
)::text,true);
SELECT public.set_company_material_combination_active(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),v,true)
FROM pricing_phase_ctx WHERE k LIKE 'glass_%';
UPDATE public.company_item_variants
SET cost=CASE glass_color WHEN 'VERDE' THEN 220 WHEN 'FUME' THEN 230 ELSE 210 END,
    sale_price=CASE glass_color WHEN 'VERDE' THEN 375 WHEN 'FUME' THEN 400 ELSE 350 END,
    is_active=true,pricing_mode='MANUAL',pricing_source='MANUAL'
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a')
  AND variant_definition_id IN (SELECT v FROM pricing_phase_ctx WHERE k LIKE 'glass_%');

-- Tenant B has independent operational options and a private product.
WITH inserted AS (
  INSERT INTO public.companies(name)
  VALUES('PRICING PHASE TENANT B '||gen_random_uuid()) RETURNING id
)
INSERT INTO pricing_phase_ctx SELECT 'company_b',id FROM inserted;
INSERT INTO public.user_companies(user_id,company_id,role,is_active)
VALUES((SELECT v FROM pricing_phase_ctx WHERE k='user_b'),(SELECT v FROM pricing_phase_ctx WHERE k='company_b'),'admin',true);

INSERT INTO public.company_colors(company_id,admin_color_id,name,code,hex_color,catalog_origin,is_active)
SELECT (SELECT v FROM pricing_phase_ctx WHERE k='company_b'),a.admin_color_id,a.name,a.code,a.hex_color,'GLOBAL',true
FROM public.company_colors a
WHERE a.id=(SELECT v FROM pricing_phase_ctx WHERE k='color_white')
  AND NOT EXISTS (SELECT 1 FROM public.company_colors b
    WHERE b.company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b') AND b.admin_color_id=a.admin_color_id);
INSERT INTO pricing_phase_ctx
SELECT 'color_b_white',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b') AND lower(code)='branco' LIMIT 1;

SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',(SELECT v FROM pricing_phase_ctx WHERE k='user_b'),'role','authenticated'
)::text,true);
SELECT public.set_company_material_combination_active(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_b'),
  (SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8'),true);
INSERT INTO pricing_phase_ctx
SELECT 'glass_item_b',company_item_id FROM public.company_item_variants
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b')
  AND variant_definition_id=(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8') LIMIT 1;
UPDATE public.company_items SET cost=250,sale_price=400,is_active=true
WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='glass_item_b');
UPDATE public.company_item_variants
SET cost=250,sale_price=400,is_active=true,pricing_mode='MANUAL',pricing_source='MANUAL'
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b')
  AND variant_definition_id=(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8');

INSERT INTO public.company_items(company_id,name,type,unit,cost,sale_price,is_active,pricing_basis,catalog_origin)
VALUES((SELECT v FROM pricing_phase_ctx WHERE k='company_b'),'TEST ACCESSORY B','accessory','un',10,20,true,'UNIT','PRIVATE')
RETURNING id;
INSERT INTO pricing_phase_ctx SELECT 'item_b',id FROM public.company_items
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b') AND name='TEST ACCESSORY B';
INSERT INTO public.company_products(company_id,commercial_name,is_active,is_custom,pricing_type,linha,product_line_id)
VALUES((SELECT v FROM pricing_phase_ctx WHERE k='company_b'),'PRIVATE PRODUCT B',true,true,'COMPOSITION',
  (SELECT slug FROM public.product_linhas WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='line')),
  (SELECT v FROM pricing_phase_ctx WHERE k='line')) RETURNING id;
INSERT INTO pricing_phase_ctx SELECT 'product_b',id FROM public.company_products
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b') AND commercial_name='PRIVATE PRODUCT B';
INSERT INTO public.company_product_items(company_product_id,company_item_id,company_id,quantity_formula,pieces_quantity)
VALUES((SELECT v FROM pricing_phase_ctx WHERE k='product_b'),(SELECT v FROM pricing_phase_ctx WHERE k='item_b'),
  (SELECT v FROM pricing_phase_ctx WHERE k='company_b'),'1',1);

-- Tenant A price bands.
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM pricing_phase_ctx WHERE k='user_a'),'role','authenticated')::text,true);
INSERT INTO pricing_phase_ctx
SELECT 'band_a',public.save_company_line_price_band(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='line'),
  'Incolor e Verde padrão',1300,
  ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8'),(SELECT v FROM pricing_phase_ctx WHERE k='glass_green_8')],
  ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),(SELECT v FROM pricing_phase_ctx WHERE k='color_black')],
  ARRAY['PADRAO'],NULL
);

SELECT pg_temp.ok((SELECT count(*) FROM public.company_product_price_lines WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='band_a') AND price=1300)=1,'T01','Simple band created');
SELECT pg_temp.ok((SELECT count(DISTINCT company_color_id) FROM public.company_product_price_line_combinations WHERE price_line_id=(SELECT v FROM pricing_phase_ctx WHERE k='band_a'))=2,'T02','Multiple profile colors');
SELECT pg_temp.ok((SELECT count(DISTINCT glass_variant_definition_id) FROM public.company_product_price_line_combinations WHERE price_line_id=(SELECT v FROM pricing_phase_ctx WHERE k='band_a'))=2,'T03','Multiple glass colors');

INSERT INTO pricing_phase_ctx
SELECT 'band_shared',public.save_company_line_price_band(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='line'),
  'Verde e Fumê 6/8',1400,
  ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='glass_green_6'),(SELECT v FROM pricing_phase_ctx WHERE k='glass_fume_6'),(SELECT v FROM pricing_phase_ctx WHERE k='glass_fume_8')],
  ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='color_bronze')],ARRAY['PADRAO'],NULL
);
SELECT pg_temp.ok((SELECT count(DISTINCT civ.glass_thickness_mm) FROM public.company_product_price_line_combinations c
  JOIN public.company_item_variants civ ON civ.company_id=c.company_id AND civ.variant_definition_id=c.glass_variant_definition_id
  WHERE c.price_line_id=(SELECT v FROM pricing_phase_ctx WHERE k='band_shared'))=2,'T04','Multiple thicknesses');
SELECT pg_temp.ok((SELECT count(DISTINCT civ.glass_color) FROM public.company_product_price_line_combinations c
  JOIN public.company_item_variants civ ON civ.company_id=c.company_id AND civ.variant_definition_id=c.glass_variant_definition_id
  WHERE c.price_line_id=(SELECT v FROM pricing_phase_ctx WHERE k='band_shared'))=2,'T05','Green and smoked share one price');

INSERT INTO pricing_phase_ctx
SELECT 'band_wood',public.save_company_line_price_band(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='line'),
  'Amadeirado',1650,ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8')],
  ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='color_wood')],ARRAY['PADRAO'],NULL
);
SELECT pg_temp.ok((SELECT price FROM public.company_product_price_lines WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='band_wood'))=1650,'T06','Wood finish has a separate price');

DO $$ BEGIN
  BEGIN
    PERFORM public.save_company_line_price_band(
      (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='line'),
      'Overlap',1500,ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8')],
      ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='color_white')],ARRAY['PADRAO'],NULL);
    RAISE EXCEPTION 'EXPECTED_PRICE_BAND_OVERLAP';
  EXCEPTION WHEN unique_violation THEN
    IF sqlerrm NOT LIKE '%PRICE_BAND_OVERLAP%' THEN RAISE; END IF;
  END;
END $$;
SELECT pg_temp.ok((SELECT count(*) FROM public.company_product_price_lines WHERE description='Overlap')=0,'T07','Overlap rejected transactionally');

SELECT public.save_company_product_pricing_method((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),'LINE_PRICE_PER_M2',(SELECT v FROM pricing_phase_ctx WHERE k='line'));
DO $$ DECLARE r jsonb; BEGIN
  r:=public.resolve_company_final_product_pricing(
    (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,
    jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_natural'),'profile_finish','PADRAO'));
  PERFORM pg_temp.ok(r->>'commercial_pricing_method'='COMPOSITION'
    AND r->>'pricing_source'='COMPOSITION','T08','LINE_BAND config cannot replace composition authority');
END $$;

SELECT public.save_company_line_price_band(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='line'),
  'Incolor e Verde padrão',1350,
  ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8'),(SELECT v FROM pricing_phase_ctx WHERE k='glass_green_8')],
  ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),(SELECT v FROM pricing_phase_ctx WHERE k='color_black')],
  ARRAY['PADRAO'],(SELECT v FROM pricing_phase_ctx WHERE k='band_a'));
SELECT pg_temp.ok((SELECT price FROM public.company_product_price_lines WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='band_a'))=1350,'T09','Band edited');
SELECT public.deactivate_company_line_price_band((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='band_wood'));
SELECT pg_temp.ok((SELECT NOT is_active FROM public.company_product_price_lines WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='band_wood'))
  AND NOT EXISTS(SELECT 1 FROM public.company_product_price_line_combinations WHERE price_line_id=(SELECT v FROM pricing_phase_ctx WHERE k='band_wood')),'T10','Deactivation releases coverage');

-- Tenant B chooses its own value for the same global glass definition.
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM pricing_phase_ctx WHERE k='user_b'),'role','authenticated')::text,true);
INSERT INTO pricing_phase_ctx
SELECT 'band_b',public.save_company_line_price_band(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_b'),(SELECT v FROM pricing_phase_ctx WHERE k='line'),
  'Tenant B',1600,ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8')],
  ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='color_b_white')],ARRAY['PADRAO'],NULL
);
SELECT pg_temp.ok((SELECT price FROM public.company_product_price_lines WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='band_b'))=1600
  AND (SELECT price FROM public.company_product_price_lines WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='band_a'))=1350,'T11',
  format('A=%s (%s) B=%s (%s)',
    (SELECT price FROM public.company_product_price_lines WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='band_a')),
    (SELECT v FROM pricing_phase_ctx WHERE k='band_a'),
    (SELECT price FROM public.company_product_price_lines WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='band_b')),
    (SELECT v FROM pricing_phase_ctx WHERE k='band_b')));

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM pricing_phase_ctx WHERE k='user_a'),'role','authenticated')::text,true);
DO $$ BEGIN
  BEGIN
    PERFORM public.get_company_pricing_workspace((SELECT v FROM pricing_phase_ctx WHERE k='company_b'));
    RAISE EXCEPTION 'EXPECTED_UNAUTHORIZED';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.save_company_line_price_band(
      (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='line'),
      'Forged color',1700,ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8')],
      ARRAY[(SELECT v FROM pricing_phase_ctx WHERE k='color_b_white')],ARRAY['PADRAO'],NULL);
    RAISE EXCEPTION 'EXPECTED_INVALID_PROFILE_COLOR';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
SELECT pg_temp.ok(true,'T12','Forged tenant identifiers rejected');

-- Private A product uses the same engine and BOM.
INSERT INTO public.company_products(company_id,commercial_name,is_active,is_custom,pricing_type,linha,product_line_id)
SELECT company_id,'PRIVATE PRODUCT A',true,true,'COMPOSITION',linha,product_line_id
FROM public.company_products WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='product_a') RETURNING id;
INSERT INTO pricing_phase_ctx SELECT 'private_a',id FROM public.company_products
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND commercial_name='PRIVATE PRODUCT A';
INSERT INTO public.company_product_items(company_product_id,item_template_id,quantity_formula,width_formula,height_formula,
  is_optional,notes,sort_order,company_item_id,cut_angle,pieces_quantity,loss_percent,section,side,calculation_type,
  applies_to,pieces_formula,cut_angle_start,cut_angle_end,company_id)
SELECT (SELECT v FROM pricing_phase_ctx WHERE k='private_a'),item_template_id,quantity_formula,width_formula,height_formula,
  is_optional,notes,sort_order,company_item_id,cut_angle,pieces_quantity,loss_percent,section,side,calculation_type,
  applies_to,pieces_formula,cut_angle_start,cut_angle_end,company_id
FROM public.company_product_items WHERE company_product_id=(SELECT v FROM pricing_phase_ctx WHERE k='product_a');
DO $$
DECLARE r jsonb; variants jsonb;
BEGIN
  variants:=jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
    'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),'profile_finish','PADRAO');
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='private_a'),1500,1200,1,variants);
  PERFORM pg_temp.ok(r->>'commercial_pricing_method'='COMPOSITION','T13','Private product uses composition engine');
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1500,1200,1,variants);
  PERFORM pg_temp.ok(r->>'commercial_pricing_method'='COMPOSITION','T14','Global-materialized product uses composition engine');
  PERFORM pg_temp.ok((r#>>'{totals,area_m2}')::numeric=1.8
    AND coalesce((r#>>'{totals,sale_price}')::numeric,-1)<>2430,'T15','Historical band does not set new suggestion');
END $$;

-- Composition fixtures use the same canonical resolver invoked by quote
-- freezing, so unique profile identities are exercised rather than bypassed.
SELECT (public.resolve_company_profile_variant(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),ci.id,
  (SELECT v FROM pricing_phase_ctx WHERE k='color_white'))).id
FROM public.company_product_items cpi
JOIN public.company_items ci ON ci.id=cpi.company_item_id AND ci.type='profile'
WHERE cpi.company_product_id=(SELECT v FROM pricing_phase_ctx WHERE k='product_a');
SELECT (public.resolve_company_profile_variant(
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),ci.id,
  (SELECT v FROM pricing_phase_ctx WHERE k='color_wood'))).id
FROM public.company_product_items cpi
JOIN public.company_items ci ON ci.id=cpi.company_item_id AND ci.type='profile'
WHERE cpi.company_product_id=(SELECT v FROM pricing_phase_ctx WHERE k='product_a');
UPDATE public.company_item_variants civ
SET cost=greatest(coalesce(ci.cost,10),0.01),
    sale_price=greatest(coalesce(ci.sale_price,20),0.01)
      * CASE WHEN civ.company_color_id=(SELECT v FROM pricing_phase_ctx WHERE k='color_wood') THEN 1.25 ELSE 1 END,
    profile_finish='PADRAO',pricing_mode='MANUAL',pricing_source='MANUAL',is_active=true
FROM public.company_items ci
WHERE ci.id=civ.company_item_id
  AND civ.company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a')
  AND civ.company_color_id IN ((SELECT v FROM pricing_phase_ctx WHERE k='color_white'),
    (SELECT v FROM pricing_phase_ctx WHERE k='color_wood'));

INSERT INTO public.company_items(company_id,name,type,unit,cost,sale_price,is_active,pricing_basis,catalog_origin)
VALUES((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),'PRICING TEST ACCESSORY','accessory','un',10,20,true,'UNIT','PRIVATE') RETURNING id;
INSERT INTO pricing_phase_ctx SELECT 'accessory_a',id FROM public.company_items
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND name='PRICING TEST ACCESSORY';
INSERT INTO public.company_product_items(company_product_id,company_item_id,company_id,quantity_formula,pieces_quantity,sort_order)
VALUES((SELECT v FROM pricing_phase_ctx WHERE k='product_a'),(SELECT v FROM pricing_phase_ctx WHERE k='accessory_a'),
  (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),'1',2,999);
SELECT public.save_company_product_pricing_method((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),'COMPOSITION',NULL);
SELECT public.save_company_composition_labor_percent((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),30);

DO $$
DECLARE core jsonb; result jsonb; wood jsonb; green jsonb; variants jsonb; wood_variants jsonb; subtotal numeric; cost numeric; total numeric;
BEGIN
  variants:=jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
    'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),
    'profile_color','Branco');
  core:=public.resolve_company_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,variants);
  result:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,variants);
  subtotal:=(result#>>'{totals,component_commercial_subtotal}')::numeric;
  cost:=(result#>>'{totals,cost}')::numeric;
  total:=(result#>>'{totals,sale_price}')::numeric;
  PERFORM pg_temp.ok(EXISTS(SELECT 1 FROM jsonb_array_elements(result->'materials') e WHERE e->>'material_type'='glass' AND (e->>'sale_price')::numeric>0),'C01','Glass commercial price included');
  PERFORM pg_temp.ok(EXISTS(SELECT 1 FROM jsonb_array_elements(result->'materials') e WHERE e->>'material_type'='profile' AND (e->>'sale_price')::numeric>0),'C02','Profile commercial price included');
  PERFORM pg_temp.ok(NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'materials') e WHERE e->>'material_type'='profile' AND e#>>'{variant,color}'<>'BRANCO'),'C03','Correct profile color variants');
  PERFORM pg_temp.ok(EXISTS(SELECT 1 FROM jsonb_array_elements(result->'materials') e WHERE e->>'item_name'='PRICING TEST ACCESSORY' AND (e->>'sale_price')::numeric=40),'C04','Accessories use commercial price');
  PERFORM pg_temp.ok(subtotal=(SELECT sum((e->>'sale_price')::numeric) FROM jsonb_array_elements(result->'materials') e),'C05','Commercial subtotal is exact');
  PERFORM pg_temp.ok((result#>>'{totals,labor_percent}')::numeric=30,'C06','Labor percentage is tenant scoped');
  PERFORM pg_temp.ok(total=round(subtotal*1.30,2),'C07','Suggested price includes labor');
  PERFORM pg_temp.ok(cost=(core#>>'{totals,cost}')::numeric,'C08','Real cost remains separate');
  PERFORM pg_temp.ok((result#>>'{totals,margin_percent}')::numeric=round((total-cost)/total*100,2),'C09','Margin is correct');
  wood_variants:=variants||jsonb_build_object('profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_wood'),'profile_color','Amadeirado');
  wood:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,wood_variants);
  PERFORM pg_temp.ok((wood#>>'{totals,sale_price}')::numeric<>total,'C10','White to wood recalculates');
  green:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,variants||jsonb_build_object('glass_color','VERDE'));
  PERFORM pg_temp.ok((green#>>'{totals,sale_price}')::numeric<>total,'C11',
    'Changing glass color recalculates');
  PERFORM pg_temp.ok((SELECT composition_labor_percent FROM public.companies WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b'))=0,'C12','Labor never crosses tenants');
  PERFORM pg_temp.ok(result->>'pricing_source'='COMPOSITION','C14','Composition is the canonical pricing source');
  PERFORM pg_temp.ok((result#>>'{totals,labor_amount}')::numeric=round(subtotal*0.30,2),'C16','Composition labor applied once');
END $$;

DO $$ DECLARE old_sale numeric; r jsonb; BEGIN
  SELECT sale_price INTO old_sale FROM public.company_items WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='accessory_a');
  UPDATE public.company_items SET sale_price=NULL WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='accessory_a');
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,
    jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),'profile_color','Branco'));
  IF r->>'suggestion_status'<>'PARTIAL'
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'materials') material
       WHERE material->>'item_name'='PRICING TEST ACCESSORY'
         AND material->>'unit_sale_price' IS NULL)
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'warnings') warning
       WHERE warning->>'code'='MISSING_PRICE') THEN
    RAISE EXCEPTION 'PARTIAL_PRICE_CONTRACT_FAILED %',r;
  END IF;
  UPDATE public.company_items SET sale_price=old_sale WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='accessory_a');
END $$;
SELECT pg_temp.ok(true,'C13','Missing component price remains null and yields PARTIAL');

SELECT public.save_company_product_pricing_method((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),'LINE_PRICE_PER_M2',(SELECT v FROM pricing_phase_ctx WHERE k='line'));
DO $$ DECLARE r jsonb; BEGIN
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,
    jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),'profile_finish','PADRAO'));
  PERFORM pg_temp.ok(r->>'commercial_pricing_method'='COMPOSITION'
    AND (r#>>'{totals,labor_percent}')::numeric=30,'C15','LINE_BAND config cannot bypass composition labor');
END $$;

-- Snapshot follow-up checks run on the same transaction-only tenant/product.
DO $$
DECLARE v_quote uuid; v_item uuid; v_expected jsonb; v_supplied jsonb; v_applied numeric;
BEGIN
  INSERT INTO public.quotes(company_id,customer_name,status,total_amount,final_amount)
  VALUES((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    'PRICING PHASE SNAPSHOTS '||gen_random_uuid(),'pending',1,1)
  RETURNING id INTO v_quote;

  v_expected:=public.resolve_company_final_product_pricing(
    (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,
    jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR',
      'glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),
      'profile_color','Branco','profile_finish','PADRAO'));
  v_applied:=(v_expected#>>'{totals,sale_price}')::numeric+123;
  v_supplied:=v_expected || jsonb_build_object(
    'variants',jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR',
      'glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),
      'profile_color','Branco','profile_finish','PADRAO'),
    'pricing_method','COMPOSITION','pricing_method_label','Composição',
    'applied_product_price',v_applied,
    'totals',(v_expected->'totals') || jsonb_build_object(
      'suggested_price',(v_expected#>'{totals,sale_price}'),
      'applied_product_price',v_applied,'quote_unit_price',v_applied,'quote_total',v_applied));
  INSERT INTO public.quote_items(
    quote_id,description,company_product_id,width,height,quantity,
    unit_price,total_price,composition_snapshot)
  VALUES(v_quote,'Snapshot COMPOSITION despite historical band',(SELECT v FROM pricing_phase_ctx WHERE k='product_a'),
    1000,1000,1,v_applied,v_applied,v_supplied)
  RETURNING id INTO v_item;
  PERFORM pg_temp.ok((SELECT composition_snapshot->>'commercial_pricing_method'='COMPOSITION'
      AND (composition_snapshot#>>'{totals,applied_product_price}')::numeric=v_applied
    FROM public.quote_items WHERE id=v_item),'S01','Snapshot freezes composition despite historical LINE_BAND config');

  PERFORM public.save_company_product_pricing_method(
    (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),'COMPOSITION',NULL);
  v_expected:=public.resolve_company_final_product_pricing(
    (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,
    jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR',
      'glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),
      'profile_color','Branco'));
  v_applied:=(v_expected#>>'{totals,sale_price}')::numeric+77;
  v_supplied:=v_expected || jsonb_build_object(
    'pricing_method','COMPOSITION','pricing_method_label','Composição',
    'applied_product_price',v_applied,
    'totals',(v_expected->'totals') || jsonb_build_object(
      'suggested_price',(v_expected#>'{totals,sale_price}'),
      'applied_product_price',v_applied,'quote_unit_price',v_applied,'quote_total',v_applied));
  INSERT INTO public.quote_items(
    quote_id,description,company_product_id,width,height,quantity,
    unit_price,total_price,composition_snapshot)
  VALUES(v_quote,'Snapshot COMPOSITION',(SELECT v FROM pricing_phase_ctx WHERE k='product_a'),
    1000,1000,1,v_applied,v_applied,v_supplied)
  RETURNING id INTO v_item;
  PERFORM pg_temp.ok((SELECT composition_snapshot->>'commercial_pricing_method'='COMPOSITION'
      AND (composition_snapshot#>>'{totals,labor_amount}')::numeric>0
      AND (composition_snapshot#>>'{totals,applied_product_price}')::numeric=v_applied
    FROM public.quote_items WHERE id=v_item),'S02','COMPOSITION snapshot freezes labor and quote-applied price');

  v_applied:=777;
  v_supplied:=jsonb_build_object(
    'pricing_method','MANUAL','pricing_method_label','Preço manual',
    'pricing_unavailable_reason','MISSING_PRICE_VARIANT',
    'applied_product_price',v_applied,'applied_price',v_applied,
    'totals',jsonb_build_object('applied_product_price',v_applied,
      'quote_unit_price',v_applied,'quote_total',v_applied));
  INSERT INTO public.quote_items(
    quote_id,description,company_product_id,width,height,quantity,
    unit_price,total_price,composition_snapshot)
  VALUES(v_quote,'Snapshot fixed manual',(SELECT v FROM pricing_phase_ctx WHERE k='product_a'),
    1000,1000,1,v_applied,v_applied,v_supplied)
  RETURNING id INTO v_item;
  PERFORM pg_temp.ok((SELECT composition_snapshot->>'composition_mode'='fixed'
      AND (composition_snapshot->>'applied_price')::numeric=v_applied
      AND (composition_snapshot#>>'{totals,applied_product_price}')::numeric=v_applied
      AND (composition_snapshot#>>'{totals,missing_price_items}')::integer>0
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(composition_snapshot->'warnings') warning
        WHERE warning->>'code'='MISSING_PRICE')
    FROM public.quote_items WHERE id=v_item),'S03','P09/P10 fixed snapshot keeps manual price and explicit missing-price warnings');
END $$;

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM pricing_phase_ctx WHERE k='user_b'),'role','authenticated')::text,true);
SELECT public.save_company_product_pricing_method((SELECT v FROM pricing_phase_ctx WHERE k='company_b'),
  (SELECT v FROM pricing_phase_ctx WHERE k='product_b'),'LINE_PRICE_PER_M2',(SELECT v FROM pricing_phase_ctx WHERE k='line'));
DO $$ DECLARE r jsonb; BEGIN
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_b'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_b'),1000,1000,1,
    jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_b_white'),'profile_finish','PADRAO'));
  IF (r#>>'{totals,sale_price}')::numeric<>20
     OR r->>'commercial_pricing_method'<>'COMPOSITION' THEN
    RAISE EXCEPTION 'TENANT_B_WRONG_COMPOSITION_PRICE %',r;
  END IF;
END $$;

SELECT pg_temp.ok((SELECT count(*) FROM pricing_phase_results WHERE test ~ '^[TC]')=31,
  'SUITE','T01-T15 and C01-C16 completed; snapshot checks are reported separately');
SELECT * FROM pricing_phase_results ORDER BY test;
ROLLBACK;
