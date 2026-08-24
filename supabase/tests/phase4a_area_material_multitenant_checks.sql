-- Phase 4A correction gates. Every fixture is rolled back.
begin;

create temporary table phase4a_mt_context (
  user_id uuid not null,
  company_a uuid not null,
  company_b uuid,
  company_c uuid,
  product_a uuid,
  product_b uuid,
  product_c uuid,
  glass_a uuid,
  glass_b uuid,
  glass_c uuid,
  result_a jsonb,
  snapshot_item uuid
) on commit drop;

insert into phase4a_mt_context(user_id,company_a,product_a)
select uc.user_id,uc.company_id,cp.id
from public.user_companies uc
join public.company_products cp on cp.company_id=uc.company_id
where uc.is_active and uc.role='admin'
  and upper(cp.commercial_name)='JANELA DE CORRER 2 FOLHAS'
order by uc.created_at
limit 1;

do $$ begin
  if not exists(select 1 from phase4a_mt_context) then
    raise exception 'PHASE4A_MT_CONTEXT_MISSING';
  end if;
end $$;

select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select user_id from phase4a_mt_context),'role','authenticated'
)::text,true);

update phase4a_mt_context c set glass_a=(
  select ci.id from public.company_items ci
  where ci.company_id=c.company_a and ci.is_commercial_area_material
    and ci.commercial_material_family='GLASS' and ci.is_active
);

do $$
declare
  c phase4a_mt_context;
  r jsonb;
  error_detail text;
  before_snapshot jsonb;
  after_snapshot jsonb;
  quote_id uuid;
begin
  select * into c from phase4a_mt_context;

  -- T01/T02: real geometry first, then the company A rate.
  r:=public.resolve_company_product_pricing(
    c.company_a,c.product_a,1000,1000,1,
    '{"glass_type":"TEMPERADO","glass_color":"INCOLOR","glass_thickness_mm":8,"glass_finish":"PADRAO"}'::jsonb
  );
  if (r#>>'{glass_pieces,0,width_mm}')::numeric<>500
     or (r#>>'{glass_pieces,0,height_mm}')::numeric<>940
     or (r#>>'{glass_pieces,0,piece_area_m2}')::numeric<>0.470
     or (r#>>'{glass_pieces,1,width_mm}')::numeric<>550
     or (r#>>'{glass_pieces,1,height_mm}')::numeric<>980
     or (r#>>'{glass_pieces,1,piece_area_m2}')::numeric<>0.539
     or (r#>>'{area_pricing_groups,0,area_m2}')::numeric<>1.009
     or (r#>>'{area_pricing_groups,0,total_cost}')::numeric<>211.89
     or (r#>>'{area_pricing_groups,0,total_sale}')::numeric<>339.02 then
    raise exception 'T01_T02_GEOMETRY_AND_PRICE';
  end if;
  c.result_a:=r;
  update phase4a_mt_context set result_a=r;

  -- T03/T04/T05: specification changes price, never piece geometry.
  perform public.save_company_item_variant(c.company_a,c.glass_a,'GLASS',
    '{"type":"TEMPERADO","color":"VERDE","thickness_mm":8,"finish":"PADRAO"}',220,'SALE_PRICE',352);
  perform public.save_company_item_variant(c.company_a,c.glass_a,'GLASS',
    '{"type":"TEMPERADO","color":"INCOLOR","thickness_mm":10,"finish":"PADRAO"}',250,'SALE_PRICE',400);
  perform public.save_company_item_variant(c.company_a,c.glass_a,'GLASS',
    '{"type":"LAMINADO","color":"INCOLOR","thickness_mm":8,"finish":"PADRAO"}',260,'SALE_PRICE',390);
  r:=public.resolve_company_product_pricing(c.company_a,c.product_a,1000,1000,1,
    '{"glass_type":"TEMPERADO","glass_color":"VERDE","glass_thickness_mm":8,"glass_finish":"PADRAO"}');
  if (r#>>'{glass_pieces,0,width_mm}')::numeric<>500
     or (r#>>'{glass_pieces,1,width_mm}')::numeric<>550
     or (r#>>'{area_pricing_groups,0,sale_price_per_m2}')::numeric<>352 then
    raise exception 'T03_GREEN_GEOMETRY';
  end if;
  r:=public.resolve_company_product_pricing(c.company_a,c.product_a,1000,1000,1,
    '{"glass_type":"TEMPERADO","glass_color":"INCOLOR","glass_thickness_mm":10,"glass_finish":"PADRAO"}');
  if (r#>>'{glass_pieces,0,piece_area_m2}')::numeric<>0.470
     or (r#>>'{area_pricing_groups,0,sale_price_per_m2}')::numeric<>400 then
    raise exception 'T04_THICKNESS_GEOMETRY';
  end if;
  r:=public.resolve_company_product_pricing(c.company_a,c.product_a,1000,1000,1,
    '{"glass_type":"LAMINADO","glass_color":"INCOLOR","glass_thickness_mm":8,"glass_finish":"PADRAO"}');
  if (r#>>'{glass_pieces,1,piece_area_m2}')::numeric<>0.539
     or (r#>>'{area_pricing_groups,0,sale_price_per_m2}')::numeric<>390 then
    raise exception 'T05_TYPE_GEOMETRY';
  end if;

  -- T06/T07/T08: technical roles are not price owners; both use one rate and snapshot is complete.
  if exists(
    select 1 from public.company_items ci
    where ci.company_id=c.company_a and ci.is_commercial_area_material
      and upper(ci.name) in('VIDRO FIXO','VIDRO MOVEL','VIDRO MÓVEL')
  ) or (c.result_a#>>'{glass_pieces,0,sale_price_per_m2}')::numeric<>336
       or (c.result_a#>>'{glass_pieces,1,sale_price_per_m2}')::numeric<>336
       or c.result_a#>>'{glass_pieces,0,role}' is null
       or c.result_a#>>'{glass_pieces,0,specification,type}'<>'TEMPERADO' then
    raise exception 'T06_T08_ROLE_PRICE_SNAPSHOT';
  end if;

  insert into public.quotes(company_id,customer_name,status,total_amount,final_amount)
  values(c.company_a,'Phase 4A snapshot','pending',339.02,339.02)
  returning id into quote_id;
  insert into public.quote_items(
    quote_id,company_product_id,description,width,height,quantity,unit_price,total_price,
    composition_snapshot,snapshot_version
  ) values(quote_id,c.product_a,'Phase 4A snapshot',1000,1000,1,339.02,339.02,c.result_a,4)
  returning id into c.snapshot_item;
  select composition_snapshot into before_snapshot from public.quote_items where id=c.snapshot_item;
  perform public.save_company_item_variant(c.company_a,c.glass_a,'GLASS',
    '{"type":"TEMPERADO","color":"INCOLOR","thickness_mm":8,"finish":"PADRAO"}',210,'SALE_PRICE',350);
  select composition_snapshot into after_snapshot from public.quote_items where id=c.snapshot_item;
  if after_snapshot is distinct from before_snapshot
     or (after_snapshot#>>'{area_pricing_groups,0,sale_price_per_m2}')::numeric<>336 then
    raise exception 'T09_SNAPSHOT_IMMUTABILITY';
  end if;

  -- T10: error identifies the commercial specification, not a technical role.
  begin
    perform public.resolve_company_product_pricing(c.company_a,c.product_a,1000,1000,1,
      '{"glass_type":"TEMPERADO","glass_color":"BRONZE","glass_thickness_mm":12,"glass_finish":"PADRAO"}');
    raise exception 'T10_EXPECTED_MISSING_PRICE_VARIANT';
  exception when check_violation then
    get stacked diagnostics error_detail = PG_EXCEPTION_DETAIL;
    if sqlerrm not like '%MISSING_PRICE_VARIANT%'
       or coalesce(error_detail,'') like '%VIDRO FIXO%'
       or coalesce(error_detail,'') like '%VIDRO MOVEL%' then
      raise;
    end if;
  end;
end $$;

-- Three-tenant reusable mechanism. Company creation trigger must seed structure only.
do $$
declare
  c phase4a_mt_context;
  b uuid;
  d uuid;
  item_b uuid;
  item_c uuid;
  tech_b1 uuid;
  tech_b2 uuid;
  tech_c1 uuid;
  tech_c2 uuid;
  v_product_b uuid;
  v_product_c uuid;
begin
  select * into c from phase4a_mt_context;
  insert into public.companies(name) values('Phase 4A tenant B') returning id into b;
  insert into public.companies(name) values('Phase 4A tenant C') returning id into d;
  if (select count(*) from public.company_items where company_id=b and is_commercial_area_material)<>3
     or (select count(*) from public.company_item_variants where company_id=b)<>0
     or (select count(*) from public.company_items where company_id=d and is_commercial_area_material)<>3
     or (select count(*) from public.company_item_variants where company_id=d)<>0 then
    raise exception 'MT_NEW_COMPANY_CATALOG_OR_PRICE_COPY';
  end if;
  insert into public.user_companies(user_id,company_id,role,is_active)
  values(c.user_id,b,'admin',true),(c.user_id,d,'admin',true);
  select id into item_b from public.company_items where company_id=b and commercial_material_family='GLASS' and is_commercial_area_material;
  select id into item_c from public.company_items where company_id=d and commercial_material_family='GLASS' and is_commercial_area_material;

  insert into public.company_items(company_id,name,type,unit,pricing_unit,pricing_basis,commercial_material_family,is_custom,is_active)
  values(b,'VIDRO FIXO','glass','m²','m²','AREA','GLASS',true,true) returning id into tech_b1;
  insert into public.company_items(company_id,name,type,unit,pricing_unit,pricing_basis,commercial_material_family,is_custom,is_active)
  values(b,'VIDRO MOVEL','glass','m²','m²','AREA','GLASS',true,true) returning id into tech_b2;
  insert into public.company_items(company_id,name,type,unit,pricing_unit,pricing_basis,commercial_material_family,is_custom,is_active)
  values(d,'VIDRO FIXO','glass','m²','m²','AREA','GLASS',true,true) returning id into tech_c1;
  insert into public.company_items(company_id,name,type,unit,pricing_unit,pricing_basis,commercial_material_family,is_custom,is_active)
  values(d,'VIDRO MOVEL','glass','m²','m²','AREA','GLASS',true,true) returning id into tech_c2;
  insert into public.company_products(company_id,commercial_name,pricing_type,is_custom,is_active)
  values(b,'Tenant B window','COMPOSITION',true,true) returning id into v_product_b;
  insert into public.company_products(company_id,commercial_name,pricing_type,is_custom,is_active)
  values(d,'Tenant C window','COMPOSITION',true,true) returning id into v_product_c;
  insert into public.company_product_items(company_id,company_product_id,company_item_id,width_formula,height_formula,quantity_formula,sort_order)
  values
    (b,v_product_b,tech_b1,'Largura / 2','Altura - 60','1',1),
    (b,v_product_b,tech_b2,'(Largura / 2) + 50','Altura - 20','1',2),
    (d,v_product_c,tech_c1,'Largura / 2','Altura - 60','1',1),
    (d,v_product_c,tech_c2,'(Largura / 2) + 50','Altura - 20','1',2);
  perform public.save_company_item_variant(b,item_b,'GLASS',
    '{"type":"TEMPERADO","color":"INCOLOR","thickness_mm":8,"finish":"PADRAO"}',250,'SALE_PRICE',390);
  update phase4a_mt_context set company_b=b,company_c=d,product_b=v_product_b,product_c=v_product_c,glass_b=item_b,glass_c=item_c;
end $$;

do $$
declare c phase4a_mt_context; r jsonb;
begin
  select * into c from phase4a_mt_context;
  r:=public.resolve_company_product_pricing(c.company_b,c.product_b,1000,1000,1,
    '{"glass_type":"TEMPERADO","glass_color":"INCOLOR","glass_thickness_mm":8,"glass_finish":"PADRAO"}');
  if (r#>>'{area_pricing_groups,0,sale_price_per_m2}')::numeric<>390 then
    raise exception 'MT_COMPANY_B_PRICE';
  end if;
  begin
    perform public.resolve_company_product_pricing(c.company_c,c.product_c,1000,1000,1,
      '{"glass_type":"TEMPERADO","glass_color":"INCOLOR","glass_thickness_mm":8,"glass_finish":"PADRAO"}');
    raise exception 'MT_COMPANY_C_EXPECTED_MISSING';
  exception when check_violation then
    if sqlerrm not like '%MISSING_PRICE_VARIANT%' then raise; end if;
  end;
  delete from public.user_companies where user_id=c.user_id and company_id in(c.company_b,c.company_c);
end $$;

grant select on phase4a_mt_context to authenticated;
select set_config('phase4a.company_b',(select company_b::text from phase4a_mt_context),true);
set local role authenticated;
do $$ declare affected integer; begin
  if exists(select 1 from public.company_item_variants where company_id=current_setting('phase4a.company_b')::uuid)
     or exists(select 1 from public.company_items where company_id=current_setting('phase4a.company_b')::uuid) then
    raise exception 'MT_CROSS_COMPANY_READ';
  end if;
  update public.company_item_variants set sale_price=1
  where company_id=current_setting('phase4a.company_b')::uuid;
  get diagnostics affected = row_count;
  if affected<>0 then raise exception 'MT_CROSS_COMPANY_WRITE'; end if;
end $$;
reset role;

select jsonb_build_object(
  'T01_geometry','PASS','T02_area_price','PASS','T03_color','PASS','T04_thickness','PASS',
  'T05_type','PASS','T06_technical_roles_hidden','PASS','T07_shared_rate','PASS',
  'T08_snapshot_complete','PASS','T09_snapshot_immutable','PASS','T10_missing_specification','PASS',
  'tenant_A_336','PASS','tenant_B_390','PASS','tenant_C_missing','PASS',
  'cross_company_rls','PASS','new_company_no_price_copy','PASS'
) phase4a_area_material_tests;

rollback;
