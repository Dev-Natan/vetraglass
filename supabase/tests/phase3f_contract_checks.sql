-- Phase 3F read-only contract checks. Safe against the official project.
do $$
declare
  v_click record;
begin
  if to_regclass('public.inventory_item_units') is null
     or to_regclass('public.stock_locations') is null
     or to_regclass('public.physical_stock_balances') is null then
    raise exception 'PHASE3F_SCHEMA_MISSING';
  end if;

  select ci.type,cs.legacy_quantity,cs.legacy_unit,cs.quantity,
    cs.canonical_quantity,cs.canonical_unit,iu.purchase_unit,
    iu.consumption_unit,iu.nominal_length_mm,pb.package_quantity,
    sl.code,sl.needs_review
  into v_click
  from public.company_items ci
  join public.company_stock cs on cs.company_item_id=ci.id
  join public.inventory_item_units iu on iu.company_item_id=ci.id
  join public.physical_stock_balances pb on pb.company_item_id=ci.id
  join public.stock_locations sl on sl.id=pb.location_id
  where upper(ci.name)='CLICK';

  if v_click.type <> 'profile' then raise exception 'T19_CLICK_CLASSIFICATION'; end if;
  if v_click.legacy_quantity <> 10 or lower(v_click.legacy_unit) <> 'barra' then
    raise exception 'CLICK_LEGACY_SNAPSHOT';
  end if;
  if v_click.purchase_unit <> 'BAR' or v_click.consumption_unit <> 'M'
     or v_click.nominal_length_mm <> 6000 then raise exception 'T01_PROFILE_CONTRACT'; end if;
  if v_click.package_quantity <> 10 or v_click.canonical_quantity <> 60000
     or v_click.canonical_unit <> 'MM' or v_click.quantity <> 60 then
    raise exception 'T02_CLICK_CONVERSION';
  end if;
  if v_click.code <> 'LEGACY_REVIEW' or not v_click.needs_review then
    raise exception 'CLICK_LOCATION_REVIEW';
  end if;

  if has_table_privilege('anon','public.physical_stock_balances','insert')
     or has_function_privilege('anon',
       'public.record_physical_stock_movement(uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb)',
       'execute') then raise exception 'PHASE3F_ANON_WRITE'; end if;

  if not exists (
    select 1 from pg_trigger where tgname='trg_phase3f_guard_company_stock_aggregate'
      and not tgisinternal
  ) then raise exception 'DIRECT_STOCK_GUARD_MISSING'; end if;

  if not exists (
    select 1 from pg_indexes where schemaname='public'
      and indexname='stock_movements_idempotency_key'
  ) then raise exception 'T05_IDEMPOTENCY_INDEX_MISSING'; end if;

  if exists (
    select 1 from public.company_stock cs
    join public.physical_inventory_summary pis on pis.company_item_id=cs.company_item_id
    where cs.canonical_quantity is distinct from pis.canonical_quantity
  ) then raise exception 'T22_STOCK_AGGREGATE_DRIFT'; end if;

  if exists (
    select 1 from public.stock_movements
    where company_item_id is not null
      and (original_quantity is null or original_unit is null
        or canonical_quantity is null or canonical_unit is null
        or conversion_factor is null or location_id is null)
  ) then raise exception 'MOVEMENT_SNAPSHOT_INCOMPLETE'; end if;
end $$;

select 'GREEN' as phase3f_contract_checks;
