-- Phase 3A: additive parametric engineering model.
-- Existing products remain FIXED. Only the evidence-backed Suprema two-leaf
-- sliding-window template is enabled as PARAMETRIC by this migration.

ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS composition_mode text NOT NULL DEFAULT 'fixed';

ALTER TABLE public.product_templates
  DROP CONSTRAINT IF EXISTS product_templates_composition_mode_check;
ALTER TABLE public.product_templates
  ADD CONSTRAINT product_templates_composition_mode_check
  CHECK (composition_mode IN ('fixed', 'parametric'));

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS composition_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS parametric_snapshot_version integer;

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_composition_mode_check;
ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_composition_mode_check
  CHECK (composition_mode IN ('fixed', 'parametric'));

CREATE TABLE public.product_parametric_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_template_id uuid NOT NULL
    REFERENCES public.product_templates(id) ON DELETE CASCADE,
  rule_key text NOT NULL,
  material_type text NOT NULL,
  item_template_id uuid
    REFERENCES public.item_templates(id) ON DELETE RESTRICT,
  group_name text NOT NULL DEFAULT 'Geral',
  formula text,
  width_formula text,
  height_formula text,
  quantity_formula text,
  pieces_formula text,
  condition_expression text,
  unit text NOT NULL DEFAULT 'un',
  cut_orientation text,
  cut_angle text,
  side text NOT NULL DEFAULT 'A',
  calculation_type text NOT NULL DEFAULT 'formula',
  applies_to text NOT NULL DEFAULT 'side',
  loss_percent numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  is_validated boolean NOT NULL DEFAULT false,
  validation_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_parametric_rules_material_type_check
    CHECK (material_type IN ('profile', 'glass', 'accessory', 'consumable', 'service')),
  CONSTRAINT product_parametric_rules_version_check CHECK (version > 0),
  CONSTRAINT product_parametric_rules_loss_check CHECK (loss_percent >= 0 AND loss_percent < 100),
  CONSTRAINT product_parametric_rules_rule_key_check CHECK (btrim(rule_key) <> ''),
  CONSTRAINT product_parametric_rules_formula_required_check CHECK (
    formula IS NOT NULL OR width_formula IS NOT NULL OR height_formula IS NOT NULL
    OR quantity_formula IS NOT NULL OR pieces_formula IS NOT NULL
  ),
  CONSTRAINT product_parametric_rules_version_unique
    UNIQUE (product_template_id, rule_key, version)
);

CREATE UNIQUE INDEX product_parametric_rules_current_unique
  ON public.product_parametric_rules(product_template_id, rule_key)
  WHERE is_active;
CREATE INDEX product_parametric_rules_template_order_idx
  ON public.product_parametric_rules(product_template_id, sort_order, rule_key);
CREATE INDEX product_parametric_rules_item_template_idx
  ON public.product_parametric_rules(item_template_id)
  WHERE item_template_id IS NOT NULL;

CREATE TABLE public.company_parametric_rule_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.product_parametric_rules(id) ON DELETE CASCADE,
  company_item_id uuid,
  formula_override text,
  width_formula_override text,
  height_formula_override text,
  quantity_formula_override text,
  pieces_formula_override text,
  condition_override text,
  loss_percent_override numeric,
  is_disabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_parametric_overrides_company_item_fk
    FOREIGN KEY (company_item_id, company_id)
    REFERENCES public.company_items(id, company_id) ON DELETE RESTRICT,
  CONSTRAINT company_parametric_overrides_loss_check
    CHECK (loss_percent_override IS NULL OR
           (loss_percent_override >= 0 AND loss_percent_override < 100)),
  CONSTRAINT company_parametric_overrides_unique UNIQUE (company_id, rule_id)
);

CREATE INDEX company_parametric_overrides_rule_idx
  ON public.company_parametric_rule_overrides(rule_id);
CREATE INDEX company_parametric_overrides_company_idx
  ON public.company_parametric_rule_overrides(company_id);

CREATE TABLE public.product_variant_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_template_id uuid NOT NULL
    REFERENCES public.product_templates(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  label text NOT NULL,
  input_type text NOT NULL,
  allowed_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_value jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variant_definitions_key_check CHECK (btrim(variant_key) <> ''),
  CONSTRAINT product_variant_definitions_input_type_check
    CHECK (input_type IN ('select', 'number', 'boolean', 'text')),
  CONSTRAINT product_variant_definitions_unique
    UNIQUE (product_template_id, variant_key)
);

CREATE INDEX product_variant_definitions_template_order_idx
  ON public.product_variant_definitions(product_template_id, sort_order, variant_key);

CREATE TRIGGER set_product_parametric_rules_updated_at
  BEFORE UPDATE ON public.product_parametric_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_company_parametric_rule_overrides_updated_at
  BEFORE UPDATE ON public.company_parametric_rule_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_product_variant_definitions_updated_at
  BEFORE UPDATE ON public.product_variant_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_parametric_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_parametric_rule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_parametric_rules_authenticated_read
  ON public.product_parametric_rules FOR SELECT TO authenticated
  USING (true);
CREATE POLICY product_parametric_rules_saas_admin_write
  ON public.product_parametric_rules FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid()))
  WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE POLICY product_variant_definitions_authenticated_read
  ON public.product_variant_definitions FOR SELECT TO authenticated
  USING (true);
CREATE POLICY product_variant_definitions_saas_admin_write
  ON public.product_variant_definitions FOR ALL TO authenticated
  USING (public.is_saas_admin(auth.uid()))
  WITH CHECK (public.is_saas_admin(auth.uid()));

CREATE POLICY company_parametric_overrides_company_read
  ON public.company_parametric_rule_overrides FOR SELECT TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY company_parametric_overrides_company_insert
  ON public.company_parametric_rule_overrides FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY company_parametric_overrides_company_update
  ON public.company_parametric_rule_overrides FOR UPDATE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY company_parametric_overrides_company_delete
  ON public.company_parametric_rule_overrides FOR DELETE TO authenticated
  USING (public.user_belongs_to_company(auth.uid(), company_id));

REVOKE ALL ON TABLE public.product_parametric_rules FROM anon;
REVOKE ALL ON TABLE public.company_parametric_rule_overrides FROM anon;
REVOKE ALL ON TABLE public.product_variant_definitions FROM anon;
GRANT SELECT ON TABLE public.product_parametric_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.company_parametric_rule_overrides TO authenticated;
GRANT SELECT ON TABLE public.product_variant_definitions TO authenticated;
GRANT ALL ON TABLE public.product_parametric_rules TO service_role;
GRANT ALL ON TABLE public.company_parametric_rule_overrides TO service_role;
GRANT ALL ON TABLE public.product_variant_definitions TO service_role;

-- Seed only the existing Vetra formulas for the single approved proof product.
-- They remain explicitly ESTIMATED until checked against a real cutting sheet.
WITH target AS (
  SELECT id
  FROM public.product_templates
  WHERE id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
    AND lower(btrim(name)) = 'janela de correr 2 folhas'
    AND lower(btrim(linha)) = 'suprema'
), seeded AS (
  INSERT INTO public.product_parametric_rules (
    product_template_id, rule_key, material_type, item_template_id, group_name,
    formula, width_formula, height_formula, quantity_formula, pieces_formula,
    unit, cut_orientation, cut_angle, side, calculation_type, applies_to,
    loss_percent, sort_order, version, is_active, is_validated, validation_source
  )
  SELECT
    pti.product_template_id,
    'legacy-' || pti.id::text,
    CASE
      WHEN it.type::text IN ('profile', 'glass', 'accessory', 'service') THEN it.type::text
      ELSE 'consumable'
    END,
    pti.item_template_id,
    COALESCE(NULLIF(pti.section, ''), 'Composição existente'),
    COALESCE(pti.width_formula, pti.height_formula, pti.quantity_formula),
    pti.width_formula,
    pti.height_formula,
    pti.quantity_formula,
    pti.pieces_formula,
    COALESCE(it.unit, 'un'),
    CASE WHEN it.type::text = 'profile' THEN
      CASE WHEN pti.width_formula IS NOT NULL THEN 'horizontal' ELSE 'vertical' END
    ELSE NULL END,
    COALESCE(pti.cut_angle::text, '90'),
    COALESCE(NULLIF(pti.side, ''), 'A'),
    COALESCE(NULLIF(pti.calculation_type, ''), 'formula'),
    COALESCE(NULLIF(pti.applies_to, ''), 'side'),
    COALESCE(pti.loss_percent, 0),
    row_number() OVER (ORDER BY pti.created_at, pti.id)::integer * 10,
    1,
    true,
    false,
    'existing_product_template_items_estimated'
  FROM public.product_template_items pti
  JOIN target t ON t.id = pti.product_template_id
  JOIN public.item_templates it ON it.id = pti.item_template_id
  RETURNING product_template_id
)
SELECT count(*) FROM seeded;

INSERT INTO public.product_variant_definitions (
  product_template_id, variant_key, label, input_type,
  allowed_values, default_value, sort_order, is_active
)
SELECT id, 'folhas', 'Folhas', 'select', '[2]'::jsonb, '2'::jsonb, 10, true
FROM public.product_templates
WHERE id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
  AND lower(btrim(name)) = 'janela de correr 2 folhas'
  AND lower(btrim(linha)) = 'suprema'
ON CONFLICT (product_template_id, variant_key) DO NOTHING;

UPDATE public.product_templates
SET composition_mode = 'parametric', updated_at = now()
WHERE id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid
  AND lower(btrim(name)) = 'janela de correr 2 folhas'
  AND lower(btrim(linha)) = 'suprema';

-- Keep FIXED freezing behavior, but require an explicit engine snapshot for
-- PARAMETRIC items and verify that its inputs match the persisted dimensions.
CREATE OR REPLACE FUNCTION public.trg_freeze_quote_item_composition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_mode text := 'fixed';
  v_quote_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.composition_snapshot IS DISTINCT FROM OLD.composition_snapshot THEN
    SELECT q.status INTO v_quote_status FROM public.quotes q WHERE q.id = NEW.quote_id;
    IF v_quote_status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'approved_quote_composition_is_immutable';
    END IF;
  END IF;

  IF NEW.product_template_id IS NOT NULL THEN
    SELECT pt.composition_mode INTO v_mode
    FROM public.product_templates pt
    WHERE pt.id = NEW.product_template_id;
  END IF;
  v_mode := COALESCE(v_mode, 'fixed');
  NEW.composition_mode := v_mode;

  IF v_mode = 'parametric' THEN
    IF NEW.composition_snapshot IS NULL
       OR jsonb_typeof(NEW.composition_snapshot) <> 'object'
       OR NEW.composition_snapshot->>'composition_mode' <> 'parametric'
       OR jsonb_typeof(NEW.composition_snapshot->'items') <> 'array'
       OR jsonb_typeof(NEW.composition_snapshot->'materials') <> 'array'
       OR jsonb_typeof(NEW.composition_snapshot->'cuts') <> 'array'
       OR jsonb_typeof(NEW.composition_snapshot->'warnings') <> 'array' THEN
      RAISE EXCEPTION 'parametric_composition_snapshot_required';
    END IF;
    IF round(COALESCE((NEW.composition_snapshot#>>'{inputs,width_mm}')::numeric, -1), 3)
         <> round(COALESCE(NEW.width, -1), 3)
       OR round(COALESCE((NEW.composition_snapshot#>>'{inputs,height_mm}')::numeric, -1), 3)
         <> round(COALESCE(NEW.height, -1), 3)
       OR COALESCE((NEW.composition_snapshot#>>'{inputs,quantity}')::integer, -1)
         <> COALESCE(NEW.quantity, -1) THEN
      RAISE EXCEPTION 'parametric_snapshot_inputs_mismatch';
    END IF;
    NEW.parametric_snapshot_version :=
      COALESCE((NEW.composition_snapshot->>'snapshot_version')::integer, 1);
    RETURN NEW;
  END IF;

  NEW.parametric_snapshot_version := NULL;
  IF NEW.composition_snapshot IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.company_product_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'source', 'company_product',
      'composition_mode', 'fixed',
      'product_id', NEW.company_product_id,
      'frozen_at', now(),
      'items', COALESCE(jsonb_agg(to_jsonb(cpi) ORDER BY cpi.sort_order, cpi.id), '[]'::jsonb)
    )
    INTO NEW.composition_snapshot
    FROM public.company_product_items cpi
    WHERE cpi.company_product_id = NEW.company_product_id;
  ELSIF NEW.product_template_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'source', 'product_template',
      'composition_mode', 'fixed',
      'product_id', NEW.product_template_id,
      'frozen_at', now(),
      'items', COALESCE(jsonb_agg(to_jsonb(pti) ORDER BY pti.created_at, pti.id), '[]'::jsonb)
    )
    INTO NEW.composition_snapshot
    FROM public.product_template_items pti
    WHERE pti.product_template_id = NEW.product_template_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_freeze_quote_item_composition ON public.quote_items;
CREATE TRIGGER trg_freeze_quote_item_composition
BEFORE INSERT OR UPDATE OF product_template_id, company_product_id,
  composition_snapshot, width, height, quantity
ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.trg_freeze_quote_item_composition();
