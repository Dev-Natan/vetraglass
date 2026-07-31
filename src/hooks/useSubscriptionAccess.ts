import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionSnapshot {
  subscription_status: string | null;
  trial_ends_at: string | null;
}

const ALLOWED_ACTIVE_STATUSES = ['active', 'ativo'];
const TRIAL_STATUSES = ['trial', 'trialing', 'teste'];

/**
 * Avalia se um snapshot de assinatura libera o acesso ao sistema.
 * Aceita reativações feitas pelo painel admin (ex.: status "trial" + nova data futura).
 */
export function isSubscriptionAllowed(snapshot: SubscriptionSnapshot | null | undefined): boolean {
  if (!snapshot) return false;

  const status = (snapshot.subscription_status ?? 'pending_payment').toLowerCase().trim();

  if (ALLOWED_ACTIVE_STATUSES.includes(status)) return true;

  if (TRIAL_STATUSES.includes(status)) {
    if (!snapshot.trial_ends_at) return false;
    const endsAt = new Date(snapshot.trial_ends_at).getTime();
    if (Number.isNaN(endsAt)) return false;
    return endsAt > Date.now();
  }

  return false;
}

/**
 * Busca sempre o estado atual da assinatura direto do banco (zero cache),
 * evitando que dados antigos em memória mantenham o usuário preso na tela de planos.
 */
export function useSubscriptionAccess(companyId: string | null | undefined, enabled = true) {
  const query = useQuery({
    queryKey: ['subscription-access', companyId],
    enabled: Boolean(companyId) && enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SubscriptionSnapshot | null> => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('subscription_status, trial_ends_at')
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;
      return (data as SubscriptionSnapshot | null) ?? null;
    },
  });

  return {
    ...query,
    allowed: query.data ? isSubscriptionAllowed(query.data) : false,
  };
}
