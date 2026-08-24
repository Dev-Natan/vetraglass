-- Phase 3F: physical inventory units, conversions, locations and immutable
-- movement snapshots. Commercial pricing remains owned by company_items and
-- company_item_variants; physical average cost never overwrites it.

CREATE TABLE public.inventory_item_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_item_id uuid NOT NULL,
  physical_dimension text NOT NULL CHECK (physical_dimension IN ('LENGTH','AREA','COUNT','MASS')),
  purchase_unit text NOT NULL,
  stock_unit text NOT NULL,
  consumption_unit text NOT NULL,
  canonical_unit text NOT NULL CHECK (canonical_unit IN ('MM','MM2','UNIT','G')),
  purchase_to_canonical_factor numeric(24,6),
  stock_to_canonical_factor numeric(24,6),
  consumption_to_canonical_factor numeric(24,6),
  nominal_length_mm numeric(18,3),
  default_width_mm numeric(18,3),
  default_height_mm numeric(18,3),
  cost_policy text NOT NULL DEFAULT 'MANUAL'
    CHECK (cost_policy IN ('MANUAL','LAST_PURCHASE','WEIGHTED_AVERAGE')),
  legacy_status text NOT NULL DEFAULT 'CONFIGURED'
    CHECK (legacy_status IN ('CONFIGURED','REVIEW_REQUIRED','AMBIGUOUS')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_item_units_company_item_fkey
    FOREIGN KEY (company_item_id, company_id)
    REFERENCES public.company_items(id, company_id) ON DELETE CASCADE,
  CONSTRAINT inventory_item_units_company_item_key UNIQUE (company_id, company_item_id),
  CONSTRAINT inventory_item_units_factor_check CHECK (
    (purchase_to_canonical_factor IS NULL OR purchase_to_canonical_factor > 0)
    AND (stock_to_canonical_factor IS NULL OR stock_to_canonical_factor > 0)
    AND (consumption_to_canonical_factor IS NULL OR consumption_to_canonical_factor > 0)
  ),
  CONSTRAINT inventory_item_units_names_check CHECK (
    btrim(purchase_unit) <> '' AND btrim(stock_unit) <> ''
    AND btrim(consumption_unit) <> ''
  )
);

CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id uuid,
  code text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'POSITION'
    CHECK (kind IN ('WAREHOUSE','SECTOR','AISLE','SHELF','RACK','POSITION','YARD','OTHER')),
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_locations_code_key UNIQUE (company_id, code),
  CONSTRAINT stock_locations_id_company_key UNIQUE (id, company_id),
  CONSTRAINT stock_locations_parent_company_fkey
    FOREIGN KEY (parent_id, company_id)
    REFERENCES public.stock_locations(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT stock_locations_text_check CHECK (btrim(code) <> '' AND btrim(name) <> ''),
  CONSTRAINT stock_locations_not_self_parent CHECK (parent_id IS DISTINCT FROM id)
);

CREATE TABLE public.physical_stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  company_item_id uuid NOT NULL,
  variant_id uuid REFERENCES public.company_item_variants(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL,
  lot_code text NOT NULL DEFAULT '',
  canonical_quantity numeric(24,6) NOT NULL DEFAULT 0 CHECK (canonical_quantity >= 0),
  package_quantity numeric(24,6) NOT NULL DEFAULT 0 CHECK (package_quantity >= 0),
  average_cost_per_canonical numeric(24,10)
    CHECK (average_cost_per_canonical IS NULL OR average_cost_per_canonical >= 0),
  inventory_value numeric(24,6)
    CHECK (inventory_value IS NULL OR inventory_value >= 0),
  width_mm numeric(18,3) CHECK (width_mm IS NULL OR width_mm > 0),
  height_mm numeric(18,3) CHECK (height_mm IS NULL OR height_mm > 0),
  thickness_mm numeric(18,3) CHECK (thickness_mm IS NULL OR thickness_mm > 0),
  supplier_name text,
  document_reference text,
  needs_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT physical_stock_balances_company_item_fkey
    FOREIGN KEY (company_item_id, company_id)
    REFERENCES public.company_items(id, company_id) ON DELETE CASCADE,
  CONSTRAINT physical_stock_balances_location_company_fkey
    FOREIGN KEY (location_id, company_id)
    REFERENCES public.stock_locations(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT physical_stock_balances_dimensions_pair CHECK (
    (width_mm IS NULL) = (height_mm IS NULL)
  )
);

CREATE UNIQUE INDEX physical_stock_balances_identity_key
ON public.physical_stock_balances (
  company_id,
  company_item_id,
  COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid),
  location_id,
  lot_code,
  COALESCE(width_mm, -1),
  COALESCE(height_mm, -1)
);

CREATE INDEX physical_stock_balances_item_idx
  ON public.physical_stock_balances(company_id, company_item_id)
  INCLUDE (canonical_quantity, package_quantity, inventory_value);
CREATE INDEX physical_stock_balances_location_idx
  ON public.physical_stock_balances(company_id, location_id);
CREATE INDEX physical_stock_balances_variant_idx
  ON public.physical_stock_balances(company_id, variant_id)
  WHERE variant_id IS NOT NULL;

ALTER TABLE public.company_stock
  ADD COLUMN canonical_quantity numeric(24,6) NOT NULL DEFAULT 0,
  ADD COLUMN canonical_unit text,
  ADD COLUMN average_unit_cost numeric(24,10),
  ADD COLUMN inventory_value numeric(24,6),
  ADD COLUMN legacy_quantity numeric(24,6),
  ADD COLUMN legacy_unit text,
  ADD COLUMN unit_status text NOT NULL DEFAULT 'REVIEW_REQUIRED',
  ADD COLUMN unit_migrated_at timestamptz;

ALTER TABLE public.company_stock
  ADD CONSTRAINT company_stock_canonical_quantity_check CHECK (canonical_quantity >= 0),
  ADD CONSTRAINT company_stock_average_unit_cost_check
    CHECK (average_unit_cost IS NULL OR average_unit_cost >= 0),
  ADD CONSTRAINT company_stock_inventory_value_check
    CHECK (inventory_value IS NULL OR inventory_value >= 0),
  ADD CONSTRAINT company_stock_unit_status_check
    CHECK (unit_status IN ('CONFIGURED','REVIEW_REQUIRED','AMBIGUOUS'));

ALTER TABLE public.stock_movements
  ADD COLUMN original_quantity numeric(24,6),
  ADD COLUMN original_unit text,
  ADD COLUMN canonical_quantity numeric(24,6),
  ADD COLUMN canonical_unit text,
  ADD COLUMN conversion_factor numeric(24,6),
  ADD COLUMN location_id uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  ADD COLUMN variant_id uuid REFERENCES public.company_item_variants(id) ON DELETE RESTRICT,
  ADD COLUMN lot_code text,
  ADD COLUMN width_mm numeric(18,3),
  ADD COLUMN height_mm numeric(18,3),
  ADD COLUMN supplier_name text,
  ADD COLUMN document_reference text,
  ADD COLUMN idempotency_key uuid,
  ADD COLUMN conversion_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_original_quantity_check
    CHECK (original_quantity IS NULL OR original_quantity > 0),
  ADD CONSTRAINT stock_movements_canonical_quantity_check
    CHECK (canonical_quantity IS NULL OR canonical_quantity > 0),
  ADD CONSTRAINT stock_movements_conversion_factor_check
    CHECK (conversion_factor IS NULL OR conversion_factor > 0),
  ADD CONSTRAINT stock_movements_dimensions_pair CHECK ((width_mm IS NULL) = (height_mm IS NULL));

CREATE UNIQUE INDEX stock_movements_idempotency_key
  ON public.stock_movements(company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.stock_reservations
  ADD COLUMN canonical_quantity numeric(24,6),
  ADD COLUMN canonical_unit text,
  ADD COLUMN conversion_factor numeric(24,6),
  ADD COLUMN variant_id uuid REFERENCES public.company_item_variants(id) ON DELETE RESTRICT,
  ADD COLUMN location_id uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT;

ALTER TABLE public.stock_reservations
  ADD CONSTRAINT stock_reservations_canonical_quantity_check
    CHECK (canonical_quantity IS NULL OR canonical_quantity > 0),
  ADD CONSTRAINT stock_reservations_conversion_factor_check
    CHECK (conversion_factor IS NULL OR conversion_factor > 0);

ALTER TABLE public.stock_offcuts
  ADD COLUMN variant_id uuid REFERENCES public.company_item_variants(id) ON DELETE RESTRICT,
  ADD COLUMN location_id uuid REFERENCES public.stock_locations(id) ON DELETE RESTRICT,
  ADD COLUMN area_mm2 numeric(24,3),
  ADD COLUMN canonical_quantity numeric(24,6),
  ADD COLUMN canonical_unit text;

ALTER TABLE public.stock_offcuts
  ADD CONSTRAINT stock_offcuts_area_mm2_check CHECK (area_mm2 IS NULL OR area_mm2 > 0),
  ADD CONSTRAINT stock_offcuts_canonical_quantity_check
    CHECK (canonical_quantity IS NULL OR canonical_quantity > 0);

CREATE OR REPLACE FUNCTION public.phase3f_normalize_unit(_unit text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE upper(regexp_replace(COALESCE(btrim(_unit), ''), '[² ]', '', 'g'))
    WHEN 'BARRA' THEN 'BAR' WHEN 'BARRAS' THEN 'BAR' WHEN 'BAR' THEN 'BAR'
    WHEN 'M' THEN 'M' WHEN 'ML' THEN 'M' WHEN 'METRO' THEN 'M' WHEN 'METROS' THEN 'M'
    WHEN 'MM' THEN 'MM'
    WHEN 'M2' THEN 'M2' WHEN 'METROQUADRADO' THEN 'M2'
    WHEN 'MM2' THEN 'MM2'
    WHEN 'UN' THEN 'UNIT' WHEN 'UND' THEN 'UNIT' WHEN 'UNIDADE' THEN 'UNIT'
    WHEN 'UNIDADES' THEN 'UNIT' WHEN 'UNIT' THEN 'UNIT' WHEN 'PC' THEN 'UNIT'
    WHEN 'PÇ' THEN 'UNIT' WHEN 'PECA' THEN 'UNIT' WHEN 'PEÇA' THEN 'UNIT'
    WHEN 'CAIXA' THEN 'BOX' WHEN 'BOX' THEN 'BOX'
    WHEN 'PACOTE' THEN 'PACK' WHEN 'PACK' THEN 'PACK'
    WHEN 'CHAPA' THEN 'SHEET' WHEN 'SHEET' THEN 'SHEET'
    WHEN 'KG' THEN 'KG' WHEN 'G' THEN 'G'
    WHEN 'TUBO' THEN 'TUBE' WHEN 'TUBE' THEN 'TUBE'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.phase3f_default_unit_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_template public.item_templates;
  v_type text := lower(NEW.type);
  v_length numeric;
BEGIN
  IF NEW.item_template_id IS NOT NULL THEN
    SELECT * INTO v_template FROM public.item_templates WHERE id = NEW.item_template_id;
  END IF;
  v_length := COALESCE(NEW.bar_length_mm, v_template.bar_length_mm);
  INSERT INTO public.inventory_item_units(
    company_id, company_item_id, physical_dimension,
    purchase_unit, stock_unit, consumption_unit, canonical_unit,
    purchase_to_canonical_factor, stock_to_canonical_factor,
    consumption_to_canonical_factor, nominal_length_mm, legacy_status
  ) VALUES (
    NEW.company_id, NEW.id,
    CASE WHEN v_type IN ('profile','perfil') THEN 'LENGTH'
         WHEN v_type IN ('glass','vidro','sheet') THEN 'AREA'
         ELSE 'COUNT' END,
    CASE WHEN v_type IN ('profile','perfil') THEN 'BAR'
         WHEN v_type IN ('glass','vidro','sheet') THEN 'M2'
         ELSE COALESCE(public.phase3f_normalize_unit(NEW.unit), 'UNIT') END,
    CASE WHEN v_type IN ('profile','perfil') THEN 'M'
         WHEN v_type IN ('glass','vidro','sheet') THEN 'M2' ELSE 'UNIT' END,
    CASE WHEN v_type IN ('profile','perfil') THEN 'M'
         WHEN v_type IN ('glass','vidro','sheet') THEN 'M2' ELSE 'UNIT' END,
    CASE WHEN v_type IN ('profile','perfil') THEN 'MM'
         WHEN v_type IN ('glass','vidro','sheet') THEN 'MM2' ELSE 'UNIT' END,
    CASE WHEN v_type IN ('profile','perfil') THEN v_length
         WHEN v_type IN ('glass','vidro','sheet') THEN 1000000 ELSE 1 END,
    CASE WHEN v_type IN ('profile','perfil') THEN 1000
         WHEN v_type IN ('glass','vidro','sheet') THEN 1000000 ELSE 1 END,
    CASE WHEN v_type IN ('profile','perfil') THEN 1000
         WHEN v_type IN ('glass','vidro','sheet') THEN 1000000 ELSE 1 END,
    v_length,
    CASE WHEN v_type IN ('profile','perfil') AND v_length IS NULL THEN 'AMBIGUOUS'
         WHEN v_type NOT IN ('profile','perfil','glass','vidro','sheet','accessory','acessorio','accessório')
           THEN 'REVIEW_REQUIRED' ELSE 'CONFIGURED' END
  ) ON CONFLICT (company_id, company_item_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_phase3f_default_unit_config
AFTER INSERT ON public.company_items
FOR EACH ROW EXECUTE FUNCTION public.phase3f_default_unit_config();

CREATE OR REPLACE FUNCTION public.phase3f_unit_factor(
  _company_item_id uuid,
  _unit text,
  _width_mm numeric DEFAULT NULL,
  _height_mm numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_config public.inventory_item_units;
  v_unit text := public.phase3f_normalize_unit(_unit);
BEGIN
  SELECT * INTO v_config FROM public.inventory_item_units
  WHERE company_item_id = _company_item_id;
  IF v_config.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_CONVERSION';
  END IF;
  IF v_config.legacy_status = 'AMBIGUOUS' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AMBIGUOUS_LEGACY_STOCK';
  END IF;
  IF v_unit IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_UNIT', DETAIL = COALESCE(_unit, 'NULL');
  END IF;
  IF v_unit = 'SHEET' THEN
    IF COALESCE(_width_mm, 0) <= 0 OR COALESCE(_height_mm, 0) <= 0
       OR v_config.canonical_unit <> 'MM2' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_DIMENSIONS';
    END IF;
    RETURN _width_mm * _height_mm;
  END IF;
  IF v_unit = public.phase3f_normalize_unit(v_config.purchase_unit) THEN
    IF v_config.purchase_to_canonical_factor IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION';
    END IF;
    RETURN v_config.purchase_to_canonical_factor;
  ELSIF v_unit = public.phase3f_normalize_unit(v_config.stock_unit) THEN
    IF v_config.stock_to_canonical_factor IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION';
    END IF;
    RETURN v_config.stock_to_canonical_factor;
  ELSIF v_unit = public.phase3f_normalize_unit(v_config.consumption_unit) THEN
    IF v_config.consumption_to_canonical_factor IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION';
    END IF;
    RETURN v_config.consumption_to_canonical_factor;
  ELSIF v_unit = v_config.canonical_unit THEN
    RETURN 1;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_UNIT',
    DETAIL = format('%s is not configured for company_item %s', _unit, _company_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_stock_location(
  _company_id uuid,
  _name text,
  _code text,
  _kind text DEFAULT 'POSITION',
  _parent_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.phase3e_can_manage_pricing(auth.uid(), _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF NULLIF(btrim(_name), '') IS NULL OR NULLIF(btrim(_code), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MISSING_LOCATION';
  END IF;
  INSERT INTO public.stock_locations(company_id,parent_id,name,code,kind)
  VALUES (_company_id,_parent_id,btrim(_name),upper(btrim(_code)),upper(_kind))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_physical_stock_movement(
  _company_id uuid,
  _company_item_id uuid,
  _direction text,
  _original_quantity numeric,
  _original_unit text,
  _location_id uuid,
  _reason text,
  _variant_id uuid DEFAULT NULL,
  _conversion_factor numeric DEFAULT NULL,
  _total_cost numeric DEFAULT NULL,
  _idempotency_key uuid DEFAULT NULL,
  _lot_code text DEFAULT '',
  _supplier_name text DEFAULT NULL,
  _document_reference text DEFAULT NULL,
  _width_mm numeric DEFAULT NULL,
  _height_mm numeric DEFAULT NULL,
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
  v_config public.inventory_item_units;
  v_balance public.physical_stock_balances;
  v_location public.stock_locations;
  v_factor numeric;
  v_canonical numeric;
  v_signed numeric;
  v_new_canonical numeric;
  v_new_packages numeric;
  v_old_value numeric;
  v_new_value numeric;
  v_new_average numeric;
  v_compat_quantity numeric;
  v_total_canonical numeric;
  v_total_value numeric;
  v_has_unknown_value boolean;
  v_total_packages numeric;
  v_stock_id uuid;
  v_movement_id uuid;
  v_existing record;
  v_lot text := COALESCE(btrim(_lot_code), '');
  v_direction text := upper(btrim(_direction));
  v_original_unit text := public.phase3f_normalize_unit(_original_unit);
BEGIN
  IF v_user_id IS NULL OR NOT public.phase3e_can_manage_pricing(v_user_id, _company_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'UNAUTHORIZED';
  END IF;
  IF v_direction NOT IN ('IN','OUT') OR COALESCE(_original_quantity,0) <= 0
     OR NULLIF(btrim(_reason),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_UNIT';
  END IF;
  SELECT * INTO v_item FROM public.company_items
  WHERE id=_company_item_id AND company_id=_company_id AND is_active FOR UPDATE;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MISSING_COMPANY_ITEM';
  END IF;
  SELECT * INTO v_config FROM public.inventory_item_units
  WHERE company_id=_company_id AND company_item_id=_company_item_id FOR UPDATE;
  IF v_config.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_CONVERSION';
  END IF;
  SELECT * INTO v_location FROM public.stock_locations
  WHERE id=_location_id AND company_id=_company_id AND is_active;
  IF v_location.id IS NULL OR v_location.needs_review THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_LOCATION';
  END IF;
  IF _variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_item_variants civ
    WHERE civ.id=_variant_id AND civ.company_id=_company_id
      AND civ.company_item_id=_company_item_id AND civ.is_active
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'VARIANT_STOCK_MISMATCH';
  END IF;
  IF _idempotency_key IS NOT NULL THEN
    SELECT id, canonical_quantity INTO v_existing FROM public.stock_movements
    WHERE company_id=_company_id AND idempotency_key=_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object('success',true,'idempotent',true,
        'movement_id',v_existing.id,'canonical_quantity',v_existing.canonical_quantity);
    END IF;
  END IF;
  v_factor := public.phase3f_unit_factor(_company_item_id,_original_unit,_width_mm,_height_mm);
  IF _conversion_factor IS NOT NULL AND abs(_conversion_factor-v_factor) > 0.000001 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_CONVERSION';
  END IF;
  v_canonical := _original_quantity * v_factor;
  v_signed := CASE WHEN v_direction='IN' THEN v_canonical ELSE -v_canonical END;
  IF _total_cost IS NOT NULL AND (_total_cost < 0 OR v_direction='OUT') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_CONVERSION',
      DETAIL = 'total_cost is accepted only for stock entries';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    concat_ws('|',_company_id,_company_item_id,COALESCE(_variant_id::text,''),
      _location_id,v_lot,COALESCE(_width_mm::text,''),COALESCE(_height_mm::text,'')),0));
  SELECT * INTO v_balance FROM public.physical_stock_balances b
  WHERE b.company_id=_company_id AND b.company_item_id=_company_item_id
    AND b.variant_id IS NOT DISTINCT FROM _variant_id AND b.location_id=_location_id
    AND b.lot_code=v_lot AND b.width_mm IS NOT DISTINCT FROM _width_mm
    AND b.height_mm IS NOT DISTINCT FROM _height_mm FOR UPDATE;
  IF v_balance.id IS NULL THEN
    IF v_direction='OUT' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INSUFFICIENT_STOCK';
    END IF;
    INSERT INTO public.physical_stock_balances(
      company_id,company_item_id,variant_id,location_id,lot_code,
      canonical_quantity,package_quantity,width_mm,height_mm,supplier_name,
      document_reference,needs_review
    ) VALUES (_company_id,_company_item_id,_variant_id,_location_id,v_lot,0,0,
      _width_mm,_height_mm,_supplier_name,_document_reference,false)
    RETURNING * INTO v_balance;
  END IF;
  v_new_canonical := v_balance.canonical_quantity + v_signed;
  IF v_new_canonical < 0 THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INSUFFICIENT_STOCK',
      DETAIL=jsonb_build_object('canonical_unit',v_config.canonical_unit,
        'available',v_balance.canonical_quantity,'requested',v_canonical)::text;
  END IF;
  v_new_packages := GREATEST(0,v_balance.package_quantity
    + CASE WHEN v_original_unit=public.phase3f_normalize_unit(v_config.purchase_unit)
      THEN CASE WHEN v_direction='IN' THEN _original_quantity ELSE -_original_quantity END
      ELSE v_signed/NULLIF(v_config.purchase_to_canonical_factor,0) END);
  v_old_value := v_balance.inventory_value;
  IF v_direction='IN' AND _total_cost IS NOT NULL THEN
    v_new_value := COALESCE(v_old_value,0)+_total_cost;
    v_new_average := CASE WHEN v_new_canonical>0 THEN v_new_value/v_new_canonical END;
  ELSIF v_direction='OUT' AND v_balance.average_cost_per_canonical IS NOT NULL THEN
    v_new_average := v_balance.average_cost_per_canonical;
    v_new_value := v_new_canonical*v_new_average;
  ELSE
    v_new_average := v_balance.average_cost_per_canonical;
    v_new_value := CASE WHEN v_new_average IS NULL THEN NULL ELSE v_new_canonical*v_new_average END;
  END IF;
  UPDATE public.physical_stock_balances SET
    canonical_quantity=v_new_canonical,package_quantity=v_new_packages,
    average_cost_per_canonical=v_new_average,inventory_value=v_new_value,
    supplier_name=COALESCE(_supplier_name,supplier_name),
    document_reference=COALESCE(_document_reference,document_reference),updated_at=now()
  WHERE id=v_balance.id;

  SELECT COALESCE(sum(canonical_quantity),0),
    CASE WHEN bool_or(inventory_value IS NULL AND canonical_quantity > 0) THEN NULL
      ELSE COALESCE(sum(inventory_value),0) END,
    COALESCE(sum(package_quantity),0),
    COALESCE(bool_or(inventory_value IS NULL AND canonical_quantity > 0),false)
  INTO v_total_canonical,v_total_value,v_total_packages,v_has_unknown_value
  FROM public.physical_stock_balances
  WHERE company_id=_company_id AND company_item_id=_company_item_id;
  v_compat_quantity := v_total_canonical/v_config.consumption_to_canonical_factor;
  SELECT id INTO v_stock_id FROM public.company_stock
  WHERE company_id=_company_id AND company_item_id=_company_item_id FOR UPDATE;
  IF v_stock_id IS NULL THEN
    INSERT INTO public.company_stock(company_id,company_item_id,item_template_id,quantity,
      canonical_quantity,canonical_unit,average_unit_cost,inventory_value,unit_status,unit_migrated_at)
    VALUES (_company_id,_company_item_id,v_item.item_template_id,v_compat_quantity,
      v_total_canonical,v_config.canonical_unit,
      CASE WHEN v_total_canonical>0 AND NOT v_has_unknown_value
        THEN v_total_value/v_total_canonical*v_config.consumption_to_canonical_factor END,
      v_total_value,'CONFIGURED',now()) RETURNING id INTO v_stock_id;
  ELSE
    UPDATE public.company_stock SET quantity=v_compat_quantity,
      canonical_quantity=v_total_canonical,canonical_unit=v_config.canonical_unit,
      average_unit_cost=CASE WHEN v_total_canonical>0 AND v_total_value IS NOT NULL
        THEN v_total_value/v_total_canonical*v_config.consumption_to_canonical_factor END,
      inventory_value=v_total_value,unit_status='CONFIGURED',unit_migrated_at=now()
    WHERE id=v_stock_id;
  END IF;
  INSERT INTO public.stock_movements(
    company_id,company_item_id,item_template_id,type,category,quantity,unit_cost,
    valor_financeiro,description,created_by,reference_type,
    original_quantity,original_unit,canonical_quantity,canonical_unit,
    conversion_factor,location_id,variant_id,lot_code,width_mm,height_mm,
    supplier_name,document_reference,idempotency_key,conversion_snapshot
  ) VALUES (
    _company_id,_company_item_id,v_item.item_template_id,
    CASE WHEN v_direction='IN' THEN 'entrada' ELSE 'saida' END,
    CASE WHEN v_direction='IN' THEN 'ajuste_positivo' ELSE 'ajuste_negativo' END,
    v_canonical/v_config.consumption_to_canonical_factor,
    CASE WHEN _total_cost IS NOT NULL THEN _total_cost/NULLIF(v_canonical/v_config.consumption_to_canonical_factor,0)
      ELSE v_balance.average_cost_per_canonical*v_config.consumption_to_canonical_factor END,
    COALESCE(_total_cost,0),btrim(_reason),v_user_id,'physical_inventory',
    _original_quantity,v_original_unit,v_canonical,v_config.canonical_unit,v_factor,
    _location_id,_variant_id,v_lot,_width_mm,_height_mm,_supplier_name,
    _document_reference,_idempotency_key,
    jsonb_build_object('purchase_unit',v_config.purchase_unit,'stock_unit',v_config.stock_unit,
      'consumption_unit',v_config.consumption_unit,'canonical_unit',v_config.canonical_unit,
      'factor',v_factor,'metadata',COALESCE(_metadata,'{}'::jsonb))
  ) RETURNING id INTO v_movement_id;
  RETURN jsonb_build_object('success',true,'idempotent',false,'stock_id',v_stock_id,
    'movement_id',v_movement_id,'canonical_quantity',v_total_canonical,
    'canonical_unit',v_config.canonical_unit,'consumption_quantity',v_compat_quantity,
    'consumption_unit',v_config.consumption_unit,'package_quantity',v_total_packages,
    'inventory_value',v_total_value);
END;
$$;

-- company_stock is now a read-compatible aggregate. Every physical mutation must
-- update it together with the canonical balance inside record_physical_stock_movement.
-- This guard prevents older direct writers from silently creating a second truth.
CREATE OR REPLACE FUNCTION public.phase3f_guard_company_stock_aggregate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.quantity,0) <> 0 AND COALESCE(NEW.canonical_quantity,0) = 0 THEN
      RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MISSING_LOCATION',
        DETAIL='Use record_physical_stock_movement for physical stock mutations';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.quantity IS DISTINCT FROM OLD.quantity
     AND NEW.canonical_quantity IS NOT DISTINCT FROM OLD.canonical_quantity THEN
    RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MISSING_LOCATION',
      DETAIL='Direct company_stock quantity updates are disabled; use record_physical_stock_movement';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase3f_snapshot_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_config public.inventory_item_units; v_factor numeric;
BEGIN
  IF NEW.company_item_id IS NULL OR NEW.canonical_quantity IS NOT NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_config FROM public.inventory_item_units WHERE company_item_id=NEW.company_item_id;
  IF v_config.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION';
  END IF;
  NEW.original_quantity:=NEW.quantity;
  NEW.original_unit:=v_config.consumption_unit;
  v_factor:=v_config.consumption_to_canonical_factor;
  NEW.conversion_factor:=v_factor;
  NEW.canonical_quantity:=NEW.quantity*v_factor;
  NEW.canonical_unit:=v_config.canonical_unit;
  NEW.conversion_snapshot:=jsonb_build_object('source','legacy_consumer','factor',v_factor,
    'consumption_unit',v_config.consumption_unit,'canonical_unit',v_config.canonical_unit);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_phase3f_snapshot_stock_movement
BEFORE INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.phase3f_snapshot_stock_movement();

CREATE OR REPLACE FUNCTION public.phase3f_snapshot_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_config public.inventory_item_units; v_factor numeric;
BEGIN
  SELECT * INTO v_config FROM public.inventory_item_units WHERE company_item_id=NEW.company_item_id;
  IF v_config.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='MISSING_CONVERSION'; END IF;
  v_factor:=public.phase3f_unit_factor(NEW.company_item_id,NEW.unit,NULL,NULL);
  NEW.canonical_quantity:=NEW.quantity_reserved*v_factor;
  NEW.canonical_unit:=v_config.canonical_unit;
  NEW.conversion_factor:=v_factor;
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_item_variants v WHERE v.id=NEW.variant_id
      AND v.company_id=NEW.company_id AND v.company_item_id=NEW.company_item_id
  ) THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='VARIANT_STOCK_MISMATCH'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_phase3f_snapshot_reservation
BEFORE INSERT OR UPDATE OF quantity_reserved,unit,variant_id ON public.stock_reservations
FOR EACH ROW EXECUTE FUNCTION public.phase3f_snapshot_reservation();

CREATE OR REPLACE VIEW public.physical_inventory_summary
WITH (security_invoker=true)
AS
SELECT
  ci.company_id,ci.id AS company_item_id,ci.item_template_id,ci.name,ci.type,ci.unit,
  ci.linha,ci.image_url,ci.cost AS commercial_cost,ci.sale_price AS commercial_sale_price,
  ci.pricing_unit,iu.physical_dimension,iu.purchase_unit,iu.stock_unit,
  iu.consumption_unit,iu.canonical_unit,iu.purchase_to_canonical_factor,
  iu.consumption_to_canonical_factor,iu.nominal_length_mm,iu.cost_policy,iu.legacy_status,
  COALESCE(sum(pb.canonical_quantity),0) AS canonical_quantity,
  COALESCE(sum(pb.package_quantity),0) AS package_quantity,
  CASE WHEN COALESCE(sum(pb.canonical_quantity),0)>0
      AND NOT COALESCE(bool_or(pb.inventory_value IS NULL AND pb.canonical_quantity>0),false)
    THEN sum(COALESCE(pb.inventory_value,0))/sum(pb.canonical_quantity) END AS average_cost_per_canonical,
  CASE WHEN COALESCE(sum(pb.canonical_quantity),0)>0
      AND NOT COALESCE(bool_or(pb.inventory_value IS NULL AND pb.canonical_quantity>0),false)
    THEN sum(COALESCE(pb.inventory_value,0))/sum(pb.canonical_quantity)*iu.consumption_to_canonical_factor END
    AS average_cost_per_consumption_unit,
  CASE WHEN bool_or(pb.inventory_value IS NULL AND pb.canonical_quantity>0) THEN NULL
    ELSE COALESCE(sum(pb.inventory_value),0) END AS inventory_value,
  count(DISTINCT pb.location_id) FILTER (WHERE pb.canonical_quantity>0) AS location_count,
  count(DISTINCT pb.variant_id) FILTER (WHERE pb.variant_id IS NOT NULL AND pb.canonical_quantity>0) AS variant_count,
  COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id',sl.id,'code',sl.code,'name',sl.name,
    'canonical_quantity',pb.canonical_quantity,'package_quantity',pb.package_quantity,
    'needs_review',pb.needs_review)) FILTER (WHERE pb.id IS NOT NULL),'[]'::jsonb) AS locations
FROM public.company_items ci
JOIN public.inventory_item_units iu ON iu.company_item_id=ci.id AND iu.company_id=ci.company_id
LEFT JOIN public.physical_stock_balances pb ON pb.company_item_id=ci.id AND pb.company_id=ci.company_id
LEFT JOIN public.stock_locations sl ON sl.id=pb.location_id
WHERE ci.is_active
GROUP BY ci.company_id,ci.id,ci.item_template_id,ci.name,ci.type,ci.unit,ci.linha,
  ci.image_url,ci.cost,ci.sale_price,ci.pricing_unit,iu.physical_dimension,
  iu.purchase_unit,iu.stock_unit,iu.consumption_unit,iu.canonical_unit,
  iu.purchase_to_canonical_factor,iu.consumption_to_canonical_factor,
  iu.nominal_length_mm,iu.cost_policy,iu.legacy_status;

-- Backfill unit contracts from existing typed company items. All current profiles
-- have a deterministic 6000 mm length from either the company item or template.
INSERT INTO public.inventory_item_units(
  company_id,company_item_id,physical_dimension,purchase_unit,stock_unit,
  consumption_unit,canonical_unit,purchase_to_canonical_factor,
  stock_to_canonical_factor,consumption_to_canonical_factor,nominal_length_mm,legacy_status
)
SELECT ci.company_id,ci.id,
  CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'LENGTH'
       WHEN lower(ci.type) IN ('glass','vidro','sheet') THEN 'AREA' ELSE 'COUNT' END,
  CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'BAR'
       WHEN lower(ci.type) IN ('glass','vidro','sheet') THEN 'M2'
       ELSE COALESCE(public.phase3f_normalize_unit(ci.unit),'UNIT') END,
  CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'M'
       WHEN lower(ci.type) IN ('glass','vidro','sheet') THEN 'M2' ELSE 'UNIT' END,
  CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'M'
       WHEN lower(ci.type) IN ('glass','vidro','sheet') THEN 'M2' ELSE 'UNIT' END,
  CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 'MM'
       WHEN lower(ci.type) IN ('glass','vidro','sheet') THEN 'MM2' ELSE 'UNIT' END,
  CASE WHEN lower(ci.type) IN ('profile','perfil') THEN COALESCE(ci.bar_length_mm,it.bar_length_mm)
       WHEN lower(ci.type) IN ('glass','vidro','sheet') THEN 1000000 ELSE 1 END,
  CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 1000
       WHEN lower(ci.type) IN ('glass','vidro','sheet') THEN 1000000 ELSE 1 END,
  CASE WHEN lower(ci.type) IN ('profile','perfil') THEN 1000
       WHEN lower(ci.type) IN ('glass','vidro','sheet') THEN 1000000 ELSE 1 END,
  COALESCE(ci.bar_length_mm,it.bar_length_mm),
  CASE WHEN lower(ci.type) IN ('profile','perfil') AND COALESCE(ci.bar_length_mm,it.bar_length_mm) IS NULL
    THEN 'AMBIGUOUS' ELSE 'CONFIGURED' END
FROM public.company_items ci LEFT JOIN public.item_templates it ON it.id=ci.item_template_id
ON CONFLICT (company_id,company_item_id) DO NOTHING;

INSERT INTO public.stock_locations(company_id,code,name,kind,is_system,needs_review)
SELECT c.id,'LEGACY_REVIEW','Legado — localização a revisar','OTHER',true,true
FROM public.companies c ON CONFLICT (company_id,code) DO NOTHING;

UPDATE public.company_stock cs SET
  legacy_quantity=cs.quantity,
  legacy_unit=ci.unit,
  canonical_quantity=CASE
    WHEN iu.legacy_status='AMBIGUOUS' THEN 0
    WHEN public.phase3f_normalize_unit(ci.unit)=public.phase3f_normalize_unit(iu.purchase_unit)
      THEN cs.quantity*iu.purchase_to_canonical_factor
    ELSE cs.quantity*iu.stock_to_canonical_factor END,
  canonical_unit=iu.canonical_unit,
  quantity=CASE
    WHEN iu.legacy_status='AMBIGUOUS' THEN cs.quantity
    WHEN public.phase3f_normalize_unit(ci.unit)=public.phase3f_normalize_unit(iu.purchase_unit)
      THEN cs.quantity*iu.purchase_to_canonical_factor/iu.consumption_to_canonical_factor
    ELSE cs.quantity*iu.stock_to_canonical_factor/iu.consumption_to_canonical_factor END,
  average_unit_cost=NULL,inventory_value=NULL,
  unit_status=iu.legacy_status,unit_migrated_at=now()
FROM public.company_items ci JOIN public.inventory_item_units iu ON iu.company_item_id=ci.id
WHERE cs.company_item_id=ci.id;

INSERT INTO public.physical_stock_balances(
  company_id,company_item_id,location_id,canonical_quantity,package_quantity,
  average_cost_per_canonical,inventory_value,needs_review
)
SELECT cs.company_id,cs.company_item_id,sl.id,cs.canonical_quantity,
  CASE WHEN public.phase3f_normalize_unit(cs.legacy_unit)=public.phase3f_normalize_unit(iu.purchase_unit)
    THEN COALESCE(cs.legacy_quantity,0)
    ELSE cs.canonical_quantity/NULLIF(iu.purchase_to_canonical_factor,0) END,
  NULL,NULL,true
FROM public.company_stock cs
JOIN public.inventory_item_units iu ON iu.company_item_id=cs.company_item_id
JOIN public.stock_locations sl ON sl.company_id=cs.company_id AND sl.code='LEGACY_REVIEW'
WHERE cs.company_item_id IS NOT NULL;

UPDATE public.stock_movements sm SET
  original_quantity=sm.quantity,
  original_unit=CASE WHEN public.phase3f_normalize_unit(ci.unit)=public.phase3f_normalize_unit(iu.purchase_unit)
    THEN iu.purchase_unit ELSE iu.consumption_unit END,
  conversion_factor=CASE WHEN public.phase3f_normalize_unit(ci.unit)=public.phase3f_normalize_unit(iu.purchase_unit)
    THEN iu.purchase_to_canonical_factor ELSE iu.consumption_to_canonical_factor END,
  canonical_quantity=sm.quantity*CASE
    WHEN public.phase3f_normalize_unit(ci.unit)=public.phase3f_normalize_unit(iu.purchase_unit)
      THEN iu.purchase_to_canonical_factor ELSE iu.consumption_to_canonical_factor END,
  canonical_unit=iu.canonical_unit,location_id=sl.id,
  conversion_snapshot=jsonb_build_object('source','phase3f_deterministic_backfill',
    'legacy_quantity',sm.quantity,'legacy_item_unit',ci.unit,
    'purchase_unit',iu.purchase_unit,'consumption_unit',iu.consumption_unit,
    'canonical_unit',iu.canonical_unit,'location_status','REVIEW_REQUIRED')
FROM public.company_items ci
JOIN public.inventory_item_units iu ON iu.company_item_id=ci.id
JOIN public.stock_locations sl ON sl.company_id=ci.company_id AND sl.code='LEGACY_REVIEW'
WHERE sm.company_item_id=ci.id AND sm.canonical_quantity IS NULL;

CREATE TRIGGER trg_phase3f_guard_company_stock_aggregate
BEFORE INSERT OR UPDATE ON public.company_stock
FOR EACH ROW EXECUTE FUNCTION public.phase3f_guard_company_stock_aggregate();

-- Keep the historical signature as an explicit compatibility failure. The old
-- contract has no unit or location and therefore cannot represent a physical
-- movement safely. The frontend is migrated to record_physical_stock_movement.
CREATE OR REPLACE FUNCTION public.adjust_company_stock(
  _company_id uuid,
  _company_item_id uuid,
  _delta numeric,
  _reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.phase3e_can_manage_pricing(auth.uid(),_company_id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='UNAUTHORIZED';
  END IF;
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='MISSING_LOCATION',
    DETAIL='Legacy adjustment has no physical unit/location; use record_physical_stock_movement';
END;
$$;

ALTER TABLE public.inventory_item_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_stock_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_item_units_select ON public.inventory_item_units FOR SELECT TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()),company_id));
CREATE POLICY inventory_item_units_manage ON public.inventory_item_units FOR ALL TO authenticated
USING (public.phase3e_can_manage_pricing((SELECT auth.uid()),company_id))
WITH CHECK (public.phase3e_can_manage_pricing((SELECT auth.uid()),company_id));
CREATE POLICY stock_locations_select ON public.stock_locations FOR SELECT TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()),company_id));
CREATE POLICY stock_locations_manage ON public.stock_locations FOR ALL TO authenticated
USING (public.phase3e_can_manage_pricing((SELECT auth.uid()),company_id))
WITH CHECK (public.phase3e_can_manage_pricing((SELECT auth.uid()),company_id));
CREATE POLICY physical_stock_balances_select ON public.physical_stock_balances FOR SELECT TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()),company_id));

GRANT SELECT ON public.inventory_item_units,public.stock_locations,
  public.physical_stock_balances,public.physical_inventory_summary TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.physical_stock_balances FROM authenticated,anon;
GRANT ALL ON public.inventory_item_units,public.stock_locations,public.physical_stock_balances TO service_role;

REVOKE ALL ON FUNCTION public.phase3f_normalize_unit(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.phase3f_unit_factor(uuid,text,numeric,numeric) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.create_stock_location(uuid,text,text,text,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.record_physical_stock_movement(uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.phase3f_normalize_unit(text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.phase3f_unit_factor(uuid,text,numeric,numeric) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_stock_location(uuid,text,text,text,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.record_physical_stock_movement(uuid,uuid,text,numeric,text,uuid,text,uuid,numeric,numeric,uuid,text,text,text,numeric,numeric,jsonb) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.adjust_company_stock(uuid,uuid,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.adjust_company_stock(uuid,uuid,numeric,text) TO authenticated,service_role;

COMMENT ON TABLE public.inventory_item_units IS 'Physical unit contract; independent from commercial pricing.';
COMMENT ON TABLE public.physical_stock_balances IS 'Canonical physical balances by item, variant, location, lot and dimensions.';
COMMENT ON COLUMN public.company_stock.quantity IS 'Compatibility aggregate in inventory_item_units.consumption_unit.';
COMMENT ON COLUMN public.stock_movements.canonical_quantity IS 'Immutable physical quantity in canonical_unit at movement time.';

NOTIFY pgrst,'reload schema';
