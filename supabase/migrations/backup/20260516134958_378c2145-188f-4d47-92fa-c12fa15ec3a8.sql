-- Função para sincronizar financeiro do orçamento
CREATE OR REPLACE FUNCTION public.sync_quote_financial_data()
RETURNS TRIGGER AS $$
DECLARE
    v_os_id UUID;
    v_total_parcelas INTEGER;
    v_valor_parcela DECIMAL(12,2);
    v_soma_parcelas DECIMAL(12,2) := 0;
    v_diff DECIMAL(12,2);
    v_count INTEGER := 0;
    v_receivable_id UUID;
    v_entry_amount DECIMAL(12,2) := 0;
    v_pending_amount DECIMAL(12,2);
BEGIN
    -- Só executa se o status for aprovado e o valor ou forma de pagamento mudou
    IF (NEW.status = 'approved' AND (OLD.status != 'approved' OR OLD.valor_final_aprovado != NEW.valor_final_aprovado OR OLD.forma_pagamento_id IS DISTINCT FROM NEW.forma_pagamento_id OR OLD.condicao_pagamento_id IS DISTINCT FROM NEW.condicao_pagamento_id)) THEN
        
        -- Busca OS vinculada
        SELECT id INTO v_os_id FROM public.ordens_servico WHERE quote_id = NEW.id;
        
        IF v_os_id IS NOT NULL THEN
            -- Atualiza valor da OS
            UPDATE public.ordens_servico 
            SET total_amount = NEW.valor_final_aprovado,
                pending_amount = NEW.valor_final_aprovado - paid_amount
            WHERE id = v_os_id;

            -- Recalcula Contas a Receber (Saldo Pendente)
            -- Nota: Esta regra assume que as contas a receber do tipo 'saldo_final' ou 'saldo_conclusao' devem ser atualizadas
            -- Entradas já pagas não são mexidas para evitar bagunça no caixa
            
            SELECT COALESCE(SUM(total_amount), 0) INTO v_entry_amount 
            FROM public.accounts_receivable 
            WHERE quote_id = NEW.id AND (receivable_type = 'entrada_orcamento' OR status = 'paid');

            v_pending_amount := NEW.valor_final_aprovado - v_entry_amount;

            -- Se houver uma condição de pagamento com parcelas
            SELECT COALESCE(parcelas, 1) INTO v_total_parcelas 
            FROM public.condicoes_pagamento 
            WHERE id = NEW.condicao_pagamento_id;

            IF v_total_parcelas > 0 AND v_pending_amount > 0 THEN
                v_valor_parcela := ROUND(v_pending_amount / v_total_parcelas, 2);
                
                -- Atualiza as parcelas existentes ou cria o alerta
                -- Para simplificar este trigger e evitar loops complexos, apenas ajustamos os valores das parcelas 'pending'
                FOR v_receivable_id IN 
                    SELECT id FROM public.accounts_receivable 
                    WHERE quote_id = NEW.id AND status = 'pending' AND receivable_type IN ('saldo_final', 'saldo_conclusao')
                    ORDER BY installment_number ASC
                LOOP
                    v_count := v_count + 1;
                    
                    IF v_count < v_total_parcelas THEN
                        UPDATE public.accounts_receivable SET total_amount = v_valor_parcela WHERE id = v_receivable_id;
                        v_soma_parcelas := v_soma_parcelas + v_valor_parcela;
                    ELSE
                        -- Ajuste de centavos na última parcela
                        v_diff := v_pending_amount - v_soma_parcelas;
                        UPDATE public.accounts_receivable SET total_amount = v_diff WHERE id = v_receivable_id;
                        v_soma_parcelas := v_soma_parcelas + v_diff;
                    END IF;
                END LOOP;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para sincronização
DROP TRIGGER IF EXISTS tr_sync_quote_financial ON public.quotes;
CREATE TRIGGER tr_sync_quote_financial
AFTER UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.sync_quote_financial_data();
