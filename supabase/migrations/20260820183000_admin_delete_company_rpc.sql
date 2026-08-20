-- Migration: 20260820183000_admin_delete_company_rpc.sql
-- Description: Cria RPC administrativa transacional para exclusão de empresa pelo SaaS Admin

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
  -- 1. Validar autenticação e se é SaaS Admin
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  IF NOT public.is_saas_admin(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas SaaS Admins podem excluir empresas');
  END IF;

  IF p_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'p_company_id é obrigatório');
  END IF;

  -- 2. Coletar usuários vinculados a esta empresa
  SELECT COALESCE(array_agg(user_id), '{}')
  INTO v_user_ids
  FROM public.user_companies
  WHERE company_id = p_company_id;

  -- 3. Exclusão em cascata controlada na ordem de integridade referencial

  -- Financeiro & Caixa
  DELETE FROM public.cash_counts WHERE cash_register_id IN (SELECT id FROM public.cash_registers WHERE company_id = p_company_id);
  DELETE FROM public.cash_movements WHERE company_id = p_company_id;
  DELETE FROM public.quote_deposits WHERE company_id = p_company_id;
  DELETE FROM public.cash_registers WHERE company_id = p_company_id;
  DELETE FROM public.company_cash_movements WHERE company_id = p_company_id;
  DELETE FROM public.company_cash WHERE company_id = p_company_id;
  DELETE FROM public.employee_commissions WHERE company_id = p_company_id;
  DELETE FROM public.financial_operation_keys WHERE company_id = p_company_id;
  DELETE FROM public.accounts_receivable WHERE company_id = p_company_id;
  DELETE FROM public.expenses WHERE company_id = p_company_id;

  -- Vendas & Orçamentos & Ordens de Serviço
  DELETE FROM public.sale_taxes WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id);
  DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id);
  DELETE FROM public.sales WHERE company_id = p_company_id;

  DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE company_id = p_company_id);
  DELETE FROM public.quotes WHERE company_id = p_company_id;

  DELETE FROM public.ordens_servico WHERE company_id = p_company_id;
  DELETE FROM public.service_appointments WHERE company_id = p_company_id;
  DELETE FROM public.measurement_photos WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id);
  DELETE FROM public.measurement_checklist WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id);
  DELETE FROM public.measurement_items WHERE measurement_id IN (SELECT id FROM public.site_measurements WHERE company_id = p_company_id);
  DELETE FROM public.site_measurements WHERE company_id = p_company_id;

  -- Estoque & Produtos
  DELETE FROM public.stock_offcuts WHERE company_id = p_company_id;
  DELETE FROM public.stock_reservations WHERE company_id = p_company_id;
  DELETE FROM public.material_consumption WHERE company_id = p_company_id;
  DELETE FROM public.stock_movements WHERE company_id = p_company_id;
  DELETE FROM public.company_stock WHERE company_id = p_company_id;
  DELETE FROM public.company_product_items WHERE company_id = p_company_id;
  DELETE FROM public.company_products WHERE company_id = p_company_id;
  DELETE FROM public.company_item_prices WHERE company_id = p_company_id;
  DELETE FROM public.company_items WHERE company_id = p_company_id;
  DELETE FROM public.company_linhas WHERE company_id = p_company_id;

  -- Compras & Fiscal
  DELETE FROM public.purchase_order_items WHERE purchase_order_id IN (SELECT id FROM public.purchase_orders WHERE company_id = p_company_id);
  DELETE FROM public.purchase_orders WHERE company_id = p_company_id;
  DELETE FROM public.nota_fiscal_itens WHERE nota_fiscal_id IN (SELECT id FROM public.notas_fiscais WHERE company_id = p_company_id);
  DELETE FROM public.notas_fiscais WHERE company_id = p_company_id;
  DELETE FROM public.company_tax_config WHERE company_id = p_company_id;

  -- Clientes, Funcionários & Configurações
  DELETE FROM public.clients WHERE company_id = p_company_id;
  DELETE FROM public.employee_invites WHERE company_id = p_company_id;
  DELETE FROM public.employees WHERE company_id = p_company_id;
  DELETE FROM public.company_notification_settings WHERE company_id = p_company_id;
  DELETE FROM public.company_notifications WHERE company_id = p_company_id;
  DELETE FROM public.company_payment_settings WHERE company_id = p_company_id;
  DELETE FROM public.company_sales_goals WHERE company_id = p_company_id;
  DELETE FROM public.company_security_settings WHERE company_id = p_company_id;
  DELETE FROM public.company_subscriptions WHERE company_id = p_company_id;
  DELETE FROM public.role_permissions WHERE company_id = p_company_id;
  DELETE FROM public.audit_logs WHERE company_id = p_company_id;
  DELETE FROM public.support_attachments WHERE ticket_id IN (SELECT id FROM public.support_tickets WHERE company_id = p_company_id);
  DELETE FROM public.support_messages WHERE ticket_id IN (SELECT id FROM public.support_tickets WHERE company_id = p_company_id);
  DELETE FROM public.support_tickets WHERE company_id = p_company_id;

  -- Memberships
  DELETE FROM public.user_companies WHERE company_id = p_company_id;

  -- 4. Excluir a empresa
  DELETE FROM public.companies WHERE id = p_company_id;

  -- 5. Limpar perfis de usuários órfãos (que não pertencem a nenhuma outra empresa e não são SaaS Admins)
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
