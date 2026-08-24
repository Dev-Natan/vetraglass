-- Phase 4A transactional contract tests.
-- All fixtures and mutations are rolled back. A failure raises an exception with its gate.

begin;

create temporary table phase4a_test_context (
  company_id uuid not null,
  user_id uuid not null,
  company_b uuid,
  glass_item uuid,
  mirror_item uuid,
  acm_item uuid,
  glass_product uuid,
  mirror_product uuid,
  acm_product uuid,
  snapshot_quote uuid,
  snapshot_quote_item uuid
) on commit drop;

insert into phase4a_test_context(company_id,user_id)
select uc.company_id,uc.user_id
from public.user_companies uc
where uc.is_active and uc.role='admin'
order by uc.created_at
limit 1;

do $$
begin
  if not exists(select 1 from phase4a_test_context) then
    raise exception 'PHASE4A_TEST_ADMIN_CONTEXT_MISSING';
  end if;
end $$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',(select user_id from phase4a_test_context),
    'role','authenticated'
  )::text,
  true
);

do $$
declare
  v_company uuid;
  v_company_b uuid;
  v_glass uuid;
  v_mirror uuid;
  v_acm uuid;
  v_glass_template uuid;
  v_mirror_template uuid;
  v_acm_template uuid;
  v_product uuid;
  v_template uuid;
  v_template_category text;
  v_template_linha text;
  v_quote uuid;
begin
  select company_id into v_company from phase4a_test_context;
  select pt.category,pt.linha into v_template_category,v_template_linha
  from public.product_templates pt
  where pt.is_active
  order by pt.created_at
  limit 1;
  if v_template_linha is null then
    raise exception 'PHASE4A_TEST_PRODUCT_LINE_MISSING';
  end if;

  insert into public.companies(name)
  values('Phase 4A Isolation '||substr(gen_random_uuid()::text,1,8))
  returning id into v_company_b;

  insert into public.item_templates(name,type,unit,is_active)
  values('Phase 4A Glass '||substr(gen_random_uuid()::text,1,8),'glass','m²',true)
  returning id into v_glass_template;
  insert into public.item_templates(name,type,unit,is_active)
  values('Phase 4A Mirror '||substr(gen_random_uuid()::text,1,8),'glass','m²',true)
  returning id into v_mirror_template;
  insert into public.item_templates(name,type,unit,is_active)
  values('Phase 4A ACM '||substr(gen_random_uuid()::text,1,8),'sheet','m²',true)
  returning id into v_acm_template;

  insert into public.company_items(
    company_id,item_template_id,name,type,unit,pricing_unit,pricing_basis,cost,markup_percent,sale_price,
    variant_attribute_schema,is_custom,is_active
  ) values
  (
    v_company,v_glass_template,'Phase 4A Glass','glass','m²','m²','AREA',210,60,336,
    jsonb_build_array(
      jsonb_build_object('key','type','label','Tipo','kind','select','catalog','glass_types','required',true),
      jsonb_build_object('key','color','label','Cor','kind','select','catalog','admin_glass_colors','required',true),
      jsonb_build_object('key','thickness_mm','label','Espessura','kind','select','catalog','admin_glass_thicknesses','required',true),
      jsonb_build_object('key','finish','label','Acabamento','kind','text','required',false)
    ),true,true
  ) returning id into v_glass;

  insert into public.company_items(
    company_id,item_template_id,name,type,unit,pricing_unit,pricing_basis,cost,markup_percent,sale_price,
    variant_attribute_schema,is_custom,is_active
  ) values
  (
    v_company,v_mirror_template,'Phase 4A Mirror','mirror','m²','m²','AREA',100,50,150,
    jsonb_build_array(
      jsonb_build_object('key','color','label','Cor','kind','select','catalog','admin_glass_colors','required',true),
      jsonb_build_object('key','thickness_mm','label','Espessura','kind','select','catalog','admin_glass_thicknesses','required',true),
      jsonb_build_object('key','finish','label','Acabamento','kind','text','required',false)
    ),true,true
  ) returning id into v_mirror;

  insert into public.company_items(
    company_id,item_template_id,name,type,unit,pricing_unit,pricing_basis,cost,markup_percent,sale_price,
    variant_attribute_schema,is_custom,is_active
  ) values
  (
    v_company,v_acm_template,'Phase 4A ACM','acm','m²','m²','AREA',80,25,100,
    jsonb_build_array(
      jsonb_build_object('key','color','label','Cor','kind','select','catalog','admin_aluminum_colors','required',true),
      jsonb_build_object('key','thickness_mm','label','Espessura','kind','number','required',true),
      jsonb_build_object('key','finish','label','Acabamento','kind','text','required',false)
    ),true,true
  ) returning id into v_acm;

  insert into public.company_items(
    company_id,name,type,unit,pricing_unit,pricing_basis,cost,markup_percent,sale_price,
    variant_attribute_schema,is_custom,is_active
  ) values(
    v_company_b,'Phase 4A Company B Mirror','mirror','m²','m²','AREA',90,50,135,
    '[]'::jsonb,true,true
  );

  insert into public.product_templates(
    name,category,linha,composition_mode,fulfillment_mode,publication_status,is_active
  ) values(
    'Phase 4A Snapshot Template '||substr(gen_random_uuid()::text,1,8),
    v_template_category,v_template_linha,'fixed','PRODUCTION','active',true
  ) returning id into v_template;

  select cp.id into v_product
  from public.company_products cp
  where cp.company_id=v_company and cp.product_template_id=v_template;
  if v_product is null then
    raise exception 'PHASE4A_TEST_PUBLISHED_PRODUCT_MISSING';
  end if;
  update public.company_products
  set commercial_name='Phase 4A Glass Product',pricing_type='COMPOSITION',is_custom=true,is_active=true
  where id=v_product;
  insert into public.company_product_items(
    company_product_id,company_id,company_item_id,width_formula,height_formula,quantity_formula
  ) values(v_product,v_company,v_glass,'Largura','Altura','1');
  update phase4a_test_context set glass_product=v_product;

  insert into public.company_products(company_id,commercial_name,pricing_type,is_custom,is_active)
  values(v_company,'Phase 4A Mirror Product','COMPOSITION',true,true)
  returning id into v_product;
  insert into public.company_product_items(
    company_product_id,company_id,company_item_id,width_formula,height_formula,quantity_formula
  ) values(v_product,v_company,v_mirror,'Largura','Altura','1');
  update phase4a_test_context set mirror_product=v_product;

  insert into public.company_products(company_id,commercial_name,pricing_type,is_custom,is_active)
  values(v_company,'Phase 4A ACM Product','COMPOSITION',true,true)
  returning id into v_product;
  insert into public.company_product_items(
    company_product_id,company_id,company_item_id,width_formula,height_formula,quantity_formula
  ) values(v_product,v_company,v_acm,'Largura','Altura','1');
  update phase4a_test_context set acm_product=v_product;

  insert into public.quotes(company_id,customer_name,status,total_amount,final_amount)
  values(v_company,'Phase 4A Snapshot','pending',336,336)
  returning id into v_quote;

  update phase4a_test_context
  set company_b=v_company_b,glass_item=v_glass,mirror_item=v_mirror,
      acm_item=v_acm,snapshot_quote=v_quote;
end $$;

do $$
declare
  v_company uuid;
  v_glass uuid;
  v_mirror uuid;
  v_acm uuid;
  v_glass_product uuid;
  v_mirror_product uuid;
  v_acm_product uuid;
  v_variant public.company_item_variants;
  v_original_variant uuid;
  v_quote_item uuid;
  v_result jsonb;
  v_snapshot_before jsonb;
  v_snapshot_after jsonb;
  v_current_product uuid;
begin
  select company_id,glass_item,mirror_item,acm_item,glass_product,mirror_product,acm_product
  into v_company,v_glass,v_mirror,v_acm,v_glass_product,v_mirror_product,v_acm_product
  from phase4a_test_context;

  -- T01 Temperado/Incolor/8 mm: 210 + 60% = 336.
  select * into v_variant from public.save_company_item_variant(
    v_company,v_glass,'GLASS',
    '{"type":"Temperado","color":"Incolor","thickness_mm":8}'::jsonb,
    210,'MARKUP',60
  );
  v_original_variant:=v_variant.id;
  if v_variant.sale_price<>336 or v_variant.markup_percent<>60
     or v_variant.attributes<>'{"type":"TEMPERADO","color":"INCOLOR","thickness_mm":8}'::jsonb then
    raise exception 'T01_TEMPERADO_INCOLOR_8';
  end if;

  v_result:=public.resolve_company_product_pricing(
    v_company,v_glass_product,1000,1000,1,
    jsonb_build_object('by_item',jsonb_build_object(
      v_glass::text,jsonb_build_object('type','Temperado','color','Incolor','thickness_mm',8)
    ))
  );
  insert into public.quote_items(
    quote_id,company_product_id,description,width,height,quantity,unit_price,total_price,
    composition_snapshot,snapshot_version
  ) values(
    (select snapshot_quote from phase4a_test_context),v_glass_product,
    'Phase 4A immutable snapshot',1000,1000,1,336,336,v_result,3
  ) returning id into v_quote_item;
  update phase4a_test_context set snapshot_quote_item=v_quote_item;

  -- T02 Verde is an independent identity.
  select * into v_variant from public.save_company_item_variant(
    v_company,v_glass,'GLASS',
    '{"type":"Temperado","color":"Verde","thickness_mm":8}'::jsonb,
    220,'MARKUP',50
  );
  if v_variant.id=v_original_variant or v_variant.sale_price<>330 then
    raise exception 'T02_TEMPERADO_VERDE_8';
  end if;

  -- T03 10 mm is independent from 8 mm.
  select * into v_variant from public.save_company_item_variant(
    v_company,v_glass,'GLASS',
    '{"type":"Temperado","color":"Incolor","thickness_mm":10}'::jsonb,
    250,'MARKUP',60
  );
  if v_variant.id=v_original_variant or v_variant.sale_price<>400 then
    raise exception 'T03_TEMPERADO_INCOLOR_10';
  end if;

  -- T04 Laminated is independent from tempered.
  select * into v_variant from public.save_company_item_variant(
    v_company,v_glass,'GLASS',
    '{"type":"Laminado","color":"Incolor","thickness_mm":8}'::jsonb,
    260,'MARKUP',50
  );
  if v_variant.id=v_original_variant or v_variant.sale_price<>390 then
    raise exception 'T04_LAMINADO_INCOLOR_8';
  end if;

  -- T05 Finish participates in the effective identity.
  select * into v_variant from public.save_company_item_variant(
    v_company,v_glass,'GLASS',
    '{"type":"Temperado","color":"Incolor","thickness_mm":8,"finish":"Jateado"}'::jsonb,
    240,'MARKUP',60
  );
  if v_variant.id=v_original_variant
     or v_variant.attributes->>'finish'<>'JATEADO' then
    raise exception 'T05_GLASS_FINISH';
  end if;

  -- T06 Mirror is generic AREA and resolves through the same canonical table.
  select * into v_variant from public.save_company_item_variant(
    v_company,v_mirror,'MIRROR',
    '{"color":"Incolor","thickness_mm":4}'::jsonb,
    100,'MARKUP',50
  );
  if v_variant.sale_price<>150 or v_variant.pricing_basis<>'AREA' then
    raise exception 'T06_MIRROR_SAVE';
  end if;
  v_result:=public.resolve_company_product_pricing(
    v_company,v_mirror_product,1000,1000,1,
    jsonb_build_object('by_item',jsonb_build_object(
      v_mirror::text,jsonb_build_object('color','Incolor','thickness_mm',4)
    ))
  );
  if (v_result#>>'{materials,0,unit_cost}')::numeric<>100
     or (v_result#>>'{materials,0,unit_sale_price}')::numeric<>150 then
    raise exception 'T06_MIRROR_RESOLVE';
  end if;

  -- T07 ACM uses configurable generic attributes.
  select * into v_variant from public.save_company_item_variant(
    v_company,v_acm,'ACM',
    '{"color":"Preto","thickness_mm":3,"finish":"Fosco"}'::jsonb,
    80,'MARKUP',25
  );
  if v_variant.sale_price<>100 or v_variant.attributes->>'color'<>'PRETO' then
    raise exception 'T07_ACM_SAVE';
  end if;
  v_result:=public.resolve_company_product_pricing(
    v_company,v_acm_product,1000,1000,1,
    jsonb_build_object('by_item',jsonb_build_object(
      v_acm::text,jsonb_build_object('color','Preto','thickness_mm',3,'finish','Fosco')
    ))
  );
  if (v_result#>>'{materials,0,unit_sale_price}')::numeric<>100 then
    raise exception 'T07_ACM_RESOLVE';
  end if;

  -- T08 Missing combination must be explicit.
  begin
    perform public.resolve_company_product_pricing(
      v_company,v_glass_product,1000,1000,1,
      jsonb_build_object('by_item',jsonb_build_object(
        v_glass::text,jsonb_build_object('type','Temperado','color','Bronze','thickness_mm',12)
      ))
    );
    raise exception 'T08_EXPECTED_MISSING_PRICE_VARIANT';
  exception when check_violation then
    if sqlerrm not like '%MISSING_PRICE_VARIANT%' then raise; end if;
  end;

  -- T09 Sale without cost returns MISSING_COST and never masks cost as zero.
  insert into public.company_item_variants(
    company_id,company_item_id,variant_type,pricing_basis,attributes,cost,markup_percent,sale_price
  ) values(
    v_company,v_mirror,'MIRROR','AREA',
    '{"color":"BRONZE","thickness_mm":4}'::jsonb,null,null,170
  );
  begin
    perform public.resolve_company_product_pricing(
      v_company,v_mirror_product,1000,1000,1,
      jsonb_build_object('by_item',jsonb_build_object(
        v_mirror::text,jsonb_build_object('color','Bronze','thickness_mm',4)
      ))
    );
    raise exception 'T09_EXPECTED_MISSING_COST';
  exception when check_violation then
    if sqlerrm not like '%MISSING_COST%' then raise; end if;
  end;

  -- T10 replay/edit keeps the canonical identity and recalculates by sale price.
  select * into v_variant from public.save_company_item_variant(
    v_company,v_glass,'GLASS',
    '{"type":"Temperado","color":"Incolor","thickness_mm":8}'::jsonb,
    210,'SALE_PRICE',357
  );
  if v_variant.id<>v_original_variant or v_variant.sale_price<>357
     or round(v_variant.markup_percent,2)<>70 then
    raise exception 'T10_EDIT_REPLAY';
  end if;

  -- T11 a quote snapshot remains immutable after current price changes.
  select composition_snapshot into v_snapshot_before
  from public.quote_items
  where id=(select snapshot_quote_item from phase4a_test_context);
  perform public.save_company_item_variant(
    v_company,v_glass,'GLASS',
    '{"type":"Temperado","color":"Incolor","thickness_mm":8}'::jsonb,
    300,'MARKUP',60
  );
  select composition_snapshot into v_snapshot_after
  from public.quote_items
  where id=(select snapshot_quote_item from phase4a_test_context);
  if v_snapshot_after is distinct from v_snapshot_before
     or (v_snapshot_after#>>'{materials,0,sale_price}')::numeric<>336 then
    raise exception 'T11_SNAPSHOT_IMMUTABILITY';
  end if;

  -- T12 the existing real product still resolves without a variant payload.
  select id into v_current_product from public.company_products
  where company_id=v_company
    and id not in(v_glass_product,v_mirror_product,v_acm_product)
    and is_active
  order by created_at
  limit 1;
  if v_current_product is null then
    raise exception 'T12_CURRENT_PRODUCT_MISSING';
  end if;
  v_result:=public.resolve_company_product_pricing(
    v_company,v_current_product,1000,1000,1,'{}'::jsonb
  );
  if coalesce((v_result->>'ready_for_quote')::boolean,false) is not true
     or jsonb_array_length(v_result->'materials')=0 then
    raise exception 'T12_CURRENT_PRODUCT_COMPATIBILITY';
  end if;

  -- T13 the authorized data correction is present and audited.
  if exists(
    select 1 from public.company_item_variants civ
    join public.company_items ci on ci.id=civ.company_item_id
    where upper(ci.name)='VIDRO FIXO' and civ.glass_thickness_mm=80
  ) or not exists(
    select 1 from public.audit_logs
    where table_name='company_item_variants'
      and metadata->>'source'='phase4a_migration'
      and metadata->>'reason' like '%80 mm -> 8 mm%'
  ) then
    raise exception 'T13_AUTHORIZED_CORRECTION';
  end if;

  -- T14 AREA selection must not include profiles.
  if exists(
    select 1 from public.company_items
    where company_id=v_company and pricing_basis='AREA' and lower(type)='profile'
  ) then
    raise exception 'T14_PROFILE_EXCLUDED_FROM_AREA';
  end if;
end $$;

-- T15 direct Data API-style reads remain company scoped by RLS.
grant select on phase4a_test_context to authenticated;
select set_config('phase4a.company_b',(select company_b::text from phase4a_test_context),true);
set local role authenticated;
do $$
begin
  if exists(
    select 1 from public.company_items
    where company_id=current_setting('phase4a.company_b')::uuid
  ) or exists(
    select 1 from public.company_item_variants
    where company_id=current_setting('phase4a.company_b')::uuid
  ) then
    raise exception 'T15_CROSS_COMPANY_RLS';
  end if;
end $$;
reset role;

select jsonb_build_object(
  'T01_tempered_clear_8','PASS',
  'T02_tempered_green_8','PASS',
  'T03_tempered_clear_10','PASS',
  'T04_laminated_clear_8','PASS',
  'T05_finish_identity','PASS',
  'T06_mirror','PASS',
  'T07_acm','PASS',
  'T08_missing_price_variant','PASS',
  'T09_missing_cost','PASS',
  'T10_edit_replay','PASS',
  'T11_snapshot_immutable','PASS',
  'T12_current_product_compatible','PASS',
  'T13_typo_correction_audited','PASS',
  'T14_profiles_excluded','PASS',
  'T15_cross_company_rls','PASS'
) as phase4a_transactional_tests;

rollback;
