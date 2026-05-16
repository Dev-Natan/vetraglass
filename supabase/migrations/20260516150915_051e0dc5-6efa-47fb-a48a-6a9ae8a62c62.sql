CREATE OR REPLACE FUNCTION public.cancel_sale(
    p_sale_id UUID,
    p_company_id UUID,
    p_user_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_stock_item RECORD;
    v_stock_restorations JSONB := '[]'::JSONB;
    v_removed_movements JSONB;
    v_cancelled_receivables JSONB;
    v_restore_qty NUMERIC;
    v_item_name TEXT;
BEGIN
    -- 1. Check if sale exists and belongs to company
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND company_id = p_company_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;

    IF v_sale.payment_status = 'cancelled' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta venda já está cancelada');
    END IF;

    -- 2. Capture data for audit BEFORE changes
    SELECT jsonb_agg(m.*) INTO v_removed_movements 
    FROM public.cash_movements m 
    WHERE m.sale_id = p_sale_id AND m.type = 'entrada';

    SELECT jsonb_agg(r.*) INTO v_cancelled_receivables 
    FROM public.accounts_receivable r 
    WHERE r.sale_id = p_sale_id;

    -- 3. Restore Stock
    FOR v_item IN (SELECT si.*, it.unit, it.name FROM public.sale_items si 
                   LEFT JOIN public.item_templates it ON si.item_template_id = it.id
                   WHERE si.sale_id = p_sale_id) LOOP
        
        v_restore_qty := 0;
        
        -- Logic for simple items
        IF v_item.item_template_id IS NOT NULL AND v_item.company_product_id IS NULL THEN
            IF (v_item.unit = 'm²' OR v_item.unit = 'm2') AND v_item.width IS NOT NULL AND v_item.height IS NOT NULL THEN
                v_restore_qty := (v_item.width::NUMERIC / 1000) * (v_item.height::NUMERIC / 1000) * v_item.quantity;
            ELSE
                v_restore_qty := v_item.quantity;
            END IF;
            
            -- Update stock
            UPDATE public.company_stock 
            SET quantity = quantity + v_restore_qty 
            WHERE company_id = p_company_id AND item_template_id = v_item.item_template_id
            RETURNING id INTO v_stock_item;
            
            IF FOUND THEN
                INSERT INTO public.stock_movements (
                    company_id, item_template_id, type, category, quantity, 
                    unit_cost, description, reference_id, reference_type, created_by
                ) VALUES (
                    p_company_id, v_item.item_template_id, 'entrada', 'estorno_venda', v_restore_qty,
                    0, 'Cancelamento de venda: ' || v_sale.sale_number, p_sale_id, 'sale_cancellation', p_user_id
                );
                
                v_stock_restorations := v_stock_restorations || jsonb_build_object('item_id', v_item.item_template_id, 'quantity', v_restore_qty);
            END IF;
        END IF;

        -- Logic for composite products (simplified here, but in real case would handle compositions)
        -- For now, the app's JS logic handles the complex composition calculation.
        -- In a robust system, this should be purely server-side.
        -- As we want consistency, we'll keep the JS logic for composition but run the core cancellation here.
    END LOOP;

    -- 4. Cancel Receivables
    UPDATE public.accounts_receivable 
    SET status = 'cancelled' 
    WHERE sale_id = p_sale_id;

    -- 5. Delete Cash Movements
    DELETE FROM public.cash_movements 
    WHERE sale_id = p_sale_id AND type = 'entrada';

    -- 6. Update Sale
    UPDATE public.sales 
    SET payment_status = 'cancelled', 
        notes = CASE WHEN p_reason IS NOT NULL AND p_reason != '' THEN 'Cancelado: ' || p_reason ELSE 'Venda cancelada' END
    WHERE id = p_sale_id;

    -- 7. Audit Log
    INSERT INTO public.audit_logs (
        company_id, user_id, action, table_name, record_id, metadata
    ) VALUES (
        p_company_id, p_user_id, 'CANCEL_SALE', 'sales', p_sale_id,
        jsonb_build_object(
            'reason', p_reason,
            'sale_number', v_sale.sale_number,
            'customer_name', v_sale.customer_name,
            'total_amount', v_sale.total_amount,
            'removed_cash_movements', v_removed_movements,
            'cancelled_accounts_receivable', v_cancelled_receivables,
            'stock_restorations', v_stock_restorations
        )
    );

    RETURN jsonb_build_object('success', true, 'sale_number', v_sale.sale_number);
END;
$$;