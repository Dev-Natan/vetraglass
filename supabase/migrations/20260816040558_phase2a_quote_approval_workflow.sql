-- Phase 2A: make quote approval and cancellation complete, transactional,
-- idempotent and company-scoped. Historical migrations remain untouched.

-- Credit/installment sales do not necessarily touch a cash register at approval.
-- Cash movements remain mandatory only when money is actually received.
ALTER TABLE public.sales ALTER COLUMN cash_register_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.phase2a_eval_formula(
  p_formula text,
  p_width numeric,
  p_height numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_expression text;
  v_result numeric;
BEGIN
  IF p_formula IS NULL OR btrim(p_formula) = '' THEN
    RETURN 0;
  END IF;

  v_expression := replace(p_formula, ',', '.');
  v_expression := regexp_replace(v_expression, 'Largura', '(' || COALESCE(p_width, 0)::text || ')', 'gi');
  v_expression := regexp_replace(v_expression, 'Altura', '(' || COALESCE(p_height, 0)::text || ')', 'gi');
  v_expression := regexp_replace(v_expression, '\mL\M', '(' || COALESCE(p_width, 0)::text || ')', 'gi');
  v_expression := regexp_replace(v_expression, '\mA\M', '(' || COALESCE(p_height, 0)::text || ')', 'gi');

  -- Only arithmetic remains before dynamic evaluation. Catalog text can never
  -- introduce identifiers, functions, casts, quotes or SQL delimiters.
  IF v_expression !~ '^[0-9+*/().[:space:]-]+$' THEN
    RAISE EXCEPTION 'unsupported_material_formula: %', p_formula;
  END IF;

  EXECUTE 'SELECT (' || v_expression || ')::numeric' INTO v_result;
  IF v_result IS NULL OR v_result < 0 THEN
    RAISE EXCEPTION 'invalid_material_formula_result: %', p_formula;
  END IF;
  RETURN v_result;
EXCEPTION
  WHEN division_by_zero THEN
    RAISE EXCEPTION 'material_formula_division_by_zero: %', p_formula;
END;
$$;

REVOKE ALL ON FUNCTION public.phase2a_eval_formula(text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.phase2a_eval_formula(text, numeric, numeric) TO authenticated, service_role;

-- Preserve payment conditions on approval and validate their company scope.
CREATE OR REPLACE FUNCTION public.check_quote_approval_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_forma_tipo text;
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT fp.tipo
      INTO v_forma_tipo
      FROM public.formas_pagamento fp
     WHERE fp.id = NEW.forma_pagamento_id
       AND fp.company_id = NEW.company_id
       AND fp.is_active = true;

    IF v_forma_tipo IS NULL OR v_forma_tipo NOT IN ('avista', 'parcelado', 'misto') THEN
      RAISE EXCEPTION 'invalid_quote_payment_method';
    END IF;

    IF NEW.condicao_pagamento_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
        FROM public.condicoes_pagamento cp
       WHERE cp.id = NEW.condicao_pagamento_id
         AND cp.company_id = NEW.company_id
         AND cp.is_active = true
         AND (cp.forma_pagamento_id IS NULL OR cp.forma_pagamento_id = NEW.forma_pagamento_id)
    ) THEN
      RAISE EXCEPTION 'invalid_quote_payment_condition';
    END IF;

    IF v_forma_tipo = 'parcelado' AND NEW.condicao_pagamento_id IS NULL THEN
      RAISE EXCEPTION 'payment_condition_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_quote_approval_rules() FROM PUBLIC, anon, authenticated;

-- Replace the previous 11-argument overload so PostgREST has one unambiguous
-- contract after adding the selected payment condition.
DROP FUNCTION public.approve_quote_transactional(
  uuid, uuid, numeric, numeric, text, numeric, date, date, text, text, uuid
);

CREATE FUNCTION public.approve_quote_transactional(
  p_quote_id uuid,
  p_company_id uuid,
  p_total_amount numeric,
  p_entry_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT NULL,
  p_card_net_amount numeric DEFAULT NULL,
  p_balance_due_date date DEFAULT NULL,
  p_estimated_end date DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_notes text DEFAULT NULL,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_condicao_pagamento_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quote public.quotes%ROWTYPE;
  v_forma record;
  v_condicao record;
  v_expected_total numeric;
  v_items_total numeric;
  v_entry numeric := round(COALESCE(p_entry_amount, 0), 2);
  v_pending numeric;
  v_cash_amount numeric;
  v_cash_register_id uuid;
  v_open_cash_count integer;
  v_sale_id uuid;
  v_sale_number integer;
  v_sale_payment_method text;
  v_os_id uuid;
  v_os_number integer;
  v_deposit_id uuid;
  v_entry_receivable_id uuid;
  v_cash_movement_id uuid;
  v_first_balance_receivable_id uuid;
  v_installment_ids jsonb := '[]'::jsonb;
  v_installments integer := 1;
  v_days_between integer := 30;
  v_installment_amount numeric;
  v_allocated numeric := 0;
  v_current_amount numeric;
  v_due_date date;
  v_receivable_id uuid;
  v_qi record;
  v_snapshot jsonb;
  v_component jsonb;
  v_side text;
  v_sides text[];
  v_width numeric;
  v_height numeric;
  v_pieces numeric;
  v_formula_quantity numeric;
  v_cut_length numeric;
  v_total_length numeric;
  v_required numeric;
  v_item_template_id uuid;
  v_company_item_id uuid;
  v_component_template_id uuid;
  v_component_company_item_id uuid;
  v_item_name text;
  v_item_type text;
  v_item_unit text;
  v_bar_length numeric;
  v_bars_needed numeric;
  v_os_item_id uuid;
  v_material_count integer := 0;
  v_consumption_count integer := 0;
  v_reservation_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF p_company_id IS NULL OR NOT public.user_belongs_to_company(v_user_id, p_company_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_quote_id IS NULL THEN
    RAISE EXCEPTION 'quote_id_required';
  END IF;

  SELECT q.* INTO v_quote
    FROM public.quotes q
   WHERE q.id = p_quote_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF v_quote.company_id <> p_company_id THEN RAISE EXCEPTION 'quote_company_mismatch'; END IF;

  -- The quote row lock serializes double clicks and concurrent requests.
  SELECT os.id, os.os_number, os.sale_id
    INTO v_os_id, v_os_number, v_sale_id
    FROM public.ordens_servico os
   WHERE os.quote_id = p_quote_id AND os.status <> 'cancelled'
   ORDER BY os.created_at LIMIT 1;
  IF FOUND THEN
    SELECT qd.id, qd.cash_register_id, qd.cash_movement_id
      INTO v_deposit_id, v_cash_register_id, v_cash_movement_id
      FROM public.quote_deposits qd
     WHERE qd.quote_id = p_quote_id AND qd.status <> 'cancelled'
     ORDER BY qd.created_at LIMIT 1;
    SELECT ar.id INTO v_entry_receivable_id
      FROM public.accounts_receivable ar
     WHERE ar.quote_id = p_quote_id AND ar.installment_number = 0 AND ar.status <> 'cancelled'
     LIMIT 1;
    SELECT ar.id INTO v_first_balance_receivable_id
      FROM public.accounts_receivable ar
     WHERE ar.quote_id = p_quote_id AND ar.installment_number = 1 AND ar.status <> 'cancelled'
     LIMIT 1;
    RETURN jsonb_build_object(
      'success', true, 'idempotent_replay', true, 'quote_id', p_quote_id,
      'sale_id', v_sale_id, 'ordem_servico_id', v_os_id, 'os_number', v_os_number,
      'quote_deposit_id', v_deposit_id, 'entry_receivable_id', v_entry_receivable_id,
      'balance_receivable_id', v_first_balance_receivable_id,
      'cash_register_id', v_cash_register_id, 'cash_movement_id', v_cash_movement_id
    );
  END IF;

  IF v_quote.status <> 'pending' THEN RAISE EXCEPTION 'quote_not_approvable: %', v_quote.status; END IF;
  IF p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN RAISE EXCEPTION 'invalid_priority'; END IF;

  IF v_quote.client_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.clients c
     WHERE c.id = v_quote.client_id AND c.company_id = p_company_id AND c.is_active = true
  ) THEN
    RAISE EXCEPTION 'invalid_quote_client';
  END IF;
  IF v_quote.client_id IS NULL AND btrim(COALESCE(v_quote.customer_name, '')) = '' THEN
    RAISE EXCEPTION 'quote_customer_required';
  END IF;

  SELECT fp.id, fp.tipo, fp.nome INTO v_forma
    FROM public.formas_pagamento fp
   WHERE fp.id = p_forma_pagamento_id
     AND fp.company_id = p_company_id
     AND fp.is_active = true;
  IF NOT FOUND OR v_forma.tipo NOT IN ('avista', 'parcelado', 'misto') THEN
    RAISE EXCEPTION 'invalid_payment_option';
  END IF;

  IF p_condicao_pagamento_id IS NOT NULL THEN
    SELECT cp.* INTO v_condicao
      FROM public.condicoes_pagamento cp
     WHERE cp.id = p_condicao_pagamento_id
       AND cp.company_id = p_company_id
       AND cp.is_active = true
       AND (cp.forma_pagamento_id IS NULL OR cp.forma_pagamento_id = p_forma_pagamento_id);
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_payment_condition'; END IF;
    v_installments := GREATEST(v_condicao.parcelas, 1);
    v_days_between := GREATEST(v_condicao.dias_entre_parcelas, 0);
  ELSIF v_forma.tipo = 'parcelado' THEN
    RAISE EXCEPTION 'payment_condition_required';
  END IF;

  -- Current UI/business contract: quote discount is kept for cash payment and
  -- removed for installment/mixed payment. The server is authoritative.
  v_expected_total := round(CASE WHEN v_forma.tipo = 'avista'
    THEN v_quote.final_amount ELSE v_quote.total_amount END, 2);
  IF round(COALESCE(p_total_amount, 0), 2) <> v_expected_total OR v_expected_total <= 0 THEN
    RAISE EXCEPTION 'quote_total_mismatch';
  END IF;

  SELECT round(COALESCE(sum(qi.total_price), 0), 2), count(*)
    INTO v_items_total, v_material_count
    FROM public.quote_items qi WHERE qi.quote_id = p_quote_id;
  IF v_material_count = 0 THEN RAISE EXCEPTION 'quote_items_required'; END IF;
  IF v_items_total <> round(v_quote.total_amount, 2) THEN RAISE EXCEPTION 'quote_items_total_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.quote_items qi
     WHERE qi.quote_id = p_quote_id
       AND (qi.quantity <= 0 OR qi.unit_price < 0 OR qi.total_price < 0)
  ) THEN RAISE EXCEPTION 'invalid_quote_item_values'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.quote_items qi
    JOIN public.company_products cp ON cp.id = qi.company_product_id
     WHERE qi.quote_id = p_quote_id AND cp.company_id <> p_company_id
  ) OR EXISTS (
    SELECT 1 FROM public.quote_items qi
    JOIN public.company_items ci ON ci.id = qi.company_item_id
     WHERE qi.quote_id = p_quote_id AND ci.company_id <> p_company_id
  ) THEN RAISE EXCEPTION 'quote_item_company_mismatch'; END IF;

  IF v_entry < 0 OR v_entry > v_expected_total THEN RAISE EXCEPTION 'invalid_entry_amount'; END IF;
  v_pending := round(v_expected_total - v_entry, 2);
  IF v_pending > 0 AND p_balance_due_date IS NULL THEN RAISE EXCEPTION 'balance_due_date_required'; END IF;

  IF v_entry > 0 THEN
    IF p_payment_method NOT IN ('dinheiro', 'cartao', 'pix') THEN RAISE EXCEPTION 'invalid_entry_payment_method'; END IF;
    v_cash_amount := CASE WHEN p_payment_method = 'cartao'
      THEN round(COALESCE(p_card_net_amount, v_entry), 2) ELSE v_entry END;
    IF v_cash_amount <= 0 OR v_cash_amount > v_entry THEN RAISE EXCEPTION 'invalid_card_net_amount'; END IF;
    PERFORM cr.id
      FROM public.cash_registers cr
     WHERE cr.company_id = p_company_id AND cr.status = 'open'
       AND (cr.opened_by = v_user_id OR cr.operator_id = v_user_id)
     FOR UPDATE;
    SELECT count(*) INTO v_open_cash_count
      FROM public.cash_registers cr
     WHERE cr.company_id = p_company_id AND cr.status = 'open'
       AND (cr.opened_by = v_user_id OR cr.operator_id = v_user_id);
    SELECT cr.id INTO v_cash_register_id
      FROM public.cash_registers cr
     WHERE cr.company_id = p_company_id AND cr.status = 'open'
       AND (cr.opened_by = v_user_id OR cr.operator_id = v_user_id)
     ORDER BY cr.id LIMIT 1;
    IF v_open_cash_count = 0 THEN RAISE EXCEPTION 'open_cash_register_required'; END IF;
    IF v_open_cash_count > 1 THEN RAISE EXCEPTION 'multiple_open_cash_registers'; END IF;
  END IF;

  v_sale_payment_method := CASE
    WHEN v_forma.tipo = 'parcelado' THEN 'cartao'
    WHEN lower(v_forma.nome) LIKE '%dinheiro%' THEN 'dinheiro'
    WHEN lower(v_forma.nome) LIKE '%cart%' THEN 'cartao'
    ELSE 'pix'
  END;
  v_sale_number := public.get_next_document_number(p_company_id, 'SALE');
  INSERT INTO public.sales (
    company_id, cash_register_id, sale_number, client_id, customer_name,
    subtotal, discount_percent, discount_amount, total_amount,
    payment_method, payment_status, sale_type, payment_type,
    paid_amount, pending_amount, remaining_amount, installments_count,
    quote_id, sold_by, notes
  ) VALUES (
    p_company_id, v_cash_register_id, v_sale_number, v_quote.client_id, v_quote.customer_name,
    v_quote.total_amount,
    CASE WHEN v_forma.tipo = 'avista' THEN COALESCE(v_quote.discount_percent, 0) ELSE 0 END,
    CASE WHEN v_forma.tipo = 'avista' THEN COALESCE(v_quote.discount_amount, 0) ELSE 0 END,
    v_expected_total,
    v_sale_payment_method, CASE WHEN v_pending = 0 THEN 'paid' ELSE 'pending' END,
    'full', CASE WHEN v_pending = 0 THEN 'full' WHEN v_entry > 0 THEN 'partial' ELSE 'installment' END,
    v_entry, v_pending, v_pending, CASE WHEN v_pending > 0 THEN v_installments ELSE 0 END,
    p_quote_id, v_user_id, format('Aprovação do orçamento #%s', v_quote.quote_number)
  ) RETURNING id INTO v_sale_id;

  INSERT INTO public.sale_items (
    sale_id, item_template_id, company_product_id, item_name, item_unit,
    quantity, unit_price, total_price, notes, width, height
  )
  SELECT v_sale_id, ci.item_template_id, qi.company_product_id,
         qi.description, COALESCE(qi.unit, ci.unit, 'un'), qi.quantity,
         qi.unit_price, qi.total_price, qi.notes, qi.width, qi.height
    FROM public.quote_items qi
    LEFT JOIN public.company_items ci ON ci.id = qi.company_item_id
   WHERE qi.quote_id = p_quote_id
   ORDER BY qi.created_at, qi.id;

  v_os_number := public.get_next_document_number(p_company_id, 'OS');
  INSERT INTO public.ordens_servico (
    company_id, quote_id, sale_id, os_number, customer_name, customer_phone,
    customer_email, customer_address, status, priority, estimated_end,
    total_amount, paid_amount, pending_amount, notes, current_stage
  ) VALUES (
    p_company_id, p_quote_id, v_sale_id, v_os_number, v_quote.customer_name,
    v_quote.customer_phone, v_quote.customer_email, v_quote.customer_address,
    'pending', p_priority, p_estimated_end, v_expected_total, v_entry, v_pending,
    p_notes, 'Aguardando início'
  ) RETURNING id INTO v_os_id;

  UPDATE public.sales SET ordem_servico_id = v_os_id WHERE id = v_sale_id;

  INSERT INTO public.os_items (
    os_id, quote_item_id, product_name, product_id, quantity,
    width_sold, height_sold, width_production, height_production,
    width_sold_b, height_sold_b, width_production_b, height_production_b,
    largura_venda, altura_venda, largura_producao, altura_producao,
    largura_venda_b, altura_venda_b, largura_producao_b, altura_producao_b,
    largura_venda_c, altura_venda_c, largura_producao_c, altura_producao_c,
    technical_notes
  )
  SELECT v_os_id, qi.id, qi.description, qi.product_template_id, qi.quantity,
         COALESCE(qi.width, 0), COALESCE(qi.height, 0), COALESCE(qi.width, 0), COALESCE(qi.height, 0),
         qi.width_b, qi.height_b, qi.width_b, qi.height_b,
         COALESCE(qi.width, 0), COALESCE(qi.height, 0), COALESCE(qi.width, 0), COALESCE(qi.height, 0),
         qi.width_b, qi.height_b, qi.width_b, qi.height_b,
         qi.width_c, qi.height_c, qi.width_c, qi.height_c, qi.notes
    FROM public.quote_items qi
   WHERE qi.quote_id = p_quote_id
   ORDER BY qi.created_at, qi.id;

  v_material_count := 0;
  FOR v_qi IN
    SELECT qi.*, oi.id AS os_item_id
      FROM public.quote_items qi
      JOIN public.os_items oi ON oi.quote_item_id = qi.id AND oi.os_id = v_os_id
     WHERE qi.quote_id = p_quote_id
     ORDER BY qi.created_at, qi.id
  LOOP
    v_snapshot := v_qi.composition_snapshot;
    IF jsonb_typeof(v_snapshot) = 'string' THEN
      BEGIN
        v_snapshot := (v_snapshot #>> '{}')::jsonb;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'invalid_composition_snapshot: %', v_qi.id;
      END;
    END IF;
    IF v_qi.item_type = 'product'
       AND (v_snapshot IS NULL OR jsonb_typeof(v_snapshot) <> 'object') THEN
      RAISE EXCEPTION 'composition_snapshot_required: %', v_qi.id;
    END IF;

    FOR v_component IN
      SELECT value FROM jsonb_array_elements(COALESCE(v_snapshot->'items', '[]'::jsonb))
    LOOP
      IF COALESCE((v_component->>'is_optional')::boolean, false)
         AND COALESCE(v_qi.excluded_optional_ids, '[]'::jsonb) ? (v_component->>'id') THEN
        CONTINUE;
      END IF;

      v_component_company_item_id := NULLIF(v_component->>'company_item_id', '')::uuid;
      v_component_template_id := NULLIF(v_component->>'item_template_id', '')::uuid;
      v_company_item_id := NULL;
      v_item_template_id := v_component_template_id;
      v_item_name := NULL;
      v_item_type := NULL;
      v_item_unit := NULL;
      v_bar_length := NULL;
      SELECT ci.id, ci.item_template_id, ci.name, ci.type, ci.unit, ci.bar_length_mm
        INTO v_company_item_id, v_item_template_id, v_item_name, v_item_type, v_item_unit, v_bar_length
        FROM public.company_items ci
       WHERE ci.company_id = p_company_id AND ci.is_active = true
         AND (ci.id = v_component_company_item_id
              OR (v_component_company_item_id IS NULL AND ci.item_template_id = v_component_template_id))
       ORDER BY CASE WHEN ci.id = v_component_company_item_id THEN 0 ELSE 1 END LIMIT 1;
      IF NOT FOUND THEN
        v_item_template_id := v_component_template_id;
        SELECT it.name, it.type::text, it.unit, it.bar_length_mm
          INTO v_item_name, v_item_type, v_item_unit, v_bar_length
          FROM public.item_templates it WHERE it.id = v_item_template_id AND it.is_active = true;
      END IF;
      IF v_item_template_id IS NULL OR v_item_name IS NULL THEN
        RAISE EXCEPTION 'composition_item_unresolved: %', v_qi.id;
      END IF;

      v_sides := CASE
        WHEN lower(COALESCE(v_component->>'side', '')) IN ('ambos', 'both') THEN ARRAY['A','B']
        WHEN upper(COALESCE(v_component->>'side', 'A')) IN ('B','C') THEN ARRAY[upper(v_component->>'side')]
        ELSE ARRAY['A']
      END;
      FOREACH v_side IN ARRAY v_sides LOOP
        v_width := CASE v_side WHEN 'B' THEN COALESCE(v_qi.width_b, v_qi.width, 0)
                               WHEN 'C' THEN COALESCE(v_qi.width_c, v_qi.width, 0)
                               ELSE COALESCE(v_qi.width, 0) END;
        v_height := CASE v_side WHEN 'B' THEN COALESCE(v_qi.height_b, v_qi.height, 0)
                                WHEN 'C' THEN COALESCE(v_qi.height_c, v_qi.height, 0)
                                ELSE COALESCE(v_qi.height, 0) END;
        v_pieces := GREATEST(COALESCE((v_component->>'pieces_quantity')::numeric, 1), 1);
        IF btrim(COALESCE(v_component->>'pieces_formula', '')) <> '' THEN
          v_pieces := GREATEST(ceil(public.phase2a_eval_formula(v_component->>'pieces_formula', v_width, v_height)), 1);
        END IF;
        v_pieces := v_pieces * v_qi.quantity;
        v_formula_quantity := 1;
        IF btrim(COALESCE(v_component->>'quantity_formula', '')) <> ''
           AND btrim(v_component->>'quantity_formula') <> '1' THEN
          v_formula_quantity := public.phase2a_eval_formula(v_component->>'quantity_formula', v_width, v_height);
        END IF;
        v_pieces := v_pieces * GREATEST(v_formula_quantity, 0);

        v_cut_length := 0;
        IF btrim(COALESCE(v_component->>'width_formula', '')) <> '' THEN
          v_cut_length := public.phase2a_eval_formula(v_component->>'width_formula', v_width, v_height);
        ELSIF btrim(COALESCE(v_component->>'height_formula', '')) <> '' THEN
          v_cut_length := public.phase2a_eval_formula(v_component->>'height_formula', v_width, v_height);
        END IF;
        v_total_length := round(v_cut_length * v_pieces, 0);
        v_bars_needed := CASE WHEN v_item_type = 'profile' AND COALESCE(v_bar_length, 0) > 0
          THEN ceil(v_total_length / v_bar_length) ELSE NULL END;

        INSERT INTO public.os_materials (
          ordem_servico_id, os_item_id, item_template_id, item_name, item_type,
          cut_length_mm, pieces_count, total_length_mm, bar_length_mm, bars_needed,
          unit, notes, procurement_status
        ) VALUES (
          v_os_id, v_qi.os_item_id, v_item_template_id,
          v_item_name || CASE WHEN array_length(v_sides, 1) > 1 THEN ' (Lado ' || v_side || ')' ELSE '' END,
          CASE WHEN v_item_type IN ('profile','glass','accessory','service') THEN v_item_type ELSE 'accessory' END,
          round(v_cut_length)::integer, ceil(v_pieces)::integer, round(v_total_length)::integer,
          COALESCE(v_bar_length, 6000)::integer, v_bars_needed, COALESCE(v_item_unit, 'un'),
          'Snapshot do orçamento #' || v_quote.quote_number, 'pending_purchase'
        );
        v_material_count := v_material_count + 1;

        v_required := CASE
          WHEN v_item_type = 'profile' AND v_bars_needed IS NOT NULL THEN v_bars_needed
          WHEN lower(COALESCE(v_item_unit, 'un')) IN ('m','ml','metro','metros') THEN v_total_length / 1000
          WHEN lower(COALESCE(v_item_unit, 'un')) IN ('m2','m²') THEN (v_width * v_height * v_pieces) / 1000000
          ELSE v_pieces
        END;
        INSERT INTO public.material_consumption (
          company_id, ordem_servico_id, quote_item_id, os_item_id, company_item_id,
          item_template_id, item_name, item_type, unit, quantity_calculated,
          formula_used, input_width, input_height, input_quantity, status
        ) VALUES (
          p_company_id, v_os_id, v_qi.id, v_qi.os_item_id, v_company_item_id,
          v_item_template_id, v_item_name, v_item_type, COALESCE(v_item_unit, 'un'),
          round(v_required, 3), v_component->>'quantity_formula', v_width, v_height,
          v_qi.quantity, 'pending'
        );
        v_consumption_count := v_consumption_count + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  v_reservation_result := public.reserve_os_materials(v_os_id);
  UPDATE public.material_consumption mc
     SET stock_reservation_id = sr.id
    FROM public.stock_reservations sr
   WHERE mc.ordem_servico_id = v_os_id
     AND sr.ordem_servico_id = v_os_id
     AND sr.company_item_id = mc.company_item_id
     AND sr.status = 'reserved';

  IF v_entry > 0 THEN
    INSERT INTO public.quote_deposits (
      company_id, quote_id, ordem_servico_id, customer_name, customer_phone,
      amount, payment_method, status, received_at, cash_register_id, created_by
    ) VALUES (
      p_company_id, p_quote_id, v_os_id, v_quote.customer_name, v_quote.customer_phone,
      v_entry, p_payment_method, 'received', now(), v_cash_register_id, v_user_id
    ) RETURNING id INTO v_deposit_id;

    INSERT INTO public.accounts_receivable (
      company_id, sale_id, quote_id, ordem_servico_id, client_id, customer_name,
      description, total_amount, installment_number, total_installments, due_date,
      paid_date, paid_amount, status, payment_method, receivable_type, created_by
    ) VALUES (
      p_company_id, v_sale_id, p_quote_id, v_os_id, v_quote.client_id, v_quote.customer_name,
      format('Entrada - Orçamento #%s', v_quote.quote_number), v_entry, 0, 0,
      current_date, current_date, v_entry, 'paid', p_payment_method, 'entrada_orcamento', v_user_id
    ) RETURNING id INTO v_entry_receivable_id;

    INSERT INTO public.cash_movements (
      company_id, cash_register_id, type, category, amount, description,
      payment_method, receivable_id, sale_id, created_by, origem, quote_id, ordem_servico_id
    ) VALUES (
      p_company_id, v_cash_register_id, 'entrada', 'entrada_orcamento', v_cash_amount,
      format('Entrada - Orçamento #%s - %s', v_quote.quote_number, v_quote.customer_name),
      p_payment_method, v_entry_receivable_id, v_sale_id, v_user_id,
      'orcamento', p_quote_id, v_os_id
    ) RETURNING id INTO v_cash_movement_id;
    UPDATE public.quote_deposits SET cash_movement_id = v_cash_movement_id WHERE id = v_deposit_id;
  END IF;

  IF v_pending > 0 THEN
    v_installment_amount := round(v_pending / v_installments, 2);
    FOR i IN 1..v_installments LOOP
      v_current_amount := CASE WHEN i = v_installments
        THEN round(v_pending - v_allocated, 2) ELSE v_installment_amount END;
      v_due_date := p_balance_due_date + ((i - 1) * v_days_between);
      INSERT INTO public.accounts_receivable (
        company_id, sale_id, quote_id, ordem_servico_id, client_id, customer_name,
        description, total_amount, installment_number, total_installments, due_date,
        paid_amount, status, payment_method, receivable_type, created_by
      ) VALUES (
        p_company_id, v_sale_id, p_quote_id, v_os_id, v_quote.client_id, v_quote.customer_name,
        format('OS #%s - Parcela (%s/%s)', v_os_number, i, v_installments),
        v_current_amount, i, v_installments, v_due_date, 0, 'pending',
        v_sale_payment_method, 'saldo_final', v_user_id
      ) RETURNING id INTO v_receivable_id;
      IF i = 1 THEN v_first_balance_receivable_id := v_receivable_id; END IF;
      v_installment_ids := v_installment_ids || jsonb_build_array(v_receivable_id);
      v_allocated := v_allocated + v_current_amount;
    END LOOP;
    IF v_allocated <> v_pending THEN RAISE EXCEPTION 'installment_rounding_mismatch'; END IF;
  END IF;

  UPDATE public.quotes
     SET status = 'approved', forma_pagamento_id = p_forma_pagamento_id,
         condicao_pagamento_id = p_condicao_pagamento_id,
         valor_original = v_quote.total_amount, valor_final_aprovado = v_expected_total,
         approved_at = now(), approved_by = v_user_id
   WHERE id = p_quote_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_approval_update_failed'; END IF;

  RETURN jsonb_build_object(
    'success', true, 'idempotent_replay', false, 'quote_id', p_quote_id,
    'sale_id', v_sale_id, 'ordem_servico_id', v_os_id, 'os_number', v_os_number,
    'quote_deposit_id', v_deposit_id, 'entry_receivable_id', v_entry_receivable_id,
    'balance_receivable_id', v_first_balance_receivable_id,
    'installment_ids', v_installment_ids, 'cash_register_id', v_cash_register_id,
    'cash_movement_id', v_cash_movement_id, 'materials_created', v_material_count,
    'consumption_created', v_consumption_count, 'reservations', v_reservation_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_quote_transactional(
  uuid, uuid, numeric, numeric, text, numeric, date, date, text, text, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_quote_transactional(
  uuid, uuid, numeric, numeric, text, numeric, date, date, text, text, uuid, uuid
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cancel_approved_quote(_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quote public.quotes%ROWTYPE;
  v_os_id uuid;
  v_sale_id uuid;
  v_original_movement_id uuid;
  v_original_register_id uuid;
  v_original_amount numeric;
  v_original_payment_method text;
  v_reversal_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT q.* INTO v_quote FROM public.quotes q WHERE q.id = _quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quote_not_found'; END IF;
  IF NOT public.user_has_elevated_role_in_company(v_user_id, v_quote.company_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT os.id, os.sale_id INTO v_os_id, v_sale_id
    FROM public.ordens_servico os
   WHERE os.quote_id = _quote_id AND os.status <> 'cancelled'
   ORDER BY os.created_at LIMIT 1 FOR UPDATE;

  IF v_quote.status = 'rejected' AND v_os_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'quote_id', _quote_id);
  END IF;
  IF v_quote.status <> 'approved' OR v_os_id IS NULL THEN
    RAISE EXCEPTION 'quote_not_cancellable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.material_consumption mc
     WHERE mc.ordem_servico_id = v_os_id AND mc.status = 'consumed'
  ) OR EXISTS (
    SELECT 1 FROM public.stock_reservations sr
     WHERE sr.ordem_servico_id = v_os_id AND sr.status = 'consumed'
  ) THEN
    RAISE EXCEPTION 'cannot_cancel_consumed_materials';
  END IF;

  SELECT cm.id, cm.cash_register_id, cm.amount, cm.payment_method
    INTO v_original_movement_id, v_original_register_id, v_original_amount, v_original_payment_method
    FROM public.cash_movements cm
   WHERE cm.quote_id = _quote_id AND cm.type = 'entrada'
     AND cm.category = 'entrada_orcamento'
   ORDER BY cm.created_at LIMIT 1;
  IF v_original_movement_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.cash_registers cr
       WHERE cr.id = v_original_register_id AND cr.status = 'open'
       FOR UPDATE
    ) THEN
      RAISE EXCEPTION 'open_original_cash_register_required_for_refund';
    END IF;
    INSERT INTO public.cash_movements (
      company_id, cash_register_id, type, category, amount, description,
      payment_method, sale_id, created_by, origem, quote_id, ordem_servico_id
    ) VALUES (
      v_quote.company_id, v_original_register_id, 'saida', 'outros',
      v_original_amount, format('Estorno - Orçamento #%s', v_quote.quote_number),
      v_original_payment_method, v_sale_id, v_user_id, 'estorno_orcamento',
      _quote_id, v_os_id
    ) RETURNING id INTO v_reversal_id;
  END IF;

  UPDATE public.stock_reservations
     SET status = 'cancelled', quantity_reserved = 0, cancelled_at = now(), updated_at = now()
   WHERE ordem_servico_id = v_os_id AND status = 'reserved';
  UPDATE public.material_consumption
     SET status = 'cancelled', updated_at = now()
   WHERE ordem_servico_id = v_os_id AND status IN ('pending', 'available');
  UPDATE public.accounts_receivable
     SET status = 'cancelled', updated_at = now()
   WHERE quote_id = _quote_id AND status <> 'cancelled';
  UPDATE public.quote_deposits
     SET status = 'cancelled', updated_at = now()
   WHERE quote_id = _quote_id AND status <> 'cancelled';
  UPDATE public.ordens_servico SET status = 'cancelled', updated_at = now() WHERE id = v_os_id;
  UPDATE public.sales SET payment_status = 'cancelled', updated_at = now() WHERE id = v_sale_id;
  UPDATE public.quotes SET status = 'rejected', updated_at = now() WHERE id = _quote_id;

  RETURN jsonb_build_object(
    'success', true, 'idempotent_replay', false, 'quote_id', _quote_id,
    'sale_id', v_sale_id, 'ordem_servico_id', v_os_id,
    'cash_reversal_id', v_reversal_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_approved_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_approved_quote(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.approve_quote_transactional(
  uuid, uuid, numeric, numeric, text, numeric, date, date, text, text, uuid, uuid
) IS 'Phase 2A canonical transactional quote approval: sale, OS, snapshot materials, reservations and receivables.';
COMMENT ON FUNCTION public.cancel_approved_quote(uuid) IS
  'Phase 2A atomic reversal. Blocks cancellation after material consumption or when a deposit cannot be refunded safely.';
