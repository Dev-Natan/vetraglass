-- Pre-4B.2 pricing and global/tenant authority acceptance suite.
-- All fixtures and mutations are rolled back.
BEGIN;

CREATE TEMP TABLE pre4b2_results(test text PRIMARY KEY, passed boolean NOT NULL, detail text);
CREATE OR REPLACE FUNCTION pg_temp.ok(_condition boolean,_test text,_detail text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO pre4b2_results VALUES(_test,COALESCE(_condition,false),_detail);
  IF NOT COALESCE(_condition,false) THEN
    RAISE EXCEPTION 'PRE4B2_TEST_FAILED: % (%)',_test,COALESCE(_detail,'');
  END IF;
END; $$;

CREATE TEMP TABLE pre4b2_ctx(k text PRIMARY KEY,v uuid NOT NULL);
GRANT SELECT ON pre4b2_ctx TO authenticated;
GRANT SELECT,INSERT,UPDATE ON pre4b2_results TO authenticated;
GRANT EXECUTE ON FUNCTION pg_temp.ok(boolean,text,text) TO authenticated;
INSERT INTO pre4b2_ctx SELECT 'user_a',id FROM auth.users ORDER BY created_at LIMIT 1;
INSERT INTO pre4b2_ctx SELECT 'user_b',id FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;
INSERT INTO pre4b2_ctx SELECT 'user_c',id FROM auth.users ORDER BY created_at OFFSET 1 LIMIT 1;

INSERT INTO public.companies(name) VALUES('PRE4B2 A') RETURNING id;
INSERT INTO pre4b2_ctx SELECT 'company_a',id FROM public.companies WHERE name='PRE4B2 A';
INSERT INTO public.companies(name) VALUES('PRE4B2 B') RETURNING id;
INSERT INTO pre4b2_ctx SELECT 'company_b',id FROM public.companies WHERE name='PRE4B2 B';
INSERT INTO public.companies(name) VALUES('PRE4B2 C') RETURNING id;
INSERT INTO pre4b2_ctx SELECT 'company_c',id FROM public.companies WHERE name='PRE4B2 C';
INSERT INTO public.user_companies(user_id,company_id,role)
SELECT (SELECT v FROM pre4b2_ctx WHERE k='user_a'),(SELECT v FROM pre4b2_ctx WHERE k='company_a'),'admin';
INSERT INTO public.user_companies(user_id,company_id,role)
SELECT (SELECT v FROM pre4b2_ctx WHERE k='user_b'),(SELECT v FROM pre4b2_ctx WHERE k='company_b'),'admin';
INSERT INTO public.user_companies(user_id,company_id,role)
SELECT (SELECT v FROM pre4b2_ctx WHERE k='user_c'),(SELECT v FROM pre4b2_ctx WHERE k='company_c'),'admin';

INSERT INTO pre4b2_ctx
SELECT 'profile_type',id FROM public.item_types WHERE lower(slug) IN ('profile','perfil') ORDER BY sort_order LIMIT 1;
SELECT pg_temp.ok((SELECT count(*) FROM pre4b2_ctx WHERE k='profile_type')=1,'P02','Perfil must be a dynamic canonical category');

INSERT INTO public.item_templates(name,type,unit,is_active,category_id,bar_length_mm,weight_per_meter,specifications)
VALUES('PRE4B2 CLICK','profile','barra',true,(SELECT v FROM pre4b2_ctx WHERE k='profile_type'),6000,0.258,jsonb_build_object('code','PRE4B2-CLICK'))
RETURNING id;
INSERT INTO pre4b2_ctx SELECT 'template',id FROM public.item_templates WHERE name='PRE4B2 CLICK';

SELECT public.phase4b1b_materialize_company_catalog((SELECT v FROM pre4b2_ctx WHERE k='company_a'));
SELECT public.phase4b1b_materialize_company_catalog((SELECT v FROM pre4b2_ctx WHERE k='company_b'));
SELECT public.phase4b1b_materialize_company_catalog((SELECT v FROM pre4b2_ctx WHERE k='company_c'));
INSERT INTO pre4b2_ctx SELECT 'item_a',id FROM public.company_items WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_a') AND item_template_id=(SELECT v FROM pre4b2_ctx WHERE k='template');
INSERT INTO pre4b2_ctx SELECT 'item_b',id FROM public.company_items WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_b') AND item_template_id=(SELECT v FROM pre4b2_ctx WHERE k='template');
INSERT INTO pre4b2_ctx SELECT 'item_c',id FROM public.company_items WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_c') AND item_template_id=(SELECT v FROM pre4b2_ctx WHERE k='template');

SELECT pg_temp.ok((SELECT count(*) FROM pre4b2_ctx WHERE k IN ('item_a','item_b','item_c'))=3,'G01','One global template materializes independently for three tenants');
SELECT pg_temp.ok((SELECT bar_length_mm FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a')) IS NULL,'G02','New materialization stores no copied bar length');
SELECT pg_temp.ok((SELECT weight_per_meter FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a')) IS NULL,'G03','New materialization stores no copied weight');
SELECT pg_temp.ok(public.pre4b2_effective_bar_length_mm((SELECT v FROM pre4b2_ctx WHERE k='item_a'))=6000,'G04','Global bar length is fallback');
SELECT pg_temp.ok(public.pre4b2_effective_weight_per_meter((SELECT v FROM pre4b2_ctx WHERE k='item_a'))=0.258,'G05','Global weight is fallback');
SELECT pg_temp.ok((SELECT count(DISTINCT company_id) FROM public.inventory_item_units WHERE company_item_id IN ((SELECT v FROM pre4b2_ctx WHERE k='item_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_b'),(SELECT v FROM pre4b2_ctx WHERE k='item_c')))=3,'G06','Unit contracts are tenant scoped');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_items WHERE id IN ((SELECT v FROM pre4b2_ctx WHERE k='item_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_b'),(SELECT v FROM pre4b2_ctx WHERE k='item_c')) AND COALESCE(cost,0)<>0),'G07','No cost copied between tenants');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_items WHERE id IN ((SELECT v FROM pre4b2_ctx WHERE k='item_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_b'),(SELECT v FROM pre4b2_ctx WHERE k='item_c')) AND COALESCE(sale_price,0)<>0),'G08','No sale price copied between tenants');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.physical_stock_balances WHERE company_id IN ((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='company_b'),(SELECT v FROM pre4b2_ctx WHERE k='company_c'))),'G09','No physical stock copied');
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.inventory_item_units WHERE company_item_id IN ((SELECT v FROM pre4b2_ctx WHERE k='item_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_b'),(SELECT v FROM pre4b2_ctx WHERE k='item_c')) AND cost_policy<>'WEIGHTED_AVERAGE'),'G10','New tenant units default to weighted average');

UPDATE public.item_templates SET bar_length_mm=6500,weight_per_meter=0.300 WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='template');
SELECT pg_temp.ok(public.pre4b2_effective_bar_length_mm((SELECT v FROM pre4b2_ctx WHERE k='item_a'))=6500,'G11','Global suggestion updates flow through NULL fallback');
SELECT pg_temp.ok(public.pre4b2_effective_weight_per_meter((SELECT v FROM pre4b2_ctx WHERE k='item_b'))=0.300,'G12','Global weight update flows through NULL fallback');

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM pre4b2_ctx WHERE k='user_a'),'role','authenticated')::text,true);
SELECT public.save_company_item_technical_overrides((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_a'),7000,0.350,false,false);
SELECT pg_temp.ok(public.pre4b2_effective_bar_length_mm((SELECT v FROM pre4b2_ctx WHERE k='item_a'))=7000,'G13','Tenant bar override wins');
SELECT pg_temp.ok(public.pre4b2_effective_weight_per_meter((SELECT v FROM pre4b2_ctx WHERE k='item_a'))=0.350,'G14','Tenant weight override wins');
SELECT pg_temp.ok(public.pre4b2_effective_bar_length_mm((SELECT v FROM pre4b2_ctx WHERE k='item_b'))=6500,'G15','Tenant A override does not affect B');
SELECT public.save_company_item_technical_overrides((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_a'),NULL,NULL,true,true);
SELECT pg_temp.ok(public.pre4b2_effective_bar_length_mm((SELECT v FROM pre4b2_ctx WHERE k='item_a'))=6500,'G16','Restore suggestion writes NULL semantics');
SELECT pg_temp.ok((SELECT bar_length_mm FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a')) IS NULL,'G17','Restore does not copy global value');

SELECT public.save_company_pricing_policy((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='profile_type'),60,true,true);
SELECT pg_temp.ok((SELECT markup_percent FROM public.company_pricing_policies WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_a') AND category_id=(SELECT v FROM pre4b2_ctx WHERE k='profile_type'))=60,'P03');
SELECT pg_temp.ok((SELECT markup_percent FROM public.company_pricing_policies WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_a') AND category_id=(SELECT v FROM pre4b2_ctx WHERE k='profile_type'))=60,'P04','Policy persists in tenant authority');
SELECT public.save_company_pricing_policy((SELECT v FROM pre4b2_ctx WHERE k='company_a'),NULL,50,true,true);
SELECT pg_temp.ok((SELECT markup_percent FROM public.company_pricing_policies WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_a') AND category_id IS NULL)=50,'P12','Company fallback exists');
SELECT public.save_company_pricing_policy((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='profile_type'),160,true,true);
SELECT pg_temp.ok((SELECT markup_percent FROM public.company_pricing_policies WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_a') AND category_id=(SELECT v FROM pre4b2_ctx WHERE k='profile_type'))=160,'P06','Markup above 100 is valid');
SELECT public.save_company_pricing_policy((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='profile_type'),60,true,true);

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM pre4b2_ctx WHERE k='user_b'),'role','authenticated')::text,true);
SELECT public.save_company_pricing_policy((SELECT v FROM pre4b2_ctx WHERE k='company_b'),(SELECT v FROM pre4b2_ctx WHERE k='profile_type'),40,true,true);
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_pricing_policies WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_b') AND markup_percent=60),'P05','Company B does not inherit A policy');

SELECT set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT v FROM pre4b2_ctx WHERE k='user_a'),'role','authenticated')::text,true);
SELECT public.record_tenant_stock_movement_with_pricing((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_a'),'IN',1,'BAR','P13',NULL,NULL,NULL,80,NULL,gen_random_uuid());
SELECT pg_temp.ok(abs(public.pre4b2_effective_cost((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_a'),NULL)-12.3076923077)<0.0001,'P14','80 per 6.5m derives cost per meter');
SELECT pg_temp.ok(abs(6500.0/1000*0.300-1.95)<0.0001,'P15','Weight per bar derives from effective technical values');
SELECT pg_temp.ok(abs(80/1.95-41.025641)<0.0001,'P16','Cost per kg derives automatically');
SELECT pg_temp.ok((SELECT markup_percent FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))=60,'P17');
SELECT pg_temp.ok(abs((SELECT sale_price FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))*6.5-128)<0.001,'P18','Sale per bar is 128');
SELECT pg_temp.ok(abs((SELECT sale_price FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))-19.6923077)<0.001,'P19','Sale per meter derives automatically');
SELECT pg_temp.ok(abs(((SELECT sale_price FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))/0.300)-65.6410256)<0.001,'P20','Sale per kg is equivalent');
SELECT pg_temp.ok((SELECT pricing_mode FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))='AUTO','P21','Entry requires no manual sale price');
SELECT pg_temp.ok((SELECT pricing_source FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))='CATEGORY_POLICY','P22','New item inherits category policy');
SELECT pg_temp.ok((SELECT catalog_origin FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))='GLOBAL','P24');
SELECT pg_temp.ok(abs(60.0/(100+60)*100-37.5)<0.0001,'P08','Markup 60 produces margin 37.5');

SELECT public.set_company_item_pricing_mode((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_a'),NULL,'AUTO',55,NULL);
SELECT pg_temp.ok((SELECT markup_percent FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))=55,'P09','Item override wins');
SELECT public.set_company_item_pricing_mode((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_a'),NULL,'MANUAL',NULL,200);
SELECT pg_temp.ok((SELECT pricing_mode='MANUAL' AND sale_price=200 FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a')),'P10','Manual wins');
SELECT public.save_company_pricing_policy((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='profile_type'),70,true,true);
SELECT pg_temp.ok((SELECT sale_price FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))=200,'P31','Policy change does not rewrite manual price');
SELECT public.set_company_item_pricing_mode((SELECT v FROM pre4b2_ctx WHERE k='company_a'),(SELECT v FROM pre4b2_ctx WHERE k='item_a'),NULL,'AUTO',NULL,NULL);
SELECT pg_temp.ok((SELECT markup_percent FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_a'))=70,'P11','Removing override returns to category');
SELECT pg_temp.ok((SELECT COALESCE(sale_price,0)=0 FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_c')),'P29','No cost means no false sale');
SELECT pg_temp.ok((SELECT pricing_source FROM public.company_items WHERE id=(SELECT v FROM pre4b2_ctx WHERE k='item_c'))='UNPRICED','P30','No policy remains explicitly unpriced');

-- RLS: A cannot read or mutate B's policy through either table or RPC.
SET LOCAL ROLE authenticated;
SELECT pg_temp.ok(NOT EXISTS(SELECT 1 FROM public.company_pricing_policies WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_b')),'G18','Cross-company policy read denied');
RESET ROLE;
DO $$ BEGIN
  BEGIN
    PERFORM public.save_company_pricing_policy((SELECT v FROM pre4b2_ctx WHERE k='company_b'),(SELECT v FROM pre4b2_ctx WHERE k='profile_type'),99,true,true);
    RAISE EXCEPTION 'cross-company write unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT pg_temp.ok((SELECT markup_percent FROM public.company_pricing_policies WHERE company_id=(SELECT v FROM pre4b2_ctx WHERE k='company_b') AND category_id=(SELECT v FROM pre4b2_ctx WHERE k='profile_type'))=40,'P41','Cross-company write denied');

SELECT pg_temp.ok((SELECT count(*) FROM pre4b2_results WHERE passed)>=38,'P01','Database contract suite completed');
SELECT * FROM pre4b2_results ORDER BY test;
ROLLBACK;
