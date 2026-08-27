-- Phase 4B.1: map PostgreSQL INSERT to the canonical audit action CREATE.
CREATE OR REPLACE FUNCTION public.phase4b1_audit_inventory_structure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.audit_logs(
      user_id, action, table_name, record_id, old_data, new_data, metadata
    ) VALUES (
      auth.uid(),
      CASE TG_OP WHEN 'INSERT' THEN 'create' ELSE lower(TG_OP) END,
      TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
      CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
      jsonb_build_object('source','phase4b1_inventory_structure')
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.phase4b1_audit_inventory_structure() FROM PUBLIC, anon, authenticated;
