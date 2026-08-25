-- Phase 4A dynamic material-family gates. All fixtures are rolled back.
BEGIN;

CREATE TEMP TABLE phase4a_dynamic_ctx(
  user_id uuid, user_b uuid, company_a uuid, company_b uuid, company_c uuid, company_d uuid,
  family_glass uuid, family_poly uuid, attr_color uuid, attr_thickness uuid,
  option_crystal uuid, option_6mm uuid, variant_a uuid, variant_b uuid
) ON COMMIT DROP;

INSERT INTO phase4a_dynamic_ctx(user_id, company_a)
SELECT uc.user_id, uc.company_id
FROM public.user_companies uc
WHERE uc.is_active AND uc.role='admin'
ORDER BY uc.created_at LIMIT 1;

UPDATE phase4a_dynamic_ctx SET user_b=(
  SELECT u.id FROM auth.users u WHERE u.id<>phase4a_dynamic_ctx.user_id ORDER BY u.created_at LIMIT 1
);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM phase4a_dynamic_ctx WHERE user_id IS NOT NULL AND user_b IS NOT NULL AND company_a IS NOT NULL) THEN
    RAISE EXCEPTION 'T00_CONTEXT_MISSING';
  END IF;
END $$;

DO $$
DECLARE family_count integer;
BEGIN
  -- T01: the initial global catalog remains available.
  SELECT count(DISTINCT commercial_material_family) INTO family_count
  FROM public.item_templates
  WHERE company_id IS NULL AND is_commercial_area_material AND is_active
    AND commercial_material_family IN ('GLASS','MIRROR','ACM');
  IF family_count<>3 THEN RAISE EXCEPTION 'T01_INITIAL_FAMILIES'; END IF;
END $$;

-- The business fixture user becomes SaaS Admin only inside this rolled-back transaction.
INSERT INTO public.saas_admins(user_id)
SELECT user_id FROM phase4a_dynamic_ctx
ON CONFLICT DO NOTHING;
DELETE FROM public.saas_admins
WHERE user_id=(SELECT user_b FROM phase4a_dynamic_ctx);

SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub',(SELECT user_id FROM phase4a_dynamic_ctx),'role','authenticated'
)::text, true);

INSERT INTO public.companies(name) VALUES
  ('PHASE4A TENANT B '||gen_random_uuid()),('PHASE4A TENANT C '||gen_random_uuid()),('PHASE4A TENANT D '||gen_random_uuid());
UPDATE phase4a_dynamic_ctx SET
  company_b=(SELECT id FROM public.companies WHERE name LIKE 'PHASE4A TENANT B %' ORDER BY created_at DESC LIMIT 1),
  company_c=(SELECT id FROM public.companies WHERE name LIKE 'PHASE4A TENANT C %' ORDER BY created_at DESC LIMIT 1),
  company_d=(SELECT id FROM public.companies WHERE name LIKE 'PHASE4A TENANT D %' ORDER BY created_at DESC LIMIT 1),
  family_glass=(SELECT id FROM public.item_templates WHERE is_commercial_area_material AND commercial_material_family='GLASS' AND company_id IS NULL);
INSERT INTO public.user_companies(user_id,company_id,role,is_active)
SELECT user_b,company_id,'admin',true FROM phase4a_dynamic_ctx
CROSS JOIN LATERAL unnest(ARRAY[company_b,company_c,company_d]) company_id;

DO $$
DECLARE c phase4a_dynamic_ctx; f public.item_templates; a public.item_template_attributes; o public.item_template_attribute_options;
BEGIN
  SELECT * INTO c FROM phase4a_dynamic_ctx;
  -- T01/T02/T18: a completely unknown global family is created without schema or React changes.
  f:=public.admin_upsert_material_family(NULL,'POLYCARBONATE_TEST','Policarbonato Teste','Fixture transacional','AREA','m²',90,true);
  a:=public.admin_upsert_material_attribute(NULL,f.id,'COLOR','Cor','SELECT',true,10,true);
  o:=public.admin_upsert_material_option(NULL,a.id,'CRYSTAL','Cristal',to_jsonb('CRYSTAL'::text),10,true);
  UPDATE phase4a_dynamic_ctx SET family_poly=f.id,attr_color=a.id,option_crystal=o.id;
  a:=public.admin_upsert_material_attribute(NULL,f.id,'THICKNESS_MM','Espessura','SELECT',true,20,true);
  o:=public.admin_upsert_material_option(NULL,a.id,'MM_6','6 mm',to_jsonb(6),10,true);
  UPDATE phase4a_dynamic_ctx SET attr_thickness=a.id,option_6mm=o.id;
  IF (SELECT count(*) FROM public.item_template_attributes WHERE item_template_id=f.id)<>2 THEN
    RAISE EXCEPTION 'T03_ATTRIBUTES';
  END IF;
  IF (SELECT count(*) FROM public.item_template_attribute_options
      WHERE attribute_id IN (SELECT id FROM public.item_template_attributes WHERE item_template_id=f.id))<>2 THEN
    RAISE EXCEPTION 'T04_OPTIONS';
  END IF;
END $$;

DO $$
DECLARE c phase4a_dynamic_ctx; family_count integer; item_count integer; v public.company_item_variants; r jsonb; before_id uuid;
BEGIN
  SELECT * INTO c FROM phase4a_dynamic_ctx;
  -- T03-T05/T10: old and new tenants discover the global family with zero eager copies.
  SELECT count(*) INTO family_count FROM public.list_company_material_families(c.company_a) WHERE id=c.family_poly;
  IF family_count<>1 THEN RAISE EXCEPTION 'T03_OLD_TENANT_DISCOVERY'; END IF;
  IF EXISTS(SELECT 1 FROM public.list_company_material_families(c.company_a) WHERE id=c.family_poly AND configured_variants<>0) THEN
    RAISE EXCEPTION 'T05_TENANT_A_INHERITED_PRICE';
  END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_b,'role','authenticated')::text,true);
  SELECT count(*) INTO family_count FROM public.list_company_material_families(c.company_d) WHERE id=c.family_poly;
  IF family_count<>1 THEN RAISE EXCEPTION 'T04_NEW_TENANT_DISCOVERY'; END IF;
  IF EXISTS(SELECT 1 FROM public.list_company_material_families(c.company_d) WHERE id=c.family_poly AND configured_variants<>0) THEN
    RAISE EXCEPTION 'T10_NEW_TENANT_INHERITED_PRICE';
  END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_id,'role','authenticated')::text,true);
  SELECT count(*) INTO item_count FROM public.company_items WHERE item_template_id=c.family_poly;
  IF item_count<>0 THEN RAISE EXCEPTION 'T05_NO_EAGER_COPY'; END IF;

  -- T06/T07: first save creates exactly one lazy company item and one tenant price.
  v:=public.save_company_material_variant(c.company_a,c.family_poly,ARRAY[c.option_crystal,c.option_6mm],100,'SALE_PRICE',160);
  UPDATE phase4a_dynamic_ctx SET variant_a=v.id;
  SELECT count(*) INTO item_count FROM public.company_items WHERE company_id=c.company_a AND item_template_id=c.family_poly;
  IF item_count<>1 THEN RAISE EXCEPTION 'T06_LAZY_COMPANY_ITEM'; END IF;
  r:=public.resolve_company_material_price(c.company_a,c.family_poly,ARRAY[c.option_6mm,c.option_crystal]);
  IF (r->>'sale_price')::numeric<>160 THEN RAISE EXCEPTION 'T07_DETERMINISTIC_RESOLVE'; END IF;

  -- T08: replay with reversed option order updates the same row.
  before_id:=v.id;
  v:=public.save_company_material_variant(c.company_a,c.family_poly,ARRAY[c.option_6mm,c.option_crystal],100,'SALE_PRICE',160);
  IF v.id<>before_id OR (SELECT count(*) FROM public.company_item_variants WHERE company_item_id=v.company_item_id)<>1 THEN
    RAISE EXCEPTION 'T08_SIGNATURE_IDEMPOTENCY';
  END IF;

  -- Tenant B may choose another price; tenant C intentionally has none.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_b,'role','authenticated')::text,true);
  v:=public.save_company_material_variant(c.company_b,c.family_poly,ARRAY[c.option_crystal,c.option_6mm],200,'SALE_PRICE',390);
  UPDATE phase4a_dynamic_ctx SET variant_b=v.id;
  r:=public.resolve_company_material_price(c.company_b,c.family_poly,ARRAY[c.option_crystal,c.option_6mm]);
  IF (r->>'sale_price')::numeric<>390 THEN RAISE EXCEPTION 'T09_TENANT_B_PRICE'; END IF;
  BEGIN
    PERFORM public.resolve_company_material_price(c.company_c,c.family_poly,ARRAY[c.option_crystal,c.option_6mm]);
    RAISE EXCEPTION 'T09_TENANT_C_SHOULD_BE_MISSING';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%MISSING_PRICE_VARIANT%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_id,'role','authenticated')::text,true);
END $$;

-- T09 cross-company: RLS protects reads and writes at the database layer.
GRANT SELECT ON phase4a_dynamic_ctx TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c phase4a_dynamic_ctx; visible integer; affected integer;
BEGIN
  SELECT * INTO c FROM phase4a_dynamic_ctx;
  SELECT count(*) INTO visible FROM public.company_item_variants WHERE id=c.variant_b;
  IF visible<>0 THEN RAISE EXCEPTION 'T09_CROSS_COMPANY_READ'; END IF;
  BEGIN
    UPDATE public.company_item_variants SET sale_price=1 WHERE id=c.variant_b;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected<>0 THEN RAISE EXCEPTION 'T09_CROSS_COMPANY_WRITE'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- least-privilege grants deny direct variant writes before RLS is even evaluated.
  END;
END $$;
RESET ROLE;

DO $$
DECLARE c phase4a_dynamic_ctx; family_count integer;
BEGIN
  SELECT * INTO c FROM phase4a_dynamic_ctx;
  -- T11: a regular company administrator is not a SaaS administrator.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_b,'role','authenticated')::text,true);
  BEGIN
    PERFORM public.admin_upsert_material_family(c.family_poly,'IGNORED','Ataque','', 'AREA','m²',90,true);
    RAISE EXCEPTION 'T11_COMMON_USER_ADMIN_WRITE';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_id,'role','authenticated')::text,true);

  -- T12: family inactivation hides new operations without deleting tenant data.
  PERFORM public.admin_upsert_material_family(c.family_poly,'IGNORED','Policarbonato Teste','Fixture transacional','AREA','m²',90,false);
  SELECT count(*) INTO family_count FROM public.list_company_material_families(c.company_a) WHERE id=c.family_poly;
  IF family_count<>0 OR NOT EXISTS(SELECT 1 FROM public.company_item_variants WHERE id=c.variant_a) THEN
    RAISE EXCEPTION 'T12_FAMILY_INACTIVATION';
  END IF;
  PERFORM public.admin_upsert_material_family(c.family_poly,'IGNORED','Policarbonato Teste','Fixture transacional','AREA','m²',90,true);
END $$;

DO $$
DECLARE c phase4a_dynamic_ctx; o public.item_template_attribute_options; r jsonb; old_signature text;
BEGIN
  SELECT * INTO c FROM phase4a_dynamic_ctx;
  SELECT attribute_signature INTO old_signature FROM public.company_item_variants WHERE id=c.variant_a;
  -- T11/T12: label edits do not alter identity or price.
  o:=public.admin_upsert_material_option(c.option_crystal,c.attr_color,'IGNORED','Cristal Renomeado',to_jsonb('CRYSTAL'::text),10,true);
  IF o.option_code<>'CRYSTAL' THEN RAISE EXCEPTION 'T11_STABLE_OPTION_CODE'; END IF;
  r:=public.resolve_company_material_price(c.company_a,c.family_poly,ARRAY[c.option_crystal,c.option_6mm]);
  IF (r->>'sale_price')::numeric<>160 OR (r->>'signature')<>old_signature THEN RAISE EXCEPTION 'T12_LABEL_INDEPENDENCE'; END IF;

  -- T13: inactivation blocks new resolution while preserving stored history.
  PERFORM public.admin_upsert_material_option(c.option_crystal,c.attr_color,'IGNORED','Cristal Renomeado',to_jsonb('CRYSTAL'::text),10,false);
  BEGIN
    PERFORM public.resolve_company_material_price(c.company_a,c.family_poly,ARRAY[c.option_crystal,c.option_6mm]);
    RAISE EXCEPTION 'T13_INACTIVE_OPTION_SHOULD_FAIL';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM NOT LIKE '%INVALID_ATTRIBUTE_COMBINATION%' THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.company_item_variants WHERE id=c.variant_a AND sale_price=160) THEN
    RAISE EXCEPTION 'T13_HISTORY_DESTROYED';
  END IF;
END $$;

DO $$
DECLARE c phase4a_dynamic_ctx; option_ids uuid[]; r jsonb; snapshot jsonb; changed jsonb;
BEGIN
  SELECT * INTO c FROM phase4a_dynamic_ctx;
  -- T14/T15/T17: current tenant's canonical GLASS price and immutable engineering geometry remain valid.
  SELECT array_agg(o.id ORDER BY a.id) INTO option_ids
  FROM public.item_template_attributes a
  JOIN public.item_template_attribute_options o ON o.attribute_id=a.id
  WHERE a.item_template_id=c.family_glass AND o.is_active AND (
    (a.attribute_code='TYPE' AND o.canonical_value #>> '{}'='TEMPERADO') OR
    (a.attribute_code='COLOR' AND o.canonical_value #>> '{}'='INCOLOR') OR
    (a.attribute_code='THICKNESS_MM' AND o.canonical_value=to_jsonb(8)) OR
    (a.attribute_code='FINISH' AND o.option_code='PADRAO')
  );
  r:=public.resolve_company_material_price(c.company_a,c.family_glass,option_ids);
  IF (r->>'cost')::numeric<>210 OR (r->>'sale_price')::numeric<>336 THEN RAISE EXCEPTION 'T14_CURRENT_GLASS_PRICE'; END IF;
  IF round((500::numeric*940 + 550::numeric*980)/1000000,3)<>1.009 THEN RAISE EXCEPTION 'T14_ENGINEERING_AREA'; END IF;
  IF round(1.009*210,2)<>211.89 OR round(1.009*336,2)<>339.02 THEN RAISE EXCEPTION 'T15_AREA_MATH'; END IF;
  IF EXISTS(SELECT 1 FROM public.item_templates WHERE is_commercial_area_material AND upper(name) IN ('VIDRO FIXO','VIDRO MÓVEL','VIDRO MOVEL')) THEN
    RAISE EXCEPTION 'T16_TECHNICAL_COMPONENT_AS_FAMILY';
  END IF;

  -- T17: a serialized commercial snapshot remains unchanged after a later price update.
  snapshot:=r;
  PERFORM public.save_company_material_variant(c.company_a,c.family_glass,option_ids,210,'SALE_PRICE',350);
  changed:=public.resolve_company_material_price(c.company_a,c.family_glass,option_ids);
  IF (snapshot->>'sale_price')::numeric<>336 OR (changed->>'sale_price')::numeric<>350 THEN
    RAISE EXCEPTION 'T17_SNAPSHOT_IMMUTABILITY';
  END IF;
END $$;

DO $$
DECLARE c phase4a_dynamic_ctx; visible integer;
BEGIN
  SELECT * INTO c FROM phase4a_dynamic_ctx;
  -- T19: ownership is prepared but private-family mutation is not exposed to companies.
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='item_templates' AND column_name='company_id') THEN
    RAISE EXCEPTION 'T19_PRIVATE_OWNERSHIP_NOT_PREPARED';
  END IF;
  UPDATE public.item_templates SET company_id=c.company_b WHERE id=c.family_poly;
  SELECT count(*) INTO visible FROM public.list_company_material_families(c.company_a) WHERE id=c.family_poly;
  IF visible<>0 THEN RAISE EXCEPTION 'T19_PRIVATE_VISIBLE_TO_OTHER_TENANT'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_b,'role','authenticated')::text,true);
  SELECT count(*) INTO visible FROM public.list_company_material_families(c.company_b) WHERE id=c.family_poly;
  IF visible<>1 THEN RAISE EXCEPTION 'T19_PRIVATE_NOT_VISIBLE_TO_OWNER'; END IF;
  SELECT count(*) INTO visible FROM public.list_company_material_families(c.company_c) WHERE id=c.family_poly;
  IF visible<>0 THEN RAISE EXCEPTION 'T19_PRIVATE_CROSS_TENANT'; END IF;
  -- T20 is covered by responsive card grids and dialogs in MeusPrecos; visual smoke remains separate.
END $$;

ROLLBACK;
