-- Migration: 20260820183000_admin_delete_company_rpc.sql
-- Description: Cria RPC administrativa transacional para exclusão de empresa pelo SaaS Admin com execução dinâmica e segura

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
  t TEXT;
  v_tables TEXT[] := ARRAY[
    -- Tabelas filhas de caixa e vendas
    'cash_counts',
    'cash_register_advances',
    'cash_register_audits',
    'cash_shortages',
    'operator_discrepancies',
    'cash_movements',
    'quote_deposits',
    'cash_registers',
    'company_cash_movements',
    'company_cash',
    'employee_commissions',
    'financial_operation_keys',
    'accounts_receivable',
    'expenses',
    'sale_taxes',
    'sale_items',
    'sales',
    'quote_items',
    'quotes',
    'service_appointments',
    'measurement_photos',
    'measurement_checklist',
    'measurement_items',
    'site_measurements',
    'ordens_servico',
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
    'purchase_order_items',
    'purchase_orders',
    'nota_fiscal_itens',
    'notas_fiscais',
    'company_tax_config',
    'clients',
    'employee_invites',
    'employees',
    'company_notification_settings',
    'company_notifications',
    'company_payment_settings',
    'company_sales_goals',
    'company_security_settings',
    'company_subscriptions',
    'role_permissions',
    'audit_logs',
    'support_attachments',
    'support_messages',
    'support_tickets',
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

  -- 2. Coletar usuários vinculados
  SELECT COALESCE(array_agg(user_id), '{}')
  INTO v_user_ids
  FROM public.user_companies
  WHERE company_id = p_company_id;

  -- 3. Limpar tabelas com company_id (resiliente a tabelas/colunas opcionais)
  FOREACH t IN ARRAY v_tables LOOP
    BEGIN
      -- Tenta deletar por company_id direto
      EXECUTE format('DELETE FROM public.%I WHERE company_id = $1', t) USING p_company_id;
    EXCEPTION
      WHEN undefined_column THEN
        -- Se não tiver company_id, tenta por subconsulta para tabelas filhas específicas
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
        NULL; -- Tabela não existe nesta instalação
      WHEN OTHERS THEN
        NULL; -- Ignora e continua
    END;
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
