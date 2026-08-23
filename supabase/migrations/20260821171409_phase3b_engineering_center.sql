-- Phase 3B: SaaS engineering center, immutable rule versioning and
-- controlled commercial validation for the single Suprema two-leaf proof template.

ALTER TABLE public.product_templates
  ADD COLUMN IF NOT EXISTS publication_status text;

UPDATE public.product_templates
SET publication_status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE publication_status IS NULL;

ALTER TABLE public.product_templates
  ALTER COLUMN publication_status SET DEFAULT 'draft',
  ALTER COLUMN publication_status SET NOT NULL;

ALTER TABLE public.product_templates
  DROP CONSTRAINT IF EXISTS product_templates_publication_status_check;
ALTER TABLE public.product_templates
  ADD CONSTRAINT product_templates_publication_status_check
  CHECK (publication_status IN ('draft', 'active', 'inactive'));

ALTER TABLE public.product_parametric_rules
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_reason text,
  ADD COLUMN IF NOT EXISTS supersedes_rule_id uuid
    REFERENCES public.product_parametric_rules(id) ON DELETE SET NULL;

ALTER TABLE public.company_parametric_rule_overrides
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE public.product_variant_definitions
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_reason text;

CREATE INDEX IF NOT EXISTS product_parametric_rules_supersedes_idx
  ON public.product_parametric_rules(supersedes_rule_id)
  WHERE supersedes_rule_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_sync_product_template_publication()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.publication_status := COALESCE(NEW.publication_status, 'draft');
    NEW.is_active := NEW.publication_status = 'active';
  ELSIF NEW.publication_status IS DISTINCT FROM OLD.publication_status THEN
    NEW.is_active := NEW.publication_status = 'active';
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.publication_status := CASE WHEN NEW.is_active THEN 'active' ELSE 'inactive' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_product_template_publication ON public.product_templates;
CREATE TRIGGER sync_product_template_publication
BEFORE INSERT OR UPDATE OF publication_status, is_active ON public.product_templates
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_product_template_publication();

-- Draft templates are private to SaaS Admin. Inactive global templates remain
-- readable only when already linked to a company, preserving historical joins.
DROP POLICY IF EXISTS "Authenticated can view product templates" ON public.product_templates;
DROP POLICY IF EXISTS "Authenticated can view available product templates" ON public.product_templates;
CREATE POLICY "Authenticated can view available product templates"
ON public.product_templates FOR SELECT TO authenticated
USING (
  (SELECT public.is_saas_admin((SELECT auth.uid())))
  OR (
    company_id IS NULL
    AND (
      publication_status = 'active'
      OR (
        publication_status = 'inactive'
        AND EXISTS (
          SELECT 1
          FROM public.company_products cp
          WHERE cp.product_template_id = product_templates.id
            AND public.user_belongs_to_company((SELECT auth.uid()), cp.company_id)
        )
      )
    )
  )
  OR (
    company_id IS NOT NULL
    AND publication_status <> 'draft'
    AND public.user_belongs_to_company((SELECT auth.uid()), company_id)
  )
);

DROP POLICY IF EXISTS product_parametric_rules_authenticated_read ON public.product_parametric_rules;
DROP POLICY IF EXISTS product_parametric_rules_available_read ON public.product_parametric_rules;
CREATE POLICY product_parametric_rules_available_read
ON public.product_parametric_rules FOR SELECT TO authenticated
USING (
  (SELECT public.is_saas_admin((SELECT auth.uid())))
  OR (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.product_templates pt
      WHERE pt.id = product_parametric_rules.product_template_id
        AND pt.publication_status = 'active'
    )
  )
);

DROP POLICY IF EXISTS product_variant_definitions_authenticated_read ON public.product_variant_definitions;
DROP POLICY IF EXISTS product_variant_definitions_available_read ON public.product_variant_definitions;
CREATE POLICY product_variant_definitions_available_read
ON public.product_variant_definitions FOR SELECT TO authenticated
USING (
  (SELECT public.is_saas_admin((SELECT auth.uid())))
  OR (
    is_active
    AND EXISTS (
      SELECT 1 FROM public.product_templates pt
      WHERE pt.id = product_variant_definitions.product_template_id
        AND pt.publication_status = 'active'
    )
  )
);

CREATE OR REPLACE FUNCTION public.create_product_parametric_rule_version(
  _source_rule_id uuid,
  _product_template_id uuid,
  _rule jsonb,
  _change_reason text,
  _confirm_validated boolean DEFAULT false
)
RETURNS public.product_parametric_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_old public.product_parametric_rules;
  v_new public.product_parametric_rules;
  v_rule_key text;
  v_version integer;
  v_validated boolean := COALESCE((_rule->>'is_validated')::boolean, false);
  v_requested_active boolean := COALESCE((_rule->>'is_active')::boolean, true);
BEGIN
  IF v_uid IS NULL OR NOT public.is_saas_admin(v_uid) THEN
    RAISE EXCEPTION 'saas_admin_required';
  END IF;
  IF NULLIF(btrim(_change_reason), '') IS NULL THEN
    RAISE EXCEPTION 'change_reason_required';
  END IF;
  IF v_validated AND NOT _confirm_validated THEN
    RAISE EXCEPTION 'validated_confirmation_required';
  END IF;
  IF v_validated AND NULLIF(btrim(_rule->>'validation_source'), '') IS NULL THEN
    RAISE EXCEPTION 'validation_source_required';
  END IF;

  -- The template lock serializes both new rules and new versions, including
  -- the source-less creation path.
  PERFORM 1
  FROM public.product_templates
  WHERE id = _product_template_id
    AND company_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'global_product_template_not_found'; END IF;

  IF _source_rule_id IS NOT NULL THEN
    SELECT * INTO v_old
    FROM public.product_parametric_rules
    WHERE id = _source_rule_id AND product_template_id = _product_template_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'source_rule_not_found'; END IF;
    v_rule_key := v_old.rule_key;
  ELSE
    v_rule_key := NULLIF(btrim(_rule->>'rule_key'), '');
    IF v_rule_key IS NULL THEN RAISE EXCEPTION 'rule_key_required'; END IF;
  END IF;

  SELECT COALESCE(max(version), 0) + 1 INTO v_version
  FROM public.product_parametric_rules
  WHERE product_template_id = _product_template_id AND rule_key = v_rule_key;

  IF v_requested_active THEN
    UPDATE public.product_parametric_rules
    SET is_active = false,
        change_reason = btrim(_change_reason),
        updated_at = now()
    WHERE product_template_id = _product_template_id
      AND rule_key = v_rule_key
      AND is_active;
  END IF;

  INSERT INTO public.product_parametric_rules (
    product_template_id, rule_key, material_type, item_template_id, group_name,
    formula, width_formula, height_formula, quantity_formula, pieces_formula,
    pieces_quantity, condition_expression, unit, cut_orientation, cut_angle,
    side, calculation_type, applies_to, loss_percent, sort_order, version,
    is_active, is_validated, validation_source, created_by, change_reason,
    supersedes_rule_id
  ) VALUES (
    _product_template_id,
    v_rule_key,
    COALESCE(_rule->>'material_type', v_old.material_type),
    COALESCE((_rule->>'item_template_id')::uuid, v_old.item_template_id),
    COALESCE(_rule->>'group_name', v_old.group_name, 'Geral'),
    CASE WHEN _rule ? 'formula' THEN NULLIF(_rule->>'formula', '') ELSE v_old.formula END,
    CASE WHEN _rule ? 'width_formula' THEN NULLIF(_rule->>'width_formula', '') ELSE v_old.width_formula END,
    CASE WHEN _rule ? 'height_formula' THEN NULLIF(_rule->>'height_formula', '') ELSE v_old.height_formula END,
    CASE WHEN _rule ? 'quantity_formula' THEN NULLIF(_rule->>'quantity_formula', '') ELSE COALESCE(v_old.quantity_formula, '1') END,
    CASE WHEN _rule ? 'pieces_formula' THEN NULLIF(_rule->>'pieces_formula', '') ELSE v_old.pieces_formula END,
    COALESCE((_rule->>'pieces_quantity')::integer, v_old.pieces_quantity, 1),
    CASE WHEN _rule ? 'condition_expression' THEN NULLIF(_rule->>'condition_expression', '') ELSE v_old.condition_expression END,
    COALESCE(_rule->>'unit', v_old.unit, 'un'),
    CASE WHEN _rule ? 'cut_orientation' THEN NULLIF(_rule->>'cut_orientation', '') ELSE v_old.cut_orientation END,
    CASE WHEN _rule ? 'cut_angle' THEN NULLIF(_rule->>'cut_angle', '') ELSE v_old.cut_angle END,
    COALESCE(_rule->>'side', v_old.side, 'A'),
    COALESCE(_rule->>'calculation_type', v_old.calculation_type, 'formula'),
    COALESCE(_rule->>'applies_to', v_old.applies_to, 'side'),
    COALESCE((_rule->>'loss_percent')::numeric, v_old.loss_percent, 0),
    COALESCE((_rule->>'sort_order')::integer, v_old.sort_order, 0),
    v_version,
    v_requested_active,
    v_validated,
    CASE WHEN _rule ? 'validation_source' THEN NULLIF(_rule->>'validation_source', '') ELSE v_old.validation_source END,
    v_uid,
    btrim(_change_reason),
    v_old.id
  ) RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_product_parametric_rule_active(
  _rule_id uuid,
  _is_active boolean,
  _change_reason text
)
RETURNS public.product_parametric_rules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_rule public.product_parametric_rules;
BEGIN
  IF v_uid IS NULL OR NOT public.is_saas_admin(v_uid) THEN
    RAISE EXCEPTION 'saas_admin_required';
  END IF;
  IF NULLIF(btrim(_change_reason), '') IS NULL THEN
    RAISE EXCEPTION 'change_reason_required';
  END IF;

  SELECT * INTO v_rule
  FROM public.product_parametric_rules
  WHERE id = _rule_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'parametric_rule_not_found'; END IF;

  PERFORM 1
  FROM public.product_templates
  WHERE id = v_rule.product_template_id
    AND company_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'global_product_template_not_found'; END IF;

  IF _is_active THEN
    UPDATE public.product_parametric_rules
    SET is_active = false,
        change_reason = btrim(_change_reason),
        updated_at = now()
    WHERE product_template_id = v_rule.product_template_id
      AND rule_key = v_rule.rule_key
      AND is_active
      AND id <> v_rule.id;
  END IF;

  UPDATE public.product_parametric_rules
  SET is_active = _is_active,
      change_reason = btrim(_change_reason),
      updated_at = now()
  WHERE id = v_rule.id
  RETURNING * INTO v_rule;

  RETURN v_rule;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_audit_product_parametric_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_row public.product_parametric_rules;
  v_action text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_action := CASE
    WHEN TG_OP = 'INSERT' AND NEW.supersedes_rule_id IS NOT NULL THEN 'PARAMETRIC_RULE_VERSION_CREATED'
    WHEN TG_OP = 'INSERT' THEN 'PARAMETRIC_RULE_CREATED'
    WHEN TG_OP = 'DELETE' THEN 'PARAMETRIC_RULE_DELETED'
    WHEN OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active THEN 'PARAMETRIC_RULE_ACTIVATED'
    WHEN OLD.is_active IS DISTINCT FROM NEW.is_active THEN 'PARAMETRIC_RULE_DEACTIVATED'
    ELSE 'PARAMETRIC_RULE_UPDATED'
  END;

  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, new_data, metadata
  ) VALUES (
    v_uid, v_action, 'product_parametric_rules', v_row.id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_build_object(
      'reason', v_row.change_reason,
      'rule_key', v_row.rule_key,
      'version', v_row.version,
      'product_template_id', v_row.product_template_id
    )
  );
  RETURN v_row;
END;
$$;

DROP TRIGGER IF EXISTS audit_product_parametric_rule ON public.product_parametric_rules;
CREATE TRIGGER audit_product_parametric_rule
AFTER INSERT OR UPDATE OR DELETE ON public.product_parametric_rules
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_product_parametric_rule();

CREATE OR REPLACE FUNCTION public.trg_audit_product_variant_definition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_row public.product_variant_definitions;
BEGIN
  IF TG_OP <> 'DELETE' AND v_uid IS NOT NULL THEN
    IF NOT public.is_saas_admin(v_uid) THEN
      RAISE EXCEPTION 'saas_admin_required';
    END IF;
    IF NULLIF(btrim(NEW.change_reason), '') IS NULL THEN
      RAISE EXCEPTION 'change_reason_required';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, v_uid);
    NEW.updated_by := v_uid;
    v_row := NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.updated_by := v_uid;
    v_row := NEW;
  ELSE
    v_row := OLD;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, new_data, metadata
  ) VALUES (
    v_uid, 'PARAMETRIC_VARIANT_' || TG_OP,
    'product_variant_definitions', v_row.id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_build_object(
      'reason', v_row.change_reason,
      'variant_key', v_row.variant_key,
      'product_template_id', v_row.product_template_id
    )
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_product_variant_definition ON public.product_variant_definitions;
CREATE TRIGGER audit_product_variant_definition
BEFORE INSERT OR UPDATE OR DELETE ON public.product_variant_definitions
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_product_variant_definition();

CREATE OR REPLACE FUNCTION public.trg_audit_company_parametric_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_row public.company_parametric_rule_overrides;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := OLD; ELSE v_row := NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, v_uid);
    NEW.updated_by := v_uid;
    v_row := NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.updated_by := v_uid;
    v_row := NEW;
  END IF;

  INSERT INTO public.audit_logs (
    user_id, company_id, action, table_name, record_id, old_data, new_data, metadata
  ) VALUES (
    v_uid, v_row.company_id, 'PARAMETRIC_OVERRIDE_' || TG_OP,
    'company_parametric_rule_overrides', v_row.id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_build_object('rule_id', v_row.rule_id, 'reason', v_row.change_reason)
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_company_parametric_override ON public.company_parametric_rule_overrides;
CREATE TRIGGER audit_company_parametric_override
BEFORE INSERT OR UPDATE OR DELETE ON public.company_parametric_rule_overrides
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_company_parametric_override();

CREATE OR REPLACE FUNCTION public.list_effective_product_templates(_company_id uuid)
RETURNS SETOF public.product_templates
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR (
       NOT public.is_saas_admin((SELECT auth.uid()))
       AND NOT public.user_belongs_to_company((SELECT auth.uid()), _company_id)
     ) THEN
    RAISE EXCEPTION 'company_access_denied';
  END IF;
  RETURN QUERY
  SELECT pt.* FROM public.product_templates pt
  WHERE pt.publication_status = 'active'
    AND (
      pt.company_id = _company_id
      OR (
        pt.company_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.product_templates c
          WHERE c.company_id = _company_id
            AND c.parent_template_id = pt.id
            AND c.publication_status = 'active'
        )
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_parametric_rule_version(uuid,uuid,jsonb,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_parametric_rule_version(uuid,uuid,jsonb,text,boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_product_parametric_rule_active(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_product_parametric_rule_active(uuid,boolean,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.list_effective_product_templates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_effective_product_templates(uuid) TO authenticated, service_role;

-- Explicit Data API grants; RLS remains the authorization boundary.
REVOKE ALL ON public.product_parametric_rules FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.product_parametric_rules FROM authenticated;
GRANT SELECT ON public.product_parametric_rules TO authenticated;

REVOKE ALL ON public.product_variant_definitions FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.product_variant_definitions FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.product_variant_definitions TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.product_templates FROM anon;
GRANT SELECT ON public.product_templates TO authenticated;

-- The single proof template is a global catalog change. No company, price,
-- stock or other operational fixture is created by this migration.
UPDATE public.product_templates
SET publication_status = 'active', is_active = true, updated_at = now()
WHERE id = 'f2ab3821-d19a-4bc1-809c-c6bb607814e5'::uuid;
