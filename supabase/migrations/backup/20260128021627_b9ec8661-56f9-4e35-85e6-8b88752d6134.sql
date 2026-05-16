
-- LIMPEZA DE DADOS TRANSACIONAIS (tabelas verificadas)
-- Mantém: auth, profiles, empresas, produtos, preços, funcionários, configurações

-- 1. Limpar suporte
DELETE FROM public.support_attachments;
DELETE FROM public.support_messages;
DELETE FROM public.support_tickets;

-- 2. Limpar notificações e anúncios
DELETE FROM public.announcement_dismissals;
DELETE FROM public.company_notifications;
DELETE FROM public.system_reminders;

-- 3. Limpar comissões e taxas de venda
DELETE FROM public.employee_commissions;
DELETE FROM public.sale_taxes;

-- 4. Limpar vendas (antes de cash_registers)
DELETE FROM public.sale_items;
DELETE FROM public.sales;

-- 5. Limpar discrepâncias de operador
DELETE FROM public.operator_discrepancies;

-- 6. Limpar dados financeiros e caixa
DELETE FROM public.cash_counts;
DELETE FROM public.cash_register_advances;
DELETE FROM public.cash_register_audits;
DELETE FROM public.cash_shortages;
DELETE FROM public.cash_movements;
DELETE FROM public.company_cash_movements;
DELETE FROM public.cash_registers;

-- 7. Limpar contas a receber e despesas
DELETE FROM public.accounts_receivable;
DELETE FROM public.expenses;

-- 8. Limpar reservas e movimentos de estoque
DELETE FROM public.stock_reservations;
DELETE FROM public.stock_movements;

-- 9. Limpar consumo de materiais e plano de corte
DELETE FROM public.material_consumption;
DELETE FROM public.os_cutting_plan;
DELETE FROM public.os_materials;

-- 10. Limpar ordens de serviço
DELETE FROM public.os_photos;
DELETE FROM public.os_glass_projects;
DELETE FROM public.ordens_servico;

-- 11. Limpar orçamentos e itens
DELETE FROM public.quote_deposits;
DELETE FROM public.quote_price_revisions;
DELETE FROM public.quote_items;
DELETE FROM public.quotes;

-- 12. Limpar pedidos de compra
DELETE FROM public.purchase_order_items;
DELETE FROM public.purchase_orders;

-- 13. Limpar clientes
DELETE FROM public.clients;

-- 14. Limpar agendamentos e medições
DELETE FROM public.service_appointments;
DELETE FROM public.measurement_photos;
DELETE FROM public.measurement_checklist;
DELETE FROM public.measurement_items;
DELETE FROM public.site_measurements;

-- 15. Limpar notas fiscais
DELETE FROM public.nota_fiscal_itens;
DELETE FROM public.notas_fiscais;

-- 16. Limpar projetos de vidro
DELETE FROM public.glass_projects;

-- 17. Limpar audit logs e tentativas de login
DELETE FROM public.audit_logs;
DELETE FROM public.login_attempts;

-- 18. Resetar contadores de caixa da empresa (zerar saldo para fundo fixo)
UPDATE public.company_cash 
SET current_balance = fixed_fund, 
    last_movement_at = NULL,
    updated_at = now();

-- 19. Resetar quantidade de estoque para zero (manter itens cadastrados)
UPDATE public.company_stock SET quantity = 0, updated_at = now();
