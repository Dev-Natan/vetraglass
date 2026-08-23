-- Phase 3B corrective: keep the established audit_logs action contract
-- (create/update/delete) and store the detailed engineering event in metadata.

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
  v_event text;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  v_action := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    ELSE 'delete'
  END;
  v_event := CASE
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
      'event', v_event,
      'reason', v_row.change_reason,
      'rule_key', v_row.rule_key,
      'version', v_row.version,
      'product_template_id', v_row.product_template_id
    )
  );
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_audit_product_variant_definition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_row public.product_variant_definitions;
  v_action text;
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
    v_action := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.created_by := OLD.created_by;
    NEW.updated_by := v_uid;
    v_row := NEW;
    v_action := 'update';
  ELSE
    v_row := OLD;
    v_action := 'delete';
  END IF;

  INSERT INTO public.audit_logs (
    user_id, action, table_name, record_id, old_data, new_data, metadata
  ) VALUES (
    v_uid, v_action, 'product_variant_definitions', v_row.id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_build_object(
      'event', 'PARAMETRIC_VARIANT_' || TG_OP,
      'reason', v_row.change_reason,
      'variant_key', v_row.variant_key,
      'product_template_id', v_row.product_template_id
    )
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_audit_product_parametric_rule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_audit_product_variant_definition() FROM PUBLIC, anon, authenticated;
