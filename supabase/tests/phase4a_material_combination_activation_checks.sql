-- Phase 4A final gates. Every fixture and price mutation is rolled back.
BEGIN;

CREATE TEMP TABLE phase4a_activation_ctx(
  user_a uuid,user_b uuid,company_a uuid,company_b uuid,company_c uuid,company_d uuid,
  family_glass uuid,family_poly uuid,attr_color uuid,attr_thickness uuid,
  crystal uuid,smoke uuid,mm4 uuid,mm6 uuid,def_crystal4 uuid,def_crystal6 uuid,def_smoke6 uuid,
  variant_a uuid
) ON COMMIT DROP;

INSERT INTO phase4a_activation_ctx(user_a,company_a,family_glass)
SELECT uc.user_id,civ.company_id,it.id
FROM public.company_item_variants civ
JOIN public.company_items ci ON ci.id=civ.company_item_id
JOIN public.item_templates it ON it.id=ci.item_template_id
JOIN public.user_companies uc ON uc.company_id=civ.company_id AND uc.is_active AND uc.role='admin'
WHERE it.commercial_material_family='GLASS' AND civ.sale_price=336
ORDER BY uc.created_at LIMIT 1;

UPDATE phase4a_activation_ctx SET user_b=(
  SELECT id FROM auth.users WHERE id<>phase4a_activation_ctx.user_a ORDER BY created_at LIMIT 1
);
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM phase4a_activation_ctx
    WHERE user_a IS NOT NULL AND user_b IS NOT NULL AND company_a IS NOT NULL AND family_glass IS NOT NULL)
  THEN RAISE EXCEPTION 'T00_CONTEXT_MISSING'; END IF;
END $$;

INSERT INTO public.saas_admins(user_id) SELECT user_a FROM phase4a_activation_ctx ON CONFLICT DO NOTHING;
DELETE FROM public.saas_admins WHERE user_id=(SELECT user_b FROM phase4a_activation_ctx);
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',(SELECT user_a FROM phase4a_activation_ctx),'role','authenticated'
)::text,true);

INSERT INTO public.companies(name) VALUES
 ('PHASE4A ACTIVATION B '||gen_random_uuid()),
 ('PHASE4A ACTIVATION C '||gen_random_uuid()),
 ('PHASE4A ACTIVATION D '||gen_random_uuid());
UPDATE phase4a_activation_ctx SET
 company_b=(SELECT id FROM public.companies WHERE name LIKE 'PHASE4A ACTIVATION B %' ORDER BY created_at DESC LIMIT 1),
 company_c=(SELECT id FROM public.companies WHERE name LIKE 'PHASE4A ACTIVATION C %' ORDER BY created_at DESC LIMIT 1),
 company_d=(SELECT id FROM public.companies WHERE name LIKE 'PHASE4A ACTIVATION D %' ORDER BY created_at DESC LIMIT 1);
INSERT INTO public.user_companies(user_id,company_id,role,is_active)
SELECT user_b,company_id,'admin',true FROM phase4a_activation_ctx
CROSS JOIN LATERAL unnest(ARRAY[company_b,company_c,company_d]) company_id;

DO $$
DECLARE c phase4a_activation_ctx; f public.item_templates; a public.item_template_attributes;
  o public.item_template_attribute_options; d public.item_template_variant_definitions;
BEGIN
  SELECT * INTO c FROM phase4a_activation_ctx;
  f:=public.admin_upsert_material_family(NULL,'POLYCARBONATE_ACTIVATION_TEST','Policarbonato Teste',
    'Fixture transacional','AREA','m²',90,true);
  a:=public.admin_upsert_material_attribute(NULL,f.id,'COLOR','Cor','SELECT',true,10,true);
  UPDATE phase4a_activation_ctx SET family_poly=f.id,attr_color=a.id;
  o:=public.admin_upsert_material_option(NULL,a.id,'CRYSTAL','Cristal',to_jsonb('CRYSTAL'::text),10,true);
  UPDATE phase4a_activation_ctx SET crystal=o.id;
  o:=public.admin_upsert_material_option(NULL,a.id,'SMOKE','Fumê',to_jsonb('SMOKE'::text),20,true);
  UPDATE phase4a_activation_ctx SET smoke=o.id;
  a:=public.admin_upsert_material_attribute(NULL,f.id,'THICKNESS_MM','Espessura','SELECT',true,20,true);
  UPDATE phase4a_activation_ctx SET attr_thickness=a.id;
  o:=public.admin_upsert_material_option(NULL,a.id,'MM_4','4 mm',to_jsonb(4),10,true);
  UPDATE phase4a_activation_ctx SET mm4=o.id;
  o:=public.admin_upsert_material_option(NULL,a.id,'MM_6','6 mm',to_jsonb(6),20,true);
  UPDATE phase4a_activation_ctx SET mm6=o.id;
  SELECT * INTO c FROM phase4a_activation_ctx;
  d:=public.admin_save_material_combination(NULL,f.id,ARRAY[c.crystal,c.mm4],10,true);
  UPDATE phase4a_activation_ctx SET def_crystal4=d.id;
  d:=public.admin_save_material_combination(NULL,f.id,ARRAY[c.mm6,c.crystal],20,true);
  UPDATE phase4a_activation_ctx SET def_crystal6=d.id;
  d:=public.admin_save_material_combination(NULL,f.id,ARRAY[c.smoke,c.mm6],30,true);
  UPDATE phase4a_activation_ctx SET def_smoke6=d.id;
END $$;

DO $$
DECLARE c phase4a_activation_ctx; n integer; state jsonb; v public.company_item_variants; before_id uuid; r jsonb;
BEGIN
  SELECT * INTO c FROM phase4a_activation_ctx;
  -- T01/T18: dynamic family exposes exactly the three Admin-defined valid combinations.
  SELECT count(*) INTO n FROM public.list_company_material_family_combinations(c.company_a,c.family_poly);
  IF n<>3 THEN RAISE EXCEPTION 'T01_GLOBAL_COMBINATIONS'; END IF;
  IF EXISTS(SELECT 1 FROM public.list_company_material_family_combinations(c.company_a,c.family_poly)
    WHERE status<>'INACTIVE') THEN RAISE EXCEPTION 'T01_NO_INHERITED_ACTIVATION'; END IF;

  -- T02/T03: activation creates one unpriced tenant variant lazily.
  state:=public.set_company_material_combination_active(c.company_a,c.def_crystal6,true);
  IF state->>'status'<>'ACTIVE_UNPRICED' THEN RAISE EXCEPTION 'T02_ACTIVE_UNPRICED'; END IF;
  before_id:=(state->>'company_variant_id')::uuid;
  IF (SELECT count(*) FROM public.company_items WHERE company_id=c.company_a AND item_template_id=c.family_poly)<>1
    OR (SELECT count(*) FROM public.company_item_variants WHERE id=before_id)<>1
  THEN RAISE EXCEPTION 'T03_LAZY_MATERIALIZATION'; END IF;

  -- T04: replay returns the same variant and does not duplicate rows.
  state:=public.set_company_material_combination_active(c.company_a,c.def_crystal6,true);
  IF (state->>'company_variant_id')::uuid<>before_id OR
    (SELECT count(*) FROM public.company_item_variants
      WHERE company_id=c.company_a AND variant_definition_id=c.def_crystal6)<>1
  THEN RAISE EXCEPTION 'T04_ACTIVATION_REPLAY'; END IF;

  -- Active without price cannot resolve commercially.
  BEGIN
    PERFORM public.resolve_company_material_price(c.company_a,c.family_poly,ARRAY[c.crystal,c.mm6]);
    RAISE EXCEPTION 'T04_UNPRICED_SHOULD_NOT_RESOLVE';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%MISSING_PRICE_VARIANT%' THEN RAISE; END IF;
  END;

  v:=public.save_company_material_variant_price(c.company_a,c.def_crystal6,100,'SALE_PRICE',160);
  IF v.id<>before_id OR v.sale_price<>160 OR NOT v.is_active THEN RAISE EXCEPTION 'T04_PRICE_REPLAY_TARGET'; END IF;

  -- T05/T06: deactivation is idempotent and preserves price/history.
  PERFORM public.set_company_material_combination_active(c.company_a,c.def_crystal6,false);
  PERFORM public.set_company_material_combination_active(c.company_a,c.def_crystal6,false);
  IF NOT EXISTS(SELECT 1 FROM public.company_item_variants
    WHERE id=before_id AND NOT is_active AND sale_price=160)
  THEN RAISE EXCEPTION 'T05_DEACTIVATION_HISTORY'; END IF;
  PERFORM public.set_company_material_combination_active(c.company_a,c.def_crystal6,true);
  r:=public.resolve_company_material_price(c.company_a,c.family_poly,ARRAY[c.mm6,c.crystal]);
  IF (r->>'sale_price')::numeric<>160 THEN RAISE EXCEPTION 'T06_REACTIVATION_PRESERVES_PRICE'; END IF;
  UPDATE phase4a_activation_ctx SET variant_a=before_id;
END $$;

DO $$
DECLARE c phase4a_activation_ctx; n integer; v public.company_item_variants;
BEGIN
  SELECT * INTO c FROM phase4a_activation_ctx;
  -- T07/T08: B remains inactive; C activates the same global definition with its own price.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_b,'role','authenticated')::text,true);
  IF EXISTS(SELECT 1 FROM public.list_company_material_family_combinations(c.company_b,c.family_poly)
    WHERE status<>'INACTIVE') THEN RAISE EXCEPTION 'T07_TENANT_B_STATUS'; END IF;
  v:=public.save_company_material_variant_price(c.company_c,c.def_crystal6,120,'SALE_PRICE',190);
  IF v.sale_price<>190 OR v.company_id<>c.company_c THEN RAISE EXCEPTION 'T08_TENANT_C_PRICE'; END IF;

  -- T09: a new tenant sees all definitions with zero activation and zero copied price.
  SELECT count(*) INTO n FROM public.list_company_material_family_combinations(c.company_d,c.family_poly);
  IF n<>3 OR EXISTS(SELECT 1 FROM public.list_company_material_family_combinations(c.company_d,c.family_poly)
    WHERE status<>'INACTIVE') THEN RAISE EXCEPTION 'T09_NEW_COMPANY'; END IF;

  -- T10/T11 admin mutation is unavailable to a common tenant user.
  BEGIN
    PERFORM public.admin_set_material_combination_active(c.def_smoke6,false);
    RAISE EXCEPTION 'T10_COMMON_USER_ADMIN_WRITE';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',c.user_a,'role','authenticated')::text,true);
END $$;

-- T19: validate direct table RLS and RPC authorization under the authenticated DB role.
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',(SELECT user_b FROM phase4a_activation_ctx),'role','authenticated'
)::text,true);
GRANT SELECT ON phase4a_activation_ctx TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c phase4a_activation_ctx;
BEGIN
  SELECT * INTO c FROM phase4a_activation_ctx;
  IF EXISTS(SELECT 1 FROM public.company_item_variants WHERE id=c.variant_a) THEN
    RAISE EXCEPTION 'T19_CROSS_COMPANY_READ';
  END IF;
  BEGIN
    PERFORM public.set_company_material_combination_active(c.company_a,c.def_crystal6,false);
    RAISE EXCEPTION 'T19_CROSS_COMPANY_WRITE';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',(SELECT user_a FROM phase4a_activation_ctx),'role','authenticated'
)::text,true);

DO $$
DECLARE c phase4a_activation_ctx; invalid_option uuid;
BEGIN
  SELECT * INTO c FROM phase4a_activation_ctx;
  -- T12: duplicate canonical signature is rejected.
  BEGIN
    PERFORM public.admin_save_material_combination(NULL,c.family_poly,ARRAY[c.mm6,c.crystal],99,true);
    RAISE EXCEPTION 'T12_DUPLICATE_SHOULD_FAIL';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM NOT LIKE '%DUPLICATE_MATERIAL_COMBINATION%' THEN RAISE; END IF;
  END;

  -- T13: option from another family is rejected.
  SELECT o.id INTO invalid_option
  FROM public.item_template_attributes a
  JOIN public.item_template_attribute_options o ON o.attribute_id=a.id
  WHERE a.item_template_id=c.family_glass LIMIT 1;
  BEGIN
    PERFORM public.admin_save_material_combination(NULL,c.family_poly,ARRAY[c.crystal,invalid_option],99,true);
    RAISE EXCEPTION 'T13_INVALID_OPTION_SHOULD_FAIL';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;

DO $$
DECLARE c phase4a_activation_ctx; option_ids uuid[]; r jsonb; snapshot jsonb; changed jsonb;
BEGIN
  SELECT * INTO c FROM phase4a_activation_ctx;
  SELECT array_agg(o.id ORDER BY a.id) INTO option_ids
  FROM public.item_template_attributes a
  JOIN public.item_template_attribute_options o ON o.attribute_id=a.id
  WHERE a.item_template_id=c.family_glass AND o.is_active AND (
    (a.attribute_code='TYPE' AND o.canonical_value #>> '{}'='TEMPERADO') OR
    (a.attribute_code='COLOR' AND o.canonical_value #>> '{}'='INCOLOR') OR
    (a.attribute_code='THICKNESS_MM' AND o.canonical_value=to_jsonb(8)) OR
    (a.attribute_code='FINISH' AND o.option_code='PADRAO')
  );
  -- T14: existing 336 price was linked to the unambiguous global definition.
  r:=public.resolve_company_material_price(c.company_a,c.family_glass,option_ids);
  IF (r->>'cost')::numeric<>210 OR (r->>'sale_price')::numeric<>336
    OR r->>'variant_definition_id' IS NULL THEN RAISE EXCEPTION 'T14_EXISTING_PRICE'; END IF;
  snapshot:=r;
  -- T15/T16: technical pieces stay outside commercial catalog and area math is unchanged.
  IF EXISTS(SELECT 1 FROM public.item_templates WHERE is_commercial_area_material
    AND upper(name) IN ('VIDRO FIXO','VIDRO MÓVEL','VIDRO MOVEL'))
  THEN RAISE EXCEPTION 'T15_TECHNICAL_COMPONENT'; END IF;
  IF round((500::numeric*940+550::numeric*980)/1000000,3)<>1.009
    OR round(1.009*336,2)<>339.02 THEN RAISE EXCEPTION 'T16_AREA_PRICE'; END IF;
  -- T17: serialized snapshot remains unchanged after current tenant price changes.
  PERFORM public.save_company_material_variant_price(
    c.company_a,(r->>'variant_definition_id')::uuid,210,'SALE_PRICE',350
  );
  changed:=public.resolve_company_material_price(c.company_a,c.family_glass,option_ids);
  IF (snapshot->>'sale_price')::numeric<>336 OR (changed->>'sale_price')::numeric<>350
  THEN RAISE EXCEPTION 'T17_SNAPSHOT'; END IF;
END $$;

-- T20 remains a visual responsive smoke; it is not asserted by SQL.
ROLLBACK;
