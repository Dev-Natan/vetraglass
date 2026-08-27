-- Phase 4B.1: audit SaaS-owned inventory structure changes.
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
      auth.uid(), lower(TG_OP), TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
      CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
      CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
      jsonb_build_object('source','phase4b1_inventory_structure')
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.phase4b1_audit_inventory_structure() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_phase4b1_audit_item_structure ON public.item_templates;
CREATE TRIGGER trg_phase4b1_audit_item_structure
AFTER INSERT OR DELETE OR UPDATE OF
  category_id, line_id, bar_length_mm, weight_per_meter, weight_per_bar, unit, is_active
ON public.item_templates
FOR EACH ROW EXECUTE FUNCTION public.phase4b1_audit_inventory_structure();

DROP TRIGGER IF EXISTS trg_phase4b1_audit_inventory_units ON public.inventory_item_units;
CREATE TRIGGER trg_phase4b1_audit_inventory_units
AFTER INSERT OR DELETE OR UPDATE OF
  purchase_unit, stock_unit, consumption_unit, sale_unit, canonical_unit,
  purchase_to_canonical_factor, consumption_to_canonical_factor,
  nominal_length_mm, cost_policy, legacy_status
ON public.inventory_item_units
FOR EACH ROW EXECUTE FUNCTION public.phase4b1_audit_inventory_structure();
