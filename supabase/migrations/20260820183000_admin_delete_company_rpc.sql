-- Migration: 20260820183000_admin_delete_company_rpc.sql
-- Description: Cria RPC administrativa transacional para exclusão de empresa pelo SaaS Admin com ordem rigorosa de integridade referencial

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
  v_pass INT;
  t TEXT;
  v_tables TEXT[] := ARRAY[
    -- 1. Suporte e Mensagens
    'support_attachments',
    'support_messages',
    'support_tickets',

    -- 2. Fiscal
    'nota_fiscal_itens',
    'notas_fiscais',

    -- 3. Vendas e Impostos (deve ser ANTES de cash_registers, quotes, ordens_servico, clients)
    'sale_taxes',
    'sale_items',
    'sales',

    -- 4. Orçamentos e Ordens de Serviço
    'quote_items',
    'quote_deposits',
    'measurement_photos',
    'measurement_checklist',
    'measurement_items',
    'site_measurements',
    'service_appointments',
    'ordens_servico',
    'quotes',

    -- 5. Caixa e Cofre Central (deve ser DEPOIS de sales, quotes e ordens_servico)
    'cash_counts',
    'cash_register_advances',
    'cash_register_audits',
    'cash_shortages',
    'operator_discrepancies',
    'cash_movements',
    'company_cash_movements',
    'cash_registers',
    'company_cash',

    -- 6. Financeiro geral & Comissões
    'employee_commissions',
    'financial_operation_keys',
    'accounts_receivable',
    'expenses',

    -- 7. Compras
    'purchase_order_items',
    'purchase_orders',

    -- 8. Estoque e Produtos
    'stock_offcuts',
    'stock_reservations',
    'material_consumption',
    'stock_movements',
    'company_stock',
    'company_product_items',
    'company_products',
    'company_item_prices',
    'company_items',
    'company_linhas',
    'company_tax_config',

    -- 9. Clientes e Funcionários
    'clients',
    'employee_invites',
    'employees',

    -- 10. Configurações da Empresa
    'company_notification_settings',
    'company_notifications',
    'company_payment_settings',
    'company_sales_goals',
    'company_security_settings',
    'company_subscriptions',
    'role_permissions',
    'audit_logs',
    'user_companies'
  ];
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

  -- 3. Limpeza multi-pass para resolver qualquer ordem circular de FKs
  FOR v_pass IN 1..3 LOOP
    FOREACH t IN ARRAY v_tables LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE company_id = $1', t) USING p_company_id;
      EXCEPTION
        WHEN undefined_column THEN
          BEGIN
            IF t = 'support_attachments' THEN
              DELETE FROM public.support_attachments WHERE message_id IN (
                SELECT m.id FROM public.support_messages m
                JOIN public.support_tickets tk ON tk.id = m.ticket_id
                WHERE tk.company_id = p_company_id
              );
            ELSIF t = 'support_messages' THEN
              DELETE FROM public.support_messages WHERE ticket_id IN (
                SELECT id FROM public.support_tickets WHERE company_id = p_company_id
              );
            ELSIF t = 'sale_items' THEN
              DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id);
            ELSIF t = 'sale_taxes' THEN
              DELETE FROM public.sale_taxes WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = p_company_id);
            ELSIF t = 'quote_items' THEN
              DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE company_id = p_company_id);
            ELSIF t = 'cash_counts' THEN
              DELETE FROM public.cash_counts WHERE cash_register_id IN (SELECT id FROM public.cash_registers WHERE company_id = p_company_id);
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        WHEN undefined_table THEN
          NULL;
        WHEN foreign_key_violation THEN
          NULL; -- Tentará no próximo passo após as filhas serem apagadas
        WHEN OTHERS THEN
          NULL;
      END;
    END LOOP;
  END LOOP;

  -- 4. Excluir a empresa
  DELETE FROM public.companies WHERE id = p_company_id;

  -- 5. Limpar perfis órfãos (usuários sem nenhuma outra empresa e que não são SaaS Admin)
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
