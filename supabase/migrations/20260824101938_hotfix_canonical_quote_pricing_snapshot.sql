-- P0: quote persistence must validate Phase 3E snapshots with the same canonical
-- resolver used by Meus Precos and AddProductPanel. Legacy snapshots retain the
-- established Phase 3C behavior for backwards compatibility.

CREATE OR REPLACE FUNCTION public.trg_freeze_quote_item_composition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_mode text := 'fixed';
  v_fulfillment text := 'IMMEDIATE';
  v_template_id uuid;
  v_company_id uuid;
  v_quote_status text;
  v_company_item record;
  v_price record;
  v_supplied jsonb;
  v_expected jsonb;
  v_bad_material text;
BEGIN
  SELECT q.company_id, q.status INTO v_company_id, v_quote_status
  FROM public.quotes q WHERE q.id = NEW.quote_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'QUOTE_NOT_FOUND';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.composition_snapshot IS DISTINCT FROM OLD.composition_snapshot
     AND v_quote_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'APPROVED_QUOTE_IS_IMMUTABLE';
  END IF;

  v_template_id := NEW.product_template_id;
  IF v_template_id IS NULL AND NEW.company_product_id IS NOT NULL THEN
    SELECT cp.product_template_id INTO v_template_id
    FROM public.company_products cp
    WHERE cp.id = NEW.company_product_id AND cp.company_id = v_company_id;
  END IF;

  IF v_template_id IS NOT NULL THEN
    SELECT pt.composition_mode, pt.fulfillment_mode INTO v_mode, v_fulfillment
    FROM public.product_templates pt WHERE pt.id = v_template_id AND pt.is_active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'INVALID_ENGINEERING_RULE';
    END IF;
    NEW.product_template_id := v_template_id;
    NEW.composition_mode := v_mode;
    NEW.fulfillment_mode := v_fulfillment;

    v_supplied := NEW.composition_snapshot;
    IF NEW.company_product_id IS NOT NULL
       AND jsonb_typeof(v_supplied) = 'object'
       AND COALESCE((v_supplied->>'snapshot_version')::integer, 0) >= 3 THEN
      IF COALESCE(NEW.width, 0) <= 0 OR COALESCE(NEW.height, 0) <= 0
         OR COALESCE(NEW.quantity, 0) <= 0 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_SNAPSHOT',
          DETAIL = 'invalid_dimensions_or_quantity';
      END IF;

      v_expected := public.resolve_company_product_pricing(
        v_company_id, NEW.company_product_id, NEW.width, NEW.height, NEW.quantity,
        COALESCE(v_supplied->'variants', '{}'::jsonb)
      );

      IF NULLIF(v_supplied->>'company_id', '')::uuid IS DISTINCT FROM v_company_id
         OR NULLIF(v_supplied->>'company_product_id', '')::uuid IS DISTINCT FROM NEW.company_product_id
         OR NULLIF(v_supplied->>'product_template_id', '')::uuid IS DISTINCT FROM v_template_id THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_SNAPSHOT',
          DETAIL = 'identity_mismatch';
      END IF;
      IF round(COALESCE((v_supplied#>>'{inputs,width_mm}')::numeric, -1), 3)
           <> round(NEW.width, 3)
         OR round(COALESCE((v_supplied#>>'{inputs,height_mm}')::numeric, -1), 3)
           <> round(NEW.height, 3)
         OR COALESCE((v_supplied#>>'{inputs,quantity}')::integer, -1) <> NEW.quantity THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_SNAPSHOT',
          DETAIL = 'inputs_mismatch';
      END IF;
      IF COALESCE(v_supplied->'variants', '{}'::jsonb)
           IS DISTINCT FROM COALESCE(v_expected->'variants', '{}'::jsonb) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_SNAPSHOT',
          DETAIL = 'variants_mismatch';
      END IF;
      IF abs(COALESCE((v_supplied#>>'{totals,cost}')::numeric, -1)
             - COALESCE((v_expected#>>'{totals,cost}')::numeric, -2)) > 0.01
         OR abs(COALESCE((v_supplied#>>'{totals,sale_price}')::numeric, -1)
             - COALESCE((v_expected#>>'{totals,sale_price}')::numeric, -2)) > 0.01
         OR abs(COALESCE((v_supplied#>>'{totals,profit}')::numeric, -1)
             - COALESCE((v_expected#>>'{totals,profit}')::numeric, -2)) > 0.01
         OR abs(COALESCE((v_supplied#>>'{totals,margin_percent}')::numeric, -1)
             - COALESCE((v_expected#>>'{totals,margin_percent}')::numeric, -2)) > 0.01 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_SNAPSHOT',
          DETAIL = 'totals_mismatch';
      END IF;
      IF jsonb_typeof(v_supplied->'materials') <> 'array'
         OR jsonb_array_length(v_supplied->'materials')
              <> jsonb_array_length(v_expected->'materials') THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_SNAPSHOT',
          DETAIL = 'materials_count_mismatch';
      END IF;

      SELECT expected->>'item_name' INTO v_bad_material
      FROM jsonb_array_elements(v_expected->'materials') expected
      LEFT JOIN LATERAL (
        SELECT supplied
        FROM jsonb_array_elements(v_supplied->'materials') supplied
        WHERE supplied->>'key' = expected->>'key'
        LIMIT 1
      ) matched ON true
      WHERE matched.supplied IS NULL
         OR NULLIF(matched.supplied->>'item_template_id', '')::uuid
              IS DISTINCT FROM NULLIF(expected->>'item_template_id', '')::uuid
         OR NULLIF(matched.supplied->>'company_item_id', '')::uuid
              IS DISTINCT FROM NULLIF(expected->>'company_item_id', '')::uuid
         OR NULLIF(matched.supplied->>'variant_id', '')::uuid
              IS DISTINCT FROM NULLIF(expected->>'variant_id', '')::uuid
         OR abs(COALESCE((matched.supplied->>'quantity')::numeric, -1)
              - COALESCE((expected->>'quantity')::numeric, -2)) > 0.000001
         OR abs(COALESCE((matched.supplied->>'unit_cost')::numeric, -1)
              - COALESCE((expected->>'unit_cost')::numeric, -2)) > 0.0001
         OR abs(COALESCE((matched.supplied->>'unit_sale_price')::numeric, -1)
              - COALESCE((expected->>'unit_sale_price')::numeric, -2)) > 0.0001
         OR abs(COALESCE((matched.supplied->>'cost')::numeric, -1)
              - COALESCE((expected->>'cost')::numeric, -2)) > 0.01
         OR abs(COALESCE((matched.supplied->>'sale_price')::numeric, -1)
              - COALESCE((expected->>'sale_price')::numeric, -2)) > 0.01
      LIMIT 1;
      IF v_bad_material IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_PRICING_SNAPSHOT',
          DETAIL = 'material_mismatch: ' || v_bad_material;
      END IF;

      -- Freeze server-validated canonical fields. Technical metadata may remain in
      -- the submitted snapshot, but identities, variants, materials and totals are
      -- replaced with the resolver output so client numbers are never authoritative.
      NEW.composition_snapshot := v_supplied
        || jsonb_build_object(
          'company_id', v_expected->'company_id',
          'company_product_id', v_expected->'company_product_id',
          'product_template_id', v_expected->'product_template_id',
          'pricing_mode', v_expected->'pricing_mode',
          'variants', v_expected->'variants',
          'materials', v_expected->'materials',
          'totals', v_expected->'totals',
          'warnings', v_expected->'warnings',
          'fulfillment_mode', v_fulfillment,
          'validated_at', now()
        );
    ELSIF v_mode = 'parametric' THEN
      NEW.composition_snapshot := COALESCE(NEW.composition_snapshot, '{}'::jsonb)
        || jsonb_build_object('fulfillment_mode', v_fulfillment);
      PERFORM public.phase3c_validate_engineering_snapshot(NEW.composition_snapshot, v_fulfillment);
      IF round(COALESCE((NEW.composition_snapshot#>>'{inputs,width_mm}')::numeric, -1), 3)
           <> round(COALESCE(NEW.width, -1), 3)
         OR round(COALESCE((NEW.composition_snapshot#>>'{inputs,height_mm}')::numeric, -1), 3)
           <> round(COALESCE(NEW.height, -1), 3)
         OR COALESCE((NEW.composition_snapshot#>>'{inputs,quantity}')::integer, -1)
           <> COALESCE(NEW.quantity, -1) THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SNAPSHOT_INPUTS_MISMATCH';
      END IF;
    ELSE
      NEW.composition_snapshot := public.phase3c_build_fixed_snapshot(
        v_template_id, v_company_id, NEW.width, NEW.height, NEW.quantity,
        NEW.opening_width, NEW.opening_height
      );
    END IF;
  ELSIF NEW.company_item_id IS NOT NULL THEN
    SELECT ci.* INTO v_company_item
    FROM public.company_items ci
    WHERE ci.id = NEW.company_item_id AND ci.company_id = v_company_id AND ci.is_active = true;
    IF v_company_item.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'MISSING_COMPANY_ITEM';
    END IF;
    SELECT cip.* INTO v_price
    FROM public.company_item_prices cip
    WHERE cip.company_id = v_company_id AND cip.item_template_id = v_company_item.item_template_id;
    IF v_price.id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'MISSING_PRICE',
        DETAIL = v_company_item.name || ' | company_item=' || v_company_item.id::text;
    END IF;
    NEW.composition_mode := 'fixed';
    NEW.fulfillment_mode := CASE WHEN v_company_item.type = 'service' THEN 'SERVICE' ELSE 'IMMEDIATE' END;
    NEW.composition_snapshot := jsonb_build_object(
      'composition_mode', 'fixed', 'fulfillment_mode', NEW.fulfillment_mode,
      'engine_version', 2, 'snapshot_version', 2,
      'inputs', jsonb_build_object(
        'VW', COALESCE(NEW.opening_width, NEW.width), 'VH', COALESCE(NEW.opening_height, NEW.height),
        'L', NEW.width, 'A', NEW.height, 'width_mm', NEW.width, 'height_mm', NEW.height,
        'quantity', NEW.quantity, 'variants', '{}'::jsonb
      ),
      'variants', '{}'::jsonb,
      'materials', CASE WHEN NEW.fulfillment_mode = 'SERVICE' THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
        'key', NEW.company_item_id, 'item_template_id', v_company_item.item_template_id,
        'company_item_id', v_company_item.id, 'item_name', v_company_item.name,
        'material_type', v_company_item.type, 'unit', v_company_item.unit,
        'quantity', NEW.quantity, 'cost', NEW.quantity * COALESCE(v_price.cost, 0),
        'sale_price', NEW.quantity * v_price.price, 'supply_mode', 'INTERNAL_STOCK'
      )) END,
      'glass_pieces', '[]'::jsonb, 'cuts', '[]'::jsonb, 'rules', '[]'::jsonb,
      'rule_versions', '[]'::jsonb, 'items', '[]'::jsonb,
      'totals', jsonb_build_object('cost', NEW.quantity * COALESCE(v_price.cost, 0),
        'sale_price', NEW.quantity * v_price.price, 'margin', NEW.quantity * (v_price.price - COALESCE(v_price.cost, 0)),
        'missing_cost_items', 0, 'missing_price_items', 0),
      'warnings', '[]'::jsonb, 'frozen_at', now()
    );
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'SNAPSHOT_MISSING';
  END IF;

  PERFORM public.phase3c_validate_engineering_snapshot(NEW.composition_snapshot, NEW.fulfillment_mode);
  NEW.snapshot_version := COALESCE((NEW.composition_snapshot->>'snapshot_version')::integer, 2);
  NEW.parametric_snapshot_version := CASE WHEN NEW.composition_mode = 'parametric' THEN NEW.snapshot_version ELSE NULL END;
  RETURN NEW;
END;
$$;

-- P1: browser clients remain unable to insert arbitrary audit rows. Authenticated
-- security events go through this narrow API, which derives user_id and validates
-- company membership before writing with definer privileges.
CREATE OR REPLACE FUNCTION public.log_authenticated_security_event(
  _event text,
  _company_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_log_id uuid;
  v_action text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'AUTHENTICATION_REQUIRED';
  END IF;
  IF _event NOT IN (
    'session_restored', 'session_timeout', 'manual_logout', 'cross_tab_logout',
    'login_success', 'password_changed'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVALID_AUDIT_EVENT';
  END IF;
  IF _company_id IS NOT NULL
     AND NOT public.user_belongs_to_company(v_user_id, _company_id)
     AND NOT public.is_saas_admin(v_user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'FORBIDDEN_COMPANY_SCOPE';
  END IF;
  v_action := CASE
    WHEN _event IN ('session_restored', 'login_success') THEN 'login'
    WHEN _event IN ('session_timeout', 'manual_logout', 'cross_tab_logout') THEN 'logout'
    ELSE 'update'
  END;
  INSERT INTO public.audit_logs(
    company_id, user_id, action, table_name, metadata, user_agent
  ) VALUES (
    _company_id, v_user_id, v_action, 'auth_security',
    COALESCE(_metadata, '{}'::jsonb) || jsonb_build_object('event', _event),
    NULLIF(_metadata->>'user_agent', '')
  ) RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_authenticated_security_event(text, uuid, jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_authenticated_security_event(text, uuid, jsonb)
  TO authenticated;

COMMENT ON FUNCTION public.log_authenticated_security_event(text, uuid, jsonb)
IS 'Writes a constrained authenticated security audit event; user_id is always auth.uid().';

NOTIFY pgrst, 'reload schema';
