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

INSERT INTO pricing_phase_ctx
SELECT 'company_a',company_id FROM public.company_products ORDER BY created_at LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'product_a',id FROM public.company_products WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') ORDER BY created_at LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'line',COALESCE(cp.product_line_id,pl.id) FROM public.company_products cp
LEFT JOIN public.product_linhas pl ON pl.slug=cp.linha
WHERE cp.id=(SELECT v FROM pricing_phase_ctx WHERE k='product_a');
INSERT INTO pricing_phase_ctx
SELECT 'user_a',uc.user_id FROM public.user_companies uc
WHERE uc.company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND uc.role='admin' AND uc.is_active
ORDER BY uc.created_at LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'user_b',u.id FROM auth.users u
WHERE u.id<>(SELECT v FROM pricing_phase_ctx WHERE k='user_a') ORDER BY u.created_at LIMIT 1;

DO $$ BEGIN
  IF (SELECT count(*) FROM pricing_phase_ctx WHERE k IN ('company_a','product_a','line','user_a','user_b'))<>5 THEN
    RAISE EXCEPTION 'PRICING_PHASE_CONTEXT_MISSING';
  END IF;
END $$;

INSERT INTO pricing_phase_ctx
SELECT 'glass_incolor_8',variant_definition_id FROM public.company_item_variants
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND is_active
  AND glass_color='INCOLOR' AND glass_thickness_mm=8 AND variant_definition_id IS NOT NULL LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'glass_green_6',variant_definition_id FROM public.company_item_variants
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND is_active
  AND glass_color='VERDE' AND glass_thickness_mm=6 AND variant_definition_id IS NOT NULL LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'glass_green_8',variant_definition_id FROM public.company_item_variants
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND is_active
  AND glass_color='VERDE' AND glass_thickness_mm=8 AND variant_definition_id IS NOT NULL LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'glass_fume_6',variant_definition_id FROM public.company_item_variants
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND is_active
  AND glass_color='FUME' AND glass_thickness_mm=6 AND variant_definition_id IS NOT NULL LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'glass_fume_8',variant_definition_id FROM public.company_item_variants
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND is_active
  AND glass_color='FUME' AND glass_thickness_mm=8 AND variant_definition_id IS NOT NULL LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'color_white',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='branco' AND is_active LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'color_black',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='preto' AND is_active LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'color_bronze',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='bronze' AND is_active LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'color_wood',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='amadeirado' AND is_active LIMIT 1;
INSERT INTO pricing_phase_ctx
SELECT 'color_natural',id FROM public.company_colors
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a') AND lower(code)='natural' AND is_active LIMIT 1;

-- Tenant B has independent operational options and a private product.
INSERT INTO public.companies(name) VALUES('PRICING PHASE TENANT B') RETURNING id;
INSERT INTO pricing_phase_ctx SELECT 'company_b',id FROM public.companies WHERE name='PRICING PHASE TENANT B';
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

INSERT INTO pricing_phase_ctx
SELECT 'glass_item_b',id FROM public.company_items
WHERE company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b')
  AND is_commercial_area_material AND commercial_material_family='GLASS' LIMIT 1;
UPDATE public.company_items SET cost=250,sale_price=400,is_active=true
WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='glass_item_b');
INSERT INTO public.company_item_variants(company_id,company_item_id,variant_type,glass_type,glass_color,
  glass_thickness_mm,cost,sale_price,is_active,pricing_basis,attributes,variant_definition_id,pricing_mode,pricing_source)
SELECT (SELECT v FROM pricing_phase_ctx WHERE k='company_b'),(SELECT v FROM pricing_phase_ctx WHERE k='glass_item_b'),
  'GLASS',a.glass_type,a.glass_color,a.glass_thickness_mm,250,400,true,'AREA',a.attributes,a.variant_definition_id,'MANUAL','MANUAL'
FROM public.company_item_variants a
WHERE a.company_id=(SELECT v FROM pricing_phase_ctx WHERE k='company_a')
  AND a.variant_definition_id=(SELECT v FROM pricing_phase_ctx WHERE k='glass_incolor_8') AND a.is_active LIMIT 1;

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
DO $$ BEGIN
  BEGIN
    PERFORM public.resolve_company_final_product_pricing(
      (SELECT v FROM pricing_phase_ctx WHERE k='company_a'),(SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,
      jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
        'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_natural'),'profile_finish','PADRAO'));
    RAISE EXCEPTION 'EXPECTED_PRICE_NOT_CONFIGURED';
  EXCEPTION WHEN check_violation THEN
    IF sqlerrm NOT LIKE '%PRICE_NOT_CONFIGURED%' THEN RAISE; END IF;
  END;
END $$;
SELECT pg_temp.ok(true,'T08','Missing combination returns PRICE_NOT_CONFIGURED');

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
SELECT public.save_company_product_pricing_method((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_phase_ctx WHERE k='private_a'),'LINE_PRICE_PER_M2',(SELECT v FROM pricing_phase_ctx WHERE k='line'));

DO $$
DECLARE r jsonb; variants jsonb;
BEGIN
  variants:=jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
    'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),'profile_finish','PADRAO');
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='private_a'),1500,1200,1,variants);
  PERFORM pg_temp.ok((r#>>'{totals,sale_price}')::numeric=2430,'T13','Private product uses canonical line engine');
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1500,1200,1,variants);
  PERFORM pg_temp.ok(r->>'commercial_pricing_method'='LINE_PRICE_PER_M2','T14','Global-materialized product uses canonical line engine');
  PERFORM pg_temp.ok((r#>>'{totals,area_m2}')::numeric=1.8 AND (r#>>'{totals,sale_price}')::numeric=2430,'T15','Area times tenant band price');
END $$;

-- Composition fixtures: tenant profile variants and an accessory are test-only.
INSERT INTO public.company_item_variants(company_id,company_item_id,variant_type,profile_color,profile_finish,cost,sale_price,
  is_active,pricing_basis,attributes,aluminum_color_id,company_color_id,pricing_mode,pricing_source)
SELECT ci.company_id,ci.id,'PROFILE',upper(cc.name),'PADRAO',greatest(coalesce(ci.cost,10),0.01),
  greatest(coalesce(ci.sale_price,20),0.01),true,ci.pricing_basis,
  public.phase4a_normalize_variant_attributes(jsonb_build_object('color',cc.name,'finish','PADRAO')),
  cc.admin_color_id,cc.id,'MANUAL','MANUAL'
FROM public.company_product_items cpi
JOIN public.company_items ci ON ci.id=cpi.company_item_id AND ci.type='profile'
CROSS JOIN public.company_colors cc
WHERE cpi.company_product_id=(SELECT v FROM pricing_phase_ctx WHERE k='product_a')
  AND cc.id=(SELECT v FROM pricing_phase_ctx WHERE k='color_white');
INSERT INTO public.company_item_variants(company_id,company_item_id,variant_type,profile_color,profile_finish,cost,sale_price,
  is_active,pricing_basis,attributes,aluminum_color_id,company_color_id,pricing_mode,pricing_source)
SELECT ci.company_id,ci.id,'PROFILE',upper(cc.name),'PADRAO',greatest(coalesce(ci.cost,10),0.01),
  greatest(coalesce(ci.sale_price,20),0.01)*1.25,true,ci.pricing_basis,
  public.phase4a_normalize_variant_attributes(jsonb_build_object('color',cc.name,'finish','PADRAO')),
  cc.admin_color_id,cc.id,'MANUAL','MANUAL'
FROM public.company_product_items cpi
JOIN public.company_items ci ON ci.id=cpi.company_item_id AND ci.type='profile'
CROSS JOIN public.company_colors cc
WHERE cpi.company_product_id=(SELECT v FROM pricing_phase_ctx WHERE k='product_a')
  AND cc.id=(SELECT v FROM pricing_phase_ctx WHERE k='color_wood');

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
    'profile_color','Branco','profile_finish','PADRAO');
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
  PERFORM pg_temp.ok((green#>>'{totals,sale_price}')::numeric<>total,'C11','Incolor to green recalculates');
  PERFORM pg_temp.ok((SELECT composition_labor_percent FROM public.companies WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='company_b'))=0,'C12','Labor never crosses tenants');
  PERFORM pg_temp.ok(result->>'pricing_source'='TENANT_COMPONENT_SALE_PRICES','C14','No second markup source');
  PERFORM pg_temp.ok((result#>>'{totals,labor_amount}')::numeric=round(subtotal*0.30,2),'C16','Composition labor applied once');
END $$;

DO $$ DECLARE old_sale numeric; BEGIN
  SELECT sale_price INTO old_sale FROM public.company_items WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='accessory_a');
  UPDATE public.company_items SET sale_price=NULL WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='accessory_a');
  BEGIN
    PERFORM public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
      (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,
      jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
        'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),'profile_color','Branco','profile_finish','PADRAO'));
    RAISE EXCEPTION 'EXPECTED_MISSING_PRICE';
  EXCEPTION WHEN check_violation THEN
    IF sqlerrm NOT LIKE '%MISSING_PRICE%' THEN RAISE; END IF;
  END;
  UPDATE public.company_items SET sale_price=old_sale WHERE id=(SELECT v FROM pricing_phase_ctx WHERE k='accessory_a');
END $$;
SELECT pg_temp.ok(true,'C13','Missing component price never invents a value');

SELECT public.save_company_product_pricing_method((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
  (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),'LINE_PRICE_PER_M2',(SELECT v FROM pricing_phase_ctx WHERE k='line'));
DO $$ DECLARE r jsonb; BEGIN
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_a'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_a'),1000,1000,1,
    jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_white'),'profile_finish','PADRAO'));
  PERFORM pg_temp.ok((r#>>'{totals,labor_percent}')::numeric=0 AND (r#>>'{totals,labor_amount}')::numeric=0,'C15','Line price never receives composition labor');
END $$;

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM pricing_phase_ctx WHERE k='user_b'),'role','authenticated')::text,true);
SELECT public.save_company_product_pricing_method((SELECT v FROM pricing_phase_ctx WHERE k='company_b'),
  (SELECT v FROM pricing_phase_ctx WHERE k='product_b'),'LINE_PRICE_PER_M2',(SELECT v FROM pricing_phase_ctx WHERE k='line'));
DO $$ DECLARE r jsonb; BEGIN
  r:=public.resolve_company_final_product_pricing((SELECT v FROM pricing_phase_ctx WHERE k='company_b'),
    (SELECT v FROM pricing_phase_ctx WHERE k='product_b'),1000,1000,1,
    jsonb_build_object('glass_type','TEMPERADO','glass_color','INCOLOR','glass_thickness_mm',8,'glass_finish','PADRAO',
      'profile_company_color_id',(SELECT v FROM pricing_phase_ctx WHERE k='color_b_white'),'profile_finish','PADRAO'));
  IF (r#>>'{totals,sale_price}')::numeric<>1600 THEN RAISE EXCEPTION 'TENANT_B_WRONG_PRICE'; END IF;
END $$;

SELECT pg_temp.ok((SELECT count(*) FROM pricing_phase_results)=31,'SUITE','T01-T15 and C01-C16 completed');
SELECT * FROM pricing_phase_results ORDER BY test;
ROLLBACK;
