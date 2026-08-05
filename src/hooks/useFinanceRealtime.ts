import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Tabelas que impactam qualquer número exibido no módulo Financeiro.
 * Qualquer INSERT/UPDATE/DELETE em uma delas invalida as queries do módulo,
 * eliminando a necessidade de F5 após movimentar caixa ou conta bancária.
 */
const WATCHED_TABLES = [
  'cash_movements',
  'company_cash_movements',
  'company_cash',
  'cash_registers',
  'bank_accounts',
  'expenses',
  'accounts_receivable',
  'quote_deposits',
  'sales',
] as const;

/** Chaves de query recalculadas quando algo muda. */
const INVALIDATED_KEYS = [
  'financial-stats',
  'financial-chart-data',
  'financial-delinquency',
  'accounts-receivable',
  'payables',
  'today-dues',
  'cash-movements',
  'company-cash',
  'operational-drawer-balance',
  'drawer-balance',
  'bank-accounts',
  'sales-financeiro-audit',
  'quote-sales-financials',
  'quote-receivables',
  'quote-financial-movements',
  'quote-all-deposits',
  'ordem-servico-for-quote',
];

export function useFinanceRealtime(): void {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const companyId = currentCompany?.id;
    if (!companyId) return;

    const invalidateAll = () => {
      INVALIDATED_KEYS.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [key], refetchType: 'all' });
      });
    };

    const channel = supabase.channel(`finance-realtime-${companyId}`);

    WATCHED_TABLES.forEach((table) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `company_id=eq.${companyId}` },
        invalidateAll,
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);
}
