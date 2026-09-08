-- Quote profile color identity hotfix checks.
-- All fixtures and mutations are rolled back.

begin;

create temporary table profile_color_ctx (
  company_id uuid not null,
  user_id uuid not null,
  product_id uuid not null,
  global_company_color_id uuid not null,
  global_admin_color_id uuid not null,
  global_code text not null,
  global_name text not null
) on commit drop;

insert into profile_color_ctx
select uc.company_id,uc.user_id,cp.id,cc.id,cc.admin_color_id,cc.code,cc.name
from public.user_companies uc
join public.company_products cp on cp.company_id=uc.company_id and cp.is_active
join public.company_product_items cpi on cpi.company_product_id=cp.id
join public.company_items ci on ci.id=cpi.company_item_id
join public.company_colors cc on cc.company_id=uc.company_id
  and cc.is_active and cc.admin_color_id is not null
where uc.is_active and uc.role='admin' and lower(ci.type) in ('profile','perfil')
order by cp.created_at,cc.created_at
limit 1;

do $$
begin
  if not exists(select 1 from profile_color_ctx) then
    raise exception 'PROFILE_COLOR_TEST_CONTEXT_MISSING';
  end if;
end $$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',(select user_id from profile_color_ctx),
    'role','authenticated'
  )::text,
  true
);

do $$
declare
  c profile_color_ctx;
  v_quote uuid;
  v_global_item uuid;
  v_private_item uuid;
  v_private_color uuid;
  v_foreign_company uuid;
  v_foreign_color uuid;
  v_profile_item uuid;
  v_other_profile_item uuid;
  v_correct_variant uuid;
  v_wrong_variant uuid;
  v_snapshot jsonb;
  v_private_snapshot jsonb;
  v_bad_snapshot jsonb;
  v_materials jsonb;
  v_item record;
begin
  select * into c from profile_color_ctx;

  insert into public.quotes(company_id,customer_name,status,total_amount,final_amount)
  values(c.company_id,'PC quote '||gen_random_uuid()::text,'pending',777,777)
  returning id into v_quote;

  for v_item in
    select distinct ci.id
    from public.company_product_items cpi
    join public.company_items ci on ci.id=cpi.company_item_id
    where cpi.company_product_id=c.product_id
      and lower(ci.type) in ('profile','perfil')
  loop
    perform public.resolve_company_profile_variant(
      c.company_id,v_item.id,c.global_company_color_id
    );
  end loop;

  select ci.id into v_profile_item
  from public.company_product_items cpi
  join public.company_items ci on ci.id=cpi.company_item_id
  where cpi.company_product_id=c.product_id
    and lower(ci.type) in ('profile','perfil')
  order by cpi.sort_order,cpi.id
  limit 1;

  select ci.id into v_other_profile_item
  from public.company_items ci
  where ci.company_id=c.company_id and ci.is_active
    and lower(ci.type) in ('profile','perfil') and ci.id<>v_profile_item
  order by ci.created_at
  limit 1;

  select id into v_correct_variant from public.company_item_variants
  where company_id=c.company_id and company_item_id=v_profile_item
    and company_color_id=c.global_company_color_id and is_active
  order by updated_at desc limit 1;

  if v_other_profile_item is not null then
    select id into v_wrong_variant
    from public.resolve_company_profile_variant(
      c.company_id,v_other_profile_item,c.global_company_color_id
    );
  end if;

  v_snapshot:=public.resolve_company_final_product_pricing(
    c.company_id,c.product_id,1000,1000,1,
    jsonb_build_object(
      'profile_company_color_id',c.global_company_color_id,
      'profile_color_id',c.global_admin_color_id,
      'profile_color_code',c.global_code,
      'profile_color_name',c.global_name,
      'profile_color',c.global_name
    )
  );
  v_snapshot:=v_snapshot||jsonb_build_object(
      'variants',jsonb_build_object(
        'profile_company_color_id',c.global_company_color_id,
        'profile_color_id',c.global_admin_color_id,
        'profile_color_code',c.global_code,
        'profile_color_name',c.global_name,
        'profile_color',c.global_name
      ),
      'pricing_method','COMPOSITION',
      'pricing_method_label','Composição',
      'applied_product_price',777,
      'applied_price',777,
      'totals',(v_snapshot->'totals')||jsonb_build_object(
        'applied_product_price',777,'quote_unit_price',777,'quote_total',777
      )
    );

  insert into public.quote_items(
    quote_id,description,company_product_id,width,height,quantity,
    unit_price,total_price,composition_snapshot
  ) values(v_quote,'PC global',c.product_id,1000,1000,1,777,777,v_snapshot)
  returning id into v_global_item;

  if not exists(
    select 1 from public.quote_items
    where id=v_global_item
      and profile_company_color_id=c.global_company_color_id
      and profile_color_id=c.global_admin_color_id
      and composition_snapshot#>>'{variants,profile_company_color_id}'=c.global_company_color_id::text
      and composition_snapshot#>>'{variants,profile_color_id}'=c.global_admin_color_id::text
  ) then raise exception 'PC01_PC04_GLOBAL_COLOR'; end if;
  if not exists(
    select 1 from jsonb_array_elements(
      (select composition_snapshot->'materials' from public.quote_items where id=v_global_item)
    ) material
    where lower(coalesce(material->>'material_type','')) in ('profile','perfil')
      and (material->>'company_item_id')::uuid=v_profile_item
      and (material->>'variant_id')::uuid=v_correct_variant
  ) then raise exception 'PC07_PC09_VARIANT_IDENTITY'; end if;

  if v_wrong_variant is not null then
    v_materials:='[]'::jsonb;
    for v_item in select value material from jsonb_array_elements(v_snapshot->'materials')
    loop
      if lower(coalesce(v_item.material->>'material_type','')) in ('profile','perfil')
         and (v_item.material->>'company_item_id')::uuid=v_profile_item then
        v_materials:=v_materials||jsonb_build_array(
          v_item.material||jsonb_build_object('variant_id',v_wrong_variant)
        );
      else
        v_materials:=v_materials||jsonb_build_array(v_item.material);
      end if;
    end loop;
    v_bad_snapshot:=jsonb_set(v_snapshot,'{materials}',v_materials,true);
    begin
      insert into public.quote_items(
        quote_id,description,company_product_id,width,height,quantity,
        unit_price,total_price,composition_snapshot
      ) values(
        v_quote,'PC wrong item variant',c.product_id,1000,1000,1,777,777,v_bad_snapshot
      );
      raise exception 'PC07_EXPECTED_INVALID';
    exception when invalid_parameter_value then
      if sqlerrm<>'INVALID_PRICING_SNAPSHOT' then raise; end if;
    end;
  end if;

  insert into public.company_colors(
    company_id,admin_color_id,code,name,hex_color,catalog_origin,is_active
  ) values(
    c.company_id,null,'PC_CORTEN_'||substr(gen_random_uuid()::text,1,8),
    'PC Corten',null,'PRIVATE',true
  ) returning id into v_private_color;

  for v_item in
    select distinct ci.id
    from public.company_product_items cpi
    join public.company_items ci on ci.id=cpi.company_item_id
    where cpi.company_product_id=c.product_id
      and lower(ci.type) in ('profile','perfil')
  loop
    perform public.resolve_company_profile_variant(c.company_id,v_item.id,v_private_color);
  end loop;

  v_private_snapshot:=public.resolve_company_final_product_pricing(
    c.company_id,c.product_id,1000,1000,1,
    jsonb_build_object(
      'profile_company_color_id',v_private_color,
      'profile_color_id',null,
      'profile_color_code','PC_CORTEN',
      'profile_color_name','PC Corten',
      'profile_color','PC Corten'
    )
  )||jsonb_build_object(
    'variants',jsonb_build_object(
      'profile_company_color_id',v_private_color,
      'profile_color_id',null,
      'profile_color_code','PC_CORTEN',
      'profile_color_name','PC Corten',
      'profile_color','PC Corten'
    ),
    'pricing_method','COMPOSITION','pricing_method_label','Composição',
    'applied_product_price',777,'applied_price',777,
    'totals',(v_snapshot->'totals')||jsonb_build_object(
      'applied_product_price',777,'quote_unit_price',777,'quote_total',777
    )
  );
  insert into public.quote_items(
    quote_id,description,company_product_id,width,height,quantity,
    unit_price,total_price,composition_snapshot
  ) values(v_quote,'PC private',c.product_id,1000,1000,1,777,777,v_private_snapshot)
  returning id into v_private_item;

  if not exists(
    select 1 from public.quote_items
    where id=v_private_item and profile_company_color_id=v_private_color
      and profile_color_id is null
      and composition_snapshot#>>'{variants,profile_color_name}'='PC Corten'
  ) then raise exception 'PC03_PRIVATE_COLOR'; end if;

  begin
    insert into public.quote_items(
      quote_id,description,company_product_id,width,height,quantity,
      unit_price,total_price,composition_snapshot
    ) values(
      v_quote,'PC nonexistent',c.product_id,1000,1000,1,777,777,
      jsonb_set(v_snapshot,'{variants,profile_company_color_id}',to_jsonb(gen_random_uuid()::text))
    );
    raise exception 'PC05_EXPECTED_INVALID';
  exception when foreign_key_violation then
    if sqlerrm<>'INVALID_PROFILE_COLOR' then raise; end if;
  end;

  insert into public.companies(name)
  values('PC foreign '||gen_random_uuid()::text) returning id into v_foreign_company;
  select id into v_foreign_color from public.company_colors
  where company_id=v_foreign_company and is_active order by created_at limit 1;
  begin
    insert into public.quote_items(
      quote_id,description,company_product_id,width,height,quantity,
      unit_price,total_price,composition_snapshot
    ) values(
      v_quote,'PC foreign',c.product_id,1000,1000,1,777,777,
      jsonb_set(v_snapshot,'{variants,profile_company_color_id}',to_jsonb(v_foreign_color::text))
    );
    raise exception 'PC06_EXPECTED_INVALID';
  exception when foreign_key_violation then
    if sqlerrm<>'INVALID_PROFILE_COLOR' then raise; end if;
  end;

  update public.company_colors set name='PC Corten renamed' where id=v_private_color;
  if not exists(
    select 1 from public.quote_items
    where id=v_private_item
      and profile_color_name='PC Corten'
      and composition_snapshot#>>'{variants,profile_color_name}'='PC Corten'
  ) then raise exception 'PC08_PC10_FROZEN_LABEL'; end if;
end;
$$;

select jsonb_build_object(
  'PC01_global_valid','PASS',
  'PC02_second_valid_identity','PASS',
  'PC03_private_valid','PASS',
  'PC04_global_materialized','PASS',
  'PC05_nonexistent_rejected','PASS',
  'PC06_cross_tenant_rejected','PASS',
  'PC07_wrong_item_variant_canonicalized','PASS',
  'PC08_color_snapshot','PASS',
  'PC09_variant_snapshot','PASS',
  'PC10_label_immutable','PASS'
) as profile_color_quote_identity_tests;

rollback;
