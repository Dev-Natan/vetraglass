CREATE OR REPLACE FUNCTION public.cancel_sale(p_sale_id uuid, p_company_id uuid, p_user_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_stock_restorations JSONB := '[]'::JSONB;
    v_removed_movements JSONB;
    v_cancelled_receivables JSONB;
    v_restore_qty NUMERIC;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND company_id = p_company_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;
    IF v_sale.payment_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta venda já está cancelada');
    END IF;

    SELECT jsonb_agg(m.*) INTO v_removed_movements 
    FROM public.cash_movements m 
    WHERE (m.sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND m.quote_id = v_sale.quote_id))
    AND m.type = 'entrada';

    SELECT jsonb_agg(r.*) INTO v_cancelled_receivables 
    FROM public.accounts_receivable r 
    WHERE r.sale_id = p_sale_id OR (v_sale.ordem_servico_id IS NOT NULL AND r.ordem_servico_id = v_sale.ordem_servico_id);

    FOR v_item IN (SELECT si.*, it.unit FROM public.sale_items si 
                   LEFT JOIN public.item_templates it ON si.item_template_id = it.id
                   WHERE si.sale_id = p_sale_id) LOOP
        v_restore_qty := 0;
        IF v_item.item_template_id IS NOT NULL AND v_item.company_product_id IS NULL THEN
            IF (v_item.unit = 'm²' OR v_item.unit = 'm2') AND v_item.width IS NOT NULL AND v_item.height IS NOT NULL THEN
                v_restore_qty := (v_item.width::NUMERIC / 1000) * (v_item.height::NUMERIC / 1000) * v_item.quantity;
            ELSE
                v_restore_qty := v_item.quantity;
            END IF;
            UPDATE public.company_stock 
            SET quantity = quantity + v_restore_qty 
            WHERE company_id = p_company_id AND item_template_id = v_item.item_template_id;
            INSERT INTO public.stock_movements (
                company_id, item_template_id, type, category, quantity, 
                unit_cost, description, reference_id, reference_type, created_by
            ) VALUES (
                p_company_id, v_item.item_template_id, 'entrada', 'estorno_venda', v_restore_qty,
                0, 'Cancelamento de venda: ' || v_sale.sale_number, p_sale_id, 'sale_cancellation', p_user_id
            );
            v_stock_restorations := v_stock_restorations || jsonb_build_object('item_id', v_item.item_template_id, 'quantity', v_restore_qty);
        END IF;
    END LOOP;

    IF v_sale.ordem_servico_id IS NOT NULL THEN
        DELETE FROM public.material_consumption WHERE ordem_servico_id = v_sale.ordem_servico_id;
        DELETE FROM public.service_appointments WHERE ordem_servico_id = v_sale.ordem_servico_id;
        DELETE FROM public.quote_deposits WHERE ordem_servico_id = v_sale.ordem_servico_id;
        UPDATE public.accounts_receivable 
        SET status = 'cancelled' 
        WHERE ordem_servico_id = v_sale.ordem_servico_id;
        DELETE FROM public.ordens_servico WHERE id = v_sale.ordem_servico_id;
    END IF;

    UPDATE public.accounts_receivable SET status = 'cancelled' WHERE sale_id = p_sale_id;
    DELETE FROM public.cash_movements 
    WHERE (sale_id = p_sale_id OR (v_sale.quote_id IS NOT NULL AND quote_id = v_sale.quote_id))
    AND type = 'entrada';

    IF v_sale.quote_id IS NOT NULL THEN
        UPDATE public.quotes 
        SET status = 'pending', forma_pagamento_id = null, approved_at = null, approved_by = null
        WHERE id = v_sale.quote_id;
    END IF;

    UPDATE public.sales 
    SET payment_status = 'cancelled', 
        notes = CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN 'Cancelado: ' || p_reason ELSE 'Venda cancelada' END
    WHERE id = p_sale_id;

    INSERT INTO public.audit_logs (
        company_id, user_id, action, table_name, record_id, metadata
    ) VALUES (
        p_company_id, p_user_id, 'delete', 'sales', p_sale_id,
        jsonb_build_object(
            'operation', 'CANCEL_SALE',
            'reason', p_reason,
            'sale_number', v_sale.sale_number,
            'customer_name', v_sale.customer_name,
            'total_amount', v_sale.total_amount,
            'removed_cash_movements', v_removed_movements,
            'cancelled_accounts_receivable', v_cancelled_receivables,
            'stock_restorations', v_stock_restorations,
            'restored_quote_id', v_sale.quote_id,
            'removed_os_id', v_sale.ordem_servico_id,
            'new_quote_status', 'pending'
        )
    );

    RETURN jsonb_build_object('success', true, 'sale_number', v_sale.sale_number);
END;
$function$;