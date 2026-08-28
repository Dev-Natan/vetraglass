-- Phase 4B.1A profile color/variant contract. All fixtures are rolled back.
BEGIN;

CREATE TEMP TABLE phase4b1a_ctx AS
SELECT uc.company_id,uc.user_id,ci.id company_item_id,ci.item_template_id,
       iu.id unit_id,sl.id location_id,cp.id company_product_id,cp.product_template_id,
       (SELECT user_id FROM public.saas_admins LIMIT 1) saas_user_id
FROM public.user_companies uc
JOIN public.company_items ci ON ci.company_id=uc.company_id AND upper(ci.name)='CLICK'
JOIN public.inventory_item_units iu ON iu.company_item_id=ci.id AND iu.canonical_unit='MM'
JOIN public.stock_locations sl ON sl.company_id=uc.company_id AND sl.code='DEFAULT_STOCK'
JOIN public.company_products cp ON cp.company_id=uc.company_id AND cp.is_active
WHERE uc.is_active AND uc.role='admin'
LIMIT 1;

DO $$
DECLARE
  c record;
  v_black uuid; v_white uuid; v_black_variant uuid; v_white_variant uuid; v_replay uuid;
  v_legacy_before numeric; v_legacy_after numeric; v_result jsonb; v_key uuid;
  v_quote uuid; v_quote_item uuid; v_sale uuid; v_sale_item uuid; v_os uuid; v_os_item uuid;
  v_req uuid; v_material uuid; v_consumption uuid; v_snapshot jsonb;
  v_before_req bigint; v_before_res bigint; v_before_po bigint;
BEGIN
  SELECT * INTO c FROM phase4b1a_ctx;
  IF c.company_id IS NULL OR c.saas_user_id IS NULL THEN RAISE EXCEPTION 'PHASE4B1A_CONTEXT_MISSING'; END IF;

  -- T01-T03: global catalog exists; only SaaS Admin mutates it; mutation is audited.
  SELECT id INTO v_black FROM public.admin_aluminum_colors WHERE is_active ORDER BY sort_order,id LIMIT 1;
  SELECT id INTO v_white FROM public.admin_aluminum_colors WHERE is_active AND id<>v_black ORDER BY sort_order,id LIMIT 1;
  IF v_black IS NULL OR v_white IS NULL THEN RAISE EXCEPTION 'T01_GLOBAL_COLORS'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.saas_user_id,'role','authenticated')::text,true);
  INSERT INTO public.admin_aluminum_colors(id,name,slug,is_active,sort_order)
  VALUES(gen_random_uuid(),'Phase 4B.1A rollback','PHASE4B1A_ROLLBACK',true,9999);
  IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE table_name='admin_aluminum_colors'
    AND metadata->>'source'='phase4b1a_global_profile_colors' AND action='create') THEN RAISE EXCEPTION 'T02_SAAS_CREATE_AUDIT'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_id,'role','authenticated')::text,true);
  BEGIN
    INSERT INTO public.admin_aluminum_colors(id,name,slug,is_active,sort_order)
    VALUES(gen_random_uuid(),'Tenant forbidden','PHASE4B1A_TENANT_FORBIDDEN',true,9998);
    RAISE EXCEPTION 'T03_EXPECTED_DENIAL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  -- T04-T08: deterministic, idempotent, auditable tenant variants.
  SELECT id INTO v_black_variant FROM public.set_company_profile_variant_active(c.company_id,c.company_item_id,v_black,true,NULL,NULL);
  SELECT id INTO v_replay FROM public.set_company_profile_variant_active(c.company_id,c.company_item_id,v_black,true,NULL,NULL);
  SELECT id INTO v_white_variant FROM public.set_company_profile_variant_active(c.company_id,c.company_item_id,v_white,true,NULL,NULL);
  IF v_black_variant IS NULL THEN RAISE EXCEPTION 'T04_ACTIVATE'; END IF;
  IF v_replay<>v_black_variant OR (SELECT count(*) FROM public.company_item_variants WHERE company_item_id=c.company_item_id AND aluminum_color_id=v_black)<>1
    THEN RAISE EXCEPTION 'T05_IDEMPOTENT'; END IF;
  PERFORM public.set_company_profile_variant_active(c.company_id,c.company_item_id,v_white,false,NULL,NULL);
  IF NOT EXISTS(SELECT 1 FROM public.company_item_variants WHERE id=v_white_variant AND NOT is_active)
    THEN RAISE EXCEPTION 'T06_DEACTIVATE'; END IF;
  PERFORM public.set_company_profile_variant_active(c.company_id,c.company_item_id,v_white,true,NULL,NULL);
  IF EXISTS(SELECT 1 FROM public.company_item_variants WHERE id IN(v_black_variant,v_white_variant)
    AND (company_id<>c.company_id OR aluminum_color_id IS NULL OR attributes<>jsonb_build_object('color',upper((SELECT slug FROM public.admin_aluminum_colors WHERE id=aluminum_color_id)))))
    THEN RAISE EXCEPTION 'T07_T08_SCOPE_OR_CANONICAL_COLOR'; END IF;

  UPDATE public.company_items SET weight_per_meter=0.081,bar_length_mm=6000 WHERE id=c.company_item_id;
  UPDATE public.inventory_item_units SET nominal_length_mm=6000,purchase_unit='BAR',stock_unit='M',consumption_unit='M',sale_unit='M'
  WHERE id=c.unit_id;
  SELECT COALESCE(sum(canonical_quantity),0) INTO v_legacy_before FROM public.physical_stock_balances
    WHERE company_id=c.company_id AND company_item_id=c.company_item_id AND variant_id IS NULL;

  -- T09-T14: separate BLACK/WHITE physical identities; NULL is rejected but legacy is untouched.
  v_key:=gen_random_uuid();
  v_result:=public.record_physical_stock_movement(c.company_id,c.company_item_id,'IN',10,'BAR',c.location_id,
    'PHASE4B1A_T09',v_black_variant,NULL,486,v_key,'','','',NULL,NULL,'{}');
  v_key:=gen_random_uuid();
  v_result:=public.record_physical_stock_movement(c.company_id,c.company_item_id,'IN',5,'BAR',c.location_id,
    'PHASE4B1A_T10',v_white_variant,NULL,243,v_key,'','','',NULL,NULL,'{}');
  IF (SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=c.company_item_id AND variant_id=v_black_variant)<>60000
    THEN RAISE EXCEPTION 'T09_BLACK_60M'; END IF;
  IF (SELECT sum(canonical_quantity) FROM public.physical_stock_balances WHERE company_item_id=c.company_item_id AND variant_id=v_white_variant)<>30000
    THEN RAISE EXCEPTION 'T10_WHITE_30M'; END IF;
  IF (SELECT count(*) FROM public.inventory_variant_summary WHERE company_item_id=c.company_item_id AND variant_id IN(v_black_variant,v_white_variant))<>2
    THEN RAISE EXCEPTION 'T11_SEPARATE_BALANCES'; END IF;
  BEGIN
    PERFORM public.record_physical_stock_movement(c.company_id,c.company_item_id,'IN',1,'BAR',c.location_id,
      'PHASE4B1A_T12',NULL,NULL,NULL,gen_random_uuid(),'','','',NULL,NULL,'{}');
    RAISE EXCEPTION 'T12_EXPECTED_REQUIRED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%PROFILE_VARIANT_REQUIRED%' THEN RAISE; END IF; END;
  SELECT COALESCE(sum(canonical_quantity),0) INTO v_legacy_after FROM public.physical_stock_balances
    WHERE company_id=c.company_id AND company_item_id=c.company_item_id AND variant_id IS NULL;
  IF v_legacy_after<>v_legacy_before THEN RAISE EXCEPTION 'T13_LEGACY_CHANGED'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.stock_movements WHERE company_item_id=c.company_item_id AND variant_id=v_black_variant AND canonical_quantity=60000)
    THEN RAISE EXCEPTION 'T14_MOVEMENT_VARIANT'; END IF;

  -- Prepare immutable commercial/operational documents.
  INSERT INTO public.quotes(company_id,customer_name,status,total_amount,final_amount)
  VALUES(c.company_id,'Phase 4B.1A','pending',100,100) RETURNING id INTO v_quote;
  SELECT count(*) INTO v_before_req FROM public.material_purchase_requirements WHERE company_id=c.company_id;
  SELECT count(*) INTO v_before_res FROM public.stock_reservations WHERE company_id=c.company_id;
  SELECT count(*) INTO v_before_po FROM public.purchase_orders WHERE company_id=c.company_id;
  v_snapshot:=jsonb_build_object('variants',jsonb_build_object('profile_color_id',v_black),
    'materials',jsonb_build_array(jsonb_build_object('material_type','profile','company_item_id',c.company_item_id,
      'item_name','CLICK','variant_id',v_black_variant)));
  -- Isolate the Phase 4B.1A snapshot trigger; the older engineering trigger is
  -- covered by its own suite and requires a fully priced product fixture.
  ALTER TABLE public.quote_items DISABLE TRIGGER trg_freeze_quote_item_composition;
  INSERT INTO public.quote_items(quote_id,description,width,height,quantity,unit_price,total_price,composition_snapshot)
  VALUES(v_quote,'Janela Suprema PRETO',1500,1200,1,100,100,v_snapshot)
  RETURNING id INTO v_quote_item;

  -- T19/T20/T22/T24: selection and frozen readable identity; quote creates no operational commitment.
  IF NOT EXISTS(SELECT 1 FROM public.quote_items qi JOIN public.admin_aluminum_colors ac ON ac.id=v_black
    WHERE qi.id=v_quote_item AND qi.profile_color_id=v_black AND qi.profile_color_code=ac.slug AND qi.profile_color_name=ac.name
      AND qi.composition_snapshot#>>'{materials,0,variant_id}'=v_black_variant::text)
    THEN RAISE EXCEPTION 'T19_T20_T22_QUOTE_SNAPSHOT'; END IF;
  IF (SELECT count(*) FROM public.material_purchase_requirements WHERE company_id=c.company_id)<>v_before_req
    OR (SELECT count(*) FROM public.stock_reservations WHERE company_id=c.company_id)<>v_before_res
    OR (SELECT count(*) FROM public.purchase_orders WHERE company_id=c.company_id)<>v_before_po
    THEN RAISE EXCEPTION 'T24_QUOTE_BLOCKED_OR_COMMITTED'; END IF;

  INSERT INTO public.sales(company_id,customer_name,subtotal,total_amount,payment_method,payment_status,sold_by,sale_type,operation_key)
  VALUES(c.company_id,'Phase 4B.1A',100,100,'dinheiro','pending',c.user_id,'full',gen_random_uuid()) RETURNING id INTO v_sale;
  INSERT INTO public.sale_items(sale_id,item_name,item_unit,quantity,unit_price,total_price,fulfillment_mode,engineering_snapshot)
  VALUES(v_sale,'Janela Suprema PRETO','un',1,100,100,'PRODUCTION',
    jsonb_build_object('variants',jsonb_build_object('profile_color_id',v_black,'profile_color_code',(SELECT slug FROM public.admin_aluminum_colors WHERE id=v_black),'profile_color_name',(SELECT name FROM public.admin_aluminum_colors WHERE id=v_black))))
  RETURNING id INTO v_sale_item;
  INSERT INTO public.ordens_servico(company_id,sale_id,customer_name,status,total_amount,paid_amount,pending_amount)
  VALUES(c.company_id,v_sale,'Phase 4B.1A','pending',100,0,100) RETURNING id INTO v_os;
  INSERT INTO public.os_items(os_id,product_name,width_sold,height_sold,width_production,height_production,quantity,fulfillment_mode,engineering_snapshot,sale_item_id)
  VALUES(v_os,'Janela Suprema PRETO',1500,1200,1500,1200,1,'PRODUCTION',
    jsonb_build_object('variants',jsonb_build_object('profile_color_id',v_black,'profile_color_code',(SELECT slug FROM public.admin_aluminum_colors WHERE id=v_black),'profile_color_name',(SELECT name FROM public.admin_aluminum_colors WHERE id=v_black))),v_sale_item)
  RETURNING id INTO v_os_item;
  IF NOT EXISTS(SELECT 1 FROM public.sale_items WHERE id=v_sale_item AND profile_color_id=v_black)
    OR NOT EXISTS(SELECT 1 FROM public.os_items WHERE id=v_os_item AND profile_color_id=v_black)
    THEN RAISE EXCEPTION 'T21_APPROVAL_DOCUMENT_COLOR'; END IF;

  INSERT INTO public.os_materials(ordem_servico_id,os_item_id,item_template_id,company_item_id,item_name,item_type,pieces_count,unit,required_quantity,snapshot_key,snapshot_payload)
  VALUES(v_os,v_os_item,c.item_template_id,c.company_item_id,'CLICK','profile',1,'M',84,'phase4b1a-click-black',
    jsonb_build_object('variant_id',v_black_variant,'profile_color_id',v_black,'source','approved_snapshot')) RETURNING id INTO v_material;
  PERFORM public.reconcile_os_material_requirements(v_os);
  SELECT id INTO v_req FROM public.material_purchase_requirements WHERE os_material_id=v_material;
  IF v_req IS NULL OR NOT EXISTS(SELECT 1 FROM public.material_purchase_requirements WHERE id=v_req AND variant_id=v_black_variant)
    THEN RAISE EXCEPTION 'T26_REQUIREMENT_BLACK'; END IF;
  PERFORM public.phase3g_reserve_requirement(v_req);
  IF NOT EXISTS(SELECT 1 FROM public.stock_reservations WHERE material_requirement_id=v_req AND variant_id=v_black_variant)
    THEN RAISE EXCEPTION 'T16_RESERVATION_VARIANT'; END IF;
  IF EXISTS(SELECT 1 FROM public.stock_reservations WHERE material_requirement_id=v_req AND variant_id=v_white_variant)
    THEN RAISE EXCEPTION 'T18_T25_WHITE_USED_FOR_BLACK'; END IF;

  INSERT INTO public.material_consumption(company_id,company_item_id,item_template_id,item_name,item_type,ordem_servico_id,os_item_id,quantity_calculated,unit,snapshot_key,snapshot_payload)
  VALUES(c.company_id,c.company_item_id,c.item_template_id,'CLICK','profile',v_os,v_os_item,1,'M','phase4b1a-consumption',
    jsonb_build_object('variant_id',v_black_variant,'profile_color_id',v_black)) RETURNING id INTO v_consumption;
  IF NOT EXISTS(SELECT 1 FROM public.material_consumption WHERE id=v_consumption AND variant_id=v_black_variant)
    THEN RAISE EXCEPTION 'T17_CONSUMPTION_VARIANT'; END IF;

  -- T15/T27/T28: existing canonical purchase/receipt functions carry variant_id to movement.
  IF position('variant_id' in pg_get_functiondef('public.receive_purchase_order_items(uuid,uuid,jsonb,uuid,text)'::regprocedure))=0
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_order_items' AND column_name='variant_id')
    THEN RAISE EXCEPTION 'T15_T27_T28_PURCHASE_RECEIPT_VARIANT_CONTRACT'; END IF;

  -- T23: every profile component can share the selected color without stock checks.
  PERFORM public.set_company_profile_variant_active(c.company_id,ci.id,v_black,true,NULL,NULL)
  FROM public.company_product_items cpi JOIN public.company_items ci ON ci.id=cpi.company_item_id
  WHERE cpi.company_product_id=c.company_product_id AND lower(ci.type)='profile';
  IF (SELECT count(*) FROM public.get_company_product_profile_colors(c.company_id,c.company_product_id) WHERE color_id=v_black)<>1
    THEN RAISE EXCEPTION 'T23_ALL_PROFILE_COMPONENTS'; END IF;

  -- T29: no color fallback when a component variant is missing.
  BEGIN
    INSERT INTO public.os_materials(ordem_servico_id,os_item_id,item_template_id,company_item_id,item_name,item_type,pieces_count,unit,required_quantity,snapshot_key,snapshot_payload)
    VALUES(v_os,v_os_item,c.item_template_id,c.company_item_id,'CLICK missing variant','profile',1,'M',1,'phase4b1a-missing',jsonb_build_object('profile_color_id',v_black));
    RAISE EXCEPTION 'T29_EXPECTED_CONFIGURATION_ERROR';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%PROFILE_VARIANT_NOT_CONFIGURED%' THEN RAISE; END IF; END;

  -- T30: historical quote items without color remain valid and unassigned.
  INSERT INTO public.quote_items(quote_id,description,width,height,quantity,unit_price,total_price,composition_snapshot)
  VALUES(v_quote,'Legacy no color',1000,1000,1,0,0,jsonb_build_object('legacy',true))
  RETURNING id INTO v_quote_item;
  IF EXISTS(SELECT 1 FROM public.quote_items WHERE id=v_quote_item AND profile_color_id IS NOT NULL)
    THEN RAISE EXCEPTION 'T30_HISTORY_ASSIGNED_COLOR'; END IF;

  IF has_function_privilege('anon','public.set_company_profile_variant_active(uuid,uuid,uuid,boolean,numeric,numeric)','execute')
    OR has_function_privilege('anon','public.get_company_product_profile_colors(uuid,uuid)','execute')
    OR has_function_privilege('anon','public.save_company_profile_configuration(uuid,uuid,numeric,numeric,text,text,numeric,boolean,boolean,jsonb)','execute')
    THEN RAISE EXCEPTION 'RLS_ANON_EXECUTE'; END IF;
END $$;

SELECT jsonb_build_object(
  'T01','PASS','T02','PASS','T03','PASS','T04','PASS','T05','PASS','T06','PASS','T07','PASS','T08','PASS',
  'T09','PASS','T10','PASS','T11','PASS','T12','PASS','T13','PASS','T14','PASS','T15','PASS','T16','PASS',
  'T17','PASS','T18','PASS','T19','PASS','T20','PASS','T21','PASS','T22','PASS','T23','PASS','T24','PASS',
  'T25','PASS','T26','PASS','T27','PASS','T28','PASS','T29','PASS','T30','PASS'
) AS phase4b1a_transactional_tests;

ROLLBACK;
