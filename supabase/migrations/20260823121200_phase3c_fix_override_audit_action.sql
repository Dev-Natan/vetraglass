-- Keep audit_logs.action inside its canonical constraint while retaining the
-- domain event in metadata.
CREATE OR REPLACE FUNCTION public.trg_audit_company_parametric_override()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_row public.company_parametric_rule_overrides;
  v_action text := CASE TG_OP
    WHEN 'INSERT' THEN 'create'
    WHEN 'UPDATE' THEN 'update'
    WHEN 'DELETE' THEN 'delete'
  END;
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
    v_uid, v_row.company_id, v_action,
    'company_parametric_rule_overrides', v_row.id,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    jsonb_build_object(
      'event', 'PARAMETRIC_OVERRIDE_' || TG_OP,
      'rule_id', v_row.rule_id,
      'reason', v_row.change_reason
    )
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_audit_company_parametric_override() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_audit_company_parametric_override() TO service_role;
