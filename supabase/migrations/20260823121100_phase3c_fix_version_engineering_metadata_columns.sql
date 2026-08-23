-- Correct the metadata column mapping introduced by the preceding migration.
-- This is intentionally a new migration because remote history is immutable.
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
  v_technical_status text := CASE
    WHEN COALESCE((_rule->>'is_validated')::boolean, false) THEN 'VALIDATED'
    ELSE COALESCE(NULLIF(_rule->>'technical_status', ''), 'ESTIMATED')
  END;
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
  IF v_technical_status NOT IN ('ESTIMATED', 'VALIDATED', 'REJECTED') THEN
    RAISE EXCEPTION 'technical_status_invalid';
  END IF;

  PERFORM 1 FROM public.product_templates
  WHERE id = _product_template_id AND company_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'global_product_template_not_found'; END IF;

  IF _source_rule_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.product_parametric_rules
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
    SET is_active = false, change_reason = btrim(_change_reason), updated_at = now()
    WHERE product_template_id = _product_template_id
      AND rule_key = v_rule_key AND is_active;
  END IF;

  INSERT INTO public.product_parametric_rules (
    product_template_id, rule_key, material_type, item_template_id, group_name,
    formula, width_formula, height_formula, quantity_formula, pieces_formula,
    pieces_quantity, condition_expression, unit, cut_orientation, cut_angle,
    side, calculation_type, applies_to, loss_percent, sort_order, version,
    is_active, is_validated, validation_source, created_by, change_reason,
    supersedes_rule_id, component_role, technical_status, source_type,
    source_name, source_page, source_reference, notes, piece_width_formula,
    piece_height_formula, supply_mode
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
    v_old.id,
    CASE WHEN _rule ? 'component_role' THEN NULLIF(_rule->>'component_role', '') ELSE v_old.component_role END,
    v_technical_status,
    CASE WHEN _rule ? 'source_type' THEN NULLIF(_rule->>'source_type', '') ELSE v_old.source_type END,
    CASE WHEN _rule ? 'source_name' THEN NULLIF(_rule->>'source_name', '') ELSE v_old.source_name END,
    CASE WHEN _rule ? 'source_page' THEN NULLIF(_rule->>'source_page', '') ELSE v_old.source_page END,
    CASE WHEN _rule ? 'source_reference' THEN NULLIF(_rule->>'source_reference', '') ELSE v_old.source_reference END,
    CASE WHEN _rule ? 'notes' THEN NULLIF(_rule->>'notes', '') ELSE v_old.notes END,
    CASE WHEN _rule ? 'piece_width_formula' THEN NULLIF(_rule->>'piece_width_formula', '') ELSE v_old.piece_width_formula END,
    CASE WHEN _rule ? 'piece_height_formula' THEN NULLIF(_rule->>'piece_height_formula', '') ELSE v_old.piece_height_formula END,
    CASE WHEN _rule ? 'supply_mode' THEN NULLIF(_rule->>'supply_mode', '') ELSE v_old.supply_mode END
  ) RETURNING * INTO v_new;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.create_product_parametric_rule_version(uuid,uuid,jsonb,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product_parametric_rule_version(uuid,uuid,jsonb,text,boolean) TO authenticated, service_role;
