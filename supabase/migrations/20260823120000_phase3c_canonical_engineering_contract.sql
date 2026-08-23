-- Phase 3C / Etapa B
-- Canonical fulfillment + immutable engineering snapshot contract.
-- No fixtures are created by this migration.

ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'PRODUCTION',
  ADD COLUMN IF NOT EXISTS installation_gap_width_mm numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS installation_gap_height_mm numeric NOT NULL DEFAULT 0;

ALTER TABLE public.product_templates
  DROP CONSTRAINT IF EXISTS product_templates_fulfillment_mode_check,
  ADD CONSTRAINT product_templates_fulfillment_mode_check
    CHECK (fulfillment_mode IN ('IMMEDIATE', 'PRODUCTION', 'SERVICE')),
  DROP CONSTRAINT IF EXISTS product_templates_installation_gap_check,
  ADD CONSTRAINT product_templates_installation_gap_check
    CHECK (installation_gap_width_mm >= 0 AND installation_gap_height_mm >= 0);

COMMENT ON COLUMN public.product_templates.fulfillment_mode IS
  'Global SaaS Admin authority: IMMEDIATE, PRODUCTION or SERVICE. Company override is intentionally unsupported.';
COMMENT ON COLUMN public.product_templates.installation_gap_width_mm IS
  'Gap applied to opening width (VW) before engineering formulas receive manufacturing width (L).';
COMMENT ON COLUMN public.product_templates.installation_gap_height_mm IS
  'Gap applied to opening height (VH) before engineering formulas receive manufacturing height (A).';

ALTER TABLE public.product_template_items
  ADD COLUMN IF NOT EXISTS component_role text,
  ADD COLUMN IF NOT EXISTS technical_status text NOT NULL DEFAULT 'ESTIMATED',
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_page text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS technical_notes text,
  ADD COLUMN IF NOT EXISTS piece_width_formula text,
  ADD COLUMN IF NOT EXISTS piece_height_formula text,
  ADD COLUMN IF NOT EXISTS condition_expression text,
  ADD COLUMN IF NOT EXISTS supply_mode text;

ALTER TABLE public.product_template_items
  DROP CONSTRAINT IF EXISTS product_template_items_technical_status_check,
  ADD CONSTRAINT product_template_items_technical_status_check
    CHECK (technical_status IN ('ESTIMATED', 'VALIDATED', 'REJECTED')),
  DROP CONSTRAINT IF EXISTS product_template_items_supply_mode_check,
  ADD CONSTRAINT product_template_items_supply_mode_check
    CHECK (supply_mode IS NULL OR supply_mode IN ('INTERNAL_STOCK', 'DEDICATED_PURCHASE'));

COMMENT ON COLUMN public.product_template_items.piece_width_formula IS
  'Dedicated dimensional-piece width formula. item_templates.default_formulas is legacy and is not an engineering source.';
COMMENT ON COLUMN public.product_template_items.piece_height_formula IS
  'Dedicated dimensional-piece height formula. item_templates.default_formulas is legacy and is not an engineering source.';
COMMENT ON COLUMN public.item_templates.default_formulas IS
  'DEPRECATED legacy payload. Preserved read-only during Phase 3C; product engineering must use product_template_items or product_parametric_rules.';

ALTER TABLE public.product_parametric_rules
  ADD COLUMN IF NOT EXISTS component_role text,
  ADD COLUMN IF NOT EXISTS technical_status text NOT NULL DEFAULT 'ESTIMATED',
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_page text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS piece_width_formula text,
  ADD COLUMN IF NOT EXISTS piece_height_formula text,
  ADD COLUMN IF NOT EXISTS supply_mode text;

UPDATE public.product_parametric_rules
SET technical_status = CASE WHEN is_validated THEN 'VALIDATED' ELSE 'ESTIMATED' END
WHERE technical_status IS DISTINCT FROM CASE WHEN is_validated THEN 'VALIDATED' ELSE 'ESTIMATED' END;

ALTER TABLE public.product_parametric_rules
  DROP CONSTRAINT IF EXISTS product_parametric_rules_technical_status_check,
  ADD CONSTRAINT product_parametric_rules_technical_status_check
    CHECK (technical_status IN ('ESTIMATED', 'VALIDATED', 'REJECTED')),
  DROP CONSTRAINT IF EXISTS product_parametric_rules_supply_mode_check,
  ADD CONSTRAINT product_parametric_rules_supply_mode_check
    CHECK (supply_mode IS NULL OR supply_mode IN ('INTERNAL_STOCK', 'DEDICATED_PURCHASE'));

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS fulfillment_mode text,
  ADD COLUMN IF NOT EXISTS snapshot_version integer,
  ADD COLUMN IF NOT EXISTS opening_width numeric,
  ADD COLUMN IF NOT EXISTS opening_height numeric,
  ADD COLUMN IF NOT EXISTS opening_width_b numeric,
  ADD COLUMN IF NOT EXISTS opening_height_b numeric,
  ADD COLUMN IF NOT EXISTS opening_width_c numeric,
  ADD COLUMN IF NOT EXISTS opening_height_c numeric;

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_fulfillment_mode_check,
  ADD CONSTRAINT quote_items_fulfillment_mode_check
    CHECK (fulfillment_mode IS NULL OR fulfillment_mode IN ('IMMEDIATE', 'PRODUCTION', 'SERVICE'));

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS product_template_id uuid REFERENCES public.product_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_quote_item_id uuid REFERENCES public.quote_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS composition_mode text,
  ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'IMMEDIATE',
  ADD COLUMN IF NOT EXISTS engineering_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_version integer;

ALTER TABLE public.sale_items
  DROP CONSTRAINT IF EXISTS sale_items_composition_mode_check,
  ADD CONSTRAINT sale_items_composition_mode_check
    CHECK (composition_mode IS NULL OR composition_mode IN ('fixed', 'parametric')),
  DROP CONSTRAINT IF EXISTS sale_items_fulfillment_mode_check,
  ADD CONSTRAINT sale_items_fulfillment_mode_check
    CHECK (fulfillment_mode IN ('IMMEDIATE', 'PRODUCTION', 'SERVICE'));

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS operation_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS sales_operation_key_unique
  ON public.sales (company_id, operation_key)
  WHERE operation_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_one_full_sale_per_quote
  ON public.sales (quote_id)
  WHERE quote_id IS NOT NULL AND sale_type = 'full';

ALTER TABLE public.ordens_servico ALTER COLUMN quote_id DROP NOT NULL;
ALTER TABLE public.ordens_servico
  DROP CONSTRAINT IF EXISTS ordens_servico_commercial_source_check,
  ADD CONSTRAINT ordens_servico_commercial_source_check
    CHECK (quote_id IS NOT NULL OR sale_id IS NOT NULL);

ALTER TABLE public.os_items
  ADD COLUMN IF NOT EXISTS sale_item_id uuid REFERENCES public.sale_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'PRODUCTION',
  ADD COLUMN IF NOT EXISTS engineering_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_version integer;

ALTER TABLE public.os_items
  DROP CONSTRAINT IF EXISTS os_items_fulfillment_mode_check,
  ADD CONSTRAINT os_items_fulfillment_mode_check
    CHECK (fulfillment_mode IN ('PRODUCTION', 'SERVICE'));

CREATE UNIQUE INDEX IF NOT EXISTS os_items_sale_item_unique
  ON public.os_items (sale_item_id)
  WHERE sale_item_id IS NOT NULL;

ALTER TABLE public.os_materials
  ADD COLUMN IF NOT EXISTS snapshot_key text,
  ADD COLUMN IF NOT EXISTS company_item_id uuid REFERENCES public.company_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS required_quantity numeric,
  ADD COLUMN IF NOT EXISTS snapshot_payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS os_materials_snapshot_key_unique
  ON public.os_materials (ordem_servico_id, os_item_id, snapshot_key)
  WHERE snapshot_key IS NOT NULL;

ALTER TABLE public.material_consumption
  ADD COLUMN IF NOT EXISTS snapshot_key text,
  ADD COLUMN IF NOT EXISTS snapshot_payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS material_consumption_snapshot_key_unique
  ON public.material_consumption (ordem_servico_id, os_item_id, snapshot_key)
  WHERE snapshot_key IS NOT NULL;

ALTER TABLE public.os_cutting_plan
  ADD COLUMN IF NOT EXISTS sale_item_id uuid REFERENCES public.sale_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS engineering_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS snapshot_version integer;

CREATE UNIQUE INDEX IF NOT EXISTS os_cutting_plan_os_item_unique
  ON public.os_cutting_plan (os_item_id)
  WHERE os_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.os_glass_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem_servico_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  os_item_id uuid NOT NULL REFERENCES public.os_items(id) ON DELETE CASCADE,
  os_glass_project_id uuid REFERENCES public.os_glass_projects(id) ON DELETE SET NULL,
  sale_item_id uuid REFERENCES public.sale_items(id) ON DELETE SET NULL,
  quote_item_id uuid REFERENCES public.quote_items(id) ON DELETE SET NULL,
  item_template_id uuid REFERENCES public.item_templates(id) ON DELETE SET NULL,
  company_item_id uuid REFERENCES public.company_items(id) ON DELETE SET NULL,
  snapshot_key text NOT NULL,
  snapshot_version integer NOT NULL DEFAULT 1,
  snapshot_payload jsonb NOT NULL,
  piece_code text NOT NULL,
  piece_role text,
  width_mm numeric NOT NULL,
  height_mm numeric NOT NULL,
  thickness_mm numeric,
  color text,
  quantity numeric NOT NULL DEFAULT 1,
  received_quantity numeric NOT NULL DEFAULT 0,
  area_m2 numeric GENERATED ALWAYS AS
    (round((width_mm * height_mm * quantity) / 1000000::numeric, 6)) STORED,
  supply_mode text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT os_glass_pieces_dimensions_check CHECK (width_mm > 0 AND height_mm > 0),
  CONSTRAINT os_glass_pieces_quantity_check CHECK (
    quantity > 0 AND received_quantity >= 0 AND received_quantity <= quantity
  ),
  CONSTRAINT os_glass_pieces_supply_mode_check CHECK (
    supply_mode IN ('INTERNAL_STOCK', 'DEDICATED_PURCHASE')
  ),
  CONSTRAINT os_glass_pieces_status_check CHECK (
    status IN ('PENDING', 'ORDERED', 'PARTIAL', 'RECEIVED', 'CONSUMED', 'CANCELLED')
  ),
  CONSTRAINT os_glass_pieces_piece_code_unique UNIQUE (ordem_servico_id, piece_code)
);

CREATE INDEX IF NOT EXISTS os_glass_pieces_company_status_idx
  ON public.os_glass_pieces (company_id, status);
CREATE INDEX IF NOT EXISTS os_glass_pieces_os_item_idx
  ON public.os_glass_pieces (os_item_id);
CREATE INDEX IF NOT EXISTS os_glass_pieces_template_idx
  ON public.os_glass_pieces (company_id, item_template_id);

CREATE TABLE IF NOT EXISTS public.purchase_order_item_glass_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  os_glass_piece_id uuid NOT NULL REFERENCES public.os_glass_pieces(id) ON DELETE RESTRICT,
  allocated_quantity numeric NOT NULL,
  received_quantity numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_order_item_glass_piece_quantity_check CHECK (
    allocated_quantity > 0 AND received_quantity >= 0 AND received_quantity <= allocated_quantity
  ),
  CONSTRAINT purchase_order_item_glass_piece_unique UNIQUE (purchase_order_item_id, os_glass_piece_id)
);

CREATE INDEX IF NOT EXISTS po_item_glass_pieces_company_idx
  ON public.purchase_order_item_glass_pieces (company_id, purchase_order_item_id);
CREATE INDEX IF NOT EXISTS po_item_glass_pieces_piece_idx
  ON public.purchase_order_item_glass_pieces (os_glass_piece_id);

ALTER TABLE public.os_glass_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_item_glass_pieces ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.os_glass_pieces FROM anon;
REVOKE ALL ON TABLE public.purchase_order_item_glass_pieces FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.os_glass_pieces TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.purchase_order_item_glass_pieces TO authenticated;
GRANT ALL ON TABLE public.os_glass_pieces TO service_role;
GRANT ALL ON TABLE public.purchase_order_item_glass_pieces TO service_role;

DROP POLICY IF EXISTS os_glass_pieces_select_company ON public.os_glass_pieces;
CREATE POLICY os_glass_pieces_select_company
ON public.os_glass_pieces FOR SELECT TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS os_glass_pieces_insert_company ON public.os_glass_pieces;
CREATE POLICY os_glass_pieces_insert_company
ON public.os_glass_pieces FOR INSERT TO authenticated
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS os_glass_pieces_update_company ON public.os_glass_pieces;
CREATE POLICY os_glass_pieces_update_company
ON public.os_glass_pieces FOR UPDATE TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS po_item_glass_pieces_select_company ON public.purchase_order_item_glass_pieces;
CREATE POLICY po_item_glass_pieces_select_company
ON public.purchase_order_item_glass_pieces FOR SELECT TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS po_item_glass_pieces_insert_company ON public.purchase_order_item_glass_pieces;
CREATE POLICY po_item_glass_pieces_insert_company
ON public.purchase_order_item_glass_pieces FOR INSERT TO authenticated
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));

DROP POLICY IF EXISTS po_item_glass_pieces_update_company ON public.purchase_order_item_glass_pieces;
CREATE POLICY po_item_glass_pieces_update_company
ON public.purchase_order_item_glass_pieces FOR UPDATE TO authenticated
USING (public.user_belongs_to_company((SELECT auth.uid()), company_id))
WITH CHECK (public.user_belongs_to_company((SELECT auth.uid()), company_id));

CREATE OR REPLACE FUNCTION public.phase3c_validate_engineering_snapshot(
  _snapshot jsonb,
  _expected_fulfillment text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_mode text;
  v_fulfillment text;
BEGIN
  IF _snapshot IS NULL OR jsonb_typeof(_snapshot) <> 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SNAPSHOT_MISSING';
  END IF;
  v_mode := _snapshot->>'composition_mode';
  v_fulfillment := _snapshot->>'fulfillment_mode';
  IF v_mode NOT IN ('fixed', 'parametric')
     OR v_fulfillment NOT IN ('IMMEDIATE', 'PRODUCTION', 'SERVICE')
     OR jsonb_typeof(_snapshot->'inputs') <> 'object'
     OR jsonb_typeof(_snapshot->'materials') <> 'array'
     OR jsonb_typeof(_snapshot->'glass_pieces') <> 'array'
     OR jsonb_typeof(_snapshot->'cuts') <> 'array'
     OR jsonb_typeof(_snapshot->'rules') <> 'array'
     OR jsonb_typeof(_snapshot->'totals') <> 'object'
     OR jsonb_typeof(_snapshot->'warnings') <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;
  IF _expected_fulfillment IS NOT NULL AND v_fulfillment <> _expected_fulfillment THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SNAPSHOT_FULFILLMENT_MISMATCH';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_snapshot->'materials') material
    WHERE COALESCE((material->>'quantity')::numeric, 0) <= 0
       OR NULLIF(material->>'item_template_id', '') IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_ENGINEERING_RULE';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_snapshot->'glass_pieces') piece
    WHERE COALESCE((piece->>'width_mm')::numeric, 0) <= 0
       OR COALESCE((piece->>'height_mm')::numeric, 0) <= 0
       OR COALESCE((piece->>'quantity')::numeric, 0) <= 0
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_GLASS_PIECE';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.phase3c_validate_engineering_snapshot(jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase3c_validate_engineering_snapshot(jsonb, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.phase3c_enforce_glass_allocation_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order_company uuid;
  v_piece_company uuid;
  v_piece_mode text;
BEGIN
  SELECT po.company_id INTO v_order_company
  FROM public.purchase_order_items poi
  JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
  WHERE poi.id = NEW.purchase_order_item_id;

  SELECT gp.company_id, gp.supply_mode INTO v_piece_company, v_piece_mode
  FROM public.os_glass_pieces gp
  WHERE gp.id = NEW.os_glass_piece_id;

  IF v_order_company IS NULL OR v_piece_company IS NULL
     OR v_order_company <> v_piece_company OR NEW.company_id <> v_piece_company THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'GLASS_PIECE_COMPANY_MISMATCH';
  END IF;
  IF v_piece_mode <> 'DEDICATED_PURCHASE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'GLASS_PIECE_NOT_DEDICATED_PURCHASE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase3c_glass_allocation_company ON public.purchase_order_item_glass_pieces;
CREATE TRIGGER trg_phase3c_glass_allocation_company
BEFORE INSERT OR UPDATE ON public.purchase_order_item_glass_pieces
FOR EACH ROW EXECUTE FUNCTION public.phase3c_enforce_glass_allocation_company();

REVOKE ALL ON FUNCTION public.phase3c_enforce_glass_allocation_company() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase3c_enforce_glass_allocation_company() TO service_role;

CREATE OR REPLACE FUNCTION public.phase3c_cancel_open_glass_pieces()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.os_glass_pieces
    SET status = 'CANCELLED', updated_at = now()
    WHERE ordem_servico_id = NEW.id
      AND status IN ('PENDING', 'ORDERED', 'PARTIAL');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_phase3c_cancel_open_glass_pieces ON public.ordens_servico;
CREATE TRIGGER trg_phase3c_cancel_open_glass_pieces
AFTER UPDATE OF status ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.phase3c_cancel_open_glass_pieces();

REVOKE ALL ON FUNCTION public.phase3c_cancel_open_glass_pieces() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.phase3c_cancel_open_glass_pieces() TO service_role;
