-- Phase 3G OS operational identity integration checks.
-- All fixtures are unique to this execution and rolled back.

begin;

create temporary table phase3g_os_context (
  company_id uuid not null,
  user_id uuid not null,
  technical_item_id uuid not null,
  technical_template_id uuid not null,
  operational_item_id uuid not null,
  operational_template_id uuid not null,
  variant_id uuid not null
) on commit drop;

insert into phase3g_os_context
select uc.company_id, uc.user_id, technical.id, technical.item_template_id,
       operational.id, operational.item_template_id, variant.id
from public.user_companies uc
join public.company_items operational
  on operational.company_id=uc.company_id and operational.is_active
join public.company_item_variants variant
  on variant.company_id=uc.company_id
 and variant.company_item_id=operational.id and variant.is_active
join lateral (
  select ci.id,ci.item_template_id
  from public.company_items ci
  where ci.company_id=uc.company_id and ci.is_active
    and ci.item_template_id is not null and lower(ci.type)='glass'
    and ci.id<>operational.id
  order by ci.created_at
  limit 1
) technical on true
where uc.is_active and uc.role='admin'
  and upper(coalesce(operational.pricing_basis,''))='AREA'
  and operational.item_template_id is not null
order by operational.created_at
limit 1;

do $$
begin
  if not exists(select 1 from phase3g_os_context) then
    raise exception 'OS_TEST_CONTEXT_MISSING';
  end if;
end $$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',(select user_id from phase3g_os_context),
    'role','authenticated'
  )::text,
  true
);

do $$
declare
  c phase3g_os_context;
  v_sale uuid;
  v_sale_item uuid;
  v_os uuid;
  v_os_item uuid;
  v_legacy_os_item uuid;
  v_foreign_company uuid;
  v_foreign_item uuid;
  v_snapshot jsonb;
  v_legacy_snapshot jsonb;
  v_bad_snapshot jsonb;
  v_result jsonb;
  v_count bigint;
  v_before_orders bigint;
  v_before_movements bigint;
  v_material record;
  v_consumption record;
  v_piece record;
  v_requirement record;
begin
  select * into c from phase3g_os_context;

  -- OS01/OS02: the migration keeps the authenticated invoker boundary.
  if exists(
    select 1 from information_schema.routine_privileges
    where routine_schema='public' and routine_name='rebuild_os_documents_from_snapshot'
      and grantee='anon' and privilege_type='EXECUTE'
  ) then raise exception 'OS02_ANON_EXECUTE'; end if;
  if not exists(
    select 1 from information_schema.routine_privileges
    where routine_schema='public' and routine_name='rebuild_os_documents_from_snapshot'
      and grantee='authenticated' and privilege_type='EXECUTE'
  ) then raise exception 'OS01_AUTH_EXECUTE'; end if;

  insert into public.sales(
    company_id,customer_name,subtotal,total_amount,payment_method,payment_status,
    sold_by,sale_type,operation_key
  ) values(
    c.company_id,'Phase 3G OS identity',100,100,'dinheiro','pending',
    c.user_id,'full',gen_random_uuid()
  ) returning id into v_sale;
  insert into public.sale_items(
    sale_id,item_name,item_unit,quantity,unit_price,total_price,fulfillment_mode,
    engineering_snapshot
  ) values(
    v_sale,'Phase 3G area product','un',1,100,100,'PRODUCTION','{}'
  ) returning id into v_sale_item;
  insert into public.ordens_servico(
    company_id,sale_id,customer_name,status,total_amount,paid_amount,pending_amount
  ) values(
    c.company_id,v_sale,'Phase 3G OS identity','pending',100,0,100
  ) returning id into v_os;
  update public.sales set ordem_servico_id=v_os where id=v_sale;

  v_snapshot := jsonb_build_object(
    'snapshot_version',4,
    'composition_mode','fixed',
    'fulfillment_mode','PRODUCTION',
    'inputs',jsonb_build_object('width_mm',1200,'height_mm',1200,'quantity',1),
    'materials',jsonb_build_array(jsonb_build_object(
      'key','phase3g-area-material',
      'company_item_id',c.technical_item_id,
      'item_template_id',c.technical_template_id,
      'pricing_company_item_id',c.operational_item_id,
      'variant_id',c.variant_id,
      'item_name','Vidro congelado',
      'material_type','glass',
      'pricing_basis','AREA',
      'quantity',1.44,
      'unit','M2',
      'width_mm',1200,
      'height_mm',1200,
      'specification',jsonb_build_object(
        'type','TEMPERADO','color','INCOLOR','thickness_mm',8,'finish','PADRAO'
      )
    )),
    'glass_pieces',jsonb_build_array(jsonb_build_object(
      'key','phase3g-area-piece',
      'company_item_id',c.technical_item_id,
      'item_template_id',c.technical_template_id,
      'pricing_company_item_id',c.operational_item_id,
      'variant_id',c.variant_id,
      'piece_role','FIXO',
      'width_mm',1200,
      'height_mm',1200,
      'quantity',1,
      'piece_quantity',1,
      'supply_mode','INTERNAL_STOCK',
      'specification',jsonb_build_object(
        'type','TEMPERADO','color','INCOLOR','thickness_mm',8,'finish','PADRAO'
      )
    )),
    'cuts','[]'::jsonb,'rules','[]'::jsonb,'totals','{}'::jsonb,'warnings','[]'::jsonb
  );

  insert into public.os_items(
    os_id,product_name,width_sold,height_sold,width_production,height_production,
    quantity,fulfillment_mode,engineering_snapshot,sale_item_id
  ) values(
    v_os,'Phase 3G area product',1200,1200,1200,1200,1,'PRODUCTION',
    v_snapshot,v_sale_item
  ) returning id into v_os_item;

  select count(*) into v_before_orders
  from public.purchase_orders where company_id=c.company_id;
  select count(*) into v_before_movements
  from public.stock_movements where company_id=c.company_id;

  v_result := public.rebuild_os_documents_from_snapshot(v_os,v_os_item);
  if coalesce((v_result->>'materials')::integer,0)<>1 then raise exception 'OS03_MATERIAL_COUNT'; end if;
  if coalesce((v_result->>'glass_pieces')::integer,0)<>1 then raise exception 'OS04_PIECE_COUNT'; end if;

  select * into v_material from public.os_materials
  where ordem_servico_id=v_os and os_item_id=v_os_item and snapshot_key='phase3g-area-material';
  if v_material.company_item_id<>c.operational_item_id then raise exception 'OS05_OPERATIONAL_MATERIAL'; end if;
  if v_material.item_template_id<>c.operational_template_id then raise exception 'OS06_OPERATIONAL_TEMPLATE'; end if;
  if v_material.variant_id<>c.variant_id then raise exception 'OS07_MATERIAL_VARIANT'; end if;
  if v_material.snapshot_payload->>'company_item_id'<>c.technical_item_id::text
     or v_material.snapshot_payload->>'pricing_company_item_id'<>c.operational_item_id::text
     then raise exception 'OS08_FROZEN_IDENTITIES'; end if;
  if (v_material.snapshot_payload->>'width_mm')::numeric<>1200
     or (v_material.snapshot_payload->>'height_mm')::numeric<>1200
     then raise exception 'OS09_FROZEN_DIMENSIONS'; end if;

  select * into v_consumption from public.material_consumption
  where ordem_servico_id=v_os and os_item_id=v_os_item and snapshot_key='phase3g-area-material';
  if v_consumption.company_item_id<>c.operational_item_id then raise exception 'OS10_CONSUMPTION_IDENTITY'; end if;
  if v_consumption.item_template_id<>c.operational_template_id then raise exception 'OS11_CONSUMPTION_TEMPLATE'; end if;
  if v_consumption.variant_id<>c.variant_id then raise exception 'OS12_CONSUMPTION_VARIANT'; end if;

  select * into v_piece from public.os_glass_pieces
  where ordem_servico_id=v_os and os_item_id=v_os_item and snapshot_key='phase3g-area-piece';
  if v_piece.company_id<>c.company_id or v_piece.company_item_id<>c.operational_item_id
     then raise exception 'OS13_PIECE_TENANT_IDENTITY'; end if;
  if v_piece.item_template_id<>c.operational_template_id then raise exception 'OS14_PIECE_TEMPLATE'; end if;
  if v_piece.snapshot_payload->>'variant_id'<>c.variant_id::text
     then raise exception 'OS15_PIECE_VARIANT'; end if;

  perform public.reconcile_os_material_requirements(v_os);
  select * into v_requirement from public.material_purchase_requirements
  where os_material_id=v_material.id;
  if v_requirement.company_id<>c.company_id or v_requirement.company_item_id<>c.operational_item_id
     then raise exception 'OS16_REQUIREMENT_IDENTITY'; end if;
  if v_requirement.variant_id<>c.variant_id then raise exception 'OS17_REQUIREMENT_VARIANT'; end if;
  if v_requirement.canonical_unit<>'MM2'
     or v_requirement.required_canonical_quantity<>1440000
     then raise exception 'OS18_CANONICAL_AREA'; end if;

  perform public.rebuild_os_documents_from_snapshot(v_os,v_os_item);
  perform public.reconcile_os_material_requirements(v_os);
  select count(*) into v_count from public.os_materials
  where ordem_servico_id=v_os and os_item_id=v_os_item and snapshot_key='phase3g-area-material';
  if v_count<>1 then raise exception 'OS19_REPLAY_MATERIAL'; end if;
  select count(*) into v_count from public.material_purchase_requirements
  where os_material_id=v_material.id;
  if v_count<>1 then raise exception 'OS20_REPLAY_REQUIREMENT'; end if;

  -- Legacy snapshots without pricing_company_item_id keep their original identity.
  v_legacy_snapshot := jsonb_set(
    jsonb_set(v_snapshot,'{materials,0}',(v_snapshot#>'{materials,0}') - 'pricing_company_item_id' ||
      jsonb_build_object(
        'key','phase3g-legacy-material',
        'company_item_id',c.operational_item_id,
        'item_template_id',c.operational_template_id
      )),
    '{glass_pieces}','[]'::jsonb
  );
  insert into public.os_items(
    os_id,product_name,width_sold,height_sold,width_production,height_production,
    quantity,fulfillment_mode,engineering_snapshot,sale_item_id
  ) values(
    v_os,'Phase 3G legacy product',1200,1200,1200,1200,1,'PRODUCTION',
    v_legacy_snapshot,null
  ) returning id into v_legacy_os_item;
  perform public.rebuild_os_documents_from_snapshot(v_os,v_legacy_os_item);
  if not exists(
    select 1 from public.os_materials
    where os_item_id=v_legacy_os_item and snapshot_key='phase3g-legacy-material'
      and company_item_id=c.operational_item_id and item_template_id=c.operational_template_id
  ) then raise exception 'OS21_LEGACY_FALLBACK'; end if;
  if not exists(
    select 1 from public.material_consumption
    where os_item_id=v_legacy_os_item and snapshot_key='phase3g-legacy-material'
      and company_item_id=c.operational_item_id
  ) then raise exception 'OS22_LEGACY_CONSUMPTION'; end if;

  -- A frozen operational identity from another company is always rejected.
  insert into public.companies(name)
  values('Phase 3G foreign '||gen_random_uuid()::text) returning id into v_foreign_company;
  select id into v_foreign_item from public.company_items
  where company_id=v_foreign_company and is_active
  order by created_at limit 1;
  if v_foreign_item is null then
    insert into public.company_items(
      company_id,name,type,unit,pricing_unit,pricing_basis,
      commercial_material_family,is_custom,is_active,item_template_id
    ) values(
      v_foreign_company,'Phase 3G foreign material','glass','m²','m²','AREA',
      'GLASS',true,true,c.operational_template_id
    ) returning id into v_foreign_item;
  end if;
  v_bad_snapshot := jsonb_set(
    jsonb_set(v_snapshot,'{materials,0,pricing_company_item_id}',to_jsonb(v_foreign_item::text)),
    '{glass_pieces}','[]'::jsonb
  );
  update public.os_items set engineering_snapshot=v_bad_snapshot where id=v_os_item;
  begin
    perform public.rebuild_os_documents_from_snapshot(v_os,v_os_item);
    raise exception 'OS23_EXPECTED_CROSS_COMPANY_FAILURE';
  exception when foreign_key_violation then
    if sqlerrm<>'MISSING_COMPANY_ITEM' then raise; end if;
  end;
  update public.os_items set engineering_snapshot=v_snapshot where id=v_os_item;

  -- Re-materialization never reads mutable catalog fields into the frozen payload.
  perform public.rebuild_os_documents_from_snapshot(v_os,v_os_item);
  if not exists(
    select 1 from public.os_materials
    where id=v_material.id
      and snapshot_payload->>'item_name'='Vidro congelado'
      and snapshot_payload#>>'{specification,thickness_mm}'='8'
  ) then raise exception 'OS24_FROZEN_SNAPSHOT'; end if;

  if (select count(*) from public.purchase_orders where company_id=c.company_id)<>v_before_orders
     or (select count(*) from public.stock_movements where company_id=c.company_id)<>v_before_movements
     then raise exception 'OS25_NO_AUTOMATIC_ORDER_OR_MOVEMENT'; end if;
end;
$$;

select jsonb_build_object(
  'OS01_authenticated_execute','PASS','OS02_anon_denied','PASS',
  'OS03_material_count','PASS','OS04_piece_count','PASS',
  'OS05_operational_material','PASS','OS06_operational_template','PASS',
  'OS07_material_variant','PASS','OS08_frozen_identities','PASS',
  'OS09_frozen_dimensions','PASS','OS10_consumption_identity','PASS',
  'OS11_consumption_template','PASS','OS12_consumption_variant','PASS',
  'OS13_piece_tenant_identity','PASS','OS14_piece_template','PASS',
  'OS15_piece_variant','PASS','OS16_requirement_identity','PASS',
  'OS17_requirement_variant','PASS','OS18_canonical_area','PASS',
  'OS19_replay_material','PASS','OS20_replay_requirement','PASS',
  'OS21_legacy_fallback','PASS','OS22_legacy_consumption','PASS',
  'OS23_cross_company_denied','PASS','OS24_frozen_snapshot','PASS',
  'OS25_no_automatic_order_or_movement','PASS'
) as phase3g_os_operational_identity_tests;

rollback;
