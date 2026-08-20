-- Migration: 20260820190000_company_data_reset_rpc.sql
-- Description: Cria RPC segura para empresas resetarem/limparem seus próprios dados de forma seletiva ou total

DROP FUNCTION IF EXISTS public.reset_company_data(UUID, TEXT[]);

CREATE OR REPLACE FUNCTION public.reset_company_data(
  p_company_id UUID,
  p_modules TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_company_admin BOOLEAN;
  v_is_saas_adm BOOLEAN;
  v_clear_all BOOLEAN;
  v_clear_financial BOOLEAN;
  v_clear_quotes BOOLEAN;
  v_clear_stock BOOLEAN;
  v_clear_products BOOLEAN;
  v_clear_clients BOOLEAN;
BEGIN
  -- 1. Validar autenticação
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Autenticação necessária');
  END IF;

  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'company_id é obrigatório');
  END IF;

  -- 2. Validar permissão (Admin da Empresa ou SaaS Admin)
  v_is_saas_adm := public.is_saas_admin(v_user_id);
  v_is_company_admin := (public.user_role_in_company(v_user_id, p_company_id) = 'admin');

  IF NOT v_is_company_admin AND NOT v_is_saas_adm THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas administradores da empresa podem redefinir dados');
  END IF;

  -- 3. Identificar módulos selecionados
  v_clear_all := ('all' = ANY(p_modules));
  v_clear_financial := v_clear_all OR ('financial' = ANY(p_modules));
  v_clear_quotes := v_clear_all OR ('quotes' = ANY(p_modules));
  v_clear_stock := v_clear_all OR ('stock' = ANY(p_modules));
  v_clear_products := v_clear_all OR ('products' = ANY(p_modules));
  v_clear_clients := v_clear_all OR ('clients' = ANY(p_modules));

  -- 4. DESVINCULAR chaves estrangeiras nullable para evitar travas de FK

  -- Desvincular Ordens de Serviço e Notas Fiscais
  IF v_clear_financial OR v_clear_quotes THEN
    BEGIN UPDATE public.ordens_servico SET sale_id = NULL, parent_sale_id = NULL, quote_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.notas_fiscais SET sale_id = NULL, quote_id = NULL, ordem_servico_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.accounts_receivable SET sale_id = NULL, quote_id = NULL, ordem_servico_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.quote_deposits SET cash_register_id = NULL, cash_movement_id = NULL, quote_id = NULL, ordem_servico_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.cash_movements SET sale_id = NULL, receivable_id = NULL, expense_id = NULL, quote_id = NULL, ordem_servico_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.company_cash_movements SET cash_register_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.employee_commissions SET sale_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  IF v_clear_clients THEN
    BEGIN UPDATE public.sales SET client_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.quotes SET client_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.ordens_servico SET client_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- 5. LIMPAR FINANCEIRO & VENDAS
  IF v_clear_financial THEN
    BEGIN DELETE FROM public.quote_deposits WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.sale_taxes WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.nota_fiscal_itens WHERE nota_fiscal_id IN (SELECT id FROM public.notas_fiscais WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.notas_fiscais WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.sales WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN DELETE FROM public.cash_counts WHERE cash_register_id IN (SELECT id FROM public.cash_registers WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.cash_register_advances WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.cash_register_audits WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.cash_shortages WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.operator_discrepancies WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.cash_movements WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.company_cash_movements WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.cash_registers WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN UPDATE public.company_cash SET current_balance = 0, last_movement_at = now() WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN DELETE FROM public.employee_commissions WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.financial_operation_keys WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.accounts_receivable WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.expenses WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- 6. LIMPAR ORÇAMENTOS E ORDENS DE SERVIÇO
  IF v_clear_quotes THEN
    BEGIN DELETE FROM public.quote_deposits WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.measurement_photos WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.measurement_checklist WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.measurement_items WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.site_measurements WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.service_appointments WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.ordens_servico WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.quotes WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- 7. LIMPAR ESTOQUE & MOVIMENTAÇÕES
  IF v_clear_stock THEN
    BEGIN DELETE FROM public.stock_offcuts WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.stock_reservations WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.material_consumption WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.stock_movements WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.company_stock WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.purchase_order_items WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.purchase_orders WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- 8. LIMPAR PRODUTOS E PREÇOS DA EMPRESA
  IF v_clear_products THEN
    BEGIN DELETE FROM public.company_product_items WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.company_products WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.company_item_prices WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.company_items WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DELETE FROM public.company_linhas WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- 9. LIMPAR CLIENTES
  IF v_clear_clients THEN
    BEGIN DELETE FROM public.clients WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;

  -- 10. Registrar log de auditoria
  BEGIN
    INSERT INTO public.audit_logs (
      user_id, company_id, action, table_name, metadata
    ) VALUES (
      v_user_id, p_company_id, 'delete', 'company_data_reset',
      jsonb_build_object(
        'modules', p_modules,
        'reset_at', now(),
        'by_user', v_user_id
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'cleared_modules', p_modules
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_company_data(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_company_data(UUID, TEXT[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
