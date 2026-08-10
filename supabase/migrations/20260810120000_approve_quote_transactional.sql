-- Aprovação transacional e idempotente de orçamento.
-- Todas as gravações críticas são executadas na mesma transação da chamada RPC.

CREATE OR REPLACE FUNCTION public.approve_quote_transactional(
    p_quote_id UUID,
    p_company_id UUID,
    p_total_amount NUMERIC,
    p_entry_amount NUMERIC DEFAULT 0,
    p_payment_method TEXT DEFAULT NULL,
    p_card_net_amount NUMERIC DEFAULT NULL,
    p_balance_due_date DATE DEFAULT NULL,
    p_estimated_end DATE DEFAULT NULL,
    p_priority TEXT DEFAULT 'normal',
    p_notes TEXT DEFAULT NULL,
    p_forma_pagamento_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_quote public.quotes%ROWTYPE;
    v_os_id UUID;
    v_os_number INTEGER;
    v_cash_register_id UUID;
    v_open_cash_count INTEGER := 0;
    v_locked_cash RECORD;
    v_deposit_id UUID;
    v_entry_receivable_id UUID;
    v_balance_receivable_id UUID;
    v_cash_movement_id UUID;
    v_sale_id UUID;
    v_sale_number INTEGER;
    v_pending_amount NUMERIC;
    v_cash_amount NUMERIC;
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

    SELECT q.*
      INTO v_quote
      FROM public.quotes q
     WHERE q.id = p_quote_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'quote_not_found';
    END IF;

    IF v_quote.company_id <> p_company_id THEN
        RAISE EXCEPTION 'quote_company_mismatch';
    END IF;

    -- Replay idempotente: a OS ativa é a entidade canônica da aprovação.
    SELECT os.id, os.os_number, os.sale_id
      INTO v_os_id, v_os_number, v_sale_id
      FROM public.ordens_servico os
     WHERE os.quote_id = p_quote_id
       AND os.status <> 'cancelled'
     LIMIT 1
     FOR UPDATE;

    IF FOUND THEN
        SELECT qd.id, qd.cash_register_id, qd.cash_movement_id
          INTO v_deposit_id, v_cash_register_id, v_cash_movement_id
          FROM public.quote_deposits qd
         WHERE qd.quote_id = p_quote_id
           AND qd.ordem_servico_id = v_os_id
           AND qd.status <> 'cancelled'
         ORDER BY qd.created_at
         LIMIT 1;

        IF v_sale_id IS NULL THEN
            SELECT s.id
              INTO v_sale_id
              FROM public.sales s
             WHERE s.quote_id = p_quote_id
               AND s.ordem_servico_id = v_os_id
               AND s.payment_status <> 'cancelled'
             ORDER BY s.created_at
             LIMIT 1;
        END IF;

        SELECT ar.id
          INTO v_entry_receivable_id
          FROM public.accounts_receivable ar
         WHERE ar.quote_id = p_quote_id
           AND ar.installment_number = 0
           AND ar.status <> 'cancelled'
         LIMIT 1;

        SELECT ar.id
          INTO v_balance_receivable_id
          FROM public.accounts_receivable ar
         WHERE ar.quote_id = p_quote_id
           AND ar.installment_number = 1
           AND ar.status <> 'cancelled'
         LIMIT 1;

        RETURN jsonb_build_object(
            'success', true,
            'idempotent_replay', true,
            'quote_id', p_quote_id,
            'ordem_servico_id', v_os_id,
            'os_number', v_os_number,
            'quote_deposit_id', v_deposit_id,
            'entry_receivable_id', v_entry_receivable_id,
            'balance_receivable_id', v_balance_receivable_id,
            'cash_register_id', v_cash_register_id,
            'cash_movement_id', v_cash_movement_id,
            'sale_id', v_sale_id
        );
    END IF;

    IF v_quote.status <> 'pending' THEN
        RAISE EXCEPTION 'quote_not_approvable: %', v_quote.status;
    END IF;

    IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
        RAISE EXCEPTION 'invalid_total_amount';
    END IF;

    IF p_entry_amount IS NULL OR p_entry_amount < 0 THEN
        RAISE EXCEPTION 'invalid_entry_amount';
    END IF;

    IF p_entry_amount > p_total_amount THEN
        RAISE EXCEPTION 'entry_amount_exceeds_total';
    END IF;

    v_pending_amount := p_total_amount - p_entry_amount;
    IF v_pending_amount < 0 THEN
        RAISE EXCEPTION 'negative_pending_amount';
    END IF;

    IF v_pending_amount > 0 AND p_balance_due_date IS NULL THEN
        RAISE EXCEPTION 'balance_due_date_required';
    END IF;

    IF p_entry_amount > 0 THEN
        IF p_payment_method IS NULL
           OR p_payment_method NOT IN ('dinheiro', 'cartao', 'pix') THEN
            RAISE EXCEPTION 'invalid_payment_method';
        END IF;

        IF p_payment_method = 'cartao' THEN
            v_cash_amount := COALESCE(p_card_net_amount, p_entry_amount);
            IF v_cash_amount <= 0 OR v_cash_amount > p_entry_amount THEN
                RAISE EXCEPTION 'invalid_card_net_amount';
            END IF;
        ELSE
            IF p_card_net_amount IS NOT NULL AND p_card_net_amount <> p_entry_amount THEN
                RAISE EXCEPTION 'card_net_amount_not_allowed';
            END IF;
            v_cash_amount := p_entry_amount;
        END IF;

        -- Trava todas as linhas open encontradas antes de validar a cardinalidade.
        FOR v_locked_cash IN
            SELECT cr.id
              FROM public.cash_registers cr
             WHERE cr.company_id = p_company_id
               AND cr.status = 'open'
             FOR UPDATE
        LOOP
            v_open_cash_count := v_open_cash_count + 1;
            v_cash_register_id := v_locked_cash.id;
        END LOOP;

        IF v_open_cash_count = 0 THEN
            RAISE EXCEPTION 'open_cash_register_required';
        ELSIF v_open_cash_count > 1 THEN
            RAISE EXCEPTION 'multiple_open_cash_registers';
        END IF;
    END IF;

    v_os_number := public.get_next_document_number(p_company_id, 'OS');

    INSERT INTO public.ordens_servico (
        company_id,
        quote_id,
        os_number,
        customer_name,
        customer_phone,
        customer_email,
        customer_address,
        status,
        priority,
        estimated_end,
        total_amount,
        paid_amount,
        pending_amount,
        notes,
        created_by
    ) VALUES (
        p_company_id,
        p_quote_id,
        v_os_number,
        v_quote.customer_name,
        v_quote.customer_phone,
        v_quote.customer_email,
        v_quote.customer_address,
        'pending',
        p_priority,
        p_estimated_end,
        p_total_amount,
        p_entry_amount,
        v_pending_amount,
        p_notes,
        v_user_id
    )
    RETURNING id INTO v_os_id;

    INSERT INTO public.os_items (
        os_id,
        quote_item_id,
        product_name,
        product_id,
        company_product_id,
        quantity,
        width_sold,
        height_sold,
        width_production,
        height_production,
        width_sold_b,
        height_sold_b,
        width_production_b,
        height_production_b,
        largura_venda,
        altura_venda,
        largura_venda_b,
        altura_venda_b,
        largura_venda_c,
        altura_venda_c,
        largura_producao,
        altura_producao,
        largura_producao_b,
        altura_producao_b,
        largura_producao_c,
        altura_producao_c,
        aluminum_color
    )
    SELECT
        v_os_id,
        qi.id,
        COALESCE(NULLIF(BTRIM(qi.description), ''), 'Item do orçamento'),
        qi.product_template_id,
        qi.company_product_id,
        qi.quantity,
        qi.width,
        qi.height,
        qi.width,
        qi.height,
        qi.width_b,
        qi.height_b,
        qi.width_b,
        qi.height_b,
        COALESCE(qi.width, 0),
        COALESCE(qi.height, 0),
        qi.width_b,
        qi.height_b,
        qi.width_c,
        qi.height_c,
        COALESCE(qi.width, 0),
        COALESCE(qi.height, 0),
        qi.width_b,
        qi.height_b,
        qi.width_c,
        qi.height_c,
        qi.aluminum_color
      FROM public.quote_items qi
     WHERE qi.quote_id = p_quote_id
     ORDER BY qi.position NULLS LAST, qi.created_at, qi.id;

    IF p_entry_amount > 0 THEN
        INSERT INTO public.quote_deposits (
            company_id,
            quote_id,
            ordem_servico_id,
            customer_name,
            customer_phone,
            amount,
            payment_method,
            status,
            received_at,
            cash_register_id,
            created_by
        ) VALUES (
            p_company_id,
            p_quote_id,
            v_os_id,
            v_quote.customer_name,
            v_quote.customer_phone,
            p_entry_amount,
            p_payment_method,
            'received',
            NOW(),
            v_cash_register_id,
            v_user_id
        )
        RETURNING id INTO v_deposit_id;

        INSERT INTO public.accounts_receivable (
            company_id,
            ordem_servico_id,
            quote_id,
            client_id,
            customer_name,
            description,
            total_amount,
            paid_amount,
            paid_date,
            payment_method,
            status,
            due_date,
            receivable_type,
            installment_number,
            total_installments,
            created_by
        ) VALUES (
            p_company_id,
            v_os_id,
            p_quote_id,
            v_quote.client_id,
            v_quote.customer_name,
            format('Entrada - Orçamento #%s', v_quote.quote_number),
            p_entry_amount,
            p_entry_amount,
            CURRENT_DATE,
            p_payment_method,
            'paid',
            CURRENT_DATE,
            'entrada_orcamento',
            0,
            0,
            v_user_id
        )
        RETURNING id INTO v_entry_receivable_id;

        INSERT INTO public.cash_movements (
            cash_register_id,
            company_id,
            type,
            category,
            amount,
            description,
            payment_method,
            created_by,
            origem,
            quote_id,
            ordem_servico_id,
            receivable_id
        ) VALUES (
            v_cash_register_id,
            p_company_id,
            'entrada',
            'entrada_orcamento',
            v_cash_amount,
            format('Entrada - Orçamento #%s - %s', v_quote.quote_number, v_quote.customer_name),
            p_payment_method,
            v_user_id,
            'orcamento',
            p_quote_id,
            v_os_id,
            v_entry_receivable_id
        )
        RETURNING id INTO v_cash_movement_id;

        v_sale_number := public.get_next_document_number(p_company_id, 'SALE');

        INSERT INTO public.sales (
            company_id,
            sale_number,
            cash_register_id,
            client_id,
            customer_name,
            subtotal,
            total_amount,
            payment_method,
            payment_status,
            sale_type,
            paid_amount,
            pending_amount,
            quote_id,
            ordem_servico_id,
            sold_by,
            notes
        ) VALUES (
            p_company_id,
            v_sale_number,
            v_cash_register_id,
            v_quote.client_id,
            v_quote.customer_name,
            p_entry_amount,
            p_entry_amount,
            p_payment_method,
            'paid',
            CASE
                WHEN p_entry_amount = p_total_amount THEN 'full'
                ELSE 'partial'
            END,
            p_entry_amount,
            v_pending_amount,
            p_quote_id,
            v_os_id,
            v_user_id,
            format('Entrada do orçamento #%s', v_quote.quote_number)
        )
        RETURNING id INTO v_sale_id;

        INSERT INTO public.sale_items (
            sale_id,
            item_name,
            item_unit,
            quantity,
            unit_price,
            total_price
        ) VALUES (
            v_sale_id,
            format('Entrada - Orçamento #%s', v_quote.quote_number),
            'un',
            1,
            p_entry_amount,
            p_entry_amount
        );

        UPDATE public.cash_movements
           SET sale_id = v_sale_id
         WHERE id = v_cash_movement_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'cash_movement_sale_link_failed';
        END IF;

        UPDATE public.quote_deposits
           SET cash_movement_id = v_cash_movement_id
         WHERE id = v_deposit_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'deposit_cash_movement_link_failed';
        END IF;

        UPDATE public.accounts_receivable
           SET sale_id = v_sale_id
         WHERE id = v_entry_receivable_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'entry_receivable_sale_link_failed';
        END IF;

        UPDATE public.ordens_servico
           SET sale_id = v_sale_id
         WHERE id = v_os_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'os_sale_link_failed';
        END IF;
    END IF;

    IF v_pending_amount > 0 THEN
        INSERT INTO public.accounts_receivable (
            company_id,
            ordem_servico_id,
            quote_id,
            sale_id,
            client_id,
            customer_name,
            description,
            total_amount,
            paid_amount,
            status,
            due_date,
            receivable_type,
            installment_number,
            total_installments,
            created_by
        ) VALUES (
            p_company_id,
            v_os_id,
            p_quote_id,
            v_sale_id,
            v_quote.client_id,
            v_quote.customer_name,
            format('OS #%s - Saldo (1/1)', v_os_number),
            v_pending_amount,
            0,
            'pending',
            p_balance_due_date,
            'saldo_final',
            1,
            1,
            v_user_id
        )
        RETURNING id INTO v_balance_receivable_id;
    END IF;

    UPDATE public.quotes
       SET status = 'approved',
           forma_pagamento_id = p_forma_pagamento_id,
           condicao_pagamento_id = NULL,
           valor_original = v_quote.total_amount,
           valor_final_aprovado = p_total_amount,
           approved_at = NOW(),
           approved_by = v_user_id
     WHERE id = p_quote_id
       AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'quote_approval_update_failed';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', false,
        'quote_id', p_quote_id,
        'ordem_servico_id', v_os_id,
        'os_number', v_os_number,
        'quote_deposit_id', v_deposit_id,
        'entry_receivable_id', v_entry_receivable_id,
        'balance_receivable_id', v_balance_receivable_id,
        'cash_register_id', v_cash_register_id,
        'cash_movement_id', v_cash_movement_id,
        'sale_id', v_sale_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_quote_transactional(
    UUID, UUID, NUMERIC, NUMERIC, TEXT, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.approve_quote_transactional(
    UUID, UUID, NUMERIC, NUMERIC, TEXT, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) TO authenticated;
