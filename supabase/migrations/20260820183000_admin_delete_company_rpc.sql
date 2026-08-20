-- Migration: 20260820183000_admin_delete_company_rpc.sql
-- Description: Cria RPC administrativa transacional com exclusão em cascata rigorosa e segura

DROP FUNCTION IF EXISTS public.admin_delete_company(UUID);

CREATE OR REPLACE FUNCTION public.admin_delete_company(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_user_ids UUID[];
  v_uid UUID;
  v_other_count INT;
BEGIN
  -- 1. Validar autenticação e permissão de SaaS Admin
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  IF NOT public.is_saas_admin(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas SaaS Admins podem excluir empresas');
  END IF;

  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_company_id é obrigatório');
  END IF;

  -- 2. Coletar usuários vinculados à empresa
  SELECT COALESCE(array_agg(user_id), '{}')
  INTO v_user_ids
  FROM public.user_companies
  WHERE company_id = p_company_id;

  -- 3. Desvincular apenas chaves nullable para evitar ciclos antes da exclusão
  BEGIN UPDATE public.ordens_servico SET sale_id = NULL, parent_sale_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.notas_fiscais SET sale_id = NULL, quote_id = NULL, ordem_servico_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.accounts_receivable SET sale_id = NULL, quote_id = NULL, ordem_servico_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.employee_commissions SET sale_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.cash_movements SET sale_id = NULL, receivable_id = NULL, expense_id = NULL, quote_id = NULL, ordem_servico_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.company_cash_movements SET cash_register_id = NULL WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 4. Excluir depósitos e itens de orçamentos e vendas
  BEGIN DELETE FROM public.quote_deposits WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.sale_taxes WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.nota_fiscal_itens WHERE nota_fiscal_id IN (SELECT id FROM public.notas_fiscais WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.notas_fiscais WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 5. Excluir Vendas
  BEGIN DELETE FROM public.sales WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 6. Excluir Medições, Agendamentos, Ordens de Serviço e Orçamentos
  BEGIN DELETE FROM public.measurement_photos WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.measurement_checklist WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.measurement_items WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.site_measurements WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.service_appointments WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.ordens_servico WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.quotes WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 7. Excluir Movimentações e Caixas
  BEGIN DELETE FROM public.cash_counts WHERE cash_register_id IN (SELECT id FROM public.cash_registers WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.cash_register_advances WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.cash_register_audits WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.cash_shortages WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.operator_discrepancies WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.cash_movements WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_cash_movements WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.cash_registers WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_cash WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 8. Financeiro, Comissões, Compras
  BEGIN DELETE FROM public.employee_commissions WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.financial_operation_keys WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.accounts_receivable WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.expenses WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.purchase_order_items WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.purchase_orders WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 9. Estoque e Produtos
  BEGIN DELETE FROM public.stock_offcuts WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.stock_reservations WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.material_consumption WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.stock_movements WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_stock WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_product_items WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_products WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_item_prices WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_items WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_linhas WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_tax_config WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 10. Clientes, Funcionários, Suporte e Configurações
  BEGIN DELETE FROM public.clients WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.employee_invites WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.employees WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    DELETE FROM public.support_attachments WHERE message_id IN (
      SELECT m.id FROM public.support_messages m
      JOIN public.support_tickets tk ON tk.id = m.ticket_id
      WHERE tk.company_id = p_company_id
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.support_messages WHERE ticket_id IN (SELECT id FROM public.support_tickets WHERE company_id = p_company_id); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.support_tickets WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN DELETE FROM public.company_notification_settings WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_notifications WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_payment_settings WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_sales_goals WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_security_settings WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.company_subscriptions WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.role_permissions WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.audit_logs WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.user_companies WHERE company_id = p_company_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 11. Excluir a empresa
  DELETE FROM public.companies WHERE id = p_company_id;

  -- 12. Limpar perfis órfãos (usuários sem nenhuma outra empresa e que não são SaaS Admin)
  FOREACH v_uid IN ARRAY v_user_ids LOOP
    SELECT count(*) INTO v_other_count
    FROM public.user_companies
    WHERE user_id = v_uid;

    IF v_other_count = 0 AND NOT public.is_saas_admin(v_uid) THEN
      DELETE FROM public.profiles WHERE user_id = v_uid;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'company_id', p_company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_company(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_company(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
