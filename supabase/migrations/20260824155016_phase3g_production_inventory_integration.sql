-- Phase 3G: remove the remaining aggregate-stock production path.

DROP INDEX IF EXISTS public.uq_stock_movement_material_consumption;
CREATE INDEX stock_movements_material_consumption_reference_idx
  ON public.stock_movements(reference_id)
  WHERE reference_type IN ('material_consumption','material_requirement')
    AND type='saida' AND category='consumo_producao';

CREATE OR REPLACE FUNCTION public.phase3g_enrich_physical_movement_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE v_metadata jsonb:=COALESCE(NEW.conversion_snapshot->'metadata','{}'::jsonb);
BEGIN
  IF v_metadata ? 'category' THEN NEW.category:=v_metadata->>'category'; END IF;
  IF v_metadata ? 'reference_type' THEN NEW.reference_type:=v_metadata->>'reference_type'; END IF;
  IF NULLIF(v_metadata->>'reference_id','') IS NOT NULL THEN
    NEW.reference_id:=(v_metadata->>'reference_id')::uuid;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_phase3g_enrich_physical_movement_context
BEFORE INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.phase3g_enrich_physical_movement_context();

CREATE OR REPLACE FUNCTION public.complete_os_production(
  _ordem_servico_id uuid,
  _lines jsonb,
  _cancelled_consumption_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_user uuid:=auth.uid();
  v_os public.ordens_servico;
  v_line jsonb;
  v_consumption public.material_consumption;
  v_requirement record;
  v_reservation record;
  v_balance public.physical_stock_balances;
  v_movement jsonb;
  v_first_movement uuid;
  v_consumed integer:=0;
  v_cancel_id uuid;
BEGIN
  IF _lines IS NULL OR jsonb_typeof(_lines)<>'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRODUCTION_LINES';
  END IF;
  SELECT * INTO v_os FROM public.ordens_servico WHERE id=_ordem_servico_id FOR UPDATE;
  IF v_os.id IS NULL OR v_user IS NULL
     OR NOT public.user_belongs_to_company(v_user,v_os.company_id)
     OR NOT public.phase3e_can_manage_pricing(v_user,v_os.company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  IF v_os.status='completed' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status','completed',
      'consumed',(SELECT count(*) FROM public.stock_movements sm
        WHERE sm.company_id=v_os.company_id AND sm.category='consumo_producao'
          AND sm.conversion_snapshot#>>'{metadata,ordem_servico_id}'=v_os.id::text));
  END IF;
  IF v_os.status<>'in_progress' THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_PRODUCTION_STATUS';
  END IF;

  FOREACH v_cancel_id IN ARRAY _cancelled_consumption_ids
  LOOP
    SELECT * INTO v_consumption FROM public.material_consumption
    WHERE id=v_cancel_id AND ordem_servico_id=v_os.id AND company_id=v_os.company_id
      AND status IN ('pending','available') FOR UPDATE;
    IF v_consumption.id IS NULL
       OR COALESCE((v_consumption.snapshot_payload->>'optional')::boolean,false)=false THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MATERIAL_NOT_OPTIONAL';
    END IF;
    UPDATE public.material_consumption SET status='cancelled',stock_reservation_id=NULL
    WHERE id=v_consumption.id;
    UPDATE public.material_purchase_requirements SET lifecycle_status='CANCELLED',
      cancelled_at=now(),cancelled_by=v_user
    WHERE ordem_servico_id=v_os.id AND os_item_id=v_consumption.os_item_id
      AND os_material_id IN (SELECT om.id FROM public.os_materials om
        WHERE om.os_item_id=v_consumption.os_item_id
          AND om.snapshot_key=v_consumption.snapshot_key);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_lines) line
    GROUP BY NULLIF(line->>'consumption_id','')::uuid
    HAVING count(*)>1
  ) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_PRODUCTION_LINES',
      DETAIL='duplicate consumption_id';
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(_lines)
  LOOP
    SELECT * INTO v_consumption FROM public.material_consumption
    WHERE id=NULLIF(v_line->>'consumption_id','')::uuid
      AND ordem_servico_id=v_os.id AND company_id=v_os.company_id
      AND status IN ('pending','available') FOR UPDATE;
    IF v_consumption.id IS NULL OR NULLIF(v_line->>'quantity','') IS NULL
       OR abs(v_consumption.quantity_calculated
         -NULLIF(v_line->>'quantity','')::numeric)>0.000001 THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_PRODUCTION_LINES';
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.material_consumption mc
    WHERE mc.ordem_servico_id=v_os.id AND mc.company_id=v_os.company_id
      AND mc.status IN ('pending','available')
      AND NOT (mc.id=ANY(_cancelled_consumption_ids))
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_lines) line
        WHERE NULLIF(line->>'consumption_id','')::uuid=mc.id)
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_PRODUCTION_LINES',
      DETAIL='Every active snapshot material must be confirmed or explicitly cancelled';
  END IF;

  PERFORM public.reconcile_os_material_requirements(v_os.id);
  IF EXISTS (SELECT 1 FROM public.material_purchase_requirements_summary s
    WHERE s.ordem_servico_id=v_os.id AND s.lifecycle_status='ACTIVE'
      AND s.shortage_canonical_quantity>0) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='MATERIAL_NOT_READY';
  END IF;

  FOR v_requirement IN
    SELECT r.*,mc.id consumption_id
    FROM public.material_purchase_requirements r
    LEFT JOIN public.os_materials om ON om.id=r.os_material_id
    LEFT JOIN public.material_consumption mc
      ON mc.ordem_servico_id=r.ordem_servico_id
      AND mc.os_item_id=r.os_item_id AND mc.snapshot_key=om.snapshot_key
    WHERE r.ordem_servico_id=v_os.id AND r.lifecycle_status='ACTIVE'
    ORDER BY r.id FOR UPDATE OF r
  LOOP
    v_first_movement:=NULL;
    FOR v_reservation IN
      SELECT * FROM public.stock_reservations
      WHERE material_requirement_id=v_requirement.id AND status='reserved'
      ORDER BY location_id,id FOR UPDATE
    LOOP
      SELECT * INTO v_balance FROM public.physical_stock_balances
      WHERE id=v_reservation.physical_stock_balance_id FOR UPDATE;
      IF v_balance.id IS NULL OR v_balance.company_id<>v_os.company_id
         OR v_balance.company_item_id<>v_requirement.company_item_id
         OR v_balance.variant_id IS DISTINCT FROM v_requirement.variant_id THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_RESERVATION_SCOPE';
      END IF;
      v_movement:=public.record_physical_stock_movement(
        v_os.company_id,v_requirement.company_item_id,'OUT',
        v_reservation.canonical_quantity,v_requirement.canonical_unit,
        v_balance.location_id,'Consumo físico de produção',v_requirement.variant_id,
        1,NULL,v_reservation.id,v_balance.lot_code,NULL,NULL,
        v_balance.width_mm,v_balance.height_mm,
        jsonb_build_object('category','consumo_producao',
          'reference_type',CASE WHEN v_requirement.consumption_id IS NULL
            THEN 'material_requirement' ELSE 'material_consumption' END,
          'reference_id',COALESCE(v_requirement.consumption_id,v_requirement.id),
          'material_requirement_id',v_requirement.id,
          'stock_reservation_id',v_reservation.id,
          'ordem_servico_id',v_os.id)
      );
      v_first_movement:=COALESCE(v_first_movement,(v_movement->>'movement_id')::uuid);
      UPDATE public.stock_reservations SET status='consumed',consumed_at=now(),updated_at=now()
      WHERE id=v_reservation.id;
      v_consumed:=v_consumed+1;
    END LOOP;
    IF v_requirement.consumption_id IS NOT NULL THEN
      UPDATE public.material_consumption SET status='consumed',consumed_at=now(),
        stock_movement_id=v_first_movement
      WHERE id=v_requirement.consumption_id;
    END IF;
    UPDATE public.material_purchase_requirements SET lifecycle_status='COMPLETED',updated_at=now()
    WHERE id=v_requirement.id;
    PERFORM public.phase3g_refresh_requirement_compat(v_requirement.id);
  END LOOP;

  UPDATE public.ordens_servico SET status='completed',actual_end=COALESCE(actual_end,current_date),
    current_stage='Finalizado',updated_at=now() WHERE id=v_os.id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','completed',
    'consumed_physical_balances',v_consumed);
END;
$$;

REVOKE ALL ON FUNCTION public.phase3g_enrich_physical_movement_context() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase3g_enrich_physical_movement_context() TO service_role;
REVOKE ALL ON FUNCTION public.complete_os_production(uuid,jsonb,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_os_production(uuid,jsonb,uuid[])
  TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
