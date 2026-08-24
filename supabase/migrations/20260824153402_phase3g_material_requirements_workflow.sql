-- Phase 3G: transactional reconciliation, consolidation and physical receipt.

CREATE OR REPLACE FUNCTION public.phase3g_refresh_requirement_compat(_requirement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row FROM public.material_purchase_requirements_summary
  WHERE id=_requirement_id;
  IF v_row.id IS NULL THEN RETURN; END IF;
  UPDATE public.os_materials SET procurement_status=CASE
    WHEN v_row.lifecycle_status='CANCELLED' THEN 'cancelled'
    WHEN v_row.shortage_canonical_quantity=0 AND v_row.received_canonical_quantity>0 THEN 'received'
    WHEN v_row.shortage_canonical_quantity=0 THEN 'in_stock'
    WHEN v_row.open_order_canonical_quantity>0 AND v_row.reserved_canonical_quantity>0 THEN 'partial'
    WHEN v_row.open_order_canonical_quantity>0 THEN 'ordered'
    WHEN v_row.reserved_canonical_quantity>0 THEN 'partial'
    ELSE 'pending_purchase' END
  WHERE id=v_row.os_material_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase3g_reserve_requirement(_requirement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_req public.material_purchase_requirements;
  v_reserved numeric;
  v_remaining numeric;
  v_over numeric;
  v_take numeric;
  v_available numeric;
  v_balance record;
  v_reservation record;
  v_created integer:=0;
  v_updated integer:=0;
BEGIN
  SELECT * INTO v_req FROM public.material_purchase_requirements
  WHERE id=_requirement_id FOR UPDATE;
  IF v_req.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='MATERIAL_REQUIREMENT_NOT_FOUND';
  END IF;
  IF v_req.lifecycle_status='CANCELLED' THEN
    RETURN jsonb_build_object('success',true,'cancelled',true,'requirement_id',v_req.id);
  END IF;

  SELECT COALESCE(sum(canonical_quantity),0) INTO v_reserved
  FROM public.stock_reservations
  WHERE material_requirement_id=v_req.id AND status='reserved';

  v_over:=greatest(v_reserved-v_req.required_canonical_quantity,0);
  IF v_over>0 THEN
    FOR v_reservation IN
      SELECT * FROM public.stock_reservations
      WHERE material_requirement_id=v_req.id AND status='reserved'
      ORDER BY reserved_at DESC,id DESC FOR UPDATE
    LOOP
      EXIT WHEN v_over<=0;
      v_take:=least(v_over,v_reservation.canonical_quantity);
      IF v_take>=v_reservation.canonical_quantity THEN
        UPDATE public.stock_reservations SET status='cancelled',cancelled_at=now(),updated_at=now()
        WHERE id=v_reservation.id;
      ELSE
        UPDATE public.stock_reservations SET
          quantity_reserved=quantity_reserved-v_take,
          canonical_quantity=canonical_quantity-v_take,updated_at=now()
        WHERE id=v_reservation.id;
      END IF;
      v_over:=v_over-v_take;
    END LOOP;
  END IF;

  SELECT COALESCE(sum(canonical_quantity),0) INTO v_reserved
  FROM public.stock_reservations
  WHERE material_requirement_id=v_req.id AND status='reserved';
  v_remaining:=greatest(v_req.required_canonical_quantity-v_reserved,0);

  FOR v_balance IN
    SELECT pb.*
    FROM public.physical_stock_balances pb
    JOIN public.stock_locations sl ON sl.id=pb.location_id
    WHERE pb.company_id=v_req.company_id
      AND pb.company_item_id=v_req.company_item_id
      AND pb.variant_id IS NOT DISTINCT FROM v_req.variant_id
      AND pb.canonical_quantity>0 AND NOT pb.needs_review
      AND sl.is_active AND NOT sl.needs_review
    ORDER BY sl.code,pb.lot_code,pb.created_at,pb.id
    FOR UPDATE OF pb
  LOOP
    EXIT WHEN v_remaining<=0;
    SELECT v_balance.canonical_quantity-COALESCE(sum(sr.canonical_quantity),0)
    INTO v_available
    FROM public.stock_reservations sr
    WHERE sr.physical_stock_balance_id=v_balance.id AND sr.status='reserved';
    v_take:=least(v_remaining,greatest(v_available,0));
    IF v_take<=0 THEN CONTINUE; END IF;
    SELECT * INTO v_reservation FROM public.stock_reservations
    WHERE material_requirement_id=v_req.id
      AND physical_stock_balance_id=v_balance.id AND status='reserved'
    FOR UPDATE;
    IF v_reservation.id IS NULL THEN
      INSERT INTO public.stock_reservations(
        company_id,company_item_id,ordem_servico_id,quantity_reserved,unit,status,
        created_by,canonical_quantity,canonical_unit,conversion_factor,variant_id,
        location_id,material_requirement_id,physical_stock_balance_id
      ) VALUES (
        v_req.company_id,v_req.company_item_id,v_req.ordem_servico_id,v_take,
        v_req.canonical_unit,'reserved',auth.uid(),v_take,v_req.canonical_unit,1,
        v_req.variant_id,v_balance.location_id,v_req.id,v_balance.id
      );
      v_created:=v_created+1;
    ELSE
      UPDATE public.stock_reservations SET
        quantity_reserved=quantity_reserved+v_take,
        canonical_quantity=canonical_quantity+v_take,updated_at=now()
      WHERE id=v_reservation.id;
      v_updated:=v_updated+1;
    END IF;
    v_remaining:=v_remaining-v_take;
  END LOOP;
  PERFORM public.phase3g_refresh_requirement_compat(v_req.id);
  RETURN jsonb_build_object('success',true,'requirement_id',v_req.id,
    'required_canonical_quantity',v_req.required_canonical_quantity,
    'reserved_canonical_quantity',v_req.required_canonical_quantity-v_remaining,
    'shortage_canonical_quantity',v_remaining,'created_reservations',v_created,
    'updated_reservations',v_updated);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_os_material_requirements(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user_id uuid:=auth.uid();
  v_os public.ordens_servico;
  v_material record;
  v_units public.inventory_item_units;
  v_requirement_id uuid;
  v_variant_id uuid;
  v_factor numeric;
  v_required_canonical numeric;
  v_result jsonb;
  v_results jsonb:='[]'::jsonb;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id=_ordem_servico_id FOR UPDATE;
  IF v_user_id IS NULL OR v_os.id IS NULL
     OR NOT public.user_belongs_to_company(v_user_id,v_os.company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;

  FOR v_material IN
    SELECT om.*,oi.sale_item_id,oi.fulfillment_mode
    FROM public.os_materials om
    JOIN public.os_items oi ON oi.id=om.os_item_id AND oi.os_id=om.ordem_servico_id
    WHERE om.ordem_servico_id=_ordem_servico_id
      AND oi.fulfillment_mode='PRODUCTION'
    ORDER BY om.id FOR UPDATE OF om
  LOOP
    IF v_material.company_item_id IS NULL OR COALESCE(v_material.required_quantity,0)<=0 THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_MATERIAL_REQUIREMENT';
    END IF;
    SELECT * INTO v_units FROM public.inventory_item_units
    WHERE company_id=v_os.company_id AND company_item_id=v_material.company_item_id;
    IF v_units.id IS NULL OR v_units.legacy_status<>'CONFIGURED' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_PURCHASE_CONVERSION';
    END IF;
    v_variant_id:=NULLIF(v_material.snapshot_payload->>'variant_id','')::uuid;
    v_factor:=public.phase3f_unit_factor(v_material.company_item_id,v_material.unit,NULL,NULL);
    v_required_canonical:=v_material.required_quantity*v_factor;
    INSERT INTO public.material_purchase_requirements(
      company_id,ordem_servico_id,os_item_id,os_material_id,sale_id,sale_item_id,
      company_item_id,item_template_id,variant_id,required_quantity,required_unit,
      required_canonical_quantity,canonical_unit,consumption_unit,purchase_unit,
      purchase_to_canonical_factor,consumption_to_canonical_factor,
      purchase_allows_fractional,priority,lifecycle_status,created_by
    ) VALUES (
      v_os.company_id,v_os.id,v_material.os_item_id,v_material.id,v_os.sale_id,
      v_material.sale_item_id,v_material.company_item_id,v_material.item_template_id,
      v_variant_id,v_material.required_quantity,v_material.unit,v_required_canonical,
      v_units.canonical_unit,v_units.consumption_unit,v_units.purchase_unit,
      v_units.purchase_to_canonical_factor,v_units.consumption_to_canonical_factor,
      public.phase3f_normalize_unit(v_units.purchase_unit) NOT IN ('BAR','UNIT'),
      CASE WHEN upper(COALESCE(v_os.priority,'NORMAL'))='URGENT' THEN 'URGENT' ELSE 'NORMAL' END,
      'ACTIVE',v_user_id
    ) ON CONFLICT (os_material_id) DO UPDATE SET
      required_quantity=EXCLUDED.required_quantity,
      required_unit=EXCLUDED.required_unit,
      required_canonical_quantity=EXCLUDED.required_canonical_quantity,
      variant_id=EXCLUDED.variant_id,priority=EXCLUDED.priority,
      lifecycle_status='ACTIVE',cancelled_at=NULL,cancelled_by=NULL,updated_at=now()
    RETURNING id INTO v_requirement_id;
    v_result:=public.phase3g_reserve_requirement(v_requirement_id);
    v_results:=v_results||jsonb_build_array(v_result);
  END LOOP;

  UPDATE public.material_purchase_requirements r SET
    lifecycle_status='CANCELLED',cancelled_at=now(),cancelled_by=v_user_id
  WHERE r.ordem_servico_id=v_os.id AND r.lifecycle_status='ACTIVE'
    AND NOT EXISTS (SELECT 1 FROM public.os_materials om WHERE om.id=r.os_material_id);
  UPDATE public.stock_reservations sr SET status='cancelled',cancelled_at=now(),updated_at=now()
  WHERE sr.ordem_servico_id=v_os.id AND sr.status='reserved'
    AND EXISTS (SELECT 1 FROM public.material_purchase_requirements r
      WHERE r.id=sr.material_requirement_id AND r.lifecycle_status='CANCELLED');

  RETURN jsonb_build_object('success',true,'ordem_servico_id',v_os.id,'requirements',v_results,
    'sufficient',NOT EXISTS(SELECT 1 FROM public.material_purchase_requirements_summary s
      WHERE s.ordem_servico_id=v_os.id AND s.lifecycle_status='ACTIVE'
        AND s.shortage_canonical_quantity>0));
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_os_materials(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path=''
AS $$ SELECT public.reconcile_os_material_requirements(_ordem_servico_id); $$;

CREATE OR REPLACE FUNCTION public.get_os_material_availability(_ordem_servico_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE v_user uuid:=auth.uid(); v_company uuid; v_items jsonb;
BEGIN
  SELECT company_id INTO v_company FROM public.ordens_servico WHERE id=_ordem_servico_id;
  IF v_user IS NULL OR v_company IS NULL
     OR NOT public.user_belongs_to_company(v_user,v_company) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'requirement_id',s.id,'os_material_id',s.os_material_id,
    'company_item_id',s.company_item_id,'item_template_id',s.item_template_id,
    'variant_id',s.variant_id,'item_name',s.item_name,'unit',s.consumption_unit,
    'canonical_unit',s.canonical_unit,'required',s.required_canonical_quantity,
    'reserved_for_os',s.reserved_canonical_quantity,
    'missing',s.shortage_canonical_quantity,'status',s.status,
    'sufficient',s.shortage_canonical_quantity=0
  ) ORDER BY s.item_name),'[]'::jsonb) INTO v_items
  FROM public.material_purchase_requirements_summary s
  WHERE s.ordem_servico_id=_ordem_servico_id AND s.lifecycle_status='ACTIVE';
  RETURN jsonb_build_object('success',true,'sufficient',NOT EXISTS(
    SELECT 1 FROM public.material_purchase_requirements_summary s
    WHERE s.ordem_servico_id=_ordem_servico_id AND s.lifecycle_status='ACTIVE'
      AND s.shortage_canonical_quantity>0),'items',v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_purchase_order_from_requirements(
  _company_id uuid,_supplier_name text,_items jsonb,
  _expected_delivery date DEFAULT NULL,_notes text DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid(); v_order_id uuid; v_order_number integer;
  v_existing record; v_line jsonb; v_alloc jsonb; v_req record; v_units record;
  v_item record; v_po_item_id uuid; v_variant uuid; v_purchase_qty numeric;
  v_ordered_canonical numeric; v_alloc_total numeric; v_alloc_qty numeric;
  v_estimated numeric; v_total numeric:=0; v_items jsonb:='[]'::jsonb;
BEGIN
  IF v_user IS NULL OR NOT public.phase3g_user_can(v_user,_company_id,'purchases','create') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items)<>'array' OR jsonb_array_length(_items)=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='PURCHASE_LINES_REQUIRED';
  END IF;
  IF _idempotency_key IS NOT NULL THEN
    SELECT id,order_number INTO v_existing FROM public.purchase_orders
    WHERE company_id=_company_id AND idempotency_key=_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('success',true,'idempotent',true,
      'purchase_order_id',v_existing.id,'order_number',v_existing.order_number); END IF;
  END IF;
  INSERT INTO public.purchase_orders(company_id,ordem_servico_id,supplier_name,status,
    total_estimated,expected_delivery,notes,created_by,idempotency_key)
  VALUES(_company_id,NULL,NULLIF(btrim(_supplier_name),''),'pending',0,
    _expected_delivery,_notes,v_user,_idempotency_key)
  RETURNING id,order_number INTO v_order_id,v_order_number;

  FOR v_line IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    SELECT ci.*,it.name template_name INTO v_item FROM public.company_items ci
    LEFT JOIN public.item_templates it ON it.id=ci.item_template_id
    WHERE ci.id=NULLIF(v_line->>'company_item_id','')::uuid
      AND ci.company_id=_company_id AND ci.is_active;
    IF v_item.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_COMPANY_ITEM'; END IF;
    v_variant:=NULLIF(v_line->>'variant_id','')::uuid;
    IF v_variant IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.company_item_variants civ
      WHERE civ.id=v_variant AND civ.company_id=_company_id AND civ.company_item_id=v_item.id AND civ.is_active)
    THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='VARIANT_STOCK_MISMATCH'; END IF;
    SELECT * INTO v_units FROM public.inventory_item_units
    WHERE company_id=_company_id AND company_item_id=v_item.id AND legacy_status='CONFIGURED';
    v_purchase_qty:=NULLIF(v_line->>'purchase_quantity','')::numeric;
    IF v_units.id IS NULL OR v_purchase_qty IS NULL OR v_purchase_qty<=0
       OR public.phase3f_normalize_unit(v_line->>'purchase_unit')
          <>public.phase3f_normalize_unit(v_units.purchase_unit) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PURCHASE_CONVERSION';
    END IF;
    IF public.phase3f_normalize_unit(v_units.purchase_unit) IN ('BAR','UNIT')
      AND v_purchase_qty<>trunc(v_purchase_qty) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PURCHASE_CONVERSION',
        DETAIL='purchase unit does not allow fractional quantities';
    END IF;
    v_ordered_canonical:=v_purchase_qty*v_units.purchase_to_canonical_factor;
    v_estimated:=COALESCE(NULLIF(v_line->>'estimated_cost','')::numeric,0);
    IF v_estimated<0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PURCHASE_COST'; END IF;
    INSERT INTO public.purchase_order_items(
      purchase_order_id,item_template_id,os_material_id,description,quantity,unit,
      estimated_cost,status,company_item_id,variant_id,purchase_unit,
      purchase_to_canonical_factor,ordered_canonical_quantity,
      purchase_allows_fractional
    ) VALUES(v_order_id,v_item.item_template_id,NULL,COALESCE(v_line->>'description',v_item.name),
      v_purchase_qty,v_units.purchase_unit,v_estimated,'pending',v_item.id,v_variant,
      v_units.purchase_unit,v_units.purchase_to_canonical_factor,v_ordered_canonical,
      public.phase3f_normalize_unit(v_units.purchase_unit) NOT IN ('BAR','UNIT'))
    RETURNING id INTO v_po_item_id;
    v_alloc_total:=0;
    IF jsonb_typeof(v_line->'allocations')<>'array' OR jsonb_array_length(v_line->'allocations')=0 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_ALLOCATION';
    END IF;
    FOR v_alloc IN SELECT value FROM jsonb_array_elements(v_line->'allocations')
    LOOP
      PERFORM 1 FROM public.material_purchase_requirements
      WHERE id=NULLIF(v_alloc->>'requirement_id','')::uuid FOR UPDATE;
      SELECT * INTO v_req FROM public.material_purchase_requirements_summary
      WHERE id=NULLIF(v_alloc->>'requirement_id','')::uuid;
      v_alloc_qty:=NULLIF(v_alloc->>'canonical_quantity','')::numeric;
      IF v_req.id IS NULL OR v_req.company_id<>_company_id
         OR v_req.company_item_id<>v_item.id OR v_req.variant_id IS DISTINCT FROM v_variant
         OR v_req.lifecycle_status<>'ACTIVE' OR COALESCE(v_alloc_qty,0)<=0
         OR v_alloc_qty>v_req.purchase_required_canonical_quantity THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_ALLOCATION';
      END IF;
      INSERT INTO public.purchase_order_item_requirement_allocations(
        company_id,purchase_order_item_id,material_requirement_id,
        allocated_canonical_quantity,created_by
      ) VALUES(_company_id,v_po_item_id,v_req.id,v_alloc_qty,v_user);
      v_alloc_total:=v_alloc_total+v_alloc_qty;
      PERFORM public.phase3g_refresh_requirement_compat(v_req.id);
    END LOOP;
    IF v_alloc_total>v_ordered_canonical THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_ALLOCATION';
    END IF;
    v_total:=v_total+v_estimated;
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'purchase_order_item_id',v_po_item_id,'ordered_canonical_quantity',v_ordered_canonical,
      'allocated_canonical_quantity',v_alloc_total));
  END LOOP;
  UPDATE public.purchase_orders SET total_estimated=v_total WHERE id=v_order_id;
  RETURN jsonb_build_object('success',true,'idempotent',false,
    'purchase_order_id',v_order_id,'order_number',v_order_number,
    'total_estimated',v_total,'items',v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_purchase_order(_purchase_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_po public.purchase_orders;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id=_purchase_order_id FOR UPDATE;
  IF v_po.id IS NULL OR v_user IS NULL
     OR NOT public.phase3g_user_can(v_user,v_po.company_id,'purchase-approval','edit') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF v_po.status='ordered' THEN RETURN jsonb_build_object('success',true,'idempotent',true); END IF;
  IF v_po.status<>'pending' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_PURCHASE_STATUS'; END IF;
  UPDATE public.purchase_orders SET status='ordered',updated_at=now() WHERE id=v_po.id;
  UPDATE public.purchase_order_items SET status='ordered',updated_at=now()
    WHERE purchase_order_id=v_po.id AND status='pending';
  RETURN jsonb_build_object('success',true,'idempotent',false,'purchase_order_id',v_po.id);
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_purchase_order(_purchase_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_po public.purchase_orders; v_req uuid;
BEGIN
  SELECT * INTO v_po FROM public.purchase_orders WHERE id=_purchase_order_id FOR UPDATE;
  IF v_po.id IS NULL OR v_user IS NULL
     OR NOT public.phase3g_user_can(v_user,v_po.company_id,'purchases','edit') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF v_po.status='cancelled' THEN RETURN jsonb_build_object('success',true,'idempotent',true); END IF;
  IF v_po.status='received' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_PURCHASE_STATUS'; END IF;
  UPDATE public.purchase_orders SET status='cancelled',updated_at=now() WHERE id=v_po.id;
  UPDATE public.purchase_order_items SET status='cancelled',updated_at=now()
    WHERE purchase_order_id=v_po.id AND status<>'received';
  UPDATE public.purchase_order_item_requirement_allocations a SET status='CANCELLED'
  WHERE a.purchase_order_item_id IN (SELECT id FROM public.purchase_order_items WHERE purchase_order_id=v_po.id)
    AND a.status IN ('OPEN','PARTIAL');
  FOR v_req IN SELECT DISTINCT a.material_requirement_id
    FROM public.purchase_order_item_requirement_allocations a
    JOIN public.purchase_order_items poi ON poi.id=a.purchase_order_item_id
    WHERE poi.purchase_order_id=v_po.id
  LOOP PERFORM public.phase3g_refresh_requirement_compat(v_req); END LOOP;
  RETURN jsonb_build_object('success',true,'idempotent',false,'purchase_order_id',v_po.id);
END; $$;

CREATE OR REPLACE FUNCTION public.receive_purchase_order_items(
  _purchase_order_id uuid,_location_id uuid,_items jsonb,
  _receipt_key uuid,_document_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid(); v_po public.purchase_orders; v_location public.stock_locations;
  v_line jsonb; v_item public.purchase_order_items; v_delta numeric; v_delta_canonical numeric;
  v_total_cost numeric; v_hash text; v_movement_key uuid; v_movement jsonb;
  v_alloc record; v_alloc_delta numeric; v_remaining numeric; v_req record;
  v_processed integer:=0; v_idempotent integer:=0; v_all_received boolean; v_any_received boolean;
BEGIN
  IF _receipt_key IS NULL OR _items IS NULL OR jsonb_typeof(_items)<>'array'
     OR jsonb_array_length(_items)=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INSUFFICIENT_RECEIPT';
  END IF;
  SELECT * INTO v_po FROM public.purchase_orders WHERE id=_purchase_order_id FOR UPDATE;
  IF v_po.id IS NULL OR v_user IS NULL
     OR NOT public.phase3g_user_can(v_user,v_po.company_id,'purchase-receiving','create')
     OR NOT public.phase3e_can_manage_pricing(v_user,v_po.company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF v_po.status NOT IN ('ordered','partial') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_PURCHASE_STATUS';
  END IF;
  SELECT * INTO v_location FROM public.stock_locations
    WHERE id=_location_id AND company_id=v_po.company_id AND is_active AND NOT needs_review;
  IF v_location.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_LOCATION'; END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO v_item FROM public.purchase_order_items
    WHERE id=NULLIF(v_line->>'purchase_order_item_id','')::uuid
      AND purchase_order_id=v_po.id FOR UPDATE;
    v_delta:=NULLIF(v_line->>'received_quantity','')::numeric;
    v_total_cost:=NULLIF(v_line->>'total_cost','')::numeric;
    IF v_item.id IS NULL OR v_item.company_item_id IS NULL OR COALESCE(v_delta,0)<=0
       OR v_item.status NOT IN ('ordered','partial')
       OR NULLIF(v_line->>'variant_id','')::uuid IS DISTINCT FROM v_item.variant_id
       OR COALESCE(v_item.received_quantity,0)+v_delta>v_item.quantity
       OR COALESCE(v_total_cost,0)<0 THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INSUFFICIENT_RECEIPT';
    END IF;
    v_hash:=md5(_receipt_key::text||v_item.id::text);
    v_movement_key:=(substr(v_hash,1,8)||'-'||substr(v_hash,9,4)||'-'||substr(v_hash,13,4)
      ||'-'||substr(v_hash,17,4)||'-'||substr(v_hash,21,12))::uuid;
    IF EXISTS(SELECT 1 FROM public.stock_movements
      WHERE company_id=v_po.company_id AND idempotency_key=v_movement_key) THEN
      v_idempotent:=v_idempotent+1; CONTINUE;
    END IF;
    v_delta_canonical:=v_delta*v_item.purchase_to_canonical_factor;
    v_movement:=public.record_physical_stock_movement(
      v_po.company_id,v_item.company_item_id,'IN',v_delta,v_item.purchase_unit,
      v_location.id,'Recebimento de pedido de compra',v_item.variant_id,
      v_item.purchase_to_canonical_factor,v_total_cost,v_movement_key,'',v_po.supplier_name,
      COALESCE(_document_reference,'PO-'||v_po.order_number),v_item.width_mm,v_item.height_mm,
      jsonb_build_object('purchase_order_id',v_po.id,'purchase_order_item_id',v_item.id,
        'receipt_key',_receipt_key,'category','compra',
        'reference_type','purchase_order_item','reference_id',v_item.id)
    );
    UPDATE public.purchase_order_items SET
      received_quantity=COALESCE(received_quantity,0)+v_delta,
      received_canonical_quantity=received_canonical_quantity+v_delta_canonical,
      actual_cost=COALESCE(actual_cost,0)+COALESCE(v_total_cost,0),
      status=CASE WHEN COALESCE(received_quantity,0)+v_delta>=quantity THEN 'received' ELSE 'partial' END,
      received_at=CASE WHEN COALESCE(received_quantity,0)+v_delta>=quantity THEN now() ELSE received_at END,
      updated_at=now()
    WHERE id=v_item.id;
    v_remaining:=v_delta_canonical;
    FOR v_alloc IN
      SELECT a.*,r.priority,r.created_at requirement_created_at
      FROM public.purchase_order_item_requirement_allocations a
      JOIN public.material_purchase_requirements r ON r.id=a.material_requirement_id
      WHERE a.purchase_order_item_id=v_item.id AND a.status IN ('OPEN','PARTIAL')
        AND r.lifecycle_status='ACTIVE'
      ORDER BY CASE r.priority WHEN 'URGENT' THEN 0 ELSE 1 END,r.created_at,a.id
      FOR UPDATE OF a
    LOOP
      EXIT WHEN v_remaining<=0;
      SELECT * INTO v_req FROM public.material_purchase_requirements_summary
        WHERE id=v_alloc.material_requirement_id;
      v_alloc_delta:=least(v_remaining,
        v_alloc.allocated_canonical_quantity-v_alloc.received_canonical_quantity,
        v_req.shortage_canonical_quantity);
      IF v_alloc_delta<=0 THEN CONTINUE; END IF;
      UPDATE public.purchase_order_item_requirement_allocations SET
        received_canonical_quantity=received_canonical_quantity+v_alloc_delta,
        status=CASE WHEN received_canonical_quantity+v_alloc_delta>=allocated_canonical_quantity
          THEN 'RECEIVED' ELSE 'PARTIAL' END
      WHERE id=v_alloc.id;
      v_remaining:=v_remaining-v_alloc_delta;
      PERFORM public.phase3g_reserve_requirement(v_alloc.material_requirement_id);
    END LOOP;
    FOR v_req IN
      SELECT r.id FROM public.material_purchase_requirements r
      WHERE r.company_id=v_po.company_id AND r.company_item_id=v_item.company_item_id
        AND r.variant_id IS NOT DISTINCT FROM v_item.variant_id AND r.lifecycle_status='ACTIVE'
      ORDER BY CASE r.priority WHEN 'URGENT' THEN 0 ELSE 1 END,r.created_at,r.id
    LOOP PERFORM public.phase3g_reserve_requirement(v_req.id); END LOOP;
    IF COALESCE(v_item.received_quantity,0)+v_delta>=v_item.quantity THEN
      UPDATE public.purchase_order_item_requirement_allocations SET
        status=CASE WHEN received_canonical_quantity>=allocated_canonical_quantity
          THEN 'RECEIVED' ELSE 'CANCELLED' END
      WHERE purchase_order_item_id=v_item.id AND status IN ('OPEN','PARTIAL');
    END IF;
    v_processed:=v_processed+1;
  END LOOP;

  SELECT bool_and(status IN ('received','cancelled')),bool_or(received_quantity>0)
  INTO v_all_received,v_any_received FROM public.purchase_order_items WHERE purchase_order_id=v_po.id;
  UPDATE public.purchase_orders SET
    status=CASE WHEN v_all_received THEN 'received' WHEN v_any_received THEN 'partial' ELSE status END,
    received_at=CASE WHEN v_all_received THEN now() ELSE received_at END,
    total_actual=(SELECT COALESCE(sum(actual_cost),0) FROM public.purchase_order_items
      WHERE purchase_order_id=v_po.id),updated_at=now()
  WHERE id=v_po.id;
  RETURN jsonb_build_object('success',true,'idempotent',v_processed=0 AND v_idempotent>0,
    'purchase_order_id',v_po.id,'processed_items',v_processed,
    'replayed_items',v_idempotent,'location_id',v_location.id);
END;
$$;

-- Keep the historical signature as an explicit compatibility failure.
CREATE OR REPLACE FUNCTION public.receive_purchase_order_items(
  _purchase_order_id uuid,_items jsonb,_total_actual numeric DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MISSING_LOCATION',
    DETAIL='Use receive_purchase_order_items(purchase_order_id,location_id,items,receipt_key,document_reference)';
END; $$;

CREATE OR REPLACE FUNCTION public.phase3g_refresh_from_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP<>'INSERT' AND OLD.material_requirement_id IS NOT NULL THEN
    PERFORM public.phase3g_refresh_requirement_compat(OLD.material_requirement_id);
  END IF;
  IF TG_OP<>'DELETE' AND NEW.material_requirement_id IS NOT NULL THEN
    PERFORM public.phase3g_refresh_requirement_compat(NEW.material_requirement_id);
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.phase3g_refresh_from_allocation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN PERFORM public.phase3g_refresh_requirement_compat(OLD.material_requirement_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM public.phase3g_refresh_requirement_compat(NEW.material_requirement_id); END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_phase3g_refresh_reservation
AFTER INSERT OR UPDATE OR DELETE ON public.stock_reservations
FOR EACH ROW EXECUTE FUNCTION public.phase3g_refresh_from_reservation();
CREATE TRIGGER trg_phase3g_refresh_allocation
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_item_requirement_allocations
FOR EACH ROW EXECUTE FUNCTION public.phase3g_refresh_from_allocation();

CREATE OR REPLACE FUNCTION public.phase3g_cancel_os_commitments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF lower(NEW.status) IN ('cancelled','cancelada')
     AND lower(OLD.status) NOT IN ('cancelled','cancelada') THEN
    UPDATE public.stock_reservations SET status='cancelled',cancelled_at=now(),updated_at=now()
    WHERE ordem_servico_id=NEW.id AND status='reserved';
    UPDATE public.material_purchase_requirements SET lifecycle_status='CANCELLED',
      cancelled_at=now(),cancelled_by=auth.uid()
    WHERE ordem_servico_id=NEW.id AND lifecycle_status='ACTIVE';
    UPDATE public.purchase_order_item_requirement_allocations a SET status='CANCELLED'
    WHERE a.material_requirement_id IN (
      SELECT id FROM public.material_purchase_requirements WHERE ordem_servico_id=NEW.id
    ) AND a.status IN ('OPEN','PARTIAL');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_phase3g_cancel_os_commitments
AFTER UPDATE OF status ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.phase3g_cancel_os_commitments();

REVOKE ALL ON FUNCTION public.phase3g_refresh_requirement_compat(uuid),
  public.phase3g_reserve_requirement(uuid),public.phase3g_refresh_from_reservation(),
  public.phase3g_refresh_from_allocation(),public.phase3g_cancel_os_commitments()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase3g_refresh_requirement_compat(uuid),
  public.phase3g_reserve_requirement(uuid),public.phase3g_refresh_from_reservation(),
  public.phase3g_refresh_from_allocation(),public.phase3g_cancel_os_commitments()
  TO service_role;

REVOKE ALL ON FUNCTION public.reconcile_os_material_requirements(uuid),
  public.reserve_os_materials(uuid),public.get_os_material_availability(uuid),
  public.create_purchase_order_from_requirements(uuid,text,jsonb,date,text,uuid),
  public.approve_purchase_order(uuid),public.cancel_purchase_order(uuid),
  public.receive_purchase_order_items(uuid,uuid,jsonb,uuid,text),
  public.receive_purchase_order_items(uuid,jsonb,numeric)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_os_material_requirements(uuid),
  public.reserve_os_materials(uuid),public.get_os_material_availability(uuid),
  public.create_purchase_order_from_requirements(uuid,text,jsonb,date,text,uuid),
  public.approve_purchase_order(uuid),public.cancel_purchase_order(uuid),
  public.receive_purchase_order_items(uuid,uuid,jsonb,uuid,text)
  TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order_items(uuid,jsonb,numeric)
  TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
