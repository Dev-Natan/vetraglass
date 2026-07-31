import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionSnapshot {
  subscription_status: string | null;
  trial_ends_at: string | null;
  /** Status da assinatura registrada no painel admin (company_subscriptions.status) */
  plan_status?: string | null;
  /** Nome do plano (ex.: "trial", "basico", "fiscal") */
  plan_name?: string | null;
  /** Vencimento do plano no painel admin (company_subscriptions.expires_at) */
  plan_expires_at?: string | null;
}

const ALLOWED_ACTIVE_STATUSES = ['active', 'ativo', 'active_paid'];
const TRIAL_STATUSES = ['trial', 'trialing', 'teste'];

/**
 * Compara datas de forma segura contra fuso horário: considera o dia inteiro
 * do vencimento como válido (expira somente ao final do dia local).
 */
function isFutureOrToday(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return false;
  const endOfDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999);
  return endOfDay.getTime() >= Date.now();
}

/**
 * Avalia se um snapshot de assinatura libera o acesso ao sistema.
 * Regra: a assinatura registrada no painel admin (company_subscriptions) tem
 * prioridade — se ela estiver "active"/"trial" com vencimento futuro, libera.
 */
export function isSubscriptionAllowed(snapshot: SubscriptionSnapshot | null | undefined): boolean {
  if (!snapshot) return false;

  const planStatus = (snapshot.plan_status ?? '').toLowerCase().trim();
  const planName = (snapshot.plan_name ?? '').toLowerCase().trim();
  const hasPlanRow = planStatus.length > 0;

  if (hasPlanRow) {
    const planActive = ALLOWED_ACTIVE_STATUSES.includes(planStatus);
    const planTrial = TRIAL_STATUSES.includes(planStatus) || TRIAL_STATUSES.includes(planName);

    // Sem data de expiração e status ativo => acesso liberado (plano vitalício/manual)
    if (planActive && !snapshot.plan_expires_at) return true;

    // Plano ativo (inclusive Trial) com vencimento futuro => acesso liberado
    if ((planActive || planTrial) && isFutureOrToday(snapshot.plan_expires_at)) return true;

    // Plano existente porém vencido/cancelado: ainda avaliamos o fallback abaixo.
  }

  const status = (snapshot.subscription_status ?? 'pending_payment').toLowerCase().trim();

  if (ALLOWED_ACTIVE_STATUSES.includes(status)) {
    // "active" puro em companies não deve liberar se o painel admin marcou vencido
    if (hasPlanRow && snapshot.plan_expires_at && !isFutureOrToday(snapshot.plan_expires_at)) return false;
    return true;
  }

  if (TRIAL_STATUSES.includes(status)) {
    return isFutureOrToday(snapshot.trial_ends_at);
  }

  return false;
}

/**
 * Busca sempre o estado atual da assinatura direto do banco (zero cache),
 * combinando companies + company_subscriptions (fonte usada pelo painel admin).
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

      const [companyRes, planRes] = await Promise.all([
        supabase
          .from('companies')
          .select('subscription_status, trial_ends_at')
          .eq('id', companyId)
          .maybeSingle(),
        supabase
          .from('company_subscriptions')
          .select('status, plan_name, expires_at')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (companyRes.error) throw companyRes.error;

      const company = companyRes.data as { subscription_status: string | null; trial_ends_at: string | null } | null;
      const plan = planRes.error ? null : (planRes.data as { status: string | null; plan_name: string | null; expires_at: string | null } | null);

      if (!company && !plan) return null;

      return {
        subscription_status: company?.subscription_status ?? null,
        trial_ends_at: company?.trial_ends_at ?? null,
        plan_status: plan?.status ?? null,
        plan_name: plan?.plan_name ?? null,
        plan_expires_at: plan?.expires_at ?? null,
      };
    },
  });

  // Revalida assim que a sessão do usuário muda (login/refresh de token),
  // garantindo que o payload da empresa esteja atualizado após o login.
  const { refetch } = query;
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (companyId && enabled) void refetch();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [companyId, enabled, refetch]);

  return {
    ...query,
    allowed: query.data ? isSubscriptionAllowed(query.data) : false,
  };
}
