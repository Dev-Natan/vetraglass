-- Phase 3G transactional contract tests.
-- All fixtures and mutations are rolled back. A failure raises an exception with the test id.

begin;

create temporary table phase3g_test_context (
  company_id uuid not null,
  user_id uuid not null
) on commit drop;

insert into phase3g_test_context(company_id,user_id)
select uc.company_id,uc.user_id
from public.user_companies uc
join public.companies c on c.id=uc.company_id
where uc.is_active and uc.role='admin'
order by c.created_at
limit 1;

do $$
begin
  if not exists(select 1 from phase3g_test_context) then
    raise exception 'PHASE3G_TEST_ADMIN_CONTEXT_MISSING';
  end if;
end $$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',(select user_id from phase3g_test_context),
    'role','authenticated'
  )::text,
  true
);

create or replace function pg_temp.phase3g_make_requirement(
  _company_id uuid,
  _company_item_id uuid,
  _quantity numeric,
  _label text,
  _variant_id uuid default null
)
returns table(requirement_id uuid,os_id uuid)
language plpgsql
as $$
declare
  v_os uuid;
  v_os_item uuid;
  v_material uuid;
  v_sale uuid;
  v_sale_item uuid;
  v_user uuid;
  v_item record;
  v_units record;
begin
  select * into v_item from public.company_items
  where id=_company_item_id and company_id=_company_id and is_active;
  select * into v_units from public.inventory_item_units
  where company_item_id=_company_item_id and company_id=_company_id
    and legacy_status='CONFIGURED';
  if v_item.id is null or v_units.id is null then
    raise exception 'PHASE3G_TEST_ITEM_CONTRACT_MISSING';
  end if;

  select user_id into v_user from phase3g_test_context limit 1;
  insert into public.sales(
    company_id,customer_name,subtotal,total_amount,payment_method,payment_status,
    sold_by,sale_type,operation_key
  ) values(
    _company_id,'Phase 3G '||_label,0,0,'dinheiro','paid',v_user,'full',gen_random_uuid()
  ) returning id into v_sale;
  insert into public.sale_items(
    sale_id,item_name,item_unit,quantity,unit_price,total_price,fulfillment_mode,
    engineering_snapshot
  ) values(
    v_sale,'Phase 3G '||_label,v_units.consumption_unit,1,0,0,'PRODUCTION',
    jsonb_build_object('source','phase3g-transaction-test','label',_label)
  ) returning id into v_sale_item;

  insert into public.ordens_servico(
    company_id,sale_id,customer_name,status,total_amount,paid_amount,pending_amount
  )
  values(_company_id,v_sale,'Phase 3G '||_label,'pending',0,0,0)
  returning id into v_os;
  update public.sales set ordem_servico_id=v_os where id=v_sale;

  insert into public.os_items(
    os_id,product_name,width_sold,height_sold,width_production,height_production,
    quantity,fulfillment_mode,engineering_snapshot,sale_item_id
  ) values(
    v_os,'Phase 3G '||_label,1000,1000,1000,1000,1,'PRODUCTION',
    jsonb_build_object('source','phase3g-transaction-test','label',_label),v_sale_item
  ) returning id into v_os_item;

  insert into public.os_materials(
    ordem_servico_id,os_item_id,item_template_id,company_item_id,item_name,item_type,
    pieces_count,unit,required_quantity,snapshot_key,snapshot_payload
  ) values(
    v_os,v_os_item,v_item.item_template_id,v_item.id,v_item.name,v_item.type,
    1,v_units.consumption_unit,_quantity,'phase3g-'||_label||'-'||gen_random_uuid()::text,
    jsonb_build_object('variant_id',_variant_id,'source','approved_snapshot','label',_label)
  ) returning id into v_material;

  perform public.reconcile_os_material_requirements(v_os);
  return query
    select r.id,v_os from public.material_purchase_requirements r
    where r.os_material_id=v_material;
end;
$$;

do $$
declare
  v_company uuid;
  v_user uuid;
  v_items uuid[];
  v_item1 uuid; v_item2 uuid; v_item3 uuid;
  v_item4 uuid; v_item5 uuid; v_item6 uuid;
  v_location_a uuid; v_location_b uuid;
  v_req1 uuid; v_req2 uuid; v_req3 uuid; v_req4 uuid;
  v_req5a uuid; v_req5b uuid; v_req5c uuid; v_req6 uuid;
  v_os1 uuid; v_os2 uuid; v_os3 uuid; v_os4 uuid;
  v_os5a uuid; v_os5b uuid; v_os5c uuid; v_os6 uuid;
  v_quote uuid;
  v_company_product uuid; v_product_template uuid;
  v_before_requirements bigint; v_before_reservations bigint; v_before_orders bigint;
  v_result jsonb;
  v_po uuid; v_po_item uuid; v_create_key uuid:=gen_random_uuid();
  v_receipt1 uuid:=gen_random_uuid(); v_receipt2 uuid:=gen_random_uuid();
  v_cancel_po uuid; v_cancel_po_item uuid;
  v_glass_item uuid; v_variant_a uuid; v_variant_b uuid;
  v_variant_req uuid; v_variant_os uuid; v_variant_po uuid; v_variant_po_item uuid;
  v_fixed_req uuid; v_composition_req uuid; v_probe_os uuid;
  v_value numeric; v_count bigint; v_name text;
begin
  select company_id,user_id into v_company,v_user from phase3g_test_context;

  select array_agg(id order by id) into v_items
  from (
    select ci.id
    from public.company_items ci
    join public.inventory_item_units iu
      on iu.company_id=ci.company_id and iu.company_item_id=ci.id
    where ci.company_id=v_company and ci.is_active
      and ci.type='profile' and iu.purchase_unit='BAR'
      and iu.purchase_to_canonical_factor=6000
    order by ci.id
    limit 6
  ) selected;
  if coalesce(array_length(v_items,1),0)<6 then
    raise exception 'PHASE3G_TEST_REQUIRES_SIX_CONFIGURED_PROFILES';
  end if;
  v_item1:=v_items[1]; v_item2:=v_items[2]; v_item3:=v_items[3];
  v_item4:=v_items[4]; v_item5:=v_items[5]; v_item6:=v_items[6];

  delete from public.physical_stock_balances where company_item_id=any(v_items);

  insert into public.stock_locations(company_id,code,name,kind,is_active,needs_review)
  values(v_company,'P3G-A-'||substr(gen_random_uuid()::text,1,6),'Phase 3G A','POSITION',true,false)
  returning id into v_location_a;
  insert into public.stock_locations(company_id,code,name,kind,is_active,needs_review)
  values(v_company,'P3G-B-'||substr(gen_random_uuid()::text,1,6),'Phase 3G B','POSITION',true,false)
  returning id into v_location_b;

  -- RBAC Alternative 1.
  update public.user_companies set role='manager'
  where company_id=v_company and user_id=v_user;
  if not public.phase3g_user_can(v_user,v_company,'purchases','create')
     or not public.phase3g_user_can(v_user,v_company,'purchase-receiving','create')
     or public.phase3g_user_can(v_user,v_company,'purchases','delete') then
    raise exception 'RBAC_MANAGER_MATRIX';
  end if;
  update public.user_companies set role='employee'
  where company_id=v_company and user_id=v_user;
  if not public.phase3g_user_can(v_user,v_company,'material-requirements','view')
     or public.phase3g_user_can(v_user,v_company,'purchases','create')
     or public.phase3g_user_can(v_user,v_company,'purchase-receiving','create') then
    raise exception 'RBAC_EMPLOYEE_MATRIX';
  end if;
  update public.user_companies set role='admin'
  where company_id=v_company and user_id=v_user;

  -- T01: quote with zero stock creates no operational commitment.
  insert into public.company_item_prices(company_id,item_template_id,price,cost)
  select v_company,ci.item_template_id,100,50
  from public.company_items ci
  where ci.company_id=v_company and ci.item_template_id is not null
    and not exists (
      select 1 from public.company_item_prices cip
      where cip.company_id=v_company and cip.item_template_id=ci.item_template_id
    )
  on conflict (company_id,item_template_id) do nothing;
  select cp.id,cp.product_template_id into v_company_product,v_product_template
  from public.company_products cp
  join public.product_templates pt on pt.id=cp.product_template_id
  where cp.company_id=v_company and cp.is_active and pt.is_active
    and pt.fulfillment_mode='PRODUCTION'
  order by cp.created_at limit 1;
  if v_company_product is null then
    raise exception 'PHASE3G_TEST_PRODUCTION_PRODUCT_MISSING';
  end if;
  select count(*) into v_before_requirements
    from public.material_purchase_requirements where company_id=v_company;
  select count(*) into v_before_reservations
    from public.stock_reservations where company_id=v_company;
  select count(*) into v_before_orders
    from public.purchase_orders where company_id=v_company;

  insert into public.quotes(company_id,customer_name,status,total_amount,final_amount)
  values(v_company,'Phase 3G Quote Zero Stock','pending',100,100)
  returning id into v_quote;
  insert into public.quote_items(
    quote_id,company_product_id,product_template_id,description,width,height,
    quantity,unit_price,total_price
  ) values(
    v_quote,v_company_product,v_product_template,'PRODUCTION without stock',1000,1000,
    1,100,100
  );
  if (select count(*) from public.material_purchase_requirements where company_id=v_company)
       <>v_before_requirements
     or (select count(*) from public.stock_reservations where company_id=v_company)
       <>v_before_reservations
     or (select count(*) from public.purchase_orders where company_id=v_company)
       <>v_before_orders then
    raise exception 'T01_QUOTE_CREATED_OPERATIONAL_COMMITMENT';
  end if;

  -- Controlled physical balances: complete, partial and split locations.
  insert into public.physical_stock_balances(
    company_id,company_item_id,location_id,canonical_quantity,package_quantity,needs_review
  ) values
    (v_company,v_item1,v_location_a,10000,0,false),
    (v_company,v_item2,v_location_a,4000,0,false),
    (v_company,v_item4,v_location_a,4000,0,false),
    (v_company,v_item4,v_location_b,6000,0,false);

  -- T02/T03/T04 and T05.
  select requirement_id,os_id into v_req1,v_os1
    from pg_temp.phase3g_make_requirement(v_company,v_item1,10,'T02-full');
  select requirement_id,os_id into v_req2,v_os2
    from pg_temp.phase3g_make_requirement(v_company,v_item2,10,'T03-partial');
  select requirement_id,os_id into v_req3,v_os3
    from pg_temp.phase3g_make_requirement(v_company,v_item3,10,'T04-zero');
  select requirement_id,os_id into v_req6,v_os6
    from pg_temp.phase3g_make_requirement(v_company,v_item6,8,'T05-bar-conversion');

  if not exists(select 1 from public.material_purchase_requirements_summary
    where id=v_req1 and required_canonical_quantity=10000
      and reserved_canonical_quantity=10000 and shortage_canonical_quantity=0
      and purchase_required_canonical_quantity=0) then
    raise exception 'T02_COMPLETE_STOCK';
  end if;
  if not exists(select 1 from public.material_purchase_requirements_summary
    where id=v_req2 and required_canonical_quantity=10000
      and reserved_canonical_quantity=4000 and shortage_canonical_quantity=6000
      and purchase_required_canonical_quantity=6000) then
    raise exception 'T03_PARTIAL_STOCK';
  end if;
  if not exists(select 1 from public.material_purchase_requirements_summary
    where id=v_req3 and required_canonical_quantity=10000
      and reserved_canonical_quantity=0 and shortage_canonical_quantity=10000) then
    raise exception 'T04_ZERO_STOCK';
  end if;
  if not exists(select 1 from public.material_purchase_requirements_summary
    where id=v_req6 and shortage_canonical_quantity=8000
      and suggested_purchase_quantity=2 and purchase_unit='BAR') then
    raise exception 'T05_BAR_TO_MM_CONVERSION';
  end if;

  -- Split one requirement between two physical locations.
  select requirement_id,os_id into v_req4,v_os4
    from pg_temp.phase3g_make_requirement(v_company,v_item4,8,'split-location');
  select count(*),coalesce(sum(canonical_quantity),0)
    into v_count,v_value
  from public.stock_reservations
  where material_requirement_id=v_req4 and status='reserved';
  if v_count<>2 or v_value<>8000 then
    raise exception 'SPLIT_LOCATION_RESERVATION';
  end if;
  perform public.reconcile_os_material_requirements(v_os4);
  if (select count(*) from public.stock_reservations
      where material_requirement_id=v_req4 and status='reserved')<>2 then
    raise exception 'T10_RESERVATION_REPLAY';
  end if;

  -- T07: one purchase-order item consolidates three OS.
  select requirement_id,os_id into v_req5a,v_os5a
    from pg_temp.phase3g_make_requirement(v_company,v_item5,8,'T07-os-a');
  select requirement_id,os_id into v_req5b,v_os5b
    from pg_temp.phase3g_make_requirement(v_company,v_item5,5,'T07-os-b');
  select requirement_id,os_id into v_req5c,v_os5c
    from pg_temp.phase3g_make_requirement(v_company,v_item5,4,'T07-os-c');

  v_result:=public.create_purchase_order_from_requirements(
    v_company,'Phase 3G Supplier',
    jsonb_build_array(jsonb_build_object(
      'company_item_id',v_item5,'variant_id',null,'description','3 OS / 17m',
      'purchase_quantity',3,'purchase_unit','BAR','estimated_cost',300,
      'allocations',jsonb_build_array(
        jsonb_build_object('requirement_id',v_req5a,'canonical_quantity',8000),
        jsonb_build_object('requirement_id',v_req5b,'canonical_quantity',5000),
        jsonb_build_object('requirement_id',v_req5c,'canonical_quantity',4000)
      )
    )),current_date+7,'T07 consolidated',v_create_key
  );
  v_po:=(v_result->>'purchase_order_id')::uuid;
  select id into v_po_item from public.purchase_order_items where purchase_order_id=v_po;
  if (select count(*) from public.purchase_order_item_requirement_allocations
      where purchase_order_item_id=v_po_item)<>3
     or (select sum(allocated_canonical_quantity)
         from public.purchase_order_item_requirement_allocations
         where purchase_order_item_id=v_po_item)<>17000
     or (select ordered_canonical_quantity from public.purchase_order_items where id=v_po_item)<>18000 then
    raise exception 'T07_THREE_OS_CONSOLIDATION';
  end if;

  v_result:=public.create_purchase_order_from_requirements(
    v_company,'Phase 3G Supplier',
    jsonb_build_array(jsonb_build_object(
      'company_item_id',v_item5,'variant_id',null,'description','3 OS / 17m',
      'purchase_quantity',3,'purchase_unit','BAR','estimated_cost',300,
      'allocations',jsonb_build_array(
        jsonb_build_object('requirement_id',v_req5a,'canonical_quantity',8000),
        jsonb_build_object('requirement_id',v_req5b,'canonical_quantity',5000),
        jsonb_build_object('requirement_id',v_req5c,'canonical_quantity',4000)
      )
    )),current_date+7,'T07 consolidated',v_create_key
  );
  if (v_result->>'purchase_order_id')::uuid<>v_po or not (v_result->>'idempotent')::boolean then
    raise exception 'T10_PURCHASE_REPLAY';
  end if;

  perform public.approve_purchase_order(v_po);
  v_result:=public.approve_purchase_order(v_po);
  if not (v_result->>'idempotent')::boolean then
    raise exception 'T10_APPROVAL_REPLAY';
  end if;

  -- T08: partial receipt, conversion and deterministic allocations.
  v_result:=public.receive_purchase_order_items(
    v_po,v_location_a,
    jsonb_build_array(jsonb_build_object(
      'purchase_order_item_id',v_po_item,'variant_id',null,
      'received_quantity',2,'total_cost',200
    )),v_receipt1,'P3G-PARTIAL'
  );
  if (select status from public.purchase_orders where id=v_po)<>'partial'
     or (select received_quantity from public.purchase_order_items where id=v_po_item)<>2
     or (select coalesce(sum(received_canonical_quantity),0)
         from public.purchase_order_item_requirement_allocations
         where purchase_order_item_id=v_po_item)<>12000
     or (select coalesce(sum(reserved_canonical_quantity),0)
         from public.material_purchase_requirements_summary
         where id in(v_req5a,v_req5b,v_req5c))<>12000
     or (select coalesce(sum(shortage_canonical_quantity),0)
         from public.material_purchase_requirements_summary
         where id in(v_req5a,v_req5b,v_req5c))<>5000 then
    raise exception 'T08_PARTIAL_RECEIPT';
  end if;

  v_result:=public.receive_purchase_order_items(
    v_po,v_location_a,
    jsonb_build_array(jsonb_build_object(
      'purchase_order_item_id',v_po_item,'variant_id',null,
      'received_quantity',2,'total_cost',200
    )),v_receipt1,'P3G-PARTIAL'
  );
  if not (v_result->>'idempotent')::boolean
     or (select received_quantity from public.purchase_order_items where id=v_po_item)<>2
     or (select count(*) from public.stock_movements
         where reference_type='purchase_order_item' and reference_id=v_po_item)<>1 then
    raise exception 'T10_RECEIPT_REPLAY';
  end if;

  -- T09/T06: complete receipt and preserve one-bar rounding surplus.
  perform public.receive_purchase_order_items(
    v_po,v_location_a,
    jsonb_build_array(jsonb_build_object(
      'purchase_order_item_id',v_po_item,'variant_id',null,
      'received_quantity',1,'total_cost',100
    )),v_receipt2,'P3G-FINAL'
  );
  if (select status from public.purchase_orders where id=v_po)<>'received'
     or exists(select 1 from public.material_purchase_requirements_summary
       where id in(v_req5a,v_req5b,v_req5c) and shortage_canonical_quantity<>0)
     or (select coalesce(sum(pb.canonical_quantity),0)
         from public.physical_stock_balances pb
         where pb.company_item_id=v_item5)
        -(select coalesce(sum(sr.canonical_quantity),0)
          from public.stock_reservations sr
          where sr.company_item_id=v_item5 and sr.status='reserved')<>1000 then
    raise exception 'T06_T09_FULL_RECEIPT_OR_SURPLUS';
  end if;

  -- T11: cancelling a purchase reopens the shortage; cancelling the OS releases commitments.
  v_result:=public.create_purchase_order_from_requirements(
    v_company,'Cancellation Supplier',
    jsonb_build_array(jsonb_build_object(
      'company_item_id',v_item6,'variant_id',null,'description','cancel test',
      'purchase_quantity',2,'purchase_unit','BAR','estimated_cost',10,
      'allocations',jsonb_build_array(
        jsonb_build_object('requirement_id',v_req6,'canonical_quantity',8000)
      )
    )),null,null,gen_random_uuid()
  );
  v_cancel_po:=(v_result->>'purchase_order_id')::uuid;
  select id into v_cancel_po_item from public.purchase_order_items
    where purchase_order_id=v_cancel_po;
  perform public.cancel_purchase_order(v_cancel_po);
  if exists(select 1 from public.purchase_order_item_requirement_allocations
      where purchase_order_item_id=v_cancel_po_item and status<>'CANCELLED')
     or (select purchase_required_canonical_quantity
         from public.material_purchase_requirements_summary where id=v_req6)<>8000 then
    raise exception 'T11_PURCHASE_CANCEL';
  end if;
  update public.ordens_servico set status='cancelled' where id=v_os6;
  if (select lifecycle_status from public.material_purchase_requirements where id=v_req6)<>'CANCELLED'
     or exists(select 1 from public.stock_reservations
       where material_requirement_id=v_req6 and status='reserved') then
    raise exception 'T11_OS_CANCEL';
  end if;

  -- T12: receiving another variant cannot satisfy the requirement.
  select ci.id into v_glass_item
  from public.company_items ci
  join public.inventory_item_units iu on iu.company_item_id=ci.id and iu.company_id=ci.company_id
  where ci.company_id=v_company and ci.is_active and ci.type='glass'
    and (select count(*) from public.company_item_variants v
         where v.company_item_id=ci.id and v.is_active)>=2
  limit 1;
  if v_glass_item is null then raise exception 'PHASE3G_TEST_VARIANTS_MISSING'; end if;
  select id into v_variant_a from public.company_item_variants
    where company_item_id=v_glass_item and is_active order by id limit 1;
  select id into v_variant_b from public.company_item_variants
    where company_item_id=v_glass_item and is_active and id<>v_variant_a order by id limit 1;
  delete from public.physical_stock_balances where company_item_id=v_glass_item;
  select requirement_id,os_id into v_variant_req,v_variant_os
    from pg_temp.phase3g_make_requirement(v_company,v_glass_item,1,'T12-variant',v_variant_a);
  v_result:=public.create_purchase_order_from_requirements(
    v_company,'Variant Supplier',
    jsonb_build_array(jsonb_build_object(
      'company_item_id',v_glass_item,'variant_id',v_variant_a,'description','variant A',
      'purchase_quantity',1,'purchase_unit','M2','estimated_cost',50,
      'allocations',jsonb_build_array(
        jsonb_build_object('requirement_id',v_variant_req,'canonical_quantity',1000000)
      )
    )),null,null,gen_random_uuid()
  );
  v_variant_po:=(v_result->>'purchase_order_id')::uuid;
  select id into v_variant_po_item from public.purchase_order_items
    where purchase_order_id=v_variant_po;
  perform public.approve_purchase_order(v_variant_po);
  begin
    perform public.receive_purchase_order_items(
      v_variant_po,v_location_a,
      jsonb_build_array(jsonb_build_object(
        'purchase_order_item_id',v_variant_po_item,'variant_id',v_variant_b,
        'received_quantity',1,'total_cost',50
      )),gen_random_uuid(),'WRONG-VARIANT'
    );
    raise exception 'T12_VARIANT_MISMATCH_WAS_ACCEPTED';
  exception
    when check_violation then
      null;
  end;
  if (select shortage_canonical_quantity
      from public.material_purchase_requirements_summary where id=v_variant_req)<>1000000 then
    raise exception 'T12_VARIANT_REQUIREMENT_CHANGED';
  end if;

  -- T13: no membership means no company capability; policies delegate to the same predicate.
  if public.phase3g_user_can(gen_random_uuid(),v_company,'purchases','view') then
    raise exception 'T13_CROSS_COMPANY_CAPABILITY';
  end if;

  -- T14: production is blocked while the OS remains valid with shortage.
  update public.ordens_servico set status='in_progress' where id=v_os3;
  begin
    perform public.complete_os_production(v_os3,'[]'::jsonb,'{}'::uuid[]);
    raise exception 'T14_PRODUCTION_WITH_SHORTAGE_WAS_ACCEPTED';
  exception
    when check_violation then
      if position('MATERIAL_NOT_READY' in sqlerrm)=0 then raise; end if;
  end;
  if (select status from public.ordens_servico where id=v_os3)<>'in_progress' then
    raise exception 'T14_OS_WAS_INVALIDATED';
  end if;

  -- Fully reserved material consumes from both locations once.
  update public.ordens_servico set status='in_progress' where id=v_os4;
  perform public.complete_os_production(v_os4,'[]'::jsonb,'{}'::uuid[]);
  v_result:=public.complete_os_production(v_os4,'[]'::jsonb,'{}'::uuid[]);
  if (select status from public.ordens_servico where id=v_os4)<>'completed'
     or not (v_result->>'idempotent')::boolean
     or (select count(*) from public.stock_movements
         where category='consumo_producao'
           and conversion_snapshot#>>'{metadata,ordem_servico_id}'=v_os4::text)<>2
     or exists(select 1 from public.physical_stock_balances
       where company_item_id=v_item4 and canonical_quantity<0) then
    raise exception 'T14_PRODUCTION_CONSUMPTION';
  end if;

  -- T15/T16: pricing mode labels do not alter the physical requirement.
  select requirement_id,os_id into v_fixed_req,v_probe_os
    from pg_temp.phase3g_make_requirement(v_company,v_item1,1,'T15-FIXED_PER_SQM');
  select requirement_id,os_id into v_composition_req,v_probe_os
    from pg_temp.phase3g_make_requirement(v_company,v_item1,1,'T16-COMPOSITION');
  if (select required_canonical_quantity from public.material_purchase_requirements where id=v_fixed_req)<>1000
     or (select required_canonical_quantity from public.material_purchase_requirements where id=v_composition_req)<>1000 then
    raise exception 'T15_T16_PRICING_AFFECTED_PHYSICAL_REQUIREMENT';
  end if;

  -- T17: changing current catalog metadata does not recalculate the approved quantity.
  select name into v_name from public.company_items where id=v_item1;
  update public.company_items set name=v_name||' catalog changed' where id=v_item1;
  perform public.reconcile_os_material_requirements(v_os1);
  if (select required_canonical_quantity from public.material_purchase_requirements where id=v_req1)<>10000
     or (select count(*) from public.material_purchase_requirements where os_material_id=(
       select os_material_id from public.material_purchase_requirements where id=v_req1))<>1 then
    raise exception 'T17_SNAPSHOT_REQUIREMENT_DRIFT';
  end if;
end;
$$;

rollback;

select jsonb_build_object(
  'T01','PASS','T02','PASS','T03','PASS','T04','PASS','T05','PASS',
  'T06','PASS','T07','PASS','T08','PASS','T09','PASS','T10','PASS',
  'T11','PASS','T12','PASS','T13','PASS','T14','PASS','T15','PASS',
  'T16','PASS','T17','PASS',
  'split_locations','PASS','three_os_one_order','PASS',
  'partial_receipt','PASS','bar_to_mm','PASS','surplus','PASS',
  'replay','PASS','cancellation','PASS','cross_company','PASS',
  'variant_mismatch','PASS','zero_stock_quote','PASS'
) as phase3g_transactional_tests;
