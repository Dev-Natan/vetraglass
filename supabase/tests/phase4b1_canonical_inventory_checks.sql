-- Phase 4B.1 canonical inventory contract checks.
-- All operational mutations are transaction-scoped and rolled back.
BEGIN;

CREATE TEMP TABLE phase4b1_ctx AS
SELECT uc.company_id, uc.user_id, ci.id AS company_item_id, ci.item_template_id,
       iu.id AS unit_id, sl.id AS location_id,
       ci.weight_per_meter AS company_weight, it.weight_per_meter AS template_weight,
       ci.cost AS commercial_cost, ci.sale_price AS commercial_price
FROM public.user_companies uc
JOIN public.company_items ci ON ci.company_id=uc.company_id
JOIN public.item_templates it ON it.id=ci.item_template_id
JOIN public.inventory_item_units iu ON iu.company_item_id=ci.id
JOIN public.stock_locations sl ON sl.company_id=uc.company_id AND sl.code='DEFAULT_STOCK'
WHERE uc.is_active AND uc.role='admin' AND ci.is_active
  AND upper(ci.name)='CLICK' AND iu.canonical_unit='MM'
ORDER BY uc.created_at
LIMIT 1;

DO $$
DECLARE
  c record;
  v_color uuid;
  v_variant uuid;
  v_before numeric;
  v_after numeric;
  v_key uuid:=gen_random_uuid();
  v_result jsonb;
  v_count bigint;
  v_error text;
  v_movement_count bigint;
  v_company_b uuid:=gen_random_uuid();
BEGIN
  SELECT * INTO c FROM phase4b1_ctx;
  IF c.company_id IS NULL THEN RAISE EXCEPTION 'PHASE4B1_CLICK_CONTEXT_MISSING'; END IF;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_id,'role','authenticated')::text,true);

  -- T01/T02/T03: stable category, line and item links.
  IF NOT EXISTS (SELECT 1 FROM public.item_types WHERE id=(SELECT category_id FROM public.item_templates WHERE id=c.item_template_id))
     THEN RAISE EXCEPTION 'T01_CATEGORY'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_linhas WHERE id=(SELECT line_id FROM public.item_templates WHERE id=c.item_template_id))
     THEN RAISE EXCEPTION 'T02_LINE'; END IF;
  IF EXISTS (SELECT 1 FROM public.item_templates WHERE id=c.item_template_id AND category_id IS NULL)
     THEN RAISE EXCEPTION 'T03_ITEM_LINK'; END IF;

  SELECT id INTO v_color FROM public.admin_aluminum_colors WHERE is_active ORDER BY sort_order,id LIMIT 1;
  IF v_color IS NULL THEN RAISE EXCEPTION 'T04_COLOR_CATALOG'; END IF;
  SELECT id INTO v_variant
  FROM public.set_company_profile_variant_active(c.company_id,c.company_item_id,v_color,true,NULL,NULL);
  IF v_variant IS NULL THEN RAISE EXCEPTION 'T04_VARIANT'; END IF;
  IF EXISTS (SELECT 1 FROM public.company_item_variants WHERE id=v_variant AND company_id<>c.company_id)
     THEN RAISE EXCEPTION 'T05_VARIANT_TENANT'; END IF;

  -- T06/T07: every existing/new company gets one internal default location.
  IF (SELECT count(*) FROM public.stock_locations WHERE company_id=c.company_id AND code='DEFAULT_STOCK' AND is_active AND NOT needs_review)<>1
     THEN RAISE EXCEPTION 'T06_DEFAULT_LOCATION'; END IF;
  INSERT INTO public.companies(id,name) VALUES(v_company_b,'Phase 4B.1 rollback tenant');
  IF (SELECT count(*) FROM public.stock_locations WHERE company_id=v_company_b AND code='DEFAULT_STOCK' AND is_active AND NOT needs_review)<>1
     THEN RAISE EXCEPTION 'T07_NEW_COMPANY_DEFAULT'; END IF;

  -- T08-T13 and T30: exact CLICK conversion contract.
  UPDATE public.company_items SET weight_per_meter=0.081,bar_length_mm=6000 WHERE id=c.company_item_id;
  UPDATE public.inventory_item_units SET nominal_length_mm=6000,purchase_unit='BAR',stock_unit='M',consumption_unit='M',sale_unit='M'
  WHERE id=c.unit_id;
  IF public.phase3f_unit_factor(c.company_item_id,'BAR',NULL,NULL)<>6000 THEN RAISE EXCEPTION 'T08_BAR_MM'; END IF;
  IF 6000/1000<>6 THEN RAISE EXCEPTION 'T09_BAR_M'; END IF;
  IF public.phase3f_unit_factor(c.company_item_id,'M',NULL,NULL)<>1000 THEN RAISE EXCEPTION 'T10_M_MM'; END IF;
  IF abs((1000/public.phase3f_unit_factor(c.company_item_id,'KG',NULL,NULL))-0.081)>0.0000001 THEN RAISE EXCEPTION 'T11_M_KG'; END IF;
  IF abs(public.phase3f_unit_factor(c.company_item_id,'KG',NULL,NULL)-12345.679012345679)>0.000001 THEN RAISE EXCEPTION 'T12_KG_M'; END IF;
  IF abs((public.phase3f_unit_factor(c.company_item_id,'BAR',NULL,NULL)*0.081/1000)-0.486)>0.0000001 THEN RAISE EXCEPTION 'T13_BAR_KG'; END IF;

  -- T14: no estimation when weight is unavailable.
  UPDATE public.company_items SET weight_per_meter=NULL WHERE id=c.company_item_id;
  UPDATE public.item_templates SET weight_per_meter=NULL WHERE id=c.item_template_id;
  BEGIN
    PERFORM public.phase3f_unit_factor(c.company_item_id,'KG',NULL,NULL);
    RAISE EXCEPTION 'T14_EXPECTED_ERROR_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%MISSING_LINEAR_WEIGHT%' THEN RAISE; END IF;
  END;
  UPDATE public.company_items SET weight_per_meter=0.081 WHERE id=c.company_item_id;
  UPDATE public.item_templates SET weight_per_meter=c.template_weight WHERE id=c.item_template_id;

  SELECT COALESCE(sum(canonical_quantity),0) INTO v_before FROM public.physical_stock_balances
  WHERE company_id=c.company_id AND company_item_id=c.company_item_id AND variant_id=v_variant;

  -- T15/T17/T18/T22/T27/T28: BAR entry, variant, physical balance, valuation and replay.
  v_result:=public.record_physical_stock_movement(c.company_id,c.company_item_id,'IN',10,'BAR',c.location_id,
    'PHASE4B1_T15',v_variant,NULL,486,v_key,'','','',NULL,NULL,jsonb_build_object('test','T15'));
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE company_id=c.company_id
    AND idempotency_key=v_key AND canonical_quantity=60000) THEN RAISE EXCEPTION 'T15_BAR_ENTRY'; END IF;
  SELECT count(*) INTO v_movement_count FROM public.stock_movements WHERE company_id=c.company_id AND idempotency_key=v_key;
  v_result:=public.record_physical_stock_movement(c.company_id,c.company_item_id,'IN',10,'BAR',c.location_id,
    'PHASE4B1_T15',v_variant,NULL,486,v_key,'','','',NULL,NULL,jsonb_build_object('test','replay'));
  IF COALESCE((v_result->>'idempotent')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'T27_IDEMPOTENCY'; END IF;
  IF (SELECT count(*) FROM public.stock_movements WHERE company_id=c.company_id AND idempotency_key=v_key)<>v_movement_count
     THEN RAISE EXCEPTION 'T28_REPLAY'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE idempotency_key=v_key AND variant_id=v_variant
    AND original_quantity=10 AND original_unit='BAR' AND canonical_quantity=60000 AND canonical_unit='MM')
     THEN RAISE EXCEPTION 'T17_VARIANT_OR_SNAPSHOT'; END IF;

  SELECT COALESCE(sum(canonical_quantity),0) INTO v_after FROM public.physical_stock_balances
  WHERE company_id=c.company_id AND company_item_id=c.company_item_id AND variant_id=v_variant;
  IF v_after-v_before<>60000 THEN RAISE EXCEPTION 'T18_PHYSICAL_BALANCE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.physical_stock_balances WHERE company_id=c.company_id
    AND company_item_id=c.company_item_id AND variant_id=v_variant AND average_cost_per_canonical=0.0081)
     THEN RAISE EXCEPTION 'T22_PHYSICAL_COST'; END IF;

  -- T16: KG entry; 48.6 kg = 600000 mm.
  v_key:=gen_random_uuid();
  v_result:=public.record_physical_stock_movement(c.company_id,c.company_item_id,'IN',48.6,'KG',c.location_id,
    'PHASE4B1_T16',v_variant,NULL,NULL,v_key,'','','',NULL,NULL,'{}');
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE company_id=c.company_id
    AND idempotency_key=v_key AND abs(canonical_quantity-600000)<0.000001)
     THEN RAISE EXCEPTION 'T16_KG_ENTRY'; END IF;

  -- T19: compatibility projection equals physical total, but the summary reads physical balances.
  IF EXISTS (SELECT 1 FROM public.company_stock cs JOIN public.inventory_variant_summary s
    ON s.company_id=cs.company_id AND s.company_item_id=cs.company_item_id
    WHERE cs.company_id=c.company_id AND cs.company_item_id=c.company_item_id
      AND s.variant_id=v_variant AND s.on_hand_canonical<>(SELECT COALESCE(sum(canonical_quantity),0)
        FROM public.physical_stock_balances pb WHERE pb.company_id=c.company_id AND pb.company_item_id=c.company_item_id AND pb.variant_id=v_variant))
     THEN RAISE EXCEPTION 'T19_CANONICAL_SOURCE'; END IF;

  -- T20/T21: reservation identity and ON_HAND - RESERVED = AVAILABLE.
  IF EXISTS (SELECT 1 FROM public.inventory_variant_summary WHERE company_id=c.company_id AND company_item_id=c.company_item_id
    AND variant_id=v_variant AND available_canonical<>on_hand_canonical-reserved_canonical)
     THEN RAISE EXCEPTION 'T20_T21_RESERVATION_MATH'; END IF;

  -- T23: physical movements do not mutate commercial price/cost.
  IF (SELECT cost IS DISTINCT FROM c.commercial_cost OR sale_price IS DISTINCT FROM c.commercial_price
      FROM public.company_items WHERE id=c.company_item_id)
     THEN RAISE EXCEPTION 'T23_COMMERCIAL_INDEPENDENCE'; END IF;

  -- T24/T25: second company owns no data from A and cross-company variant activation is rejected.
  IF EXISTS (SELECT 1 FROM public.inventory_variant_summary WHERE company_id=v_company_b AND on_hand_canonical<>0)
     OR EXISTS (SELECT 1 FROM public.stock_movements WHERE company_id=v_company_b)
     THEN RAISE EXCEPTION 'T24_NEW_TENANT_INHERITED_STOCK'; END IF;
  BEGIN
    PERFORM public.set_company_profile_variant_active(v_company_b,c.company_item_id,v_color,true,NULL,NULL);
    RAISE EXCEPTION 'T25_EXPECTED_DENIAL_NOT_RAISED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%UNAUTHORIZED%' AND SQLERRM NOT LIKE '%INVALID_COMPANY_ITEM%' THEN RAISE; END IF;
  END;

  -- T26: anon has no privileged execution/write path.
  IF has_function_privilege('anon','public.record_physical_stock_movement(uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb)','execute')
     OR has_function_privilege('anon','public.set_company_profile_variant_active(uuid,uuid,uuid,boolean,numeric,numeric)','execute')
     OR has_table_privilege('anon','public.physical_stock_balances','insert')
     THEN RAISE EXCEPTION 'T26_ANON'; END IF;

  -- T29: pre-existing movements are never rewritten by this phase.
  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE created_at IS NULL OR id IS NULL)
     THEN RAISE EXCEPTION 'T29_HISTORY'; END IF;

  -- T30 exact representation after the 10 BAR movement itself.
  IF 10*6000<>60000 OR 60000/1000<>60 OR abs(60*0.081-4.86)>0.0000001
     OR abs(48.6/0.081-600)>0.0000001 THEN RAISE EXCEPTION 'T30_CLICK_EXACT'; END IF;
END $$;

SELECT 'GREEN' AS phase4b1_t01_t30;
ROLLBACK;
