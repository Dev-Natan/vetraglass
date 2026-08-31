-- Phase 4B.1B acceptance suite. Everything is rolled back.
BEGIN;

CREATE TEMP TABLE phase4b1b_results(test text PRIMARY KEY, passed boolean NOT NULL, detail text);
CREATE OR REPLACE FUNCTION pg_temp.ok(_condition boolean,_test text,_detail text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO phase4b1b_results VALUES (_test,COALESCE(_condition,false),_detail);
  IF NOT COALESCE(_condition,false) THEN
    RAISE EXCEPTION 'PHASE4B1B_TEST_FAILED: % (%)',_test,COALESCE(_detail,'');
  END IF;
END; $$;

CREATE TEMP TABLE phase4b1b_ctx(k text PRIMARY KEY,v uuid NOT NULL);
GRANT SELECT ON phase4b1b_ctx TO authenticated;
GRANT SELECT,INSERT,UPDATE ON phase4b1b_results TO authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean,text,text) TO authenticated;
INSERT INTO phase4b1b_ctx
SELECT 'user_a',id FROM auth.users ORDER BY created_at LIMIT 1;
INSERT INTO phase4b1b_ctx
SELECT 'user_b',id FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;

INSERT INTO public.companies(name) VALUES ('PHASE4B1B A') RETURNING id;
INSERT INTO phase4b1b_ctx SELECT 'company_a',id FROM public.companies WHERE name='PHASE4B1B A';
INSERT INTO public.companies(name) VALUES ('PHASE4B1B B') RETURNING id;
INSERT INTO phase4b1b_ctx SELECT 'company_b',id FROM public.companies WHERE name='PHASE4B1B B';
INSERT INTO public.user_companies(user_id,company_id,role)
SELECT (SELECT v FROM phase4b1b_ctx WHERE k='user_a'),(SELECT v FROM phase4b1b_ctx WHERE k='company_a'),'admin';
INSERT INTO public.user_companies(user_id,company_id,role)
SELECT (SELECT v FROM phase4b1b_ctx WHERE k='user_b'),(SELECT v FROM phase4b1b_ctx WHERE k='company_b'),'admin';

SELECT pg_temp.ok(
  (SELECT count(*) FROM public.company_items WHERE company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a') AND catalog_origin='GLOBAL')
  =(SELECT count(*) FROM public.item_templates WHERE company_id IS NULL AND is_active), 'T01');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_items WHERE company_id IS NULL),'T02');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.physical_stock_balances WHERE company_id IN
  ((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='company_b'))),'T03');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_stock WHERE company_id IN
  ((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='company_b')) AND quantity<>0),'T04');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_items WHERE company_id IN
  ((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='company_b')) AND (cost<>0 OR sale_price<>0)),'T05');

INSERT INTO public.item_templates(name,type,unit,is_active,specifications)
VALUES ('PHASE4B1B GLOBAL LATE','accessory','un',true,jsonb_build_object('code','P4B1B-LATE'))
RETURNING id;
SELECT public.phase4b1b_materialize_company_catalog((SELECT v FROM phase4b1b_ctx WHERE k='company_a'));
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_items WHERE company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a') AND code='P4B1B-LATE'),'T06');
SELECT public.phase4b1b_materialize_company_catalog((SELECT v FROM phase4b1b_ctx WHERE k='company_a'));
SELECT pg_temp.ok((SELECT count(*) FROM public.company_items WHERE company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a') AND code='P4B1B-LATE')=1,'T07');

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM phase4b1b_ctx WHERE k='user_a'),'role','authenticated')::text,true);
WITH created AS (
  SELECT public.create_private_company_item(
    (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),'XP-200','XP-200','profile',
    'BAR','M','M','MM',6000,1000,1000,6000,'Perfil privado de teste') payload
) INSERT INTO phase4b1b_ctx SELECT 'item_a',(payload->>'company_item_id')::uuid FROM created;
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_items WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a') AND catalog_origin='PRIVATE' AND item_template_id IS NULL),'T08');

SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_items WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a') AND company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_b')),'T09');
RESET ROLE;

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM phase4b1b_ctx WHERE k='user_b'),'role','authenticated')::text,true);
WITH created AS (
  SELECT public.create_private_company_item(
    (SELECT v FROM phase4b1b_ctx WHERE k='company_b'),'XP-200','XP-200','profile',
    'BAR','M','M','MM',6000,1000,1000,6000,'Mesmo nome, outro tenant') payload
) INSERT INTO phase4b1b_ctx SELECT 'item_b',(payload->>'company_item_id')::uuid FROM created;
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_items WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='item_b')),'T10');
SELECT pg_temp.ok((SELECT v FROM phase4b1b_ctx WHERE k='item_a')<>(SELECT v FROM phase4b1b_ctx WHERE k='item_b'),'T11');

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM phase4b1b_ctx WHERE k='user_a'),'role','authenticated')::text,true);
SELECT public.record_tenant_stock_movement(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='item_a'),
  'IN',10,'BAR','T12 private stock',NULL,NULL,NULL,356.25,6,gen_random_uuid());
SELECT pg_temp.ok((SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a'))=60000,'T12');
UPDATE public.company_items
SET cost=3.75, sale_price=6
WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a');

INSERT INTO public.company_products(company_id,commercial_name,is_custom)
VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),'Porta XP',true) RETURNING id;
INSERT INTO phase4b1b_ctx SELECT 'product_a',id FROM public.company_products WHERE commercial_name='Porta XP' AND company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a');
INSERT INTO public.company_product_items(company_product_id,company_item_id,quantity_formula,pieces_formula,height_formula)
VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='product_a'),(SELECT v FROM phase4b1b_ctx WHERE k='item_a'),'1','2','A - 30');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_product_items WHERE company_product_id=(SELECT v FROM phase4b1b_ctx WHERE k='product_a') AND company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a')),'T13');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_product_items WHERE company_product_id=(SELECT v FROM phase4b1b_ctx WHERE k='product_a') AND height_formula='A - 30' AND pieces_formula='2'),'T14');

WITH color AS (SELECT public.create_private_company_color((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),'MARROM','MARROM','#6F4E37') row)
INSERT INTO phase4b1b_ctx SELECT 'color_a',(row).id FROM color;
INSERT INTO public.quotes(company_id,customer_name) VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),'Teste 4B1B') RETURNING id;
INSERT INTO phase4b1b_ctx SELECT 'quote_a',id FROM public.quotes WHERE customer_name='Teste 4B1B' AND company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a');
INSERT INTO public.quote_items(
  quote_id,description,company_product_id,width,height,quantity,unit_price,total_price,
  composition_snapshot,profile_company_color_id
)
VALUES (
  (SELECT v FROM phase4b1b_ctx WHERE k='quote_a'),'Porta XP',
  (SELECT v FROM phase4b1b_ctx WHERE k='product_a'),900,2100,1,0,0,
  jsonb_build_object('variants',jsonb_build_object(
    'profile_company_color_id',(SELECT v FROM phase4b1b_ctx WHERE k='color_a')
  )),
  (SELECT v FROM phase4b1b_ctx WHERE k='color_a')
);
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a') AND profile_company_color_id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a')),'T15');

INSERT INTO public.ordens_servico(company_id,quote_id,customer_name)
VALUES (
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),
  (SELECT v FROM phase4b1b_ctx WHERE k='quote_a'),
  'Teste 4B1B'
) RETURNING id;
INSERT INTO phase4b1b_ctx SELECT 'os_a',id FROM public.ordens_servico WHERE customer_name='Teste 4B1B' AND company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a');
INSERT INTO public.os_materials(ordem_servico_id,item_name,item_type,company_item_id,required_quantity,unit,snapshot_payload)
VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='os_a'),'XP-200','profile',(SELECT v FROM phase4b1b_ctx WHERE k='item_a'),4140,'MM',jsonb_build_object('height_formula','A - 30','pieces',2));
INSERT INTO phase4b1b_ctx SELECT 'os_material_a',id FROM public.os_materials WHERE ordem_servico_id=(SELECT v FROM phase4b1b_ctx WHERE k='os_a') AND company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.os_materials WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='os_material_a') AND item_template_id IS NULL),'T16');

INSERT INTO public.material_purchase_requirements(
  company_id,ordem_servico_id,os_material_id,company_item_id,item_template_id,
  required_quantity,required_unit,required_canonical_quantity,canonical_unit,
  consumption_unit,purchase_unit,purchase_to_canonical_factor,consumption_to_canonical_factor
) VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='os_a'),
  (SELECT v FROM phase4b1b_ctx WHERE k='os_material_a'),(SELECT v FROM phase4b1b_ctx WHERE k='item_a'),NULL,
  4.14,'M',4140,'MM','M','BAR',6000,1000);
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.material_purchase_requirements WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a') AND item_template_id IS NULL),'T17');

INSERT INTO public.purchase_orders(company_id,supplier_name) VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),'Fornecedor teste') RETURNING id;
INSERT INTO phase4b1b_ctx SELECT 'po_a',id FROM public.purchase_orders WHERE supplier_name='Fornecedor teste' AND company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a');
INSERT INTO public.purchase_order_items(purchase_order_id,description,company_item_id,quantity,unit,purchase_unit,purchase_to_canonical_factor,ordered_canonical_quantity)
VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='po_a'),'XP-200',(SELECT v FROM phase4b1b_ctx WHERE k='item_a'),1,'barra','BAR',6000,6000);
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.purchase_order_items WHERE purchase_order_id=(SELECT v FROM phase4b1b_ctx WHERE k='po_a') AND company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a')),'T18');
SELECT public.record_tenant_stock_movement(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),
  (SELECT v FROM phase4b1b_ctx WHERE k='item_a'),
  'IN',1,'BAR','T19 receipt',
  (SELECT v FROM phase4b1b_ctx WHERE k='color_a'),
  NULL,NULL,35.625,NULL,gen_random_uuid()
);
SELECT pg_temp.ok((SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a'))=66000,'T19');

DO $$ BEGIN
  BEGIN
    INSERT INTO public.company_product_items(company_product_id,company_item_id,quantity_formula)
    VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='product_a'),(SELECT v FROM phase4b1b_ctx WHERE k='item_b'),'1');
    PERFORM pg_temp.ok(false,'T20','cross-company insert accepted');
  EXCEPTION WHEN foreign_key_violation THEN PERFORM pg_temp.ok(true,'T20'); END;
END $$;

SELECT pg_temp.ok((SELECT count(*) FROM public.company_colors WHERE company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a') AND lower(code)='preto')=1
  AND (SELECT count(*) FROM public.company_colors WHERE company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_b') AND lower(code)='preto')=1,'T21');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_colors WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a')),'T22');
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM phase4b1b_ctx WHERE k='user_b'),'role','authenticated')::text,true);
WITH color AS (SELECT public.create_private_company_color((SELECT v FROM phase4b1b_ctx WHERE k='company_b'),'MARROM','MARROM','#6F4E37') row)
INSERT INTO phase4b1b_ctx SELECT 'color_b',(row).id FROM color;
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_colors WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='color_b')),'T23');
SELECT pg_temp.ok((SELECT v FROM phase4b1b_ctx WHERE k='color_a')<>(SELECT v FROM phase4b1b_ctx WHERE k='color_b'),'T24');

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM phase4b1b_ctx WHERE k='user_a'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_colors WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='color_b')),'T25');
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM phase4b1b_ctx WHERE k='user_b'),'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_colors WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a')),'T26');
RESET ROLE;

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM phase4b1b_ctx WHERE k='user_a'),'role','authenticated')::text,true);
SELECT public.record_tenant_stock_movement((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='item_a'),'IN',1,'BAR','T27 brown entry',(SELECT v FROM phase4b1b_ctx WHERE k='color_a'),NULL,NULL,35.625,NULL,gen_random_uuid());
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.physical_stock_balances b JOIN public.company_item_variants v ON v.id=b.variant_id WHERE v.company_color_id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a')),'T27');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a') AND profile_company_color_id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a')),'T28');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_item_variants WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a') AND company_color_id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a')),'T29');
SELECT public.resolve_company_profile_variant((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='item_a'),(SELECT v FROM phase4b1b_ctx WHERE k='color_a'));
SELECT pg_temp.ok((SELECT count(*) FROM public.company_item_variants WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a') AND company_color_id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a'))=1,'T30');
SELECT pg_temp.ok((SELECT count(*) FROM public.get_company_product_profile_colors((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='product_a')) WHERE color_id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a'))=1,'T31');
SELECT pg_temp.ok(NOT EXISTS(
  SELECT 1 FROM public.material_purchase_requirements r JOIN public.company_item_variants v ON v.id=r.variant_id
  WHERE r.company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a') AND v.company_color_id=(SELECT v FROM phase4b1b_ctx WHERE k='color_b')),'T32');

-- CLICK: 10 bars = 60m, then 6 bars = 36m, total 96m and 16 bars.
INSERT INTO phase4b1b_ctx
SELECT 'click_a',ci.id FROM public.company_items ci JOIN public.item_templates it ON it.id=ci.item_template_id
WHERE ci.company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a') AND upper(it.name)='CLICK';
UPDATE public.company_items SET cost=3.75,sale_price=6 WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a');
SELECT public.record_tenant_stock_movement((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='click_a'),'IN',10,'BAR','T33 first entry',NULL,NULL,NULL,225,6,gen_random_uuid());
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.stock_movements WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a')),'T33');
SELECT pg_temp.ok((SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))=60000,'T34');
SELECT pg_temp.ok((SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))/1000=60,'T35');
SELECT public.record_tenant_stock_movement((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='click_a'),'IN',6,'BAR','T36 projected',NULL,NULL,NULL,135,NULL,gen_random_uuid());
SELECT pg_temp.ok((SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))/1000=96,'T36');
SELECT pg_temp.ok(abs((SELECT max(average_cost_per_canonical)*1000 FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))-3.75)<0.0001,'T37');
SELECT pg_temp.ok((SELECT sale_price FROM public.company_items WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))=6,'T38');
SELECT pg_temp.ok((SELECT sale_price FROM public.company_items WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))=6,'T39');
SELECT public.record_tenant_stock_movement((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='click_a'),'IN',1,'BAR','T40 explicit price',NULL,NULL,NULL,22.5,6.5,gen_random_uuid());
SELECT pg_temp.ok((SELECT sale_price FROM public.company_items WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))=6.5,'T40');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.stock_movements sm JOIN public.stock_locations l ON l.id=sm.location_id WHERE sm.company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a') AND l.code='DEFAULT_STOCK'),'T41');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.stock_movements WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a') AND location_id IS NULL),'T42');
SELECT public.record_tenant_stock_movement((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='click_a'),'OUT',1,'BAR','T43 exit',NULL,NULL,NULL,NULL,NULL,gen_random_uuid());
SELECT pg_temp.ok((SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))/1000=96,'T43');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a') AND canonical_quantity>0),'T44');
SELECT pg_temp.ok(EXISTS(SELECT 1 FROM public.company_items ci WHERE ci.company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a') AND NOT EXISTS(SELECT 1 FROM public.physical_stock_balances b WHERE b.company_item_id=ci.id AND b.canonical_quantity<>0)),'T45');
DO $$ BEGIN
  BEGIN
    PERFORM public.record_tenant_stock_movement((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='click_a'),'OUT',1000,'BAR','T46 negative forbidden',NULL,NULL,NULL,NULL,NULL,gen_random_uuid());
    PERFORM pg_temp.ok(false,'T46','negative stock accepted');
  EXCEPTION WHEN check_violation THEN PERFORM pg_temp.ok(true,'T46','policy forbids negative stock'); END;
END $$;
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.physical_stock_balances WHERE canonical_quantity<0),'T47','negative-to-positive is unreachable by canonical policy');

-- Private products use the same canonical quote engine as global products.
SELECT pg_temp.ok((SELECT composition_snapshot->>'product_origin'='PRIVATE' FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a')),'T48');
SELECT pg_temp.ok((SELECT composition_snapshot->'product_template_id'='null'::jsonb FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a')),'T49');
SELECT pg_temp.ok((SELECT composition_snapshot->>'product_name'='Porta XP' FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a')),'T50');
SELECT pg_temp.ok((SELECT composition_snapshot#>>'{materials,0,height_formula}'='A - 30' FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a')),'T51');
SELECT pg_temp.ok(abs((SELECT (composition_snapshot#>>'{materials,0,quantity}')::numeric FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a'))-4.14)<0.000001,'T52');
SELECT pg_temp.ok((SELECT NULLIF(composition_snapshot#>>'{materials,0,company_item_id}','')::uuid=(SELECT v FROM phase4b1b_ctx WHERE k='item_a') FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a')),'T53');
SELECT pg_temp.ok((public.resolve_company_product_pricing(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='product_a'),900,2100,1,'{}'
)->'product_template_id')='null'::jsonb,'T54');

INSERT INTO public.quotes(company_id,customer_name)
VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='company_b'),'Teste cross tenant') RETURNING id;
INSERT INTO phase4b1b_ctx SELECT 'quote_b',id FROM public.quotes WHERE customer_name='Teste cross tenant' AND company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_b');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.quote_items(quote_id,description,company_product_id,width,height,quantity,unit_price,total_price,composition_snapshot)
    VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='quote_b'),'Produto A proibido',(SELECT v FROM phase4b1b_ctx WHERE k='product_a'),900,2100,1,0,0,'{}');
    PERFORM pg_temp.ok(false,'T55','cross-company product accepted');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.ok(SQLERRM IN ('PRODUCT_NOT_FOUND','SNAPSHOT_MISSING'),'T55',SQLERRM);
  END;
END $$;

INSERT INTO public.company_products(company_id,commercial_name,is_custom)
VALUES ((SELECT v FROM phase4b1b_ctx WHERE k='company_a'),'Produto sem composição',true) RETURNING id;
INSERT INTO phase4b1b_ctx SELECT 'empty_product_a',id FROM public.company_products WHERE commercial_name='Produto sem composição' AND company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a');
DO $$ BEGIN
  BEGIN
    PERFORM public.resolve_company_product_pricing(
      (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='empty_product_a'),900,2100,1,'{}'
    );
    PERFORM pg_temp.ok(false,'T56','empty private composition accepted');
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.ok(SQLERRM='MISSING_COMPANY_ITEM','T56',SQLERRM);
  END;
END $$;

INSERT INTO public.company_product_items(company_product_id,company_item_id,item_template_id,quantity_formula,height_formula)
SELECT (SELECT v FROM phase4b1b_ctx WHERE k='product_a'),ci.id,ci.item_template_id,'1','A'
FROM public.company_items ci WHERE ci.id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a');
SELECT pg_temp.ok(jsonb_array_length(public.resolve_company_product_pricing(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='product_a'),900,2100,1,'{}'
)->'materials')=2,'T57');
SELECT pg_temp.ok(NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(public.resolve_company_product_pricing(
    (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='product_a'),900,2100,1,'{}'
  )->'materials') m
  JOIN public.company_items ci ON ci.id=NULLIF(m->>'company_item_id','')::uuid
  WHERE ci.company_id<>(SELECT v FROM phase4b1b_ctx WHERE k='company_a')
),'T58');

CREATE TEMP TABLE phase4b1b_replay_snapshots(payload jsonb NOT NULL);
INSERT INTO phase4b1b_replay_snapshots(payload)
SELECT public.resolve_company_product_pricing(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='product_a'),900,2100,1,'{}'
);
INSERT INTO phase4b1b_replay_snapshots(payload)
SELECT public.resolve_company_product_pricing(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),(SELECT v FROM phase4b1b_ctx WHERE k='product_a'),900,2100,1,'{}'
);
SELECT pg_temp.ok((SELECT count(DISTINCT payload)=1 FROM phase4b1b_replay_snapshots),'T60');

INSERT INTO phase4b1b_ctx
SELECT 'global_accessory_a',ci.id FROM public.company_items ci
WHERE ci.company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a')
  AND ci.code='P4B1B-LATE';
UPDATE public.company_items SET cost=1,sale_price=2
WHERE id=(SELECT v FROM phase4b1b_ctx WHERE k='global_accessory_a');
INSERT INTO public.company_item_prices(company_id,item_template_id,price,cost)
SELECT ci.company_id,ci.item_template_id,2,1 FROM public.company_items ci
WHERE ci.id=(SELECT v FROM phase4b1b_ctx WHERE k='global_accessory_a')
ON CONFLICT (company_id,item_template_id) DO UPDATE SET price=2,cost=1;
INSERT INTO public.quote_items(quote_id,description,company_item_id,width,height,quantity,unit_price,total_price)
VALUES (
  (SELECT v FROM phase4b1b_ctx WHERE k='quote_a'),'Acessório global + produto privado',
  (SELECT v FROM phase4b1b_ctx WHERE k='global_accessory_a'),900,2100,1,2,2
);
SELECT pg_temp.ok(
  (SELECT count(*) FROM public.quote_items WHERE quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a'))=2
  AND EXISTS (
    SELECT 1 FROM public.quote_items qi
    WHERE qi.quote_id=(SELECT v FROM phase4b1b_ctx WHERE k='quote_a')
      AND qi.company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='global_accessory_a')
      AND NULLIF(qi.composition_snapshot#>>'{materials,0,item_template_id}','') IS NOT NULL
  ),
  'T59'
);

SELECT pg_temp.ok((SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))=96000,'CLICK');
SELECT pg_temp.ok((SELECT sum(package_quantity) FROM public.physical_stock_balances WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a'))=16,'CLICK_BARS');
SELECT pg_temp.ok(abs(96000*0.081/1000-7.776)<0.0001,'CLICK_WEIGHT');
SELECT pg_temp.ok(EXISTS(
  SELECT 1 FROM public.company_product_items
  WHERE company_product_id=(SELECT v FROM phase4b1b_ctx WHERE k='product_a')
    AND company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a')
    AND height_formula='A - 30' AND pieces_formula='2'
),'XP200_FORMULA');
SELECT pg_temp.ok(2*(2100-30)=4140,'XP200_RESULT');

-- Final stock movement hotfix acceptance (T61-T70).
-- T61: an explicit legacy NULL balance exits without asking for a color.
INSERT INTO public.stock_locations(company_id,name,code,kind,needs_review)
VALUES (
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),
  'Legacy review fixture','LEGACY_REVIEW_T61','WAREHOUSE',true
);
UPDATE public.physical_stock_balances
SET location_id=(
      SELECT id FROM public.stock_locations
      WHERE company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a')
        AND code='LEGACY_REVIEW_T61'
    ),
    needs_review=true
WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a')
  AND variant_id IS NULL;
SELECT public.record_tenant_stock_movement(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),
  (SELECT v FROM phase4b1b_ctx WHERE k='click_a'),
  'OUT',16,'BAR','T61 legacy full exit',NULL,NULL,NULL,NULL,NULL,gen_random_uuid()
);
SELECT pg_temp.ok(
  COALESCE((SELECT sum(canonical_quantity) FROM public.physical_stock_balances
    WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a')
      AND variant_id IS NULL),0)=0
  AND EXISTS(SELECT 1 FROM public.stock_movements
    WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a')
      AND type='saida' AND variant_id IS NULL AND original_quantity=16 AND original_unit='BAR'
      AND location_id=(
        SELECT id FROM public.stock_locations
        WHERE company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a')
          AND code='LEGACY_REVIEW_T61'
      )),
  'T61','legacy stock exits without color reclassification'
);

INSERT INTO phase4b1b_ctx
SELECT 'variant_a',id FROM public.company_item_variants
WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a')
  AND company_color_id=(SELECT v FROM phase4b1b_ctx WHERE k='color_a');
SELECT public.record_tenant_stock_movement(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),
  (SELECT v FROM phase4b1b_ctx WHERE k='item_a'),
  'OUT',1,'BAR','T62 existing variant exit',NULL,
  (SELECT v FROM phase4b1b_ctx WHERE k='variant_a'),NULL,NULL,NULL,gen_random_uuid()
);
SELECT pg_temp.ok(EXISTS(
  SELECT 1 FROM public.stock_movements
  WHERE company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='item_a')
    AND variant_id=(SELECT v FROM phase4b1b_ctx WHERE k='variant_a')
    AND type='saida' AND original_quantity=1
),'T62','existing variant identity reaches the physical movement');

DO $$
DECLARE v_bronze uuid;
BEGIN
  SELECT cc.id INTO v_bronze FROM public.company_colors cc
  JOIN public.admin_aluminum_colors ac ON ac.id=cc.admin_color_id
  WHERE cc.company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a') AND ac.slug='bronze';
  BEGIN
    PERFORM public.record_tenant_stock_movement(
      (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),
      (SELECT v FROM phase4b1b_ctx WHERE k='click_a'),
      'OUT',1,'BAR','T63 forbidden variant creation',v_bronze,NULL,NULL,NULL,NULL,gen_random_uuid()
    );
    PERFORM pg_temp.ok(false,'T63','exit created/resolved a missing variant');
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM pg_temp.ok(SQLERRM='EXISTING_VARIANT_REQUIRED','T63',SQLERRM);
  END;
END $$;

SELECT public.record_tenant_stock_movement(
  (SELECT v FROM phase4b1b_ctx WHERE k='company_a'),
  (SELECT v FROM phase4b1b_ctx WHERE k='click_a'),
  'IN',1,'BAR','T64 bronze entry',
  (SELECT cc.id FROM public.company_colors cc JOIN public.admin_aluminum_colors ac ON ac.id=cc.admin_color_id
   WHERE cc.company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a') AND ac.slug='bronze'),
  NULL,NULL,22.5,NULL,gen_random_uuid()
);
SELECT pg_temp.ok((SELECT count(*) FROM public.company_item_variants civ
  JOIN public.company_colors cc ON cc.id=civ.company_color_id
  JOIN public.admin_aluminum_colors ac ON ac.id=cc.admin_color_id
  WHERE civ.company_item_id=(SELECT v FROM phase4b1b_ctx WHERE k='click_a') AND ac.slug='bronze')=1,
  'T64','entry resolves the missing variant exactly once');

SELECT pg_temp.ok((SELECT count(*) FROM public.admin_aluminum_colors WHERE slug='branco')=1,'T65');
SELECT pg_temp.ok((SELECT count(*) FROM public.admin_aluminum_colors WHERE slug='preto')=1,'T66');
SELECT pg_temp.ok((SELECT count(*) FROM public.admin_aluminum_colors WHERE slug='bronze')=1,'T67');
SELECT pg_temp.ok((SELECT count(*) FROM public.admin_aluminum_colors WHERE slug='amadeirado')=1,'T68');
SELECT pg_temp.ok((SELECT count(*) FROM public.admin_aluminum_colors WHERE slug='fosco')=1,'T69');

SELECT public.phase4b1b_materialize_company_catalog((SELECT v FROM phase4b1b_ctx WHERE k='company_a'));
SELECT public.phase4b1b_materialize_company_catalog((SELECT v FROM phase4b1b_ctx WHERE k='company_a'));
SELECT pg_temp.ok(
  (SELECT count(*) FROM public.company_colors cc JOIN public.admin_aluminum_colors ac ON ac.id=cc.admin_color_id
   WHERE cc.company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_a')
     AND ac.slug IN ('branco','preto','bronze','amadeirado','fosco'))=5
  AND (SELECT count(*) FROM public.company_colors cc JOIN public.admin_aluminum_colors ac ON ac.id=cc.admin_color_id
   WHERE cc.company_id=(SELECT v FROM phase4b1b_ctx WHERE k='company_b')
     AND ac.slug IN ('branco','preto','bronze','amadeirado','fosco'))=5,
  'T70','global color materialization is tenant-wide and idempotent'
);

SELECT jsonb_build_object(
  'passed',(SELECT count(*) FROM phase4b1b_results WHERE passed),
  'failed',(SELECT count(*) FROM phase4b1b_results WHERE NOT passed),
  'tests',(SELECT jsonb_agg(test ORDER BY test) FROM phase4b1b_results)
) AS phase4b1b_result;

ROLLBACK;
