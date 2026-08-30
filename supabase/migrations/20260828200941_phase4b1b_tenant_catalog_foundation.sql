-- Phase 4B.1B: tenant projections of the global catalog.
-- Global authorities remain item_templates/product_templates/admin_aluminum_colors.
-- Operational identities are always tenant-owned company_* rows.

ALTER TABLE public.company_items
  ADD COLUMN catalog_origin text NOT NULL DEFAULT 'PRIVATE',
  ADD COLUMN code text;

ALTER TABLE public.company_items
  ADD CONSTRAINT company_items_catalog_origin_check
  CHECK (catalog_origin IN ('GLOBAL', 'PRIVATE'));

UPDATE public.company_items ci
SET catalog_origin = CASE WHEN ci.item_template_id IS NULL THEN 'PRIVATE' ELSE 'GLOBAL' END,
    code = COALESCE(ci.code, NULLIF(btrim(ci.specifications->>'code'), ''));

CREATE UNIQUE INDEX company_items_private_code_uidx
  ON public.company_items(company_id, lower(btrim(code)))
  WHERE catalog_origin = 'PRIVATE' AND NULLIF(btrim(code), '') IS NOT NULL;

CREATE TABLE public.company_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  admin_color_id uuid REFERENCES public.admin_aluminum_colors(id) ON DELETE RESTRICT,
  name text NOT NULL,
  code text NOT NULL,
  hex_color text,
  catalog_origin text NOT NULL DEFAULT 'PRIVATE'
    CHECK (catalog_origin IN ('GLOBAL', 'PRIVATE')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_colors_id_company_key UNIQUE (id, company_id),
  CONSTRAINT company_colors_global_shape_check CHECK (
    (catalog_origin = 'GLOBAL' AND admin_color_id IS NOT NULL)
    OR (catalog_origin = 'PRIVATE' AND admin_color_id IS NULL)
  ),
  CONSTRAINT company_colors_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT company_colors_code_check CHECK (btrim(code) <> '')
);

CREATE UNIQUE INDEX company_colors_global_uidx
  ON public.company_colors(company_id, admin_color_id)
  WHERE admin_color_id IS NOT NULL;
CREATE UNIQUE INDEX company_colors_code_uidx
  ON public.company_colors(company_id, lower(btrim(code)));
CREATE UNIQUE INDEX company_colors_name_uidx
  ON public.company_colors(company_id, lower(btrim(name)));
CREATE INDEX company_colors_company_active_idx
  ON public.company_colors(company_id, is_active, name);

ALTER TABLE public.company_item_variants
  ADD COLUMN company_color_id uuid;

ALTER TABLE public.company_item_variants
  ADD CONSTRAINT company_item_variants_company_color_scope_fkey
  FOREIGN KEY (company_color_id, company_id)
  REFERENCES public.company_colors(id, company_id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX company_item_variants_company_color_uidx
  ON public.company_item_variants(company_item_id, company_color_id)
  WHERE company_color_id IS NOT NULL;

ALTER TABLE public.quote_items ADD COLUMN profile_company_color_id uuid;
ALTER TABLE public.sale_items ADD COLUMN profile_company_color_id uuid;
ALTER TABLE public.os_items ADD COLUMN profile_company_color_id uuid;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_profile_company_color_id_fkey
  FOREIGN KEY (profile_company_color_id) REFERENCES public.company_colors(id) ON DELETE RESTRICT;
ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_profile_company_color_id_fkey
  FOREIGN KEY (profile_company_color_id) REFERENCES public.company_colors(id) ON DELETE RESTRICT;
ALTER TABLE public.os_items
  ADD CONSTRAINT os_items_profile_company_color_id_fkey
  FOREIGN KEY (profile_company_color_id) REFERENCES public.company_colors(id) ON DELETE RESTRICT;

CREATE INDEX quote_items_profile_company_color_idx ON public.quote_items(profile_company_color_id)
  WHERE profile_company_color_id IS NOT NULL;
CREATE INDEX sale_items_profile_company_color_idx ON public.sale_items(profile_company_color_id)
  WHERE profile_company_color_id IS NOT NULL;
CREATE INDEX os_items_profile_company_color_idx ON public.os_items(profile_company_color_id)
  WHERE profile_company_color_id IS NOT NULL;

-- A composition can only point at a tenant item belonging to its own tenant.
CREATE OR REPLACE FUNCTION public.phase4b1b_validate_company_product_item_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_product_company uuid; v_item_company uuid;
BEGIN
  SELECT company_id INTO v_product_company
  FROM public.company_products WHERE id = NEW.company_product_id;
  IF v_product_company IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='MISSING_COMPANY_PRODUCT';
  END IF;
  NEW.company_id := v_product_company;
  IF NEW.company_item_id IS NOT NULL THEN
    SELECT company_id INTO v_item_company
    FROM public.company_items WHERE id = NEW.company_item_id;
    IF v_item_company IS DISTINCT FROM v_product_company THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='CROSS_COMPANY_ITEM';
    END IF;
  END IF;
  IF NEW.company_item_id IS NULL AND NEW.item_template_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='MISSING_PRODUCT_COMPONENT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase4b1b_company_product_item_scope ON public.company_product_items;
CREATE TRIGGER trg_phase4b1b_company_product_item_scope
BEFORE INSERT OR UPDATE OF company_product_id, company_item_id, company_id
ON public.company_product_items
FOR EACH ROW EXECUTE FUNCTION public.phase4b1b_validate_company_product_item_scope();

-- Internal materializer. It is trigger-safe and deliberately not executable by clients.
CREATE OR REPLACE FUNCTION public.phase4b1b_materialize_company_catalog(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_items integer; v_colors integer; v_products integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
    RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='MISSING_COMPANY';
  END IF;

  INSERT INTO public.company_items(
    company_id,item_template_id,name,description,type,unit,cost,sale_price,
    specifications,image_url,linha,is_custom,is_active,ncm,cfop_venda,
    cfop_venda_interestadual,cest,origem,codigo_servico,aliquota_iss,
    bar_length_mm,weight_per_meter,pricing_basis,variant_attribute_schema,
    is_commercial_area_material,commercial_material_family,catalog_origin,code
  )
  SELECT _company_id,it.id,it.name,it.description,it.type::text,it.unit,0,0,
    it.specifications,it.image_url,it.linha,false,true,it.ncm,it.cfop_venda,
    it.cfop_venda_interestadual,it.cest,it.origem,it.codigo_servico,it.aliquota_iss,
    it.bar_length_mm,it.weight_per_meter,
    CASE WHEN lower(it.type::text) IN ('profile','perfil') THEN 'LENGTH'
         WHEN lower(it.type::text) IN ('glass','vidro','sheet','chapa') THEN 'AREA'
         ELSE COALESCE(it.pricing_basis,'UNIT') END,
    COALESCE(it.variant_attribute_schema,'[]'::jsonb),
    COALESCE(it.is_commercial_area_material,false),it.commercial_material_family,
    'GLOBAL',NULLIF(btrim(it.specifications->>'code'),'')
  FROM public.item_templates it
  WHERE it.company_id IS NULL AND it.is_active
  ON CONFLICT (company_id,item_template_id) DO UPDATE
  SET name=EXCLUDED.name,description=EXCLUDED.description,type=EXCLUDED.type,
      unit=EXCLUDED.unit,image_url=EXCLUDED.image_url,linha=EXCLUDED.linha,
      is_active=true,catalog_origin='GLOBAL',updated_at=now();
  GET DIAGNOSTICS v_items = ROW_COUNT;

  INSERT INTO public.inventory_item_units(
    company_id,company_item_id,physical_dimension,purchase_unit,stock_unit,
    consumption_unit,canonical_unit,purchase_to_canonical_factor,
    stock_to_canonical_factor,consumption_to_canonical_factor,nominal_length_mm,
    cost_policy,legacy_status,sale_unit,cost_unit
  )
  SELECT _company_id,ci.id,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'LENGTH'
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 'AREA'
         ELSE 'COUNT' END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'BAR'
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 'M2'
         ELSE 'UNIT' END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'M'
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 'M2'
         ELSE 'UNIT' END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'M'
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 'M2'
         ELSE 'UNIT' END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'MM'
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 'MM2'
         ELSE 'UNIT' END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN COALESCE(NULLIF(ci.bar_length_mm,0),6000)
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 1000000 ELSE 1 END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 1000
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 1000000 ELSE 1 END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 1000
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 1000000 ELSE 1 END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN COALESCE(NULLIF(ci.bar_length_mm,0),6000) END,
    'MANUAL','CONFIGURED',
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'M'
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 'M2' ELSE 'UNIT' END,
    CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'M'
         WHEN lower(ci.type) IN ('glass','vidro','sheet','chapa') THEN 'M2' ELSE 'UNIT' END
  FROM public.company_items ci
  WHERE ci.company_id=_company_id
    AND NOT EXISTS (SELECT 1 FROM public.inventory_item_units iu
                    WHERE iu.company_id=_company_id AND iu.company_item_id=ci.id)
  ON CONFLICT (company_id,company_item_id) DO NOTHING;

  INSERT INTO public.company_colors(company_id,admin_color_id,name,code,hex_color,catalog_origin,is_active)
  SELECT _company_id,c.id,c.name,c.slug,c.hex_color,'GLOBAL',true
  FROM public.admin_aluminum_colors c WHERE c.is_active
  ON CONFLICT (company_id,admin_color_id) WHERE admin_color_id IS NOT NULL DO UPDATE
  SET name=EXCLUDED.name,code=EXCLUDED.code,hex_color=EXCLUDED.hex_color,
      is_active=true,updated_at=now();
  GET DIAGNOSTICS v_colors = ROW_COUNT;

  UPDATE public.company_item_variants civ
  SET company_color_id=cc.id
  FROM public.company_colors cc
  WHERE civ.company_id=_company_id AND civ.company_color_id IS NULL
    AND civ.aluminum_color_id=cc.admin_color_id AND cc.company_id=_company_id;

  PERFORM public.activate_product_template_for_company(_company_id,pt.id)
  FROM public.product_templates pt
  WHERE pt.company_id IS NULL AND pt.is_active;
  GET DIAGNOSTICS v_products = ROW_COUNT;

  UPDATE public.company_product_items cpi
  SET company_id=cp.company_id
  FROM public.company_products cp
  WHERE cpi.company_product_id=cp.id AND cp.company_id=_company_id;

  UPDATE public.company_product_items cpi
  SET company_item_id=ci.id
  FROM public.company_products cp, public.company_items ci
  WHERE cpi.company_product_id=cp.id AND cp.company_id=_company_id
    AND cpi.company_item_id IS NULL AND cpi.item_template_id=ci.item_template_id
    AND ci.company_id=_company_id;

  RETURN jsonb_build_object('company_id',_company_id,'items_touched',v_items,
    'colors_touched',v_colors,'products_touched',v_products);
END;
$$;

REVOKE ALL ON FUNCTION public.phase4b1b_materialize_company_catalog(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase4b1b_materialize_company_catalog(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_company_catalog(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.user_belongs_to_company(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='UNAUTHORIZED';
  END IF;
  RETURN public.phase4b1b_materialize_company_catalog(_company_id);
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_company_catalog(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_company_catalog(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.phase4b1b_materialize_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.phase4b1b_materialize_company_catalog(NEW.id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_phase4b1b_materialize_new_company ON public.companies;
CREATE TRIGGER trg_phase4b1b_materialize_new_company
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.phase4b1b_materialize_new_company();
REVOKE ALL ON FUNCTION public.phase4b1b_materialize_new_company() FROM PUBLIC,anon,authenticated;

-- Materialize the current tenants without creating balances or copying prices.
SELECT public.phase4b1b_materialize_company_catalog(id) FROM public.companies;

ALTER TABLE public.company_colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_colors_select_tenant ON public.company_colors
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(),company_id));
CREATE POLICY company_colors_insert_manager ON public.company_colors
  FOR INSERT TO authenticated
  WITH CHECK (catalog_origin='PRIVATE' AND public.phase3e_can_manage_pricing(auth.uid(),company_id));
CREATE POLICY company_colors_update_manager ON public.company_colors
  FOR UPDATE TO authenticated
  USING (public.phase3e_can_manage_pricing(auth.uid(),company_id))
  WITH CHECK (public.phase3e_can_manage_pricing(auth.uid(),company_id));
CREATE POLICY company_colors_delete_manager ON public.company_colors
  FOR DELETE TO authenticated
  USING (catalog_origin='PRIVATE' AND public.phase3e_can_manage_pricing(auth.uid(),company_id));

REVOKE ALL ON TABLE public.company_colors FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.company_colors TO authenticated;
GRANT ALL ON TABLE public.company_colors TO service_role;

COMMENT ON COLUMN public.company_items.catalog_origin IS
  'GLOBAL is a tenant projection of item_templates; PRIVATE is tenant-owned. Both use the same operational engine.';
COMMENT ON TABLE public.company_colors IS
  'Tenant-visible profile colors. GLOBAL rows project admin_aluminum_colors; PRIVATE rows are tenant-owned.';
