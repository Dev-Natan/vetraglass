-- Phase 4A.3 extensibility and tenant-isolation fixtures. Always rolled back.
BEGIN;

CREATE TEMP TABLE p4a3_tenant_ctx(
  admin_user uuid, tenant_user uuid, company_a uuid, company_b uuid, company_c uuid,
  family_id uuid, definition_id uuid
) ON COMMIT DROP;

INSERT INTO p4a3_tenant_ctx(admin_user, tenant_user, family_id)
SELECT sa.user_id,
  (SELECT u.id FROM auth.users u WHERE u.id <> sa.user_id ORDER BY u.created_at LIMIT 1),
  (SELECT id FROM public.item_templates WHERE company_id IS NULL
    AND is_commercial_area_material AND commercial_material_family='GLASS')
FROM public.saas_admins sa ORDER BY sa.created_at LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM p4a3_tenant_ctx WHERE admin_user IS NOT NULL
    AND tenant_user IS NOT NULL AND family_id IS NOT NULL)
  THEN RAISE EXCEPTION 'T39_FIXTURE_CONTEXT_MISSING'; END IF;
END $$;

INSERT INTO public.companies(name) VALUES
  ('P4A3 TENANT A '||gen_random_uuid()),('P4A3 TENANT B '||gen_random_uuid()),
  ('P4A3 TENANT C '||gen_random_uuid());
UPDATE p4a3_tenant_ctx SET
  company_a=(SELECT id FROM public.companies WHERE name LIKE 'P4A3 TENANT A %' ORDER BY created_at DESC LIMIT 1),
  company_b=(SELECT id FROM public.companies WHERE name LIKE 'P4A3 TENANT B %' ORDER BY created_at DESC LIMIT 1),
  company_c=(SELECT id FROM public.companies WHERE name LIKE 'P4A3 TENANT C %' ORDER BY created_at DESC LIMIT 1);
INSERT INTO public.user_companies(user_id,company_id,role,is_active)
SELECT admin_user,company_a,'admin'::public.app_role,true FROM p4a3_tenant_ctx
UNION ALL SELECT tenant_user,company_b,'admin'::public.app_role,true FROM p4a3_tenant_ctx
UNION ALL SELECT tenant_user,company_c,'admin'::public.app_role,true FROM p4a3_tenant_ctx;

SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',(SELECT admin_user FROM p4a3_tenant_ctx),'role','authenticated')::text,true);

DO $$
DECLARE c p4a3_tenant_ctx; type_attr uuid; reflected uuid; bronze uuid; mm12 uuid;
  standard uuid; definition public.item_template_variant_definitions;
BEGIN
  SELECT * INTO c FROM p4a3_tenant_ctx;
  SELECT id INTO type_attr FROM public.item_template_attributes
    WHERE item_template_id=c.family_id AND attribute_code='TYPE';
  reflected := (public.admin_upsert_material_option(NULL,type_attr,'REFLETIVO_P4A3',
    'Vidro Refletivo Fixture',to_jsonb('REFLETIVO_P4A3'::text),99,true)).id;
  SELECT o.id INTO bronze FROM public.item_template_attribute_options o
    JOIN public.item_template_attributes a ON a.id=o.attribute_id
    WHERE a.item_template_id=c.family_id AND a.attribute_code='COLOR' AND o.option_code='BRONZE';
  SELECT o.id INTO mm12 FROM public.item_template_attribute_options o
    JOIN public.item_template_attributes a ON a.id=o.attribute_id
    WHERE a.item_template_id=c.family_id AND a.attribute_code='THICKNESS_MM' AND o.option_code='MM_12';
  SELECT o.id INTO standard FROM public.item_template_attribute_options o
    JOIN public.item_template_attributes a ON a.id=o.attribute_id
    WHERE a.item_template_id=c.family_id AND a.attribute_code='FINISH' AND o.option_code='PADRAO';
  definition := public.admin_save_material_combination(NULL,c.family_id,
    ARRAY[reflected,bronze,mm12,standard],990,true);
  UPDATE p4a3_tenant_ctx SET definition_id=definition.id;
END $$;

DO $$
DECLARE c p4a3_tenant_ctx; row_a public.company_item_variants;
BEGIN
  SELECT * INTO c FROM p4a3_tenant_ctx;
  -- T40-T48/T51-T54: a generic Admin-created type appears to every tenant,
  -- initially inactive, and each tenant owns a distinct price.
  IF NOT EXISTS (SELECT 1 FROM public.list_company_material_family_combinations(c.company_a,c.family_id)
    WHERE definition_id=c.definition_id AND status='INACTIVE')
  THEN RAISE EXCEPTION 'T40_T47_DYNAMIC_DEFINITION_NOT_VISIBLE'; END IF;
  row_a:=public.save_company_material_variant_price(c.company_a,c.definition_id,100,'SALE_PRICE',150);
  IF row_a.company_id<>c.company_a OR row_a.sale_price<>150 THEN RAISE EXCEPTION 'T51_T53_TENANT_A'; END IF;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.tenant_user,'role','authenticated')::text,true);
  IF NOT EXISTS (SELECT 1 FROM public.list_company_material_family_combinations(c.company_b,c.family_id)
    WHERE definition_id=c.definition_id AND status='INACTIVE')
  THEN RAISE EXCEPTION 'T45_T47_TENANT_B_INACTIVE'; END IF;
  PERFORM public.save_company_material_variant_price(c.company_b,c.definition_id,120,'SALE_PRICE',180);
  IF NOT EXISTS (SELECT 1 FROM public.list_company_material_family_combinations(c.company_c,c.family_id)
    WHERE definition_id=c.definition_id AND status='INACTIVE')
  THEN RAISE EXCEPTION 'T56_NEW_TENANT_INHERITED_PRICE'; END IF;
  BEGIN
    PERFORM 1 FROM public.list_company_material_family_combinations(c.company_a,c.family_id);
    RAISE EXCEPTION 'T55_CROSS_COMPANY_RPC_ALLOWED';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.admin_user,'role','authenticated')::text,true);
  PERFORM public.admin_set_material_combination_active(c.definition_id,false);
  IF (SELECT count(*) FROM public.company_item_variants WHERE variant_definition_id=c.definition_id)<>2
  THEN RAISE EXCEPTION 'T49_T50_INACTIVATION_BROKE_HISTORY'; END IF;
END $$;

ROLLBACK;
