-- Phase 3G: canonical post-sale material requirements and purchase allocations.
-- This migration evolves the existing OS, reservation and purchase-order model.

CREATE OR REPLACE FUNCTION public.phase3g_user_can(
  _user_id uuid,
  _company_id uuid,
  _module text,
  _action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT _user_id IS NOT DISTINCT FROM (SELECT auth.uid()) AND EXISTS (
    SELECT 1
    FROM public.user_companies uc
    WHERE uc.user_id = _user_id
      AND uc.company_id = _company_id
      AND uc.is_active
      AND (
        uc.role = 'admin'::public.app_role
        OR EXISTS (
          SELECT 1
          FROM public.role_permissions rp
          WHERE rp.company_id = uc.company_id
            AND rp.role = uc.role
            AND rp.module = _module
            AND CASE lower(_action)
              WHEN 'view' THEN COALESCE(rp.can_view, false)
              WHEN 'create' THEN COALESCE(rp.can_create, false)
              WHEN 'edit' THEN COALESCE(rp.can_edit, false)
              WHEN 'delete' THEN COALESCE(rp.can_delete, false)
              ELSE false
            END
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.phase3g_user_can(uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase3g_user_can(uuid,uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.phase3g_seed_company_permissions(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.role_permissions(
    company_id, role, module, can_view, can_create, can_edit, can_delete
  )
  SELECT _company_id, seed.role::public.app_role, seed.module,
    seed.can_view, seed.can_create, seed.can_edit, seed.can_delete
  FROM (VALUES
    ('manager','material-requirements',true,true,true,false),
    ('manager','purchases',true,true,true,false),
    ('manager','purchase-approval',true,false,true,false),
    ('manager','purchase-receiving',true,true,true,false),
    ('manager','stock-reservations',true,true,true,false),
    ('employee','material-requirements',true,false,false,false),
    ('employee','purchases',true,false,false,false),
    ('employee','purchase-approval',false,false,false,false),
    ('employee','purchase-receiving',false,false,false,false),
    ('employee','stock-reservations',true,false,false,false)
  ) AS seed(role,module,can_view,can_create,can_edit,can_delete)
  ON CONFLICT (company_id,role,module) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase3g_seed_company_permissions_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.phase3g_seed_company_permissions(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.phase3g_seed_company_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.phase3g_seed_company_permissions_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase3g_seed_company_permissions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.phase3g_seed_company_permissions_trigger() TO service_role;

SELECT public.phase3g_seed_company_permissions(id) FROM public.companies;

DROP TRIGGER IF EXISTS trg_phase3g_seed_company_permissions ON public.companies;
CREATE TRIGGER trg_phase3g_seed_company_permissions
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.phase3g_seed_company_permissions_trigger();

CREATE TABLE public.material_purchase_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  os_item_id uuid REFERENCES public.os_items(id) ON DELETE SET NULL,
  os_material_id uuid NOT NULL UNIQUE REFERENCES public.os_materials(id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  sale_item_id uuid REFERENCES public.sale_items(id) ON DELETE SET NULL,
  company_item_id uuid NOT NULL,
  item_template_id uuid REFERENCES public.item_templates(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.company_item_variants(id) ON DELETE RESTRICT,
  required_quantity numeric NOT NULL,
  required_unit text NOT NULL,
  required_canonical_quantity numeric NOT NULL,
  canonical_unit text NOT NULL,
  consumption_unit text NOT NULL,
  purchase_unit text NOT NULL,
  purchase_to_canonical_factor numeric NOT NULL,
  consumption_to_canonical_factor numeric NOT NULL,
  purchase_allows_fractional boolean NOT NULL DEFAULT false,
  priority text NOT NULL DEFAULT 'NORMAL',
  lifecycle_status text NOT NULL DEFAULT 'ACTIVE',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_purchase_requirements_company_item_fkey
    FOREIGN KEY (company_item_id,company_id)
    REFERENCES public.company_items(id,company_id) ON DELETE RESTRICT,
  CONSTRAINT material_purchase_requirements_required_quantity_check
    CHECK (required_quantity > 0 AND required_canonical_quantity > 0),
  CONSTRAINT material_purchase_requirements_factors_check
    CHECK (purchase_to_canonical_factor > 0 AND consumption_to_canonical_factor > 0),
  CONSTRAINT material_purchase_requirements_priority_check
    CHECK (priority IN ('NORMAL','URGENT')),
  CONSTRAINT material_purchase_requirements_lifecycle_check
    CHECK (lifecycle_status IN ('ACTIVE','COMPLETED','CANCELLED')),
  CONSTRAINT material_purchase_requirements_cancelled_check
    CHECK ((lifecycle_status = 'CANCELLED') = (cancelled_at IS NOT NULL))
);

CREATE INDEX material_purchase_requirements_company_status_idx
  ON public.material_purchase_requirements(company_id,lifecycle_status,priority,created_at);
CREATE INDEX material_purchase_requirements_os_idx
  ON public.material_purchase_requirements(ordem_servico_id,os_item_id);
CREATE INDEX material_purchase_requirements_item_variant_idx
  ON public.material_purchase_requirements(company_id,company_item_id,variant_id)
  WHERE lifecycle_status='ACTIVE';

CREATE TABLE public.purchase_order_item_requirement_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_item_id uuid NOT NULL
    REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  material_requirement_id uuid NOT NULL
    REFERENCES public.material_purchase_requirements(id) ON DELETE RESTRICT,
  allocated_canonical_quantity numeric NOT NULL,
  received_canonical_quantity numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'OPEN',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_item_requirement_allocation_unique
    UNIQUE (purchase_order_item_id,material_requirement_id),
  CONSTRAINT purchase_order_item_requirement_allocation_quantity_check
    CHECK (allocated_canonical_quantity > 0
      AND received_canonical_quantity >= 0
      AND received_canonical_quantity <= allocated_canonical_quantity),
  CONSTRAINT purchase_order_item_requirement_allocation_status_check
    CHECK (status IN ('OPEN','PARTIAL','RECEIVED','CANCELLED'))
);

CREATE INDEX po_requirement_allocations_requirement_idx
  ON public.purchase_order_item_requirement_allocations(material_requirement_id,status);
CREATE INDEX po_requirement_allocations_company_item_idx
  ON public.purchase_order_item_requirement_allocations(company_id,purchase_order_item_id);

ALTER TABLE public.purchase_orders
  ADD COLUMN idempotency_key uuid;

CREATE UNIQUE INDEX purchase_orders_company_idempotency_key
  ON public.purchase_orders(company_id,idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.purchase_order_items
  ADD COLUMN company_item_id uuid,
  ADD COLUMN variant_id uuid,
  ADD COLUMN purchase_unit text,
  ADD COLUMN purchase_to_canonical_factor numeric,
  ADD COLUMN ordered_canonical_quantity numeric,
  ADD COLUMN received_canonical_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN purchase_allows_fractional boolean NOT NULL DEFAULT false;

ALTER TABLE public.purchase_order_items
  ADD CONSTRAINT purchase_order_items_company_item_id_fkey
    FOREIGN KEY (company_item_id) REFERENCES public.company_items(id) ON DELETE RESTRICT,
  ADD CONSTRAINT purchase_order_items_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES public.company_item_variants(id) ON DELETE RESTRICT,
  ADD CONSTRAINT purchase_order_items_canonical_quantities_check
    CHECK (
      (ordered_canonical_quantity IS NULL AND purchase_to_canonical_factor IS NULL)
      OR (ordered_canonical_quantity > 0
        AND purchase_to_canonical_factor > 0
        AND received_canonical_quantity >= 0
        AND received_canonical_quantity <= ordered_canonical_quantity)
    );

ALTER TABLE public.purchase_order_items
  DROP CONSTRAINT purchase_order_items_status_check,
  ADD CONSTRAINT purchase_order_items_status_check
    CHECK (status IN ('pending','ordered','partial','received','cancelled'));

CREATE INDEX purchase_order_items_company_item_variant_idx
  ON public.purchase_order_items(company_item_id,variant_id,status)
  WHERE company_item_id IS NOT NULL;

ALTER TABLE public.stock_reservations
  ADD COLUMN material_requirement_id uuid
    REFERENCES public.material_purchase_requirements(id) ON DELETE RESTRICT,
  ADD COLUMN physical_stock_balance_id uuid
    REFERENCES public.physical_stock_balances(id) ON DELETE RESTRICT;

DROP INDEX public.uq_stock_reservations_active_os_item;

CREATE UNIQUE INDEX stock_reservations_active_requirement_balance_key
  ON public.stock_reservations(material_requirement_id,physical_stock_balance_id)
  WHERE status='reserved' AND material_requirement_id IS NOT NULL;
CREATE INDEX stock_reservations_physical_balance_active_idx
  ON public.stock_reservations(physical_stock_balance_id)
  INCLUDE (canonical_quantity)
  WHERE status='reserved' AND physical_stock_balance_id IS NOT NULL;
CREATE INDEX stock_reservations_requirement_status_idx
  ON public.stock_reservations(material_requirement_id,status)
  WHERE material_requirement_id IS NOT NULL;

ALTER TABLE public.stock_reservations
  ADD CONSTRAINT stock_reservations_phase3g_physical_scope_check
  CHECK (material_requirement_id IS NULL OR physical_stock_balance_id IS NOT NULL);

ALTER TABLE public.os_materials
  DROP CONSTRAINT os_materials_procurement_status_check,
  ADD CONSTRAINT os_materials_procurement_status_check
    CHECK (procurement_status IN (
      'in_stock','pending_purchase','ordered','partial','received','cancelled'
    ));

CREATE OR REPLACE FUNCTION public.phase3g_validate_requirement_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_os public.ordens_servico;
  v_material public.os_materials;
  v_item public.company_items;
  v_units public.inventory_item_units;
BEGIN
  SELECT * INTO v_os FROM public.ordens_servico WHERE id=NEW.ordem_servico_id;
  SELECT * INTO v_material FROM public.os_materials WHERE id=NEW.os_material_id;
  SELECT * INTO v_item FROM public.company_items WHERE id=NEW.company_item_id;
  SELECT * INTO v_units FROM public.inventory_item_units
    WHERE company_id=NEW.company_id AND company_item_id=NEW.company_item_id;
  IF v_os.id IS NULL OR v_os.company_id<>NEW.company_id
     OR v_material.id IS NULL OR v_material.ordem_servico_id<>NEW.ordem_servico_id
     OR v_item.id IS NULL OR v_item.company_id<>NEW.company_id
     OR v_material.company_item_id IS DISTINCT FROM NEW.company_item_id
     OR v_units.id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_REQUIREMENT_SCOPE';
  END IF;
  IF NEW.os_item_id IS DISTINCT FROM v_material.os_item_id
     OR NEW.item_template_id IS DISTINCT FROM v_material.item_template_id THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_REQUIREMENT_SCOPE';
  END IF;
  IF NEW.variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.company_item_variants civ
    WHERE civ.id=NEW.variant_id AND civ.company_id=NEW.company_id
      AND civ.company_item_id=NEW.company_item_id AND civ.is_active
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='VARIANT_STOCK_MISMATCH';
  END IF;
  IF NEW.canonical_unit<>v_units.canonical_unit
     OR NEW.consumption_unit<>v_units.consumption_unit
     OR NEW.purchase_unit<>v_units.purchase_unit
     OR abs(NEW.purchase_to_canonical_factor-v_units.purchase_to_canonical_factor)>0.000001
     OR abs(NEW.consumption_to_canonical_factor-v_units.consumption_to_canonical_factor)>0.000001 THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_PURCHASE_CONVERSION';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase3g_validate_allocation_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_requirement public.material_purchase_requirements; v_item record;
BEGIN
  SELECT * INTO v_requirement FROM public.material_purchase_requirements
    WHERE id=NEW.material_requirement_id;
  SELECT poi.*,po.company_id INTO v_item
  FROM public.purchase_order_items poi JOIN public.purchase_orders po ON po.id=poi.purchase_order_id
  WHERE poi.id=NEW.purchase_order_item_id;
  IF v_requirement.id IS NULL OR v_item.id IS NULL
     OR v_requirement.company_id<>NEW.company_id OR v_item.company_id<>NEW.company_id
     OR v_requirement.company_item_id IS DISTINCT FROM v_item.company_item_id
     OR v_requirement.variant_id IS DISTINCT FROM v_item.variant_id THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='INVALID_ALLOCATION';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.phase3g_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_phase3g_validate_requirement_scope
BEFORE INSERT OR UPDATE ON public.material_purchase_requirements
FOR EACH ROW EXECUTE FUNCTION public.phase3g_validate_requirement_scope();
CREATE TRIGGER trg_phase3g_requirement_updated_at
BEFORE UPDATE ON public.material_purchase_requirements
FOR EACH ROW EXECUTE FUNCTION public.phase3g_touch_updated_at();
CREATE TRIGGER trg_phase3g_validate_allocation_scope
BEFORE INSERT OR UPDATE ON public.purchase_order_item_requirement_allocations
FOR EACH ROW EXECUTE FUNCTION public.phase3g_validate_allocation_scope();
CREATE TRIGGER trg_phase3g_allocation_updated_at
BEFORE UPDATE ON public.purchase_order_item_requirement_allocations
FOR EACH ROW EXECUTE FUNCTION public.phase3g_touch_updated_at();
CREATE TRIGGER audit_material_purchase_requirements_changes
AFTER INSERT OR UPDATE OR DELETE ON public.material_purchase_requirements
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
CREATE TRIGGER audit_po_requirement_allocations_changes
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_order_item_requirement_allocations
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE OR REPLACE VIEW public.material_purchase_requirements_summary
WITH (security_invoker=true)
AS
WITH reservation_totals AS (
  SELECT material_requirement_id,
    COALESCE(sum(canonical_quantity),0) AS reserved_canonical_quantity
  FROM public.stock_reservations
  WHERE status='reserved' AND material_requirement_id IS NOT NULL
  GROUP BY material_requirement_id
), allocation_totals AS (
  SELECT a.material_requirement_id,
    COALESCE(sum(a.allocated_canonical_quantity-a.received_canonical_quantity)
      FILTER (WHERE a.status IN ('OPEN','PARTIAL') AND po.status<>'cancelled'),0)
      AS open_order_canonical_quantity,
    COALESCE(sum(a.received_canonical_quantity),0) AS received_canonical_quantity
  FROM public.purchase_order_item_requirement_allocations a
  JOIN public.purchase_order_items poi ON poi.id=a.purchase_order_item_id
  JOIN public.purchase_orders po ON po.id=poi.purchase_order_id
  GROUP BY a.material_requirement_id
), base AS (
  SELECT r.*,os.os_number,om.item_name,om.item_type,
    COALESCE(it.specifications->>'code',it.codigo_servico) AS item_code,
    COALESCE(rt.reserved_canonical_quantity,0) AS reserved_canonical_quantity,
    COALESCE(at.open_order_canonical_quantity,0) AS open_order_canonical_quantity,
    COALESCE(at.received_canonical_quantity,0) AS received_canonical_quantity
  FROM public.material_purchase_requirements r
  JOIN public.ordens_servico os ON os.id=r.ordem_servico_id
  JOIN public.os_materials om ON om.id=r.os_material_id
  LEFT JOIN public.item_templates it ON it.id=r.item_template_id
  LEFT JOIN reservation_totals rt ON rt.material_requirement_id=r.id
  LEFT JOIN allocation_totals at ON at.material_requirement_id=r.id
)
SELECT base.*,
  CASE WHEN lifecycle_status='ACTIVE' THEN
    greatest(required_canonical_quantity-reserved_canonical_quantity,0) ELSE 0 END
    AS shortage_canonical_quantity,
  CASE WHEN lifecycle_status='ACTIVE' THEN
    greatest(required_canonical_quantity-reserved_canonical_quantity
      -open_order_canonical_quantity,0) ELSE 0 END AS purchase_required_canonical_quantity,
  CASE WHEN lifecycle_status='CANCELLED' THEN 'CANCELLED'
    WHEN lifecycle_status='COMPLETED' THEN 'SUPPLIED'
    WHEN reserved_canonical_quantity>=required_canonical_quantity THEN 'SUPPLIED'
    WHEN reserved_canonical_quantity>0 THEN 'PARTIALLY_SUPPLIED'
    ELSE 'PENDING' END AS status,
  CASE WHEN lifecycle_status<>'ACTIVE' THEN 0
    WHEN purchase_allows_fractional THEN
      greatest(required_canonical_quantity-reserved_canonical_quantity
        -open_order_canonical_quantity,0)/purchase_to_canonical_factor
    ELSE ceil(greatest(required_canonical_quantity-reserved_canonical_quantity
        -open_order_canonical_quantity,0)/purchase_to_canonical_factor)
  END AS suggested_purchase_quantity
FROM base;

ALTER TABLE public.material_purchase_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_item_requirement_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_purchase_requirements_select
ON public.material_purchase_requirements FOR SELECT TO authenticated
USING (public.phase3g_user_can((SELECT auth.uid()),company_id,'material-requirements','view'));
CREATE POLICY po_requirement_allocations_select
ON public.purchase_order_item_requirement_allocations FOR SELECT TO authenticated
USING (public.phase3g_user_can((SELECT auth.uid()),company_id,'purchases','view'));

DROP POLICY IF EXISTS "Users can create company purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update company purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Admins can delete company purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can view company purchase orders" ON public.purchase_orders;
CREATE POLICY phase3g_purchase_orders_select ON public.purchase_orders FOR SELECT TO authenticated
USING (public.phase3g_user_can((SELECT auth.uid()),company_id,'purchases','view'));

DROP POLICY IF EXISTS "Users can create purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can update purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can delete purchase order items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Users can view purchase order items" ON public.purchase_order_items;
CREATE POLICY phase3g_purchase_order_items_select ON public.purchase_order_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchase_orders po WHERE po.id=purchase_order_id
    AND public.phase3g_user_can((SELECT auth.uid()),po.company_id,'purchases','view')
));

REVOKE ALL ON public.material_purchase_requirements,
  public.purchase_order_item_requirement_allocations FROM anon, authenticated;
GRANT SELECT ON public.material_purchase_requirements,
  public.purchase_order_item_requirement_allocations,
  public.material_purchase_requirements_summary TO authenticated;
GRANT ALL ON public.material_purchase_requirements,
  public.purchase_order_item_requirement_allocations TO service_role;
REVOKE INSERT,UPDATE,DELETE ON public.purchase_orders,public.purchase_order_items
  FROM anon,authenticated;

REVOKE ALL ON FUNCTION public.phase3g_validate_requirement_scope(),
  public.phase3g_validate_allocation_scope(),public.phase3g_touch_updated_at()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.phase3g_validate_requirement_scope(),
  public.phase3g_validate_allocation_scope(),public.phase3g_touch_updated_at()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_material_purchase(
  uuid,numeric,text,uuid,numeric,uuid
) FROM PUBLIC,anon;

NOTIFY pgrst,'reload schema';
