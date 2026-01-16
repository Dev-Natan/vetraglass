import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

interface OnboardingStatus {
  hasClients: boolean;
  hasProducts: boolean;
  hasFirstSale: boolean;
  hasFirstQuote: boolean;
  isComplete: boolean;
  isLoading: boolean;
  isDismissed: boolean;
  dismissOnboarding: () => void;
}

const ONBOARDING_DISMISSED_KEY = 'vetraglass_onboarding_dismissed';

export function useOnboardingStatus(): OnboardingStatus {
  const { currentCompany, user } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (user?.id && currentCompany?.id) {
      const key = `${ONBOARDING_DISMISSED_KEY}_${user.id}_${currentCompany.id}`;
      const dismissed = localStorage.getItem(key) === 'true';
      setIsDismissed(dismissed);
    }
  }, [user?.id, currentCompany?.id]);

  const { data, isLoading } = useQuery({
    queryKey: ['onboarding-status', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) {
        return {
          hasClients: false,
          hasProducts: false,
          hasFirstSale: false,
          hasFirstQuote: false,
        };
      }

      // Parallel requests for better performance
      const [clientsRes, productsRes, salesRes, quotesRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', currentCompany.id)
          .limit(1),
        supabase
          .from('company_products')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', currentCompany.id)
          .limit(1),
        supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', currentCompany.id)
          .limit(1),
        supabase
          .from('quotes')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', currentCompany.id)
          .limit(1),
      ]);

      return {
        hasClients: (clientsRes.count || 0) > 0,
        hasProducts: (productsRes.count || 0) > 0,
        hasFirstSale: (salesRes.count || 0) > 0,
        hasFirstQuote: (quotesRes.count || 0) > 0,
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const dismissOnboarding = () => {
    if (user?.id && currentCompany?.id) {
      const key = `${ONBOARDING_DISMISSED_KEY}_${user.id}_${currentCompany.id}`;
      localStorage.setItem(key, 'true');
      setIsDismissed(true);
    }
  };

  const status = data || {
    hasClients: false,
    hasProducts: false,
    hasFirstSale: false,
    hasFirstQuote: false,
  };

  const isComplete = status.hasClients && status.hasProducts && status.hasFirstSale && status.hasFirstQuote;

  return {
    ...status,
    isComplete,
    isLoading,
    isDismissed,
    dismissOnboarding,
  };
}
