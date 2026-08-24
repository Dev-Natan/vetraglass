-- Phase 3G: receipt replay must be detected before mutable quantity/status checks.

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
  SELECT * INTO v_location FROM public.stock_locations
    WHERE id=_location_id AND company_id=v_po.company_id AND is_active AND NOT needs_review;
  IF v_location.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_LOCATION';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO v_item FROM public.purchase_order_items
    WHERE id=NULLIF(v_line->>'purchase_order_item_id','')::uuid
      AND purchase_order_id=v_po.id FOR UPDATE;
    v_delta:=NULLIF(v_line->>'received_quantity','')::numeric;
    v_total_cost:=NULLIF(v_line->>'total_cost','')::numeric;
    IF v_item.id IS NULL OR v_item.company_item_id IS NULL OR COALESCE(v_delta,0)<=0
       OR NULLIF(v_line->>'variant_id','')::uuid IS DISTINCT FROM v_item.variant_id
       OR COALESCE(v_total_cost,0)<0 THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INSUFFICIENT_RECEIPT';
    END IF;

    v_hash:=md5(_receipt_key::text||v_item.id::text);
    v_movement_key:=(substr(v_hash,1,8)||'-'||substr(v_hash,9,4)||'-'||substr(v_hash,13,4)
      ||'-'||substr(v_hash,17,4)||'-'||substr(v_hash,21,12))::uuid;
    IF EXISTS(SELECT 1 FROM public.stock_movements
      WHERE company_id=v_po.company_id AND idempotency_key=v_movement_key) THEN
      v_idempotent:=v_idempotent+1;
      CONTINUE;
    END IF;

    IF v_po.status NOT IN ('ordered','partial')
       OR v_item.status NOT IN ('ordered','partial')
       OR COALESCE(v_item.received_quantity,0)+v_delta>v_item.quantity THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INSUFFICIENT_RECEIPT';
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
    LOOP
      PERFORM public.phase3g_reserve_requirement(v_req.id);
    END LOOP;

    IF COALESCE(v_item.received_quantity,0)+v_delta>=v_item.quantity THEN
      UPDATE public.purchase_order_item_requirement_allocations SET
        status=CASE WHEN received_canonical_quantity>=allocated_canonical_quantity
          THEN 'RECEIVED' ELSE 'CANCELLED' END
      WHERE purchase_order_item_id=v_item.id AND status IN ('OPEN','PARTIAL');
    END IF;
    v_processed:=v_processed+1;
  END LOOP;

  SELECT bool_and(status IN ('received','cancelled')),bool_or(received_quantity>0)
  INTO v_all_received,v_any_received
  FROM public.purchase_order_items WHERE purchase_order_id=v_po.id;
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

REVOKE ALL ON FUNCTION public.receive_purchase_order_items(uuid,uuid,jsonb,uuid,text)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order_items(uuid,uuid,jsonb,uuid,text)
  TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
