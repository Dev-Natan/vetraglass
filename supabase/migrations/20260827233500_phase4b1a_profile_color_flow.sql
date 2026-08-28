-- Phase 4B.1A: profile color is a canonical operational variant from quote to consumption.
-- Existing NULL variants remain historical and are never reclassified automatically.

ALTER TABLE public.inventory_item_units
  ADD COLUMN cost_unit text;

UPDATE public.inventory_item_units
SET cost_unit = COALESCE(cost_unit, sale_unit, consumption_unit)
WHERE cost_unit IS NULL;

ALTER TABLE public.quote_items
  ADD COLUMN profile_color_id uuid,
  ADD COLUMN profile_color_code text,
  ADD COLUMN profile_color_name text;

ALTER TABLE public.sale_items
  ADD COLUMN profile_color_id uuid,
  ADD COLUMN profile_color_code text,
  ADD COLUMN profile_color_name text;

ALTER TABLE public.os_items
  ADD COLUMN profile_color_id uuid,
  ADD COLUMN profile_color_code text,
  ADD COLUMN profile_color_name text;

ALTER TABLE public.os_materials
  ADD COLUMN variant_id uuid;

ALTER TABLE public.material_consumption
  ADD COLUMN variant_id uuid;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_profile_color_id_fkey
  FOREIGN KEY (profile_color_id) REFERENCES public.admin_aluminum_colors(id) ON DELETE RESTRICT;
ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_profile_color_id_fkey
  FOREIGN KEY (profile_color_id) REFERENCES public.admin_aluminum_colors(id) ON DELETE RESTRICT;
ALTER TABLE public.os_items
  ADD CONSTRAINT os_items_profile_color_id_fkey
  FOREIGN KEY (profile_color_id) REFERENCES public.admin_aluminum_colors(id) ON DELETE RESTRICT;
ALTER TABLE public.os_materials
  ADD CONSTRAINT os_materials_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.company_item_variants(id) ON DELETE RESTRICT;
ALTER TABLE public.material_consumption
  ADD CONSTRAINT material_consumption_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.company_item_variants(id) ON DELETE RESTRICT;

CREATE INDEX quote_items_profile_color_id_idx ON public.quote_items(profile_color_id)
  WHERE profile_color_id IS NOT NULL;
CREATE INDEX sale_items_profile_color_id_idx ON public.sale_items(profile_color_id)
  WHERE profile_color_id IS NOT NULL;
CREATE INDEX os_items_profile_color_id_idx ON public.os_items(profile_color_id)
  WHERE profile_color_id IS NOT NULL;
CREATE INDEX os_materials_variant_id_idx ON public.os_materials(variant_id)
  WHERE variant_id IS NOT NULL;
CREATE INDEX material_consumption_variant_id_idx ON public.material_consumption(variant_id)
  WHERE variant_id IS NOT NULL;

COMMENT ON COLUMN public.inventory_item_units.cost_unit IS
  'Tenant display basis for cost entry. Stored commercial amounts remain normalized to the canonical pricing basis.';
COMMENT ON COLUMN public.quote_items.profile_color_id IS
  'Canonical global profile color selected at quote time; code/name are immutable readable snapshot fields.';
COMMENT ON COLUMN public.os_materials.variant_id IS
  'Tenant-owned operational variant copied from the immutable quote engineering snapshot.';
COMMENT ON COLUMN public.material_consumption.variant_id IS
  'Tenant-owned operational variant that must match reservation and physical consumption.';

-- Normalize the 4B.1 profile attribute representation used by the commercial
-- resolver while keeping aluminum_color_id as the stable relational identity.
UPDATE public.company_item_variants civ
SET attributes = jsonb_build_object('color', upper(c.slug)),
    attribute_signature = 'COLOR_ID=' || c.id::text,
    profile_color = c.name,
    updated_at = now()
FROM public.admin_aluminum_colors c
WHERE c.id = civ.aluminum_color_id
  AND civ.variant_type = 'PROFILE';

CREATE OR REPLACE FUNCTION public.set_company_profile_variant_active(
  _company_id uuid,
  _company_item_id uuid,
  _aluminum_color_id uuid,
  _is_active boolean,
  _cost numeric DEFAULT NULL,
  _sale_price numeric DEFAULT NULL
)
RETURNS public.company_item_variants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.company_items;
  v_color public.admin_aluminum_colors;
  v_variant public.company_item_variants;
  v_old jsonb;
BEGIN
  IF v_user_id IS NULL OR NOT public.phase3e_can_manage_pricing(v_user_id, _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  SELECT * INTO v_item FROM public.company_items
  WHERE id = _company_item_id AND company_id = _company_id FOR UPDATE;
  IF v_item.id IS NULL OR lower(v_item.type) NOT IN ('profile','perfil') THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
  END IF;
  SELECT * INTO v_color FROM public.admin_aluminum_colors
  WHERE id = _aluminum_color_id AND is_active;
  IF v_color.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_PROFILE_COLOR';
  END IF;
  IF COALESCE(_cost, 0) < 0 OR COALESCE(_sale_price, 0) < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICE';
  END IF;

  SELECT * INTO v_variant FROM public.company_item_variants
  WHERE company_id = _company_id
    AND company_item_id = _company_item_id
    AND aluminum_color_id = _aluminum_color_id
  FOR UPDATE;
  v_old := CASE WHEN v_variant.id IS NULL THEN NULL ELSE to_jsonb(v_variant) END;

  IF v_variant.id IS NULL THEN
    INSERT INTO public.company_item_variants(
      company_id, company_item_id, variant_type, profile_color,
      cost, sale_price, is_active, pricing_basis, attributes,
      attribute_signature, aluminum_color_id
    ) VALUES (
      _company_id, _company_item_id, 'PROFILE', v_color.name,
      _cost, _sale_price, _is_active, 'LENGTH',
      jsonb_build_object('color', upper(v_color.slug)),
      'COLOR_ID=' || v_color.id::text, v_color.id
    ) RETURNING * INTO v_variant;
  ELSE
    UPDATE public.company_item_variants
    SET profile_color = v_color.name,
        cost = COALESCE(_cost, cost),
        sale_price = COALESCE(_sale_price, sale_price),
        is_active = _is_active,
        pricing_basis = 'LENGTH',
        attributes = jsonb_build_object('color', upper(v_color.slug)),
        attribute_signature = 'COLOR_ID=' || v_color.id::text,
        updated_at = now()
    WHERE id = v_variant.id
    RETURNING * INTO v_variant;
  END IF;

  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,old_data,new_data,metadata)
  VALUES (v_user_id,_company_id,
    CASE WHEN v_old IS NULL THEN 'insert' ELSE 'update' END,
    'company_item_variants',v_variant.id,v_old,to_jsonb(v_variant),
    jsonb_build_object('source','phase4b1a_profile_variant_activation'));
  RETURN v_variant;
END;
$$;

REVOKE ALL ON FUNCTION public.set_company_profile_variant_active(uuid,uuid,uuid,boolean,numeric,numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_profile_variant_active(uuid,uuid,uuid,boolean,numeric,numeric)
  TO authenticated, service_role;

-- Only colors configured for every profile component of the product are valid
-- choices in the common quote flow. Stock quantity deliberately does not enter
-- this query.
CREATE OR REPLACE FUNCTION public.get_company_product_profile_colors(
  _company_id uuid,
  _company_product_id uuid
)
RETURNS TABLE(
  color_id uuid,
  color_code text,
  color_name text,
  hex_color text,
  sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH profile_components AS (
    SELECT DISTINCT ci.id AS company_item_id
    FROM public.company_product_items cpi
    JOIN public.company_products cp
      ON cp.id = cpi.company_product_id AND cp.company_id = _company_id
    JOIN public.company_items ci
      ON ci.id = cpi.company_item_id AND ci.company_id = _company_id
    WHERE cpi.company_product_id = _company_product_id
      AND ci.is_active
      AND lower(ci.type) IN ('profile','perfil')
  ), totals AS (
    SELECT count(*)::integer AS component_count FROM profile_components
  )
  SELECT c.id, c.slug, c.name, c.hex_color, c.sort_order
  FROM public.admin_aluminum_colors c
  JOIN public.company_item_variants civ
    ON civ.aluminum_color_id = c.id
   AND civ.company_id = _company_id
   AND civ.is_active
   AND civ.variant_type = 'PROFILE'
  JOIN profile_components pc ON pc.company_item_id = civ.company_item_id
  CROSS JOIN totals t
  WHERE auth.uid() IS NOT NULL
    AND public.user_belongs_to_company(auth.uid(), _company_id)
    AND c.is_active
    AND t.component_count > 0
  GROUP BY c.id,c.slug,c.name,c.hex_color,c.sort_order,t.component_count
  HAVING count(DISTINCT pc.company_item_id) = t.component_count
  ORDER BY c.sort_order,c.name;
$$;

REVOKE ALL ON FUNCTION public.get_company_product_profile_colors(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_product_profile_colors(uuid,uuid)
  TO authenticated, service_role;

-- Freeze canonical plus human-readable color identity on quote snapshots.
CREATE OR REPLACE FUNCTION public.phase4b1a_freeze_quote_profile_color()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_color public.admin_aluminum_colors;
  v_color_id uuid;
  v_material jsonb;
  v_materials jsonb := '[]'::jsonb;
  v_variant public.company_item_variants;
BEGIN
  IF NEW.composition_snapshot IS NULL OR jsonb_typeof(NEW.composition_snapshot) <> 'object' THEN
    RETURN NEW;
  END IF;
  SELECT q.company_id INTO v_company_id FROM public.quotes q WHERE q.id = NEW.quote_id;
  v_color_id := NULLIF(NEW.composition_snapshot#>>'{variants,profile_color_id}', '')::uuid;
  IF v_color_id IS NULL THEN
    NEW.profile_color_id := NULL;
    NEW.profile_color_code := NULL;
    NEW.profile_color_name := NULL;
    RETURN NEW;
  END IF;
  SELECT * INTO v_color FROM public.admin_aluminum_colors WHERE id = v_color_id;
  IF v_color.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='INVALID_PROFILE_COLOR';
  END IF;

  NEW.profile_color_id := v_color.id;
  NEW.profile_color_code := v_color.slug;
  NEW.profile_color_name := v_color.name;
  NEW.aluminum_color := v_color.name;
  NEW.composition_snapshot := jsonb_set(
    NEW.composition_snapshot,
    '{variants}',
    COALESCE(NEW.composition_snapshot->'variants','{}'::jsonb) || jsonb_build_object(
      'profile_color_id',v_color.id,
      'profile_color_code',v_color.slug,
      'profile_color_name',v_color.name,
      'profile_color',v_color.name
    ),
    true
  );

  IF jsonb_typeof(NEW.composition_snapshot->'materials') = 'array' THEN
    FOR v_material IN SELECT value FROM jsonb_array_elements(NEW.composition_snapshot->'materials')
    LOOP
      IF lower(COALESCE(v_material->>'material_type','')) IN ('profile','perfil') THEN
        v_variant := NULL;
        IF NULLIF(v_material->>'variant_id','') IS NOT NULL THEN
          SELECT * INTO v_variant FROM public.company_item_variants civ
          WHERE civ.id = (v_material->>'variant_id')::uuid
            AND civ.company_id = v_company_id
            AND civ.company_item_id = NULLIF(v_material->>'company_item_id','')::uuid
            AND civ.aluminum_color_id = v_color.id;
          IF v_variant.id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PROFILE_VARIANT_NOT_CONFIGURED',
              DETAIL=COALESCE(v_material->>'item_name','Perfil') || ' | ' || v_color.name;
          END IF;
        END IF;
        v_material := v_material || jsonb_build_object(
          'profile_color_id',v_color.id,
          'profile_color_code',v_color.slug,
          'profile_color_name',v_color.name
        );
      END IF;
      v_materials := v_materials || jsonb_build_array(v_material);
    END LOOP;
    NEW.composition_snapshot := jsonb_set(NEW.composition_snapshot,'{materials}',v_materials,true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase4b1a_freeze_quote_profile_color ON public.quote_items;
CREATE TRIGGER trg_phase4b1a_freeze_quote_profile_color
BEFORE INSERT OR UPDATE OF composition_snapshot ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_freeze_quote_profile_color();

REVOKE ALL ON FUNCTION public.phase4b1a_freeze_quote_profile_color()
  FROM PUBLIC, anon, authenticated;

-- Sale and OS rows expose the immutable quote color without consulting the
-- current global catalog.
CREATE OR REPLACE FUNCTION public.phase4b1a_sync_document_profile_color()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.profile_color_id := NULLIF(NEW.engineering_snapshot#>>'{variants,profile_color_id}','')::uuid;
  NEW.profile_color_code := NULLIF(NEW.engineering_snapshot#>>'{variants,profile_color_code}','');
  NEW.profile_color_name := NULLIF(NEW.engineering_snapshot#>>'{variants,profile_color_name}','');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase4b1a_sale_item_profile_color ON public.sale_items;
CREATE TRIGGER trg_phase4b1a_sale_item_profile_color
BEFORE INSERT OR UPDATE OF engineering_snapshot ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_sync_document_profile_color();

DROP TRIGGER IF EXISTS trg_phase4b1a_os_item_profile_color ON public.os_items;
CREATE TRIGGER trg_phase4b1a_os_item_profile_color
BEFORE INSERT OR UPDATE OF engineering_snapshot ON public.os_items
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_sync_document_profile_color();

REVOKE ALL ON FUNCTION public.phase4b1a_sync_document_profile_color()
  FROM PUBLIC, anon, authenticated;

-- Material rows derive their FK from the immutable snapshot. A selected color
-- with a missing component variant blocks operational materialization with an
-- explicit error; it never falls back to another color or to NULL stock.
CREATE OR REPLACE FUNCTION public.phase4b1a_sync_material_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_color_id uuid;
  v_item_type text;
BEGIN
  SELECT os.company_id INTO v_company_id
  FROM public.ordens_servico os WHERE os.id = NEW.ordem_servico_id;
  NEW.variant_id := NULLIF(NEW.snapshot_payload->>'variant_id','')::uuid;
  v_color_id := NULLIF(NEW.snapshot_payload->>'profile_color_id','')::uuid;
  SELECT lower(ci.type) INTO v_item_type
  FROM public.company_items ci
  WHERE ci.id = NEW.company_item_id AND ci.company_id = v_company_id;

  IF v_item_type IN ('profile','perfil') AND v_color_id IS NOT NULL THEN
    IF NEW.variant_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.company_item_variants civ
      WHERE civ.id = NEW.variant_id
        AND civ.company_id = v_company_id
        AND civ.company_item_id = NEW.company_item_id
        AND civ.aluminum_color_id = v_color_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PROFILE_VARIANT_NOT_CONFIGURED',
        DETAIL=COALESCE(NEW.item_name,'Perfil');
    END IF;
  ELSIF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_item_variants civ
    WHERE civ.id = NEW.variant_id
      AND civ.company_id = v_company_id
      AND civ.company_item_id = NEW.company_item_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='INVALID_VARIANT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase4b1a_os_material_variant ON public.os_materials;
CREATE TRIGGER trg_phase4b1a_os_material_variant
BEFORE INSERT OR UPDATE OF snapshot_payload,variant_id,company_item_id ON public.os_materials
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_sync_material_variant();

DROP TRIGGER IF EXISTS trg_phase4b1a_material_consumption_variant ON public.material_consumption;
CREATE TRIGGER trg_phase4b1a_material_consumption_variant
BEFORE INSERT OR UPDATE OF snapshot_payload,variant_id,company_item_id ON public.material_consumption
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_sync_material_variant();

REVOKE ALL ON FUNCTION public.phase4b1a_sync_material_variant()
  FROM PUBLIC, anon, authenticated;

-- Canonical physical entries for a profile become variant-required as soon as
-- the tenant activates any color for that item. Historical NULL balances and
-- movements remain untouched.
CREATE OR REPLACE FUNCTION public.phase4b1a_require_physical_profile_variant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_type text;
BEGIN
  SELECT lower(ci.type) INTO v_type
  FROM public.company_items ci
  WHERE ci.id = NEW.company_item_id AND ci.company_id = NEW.company_id;
  IF v_type IN ('profile','perfil') AND EXISTS (
    SELECT 1 FROM public.company_item_variants civ
    WHERE civ.company_id = NEW.company_id
      AND civ.company_item_id = NEW.company_item_id
      AND civ.variant_type = 'PROFILE' AND civ.is_active
  ) AND NEW.variant_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PROFILE_VARIANT_REQUIRED';
  END IF;
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_item_variants civ
    WHERE civ.id=NEW.variant_id AND civ.company_id=NEW.company_id
      AND civ.company_item_id=NEW.company_item_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='INVALID_VARIANT';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase4b1a_require_balance_variant ON public.physical_stock_balances;
CREATE TRIGGER trg_phase4b1a_require_balance_variant
BEFORE INSERT OR UPDATE OF company_id,company_item_id,variant_id ON public.physical_stock_balances
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_require_physical_profile_variant();

DROP TRIGGER IF EXISTS trg_phase4b1a_require_movement_variant ON public.stock_movements;
CREATE TRIGGER trg_phase4b1a_require_movement_variant
BEFORE INSERT OR UPDATE OF company_id,company_item_id,variant_id ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_require_physical_profile_variant();

REVOKE ALL ON FUNCTION public.phase4b1a_require_physical_profile_variant()
  FROM PUBLIC, anon, authenticated;

-- Global colors are archived, never physically deleted. Their mutations are
-- audited by the database and remain SaaS-admin-only through existing RLS.
CREATE OR REPLACE FUNCTION public.phase4b1a_audit_global_color()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_saas_admin(auth.uid()) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,old_data,new_data,metadata)
  VALUES (auth.uid(),NULL,lower(TG_OP),'admin_aluminum_colors',NEW.id,
    CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW),
    jsonb_build_object('source','phase4b1a_global_profile_colors'));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase4b1a_block_global_color_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PROFILE_COLOR_ARCHIVE_REQUIRED';
END;
$$;

DROP TRIGGER IF EXISTS trg_phase4b1a_audit_global_color ON public.admin_aluminum_colors;
CREATE TRIGGER trg_phase4b1a_audit_global_color
AFTER INSERT OR UPDATE ON public.admin_aluminum_colors
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_audit_global_color();

DROP TRIGGER IF EXISTS trg_phase4b1a_block_global_color_delete ON public.admin_aluminum_colors;
CREATE TRIGGER trg_phase4b1a_block_global_color_delete
BEFORE DELETE ON public.admin_aluminum_colors
FOR EACH ROW EXECUTE FUNCTION public.phase4b1a_block_global_color_delete();

REVOKE ALL ON FUNCTION public.phase4b1a_audit_global_color(),
  public.phase4b1a_block_global_color_delete() FROM PUBLIC, anon, authenticated;

-- Backfill explicit FK columns only from already-frozen snapshot identities.
UPDATE public.quote_items
SET profile_color_id = NULLIF(composition_snapshot#>>'{variants,profile_color_id}','')::uuid,
    profile_color_code = NULLIF(composition_snapshot#>>'{variants,profile_color_code}',''),
    profile_color_name = NULLIF(composition_snapshot#>>'{variants,profile_color_name}','')
WHERE NULLIF(composition_snapshot#>>'{variants,profile_color_id}','') IS NOT NULL;

UPDATE public.sale_items
SET profile_color_id = NULLIF(engineering_snapshot#>>'{variants,profile_color_id}','')::uuid,
    profile_color_code = NULLIF(engineering_snapshot#>>'{variants,profile_color_code}',''),
    profile_color_name = NULLIF(engineering_snapshot#>>'{variants,profile_color_name}','')
WHERE NULLIF(engineering_snapshot#>>'{variants,profile_color_id}','') IS NOT NULL;

UPDATE public.os_items
SET profile_color_id = NULLIF(engineering_snapshot#>>'{variants,profile_color_id}','')::uuid,
    profile_color_code = NULLIF(engineering_snapshot#>>'{variants,profile_color_code}',''),
    profile_color_name = NULLIF(engineering_snapshot#>>'{variants,profile_color_name}','')
WHERE NULLIF(engineering_snapshot#>>'{variants,profile_color_id}','') IS NOT NULL;

UPDATE public.os_materials
SET variant_id = NULLIF(snapshot_payload->>'variant_id','')::uuid
WHERE NULLIF(snapshot_payload->>'variant_id','') IS NOT NULL;

UPDATE public.material_consumption
SET variant_id = NULLIF(snapshot_payload->>'variant_id','')::uuid
WHERE NULLIF(snapshot_payload->>'variant_id','') IS NOT NULL;

-- Profile configuration is metadata/pricing only. It cannot alter physical
-- quantity; movements remain the sole stock mutation path.
CREATE OR REPLACE FUNCTION public.save_company_profile_configuration(
  _company_id uuid,
  _company_item_id uuid,
  _canonical_cost_per_meter numeric,
  _canonical_sale_per_meter numeric,
  _cost_unit text,
  _sale_unit text,
  _min_stock numeric DEFAULT 0,
  _allow_fractional boolean DEFAULT true,
  _is_active boolean DEFAULT true,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item public.company_items;
  v_units public.inventory_item_units;
  v_old jsonb;
  v_cost_unit text := public.phase3f_normalize_unit(_cost_unit);
  v_sale_unit text := public.phase3f_normalize_unit(_sale_unit);
  v_markup numeric;
BEGIN
  IF v_user_id IS NULL OR NOT public.phase3e_can_manage_pricing(v_user_id,_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  SELECT * INTO v_item FROM public.company_items
  WHERE id=_company_item_id AND company_id=_company_id FOR UPDATE;
  IF v_item.id IS NULL OR lower(v_item.type) NOT IN ('profile','perfil') THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_COMPANY_ITEM';
  END IF;
  SELECT * INTO v_units FROM public.inventory_item_units
  WHERE company_id=_company_id AND company_item_id=_company_item_id FOR UPDATE;
  IF v_units.id IS NULL OR v_units.physical_dimension<>'LENGTH' OR v_units.canonical_unit<>'MM' THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION';
  END IF;
  IF v_cost_unit NOT IN ('M','BAR','KG') OR v_sale_unit NOT IN ('M','BAR','KG') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_UNIT';
  END IF;
  PERFORM public.phase3f_unit_factor(_company_item_id,v_cost_unit,NULL,NULL);
  PERFORM public.phase3f_unit_factor(_company_item_id,v_sale_unit,NULL,NULL);
  IF COALESCE(_canonical_cost_per_meter,0)<=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MISSING_COST';
  END IF;
  IF COALESCE(_canonical_sale_per_meter,0)<=0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='MISSING_PRICE';
  END IF;
  IF COALESCE(_min_stock,0)<0 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='INVALID_ITEM_CONFIGURATION';
  END IF;
  v_markup:=round(((_canonical_sale_per_meter/_canonical_cost_per_meter)-1)*100,4);
  v_old:=to_jsonb(v_item);

  UPDATE public.company_items SET
    cost=_canonical_cost_per_meter,
    sale_price=_canonical_sale_per_meter,
    markup_percent=v_markup,
    pricing_unit='m',
    is_active=_is_active,
    image_url=COALESCE(NULLIF(_metadata->>'image_url',''),image_url),
    linha=COALESCE(NULLIF(_metadata->>'linha',''),linha),
    bar_length_mm=COALESCE(NULLIF(_metadata->>'bar_length_mm','')::numeric,bar_length_mm),
    weight_kg=COALESCE(NULLIF(_metadata->>'weight_kg','')::numeric,weight_kg),
    weight_per_meter=COALESCE(NULLIF(_metadata->>'weight_per_meter','')::numeric,weight_per_meter),
    ncm=NULLIF(_metadata->>'ncm',''),cest=NULLIF(_metadata->>'cest',''),
    cfop_venda=NULLIF(_metadata->>'cfop_venda',''),
    cfop_venda_interestadual=NULLIF(_metadata->>'cfop_venda_interestadual',''),
    origem=NULLIF(_metadata->>'origem',''),
    codigo_servico=NULLIF(_metadata->>'codigo_servico',''),
    aliquota_iss=NULLIF(_metadata->>'aliquota_iss','')::numeric,
    updated_at=now()
  WHERE id=v_item.id RETURNING * INTO v_item;

  UPDATE public.inventory_item_units SET
    cost_unit=v_cost_unit,sale_unit=v_sale_unit,
    nominal_length_mm=COALESCE(NULLIF(_metadata->>'bar_length_mm','')::numeric,nominal_length_mm),
    updated_at=now()
  WHERE id=v_units.id;

  UPDATE public.company_stock SET
    min_quantity=COALESCE(_min_stock,0),allow_fractional=_allow_fractional,
    is_active=_is_active,updated_at=now()
  WHERE company_id=_company_id AND company_item_id=_company_item_id;

  INSERT INTO public.audit_logs(user_id,company_id,action,table_name,record_id,old_data,new_data,metadata)
  VALUES(v_user_id,_company_id,'update','company_items',v_item.id,v_old,to_jsonb(v_item),
    jsonb_build_object('source','phase4b1a_profile_configuration',
      'cost_unit',v_cost_unit,'sale_unit',v_sale_unit,'physical_quantity_changed',false));

  RETURN jsonb_build_object('success',true,'company_item_id',v_item.id,
    'cost_per_meter',v_item.cost,'sale_price_per_meter',v_item.sale_price,
    'markup_percent',v_item.markup_percent,'cost_unit',v_cost_unit,'sale_unit',v_sale_unit,
    'physical_quantity_changed',false);
END;
$$;

REVOKE ALL ON FUNCTION public.save_company_profile_configuration(
  uuid,uuid,numeric,numeric,text,text,numeric,boolean,boolean,jsonb
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_company_profile_configuration(
  uuid,uuid,numeric,numeric,text,text,numeric,boolean,boolean,jsonb
) TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
