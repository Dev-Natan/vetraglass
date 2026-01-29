import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logSessionTimeout, logCrossTabLogout } from '@/utils/securityAudit';

const DEFAULT_TIMEOUT_MINUTES = 480; // 8 horas
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
const THROTTLE_MS = 30000; // Atualiza timer a cada 30s de atividade (evita overhead)

export function useSessionTimeout() {
  const { signOut, currentCompany, user } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const throttleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Buscar configuração de timeout da empresa
  const { data: timeoutMinutes } = useQuery({
    queryKey: ['security-settings-timeout', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return DEFAULT_TIMEOUT_MINUTES;
      
      const { data } = await supabase
        .from('company_security_settings')
        .select('session_timeout_minutes')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      
      return data?.session_timeout_minutes ?? DEFAULT_TIMEOUT_MINUTES;
    },
    enabled: !!currentCompany?.id && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const handleTimeout = useCallback(async () => {
    console.log('[SessionTimeout] Sessão expirada por inatividade');
    
    // Registrar evento de segurança
    const inactiveMinutes = Math.round((Date.now() - lastActivityRef.current) / 60000);
    logSessionTimeout(user?.id || '', currentCompany?.id, inactiveMinutes);
    
    toast.warning('Sessão expirada', {
      description: 'Você foi desconectado por inatividade. Faça login novamente.',
      duration: 5000,
    });
    await signOut();
  }, [signOut, user?.id, currentCompany?.id]);

  const resetTimer = useCallback(() => {
    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Calcular tempo de timeout
    const minutes = timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
    const timeoutMs = minutes * 60 * 1000;

    // Configurar novo timeout
    timeoutRef.current = setTimeout(handleTimeout, timeoutMs);
    lastActivityRef.current = Date.now();
  }, [timeoutMinutes, handleTimeout]);

  const handleActivity = useCallback(() => {
    // Throttle para evitar muitas atualizações
    if (throttleRef.current) return;

    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
    }, THROTTLE_MS);

    resetTimer();
  }, [resetTimer]);

  // Sincronização entre abas via BroadcastChannel
  useEffect(() => {
    if (!user) return;

    // Criar canal para comunicação entre abas
    const channel = new BroadcastChannel('vetra-session');

    // Escutar eventos de outras abas
    channel.onmessage = (event) => {
      if (event.data.type === 'activity') {
        // Outra aba teve atividade, resetar timer localmente também
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        const minutes = timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES;
        timeoutRef.current = setTimeout(handleTimeout, minutes * 60 * 1000);
      } else if (event.data.type === 'logout') {
        // Outra aba fez logout, fazer logout aqui também
        logCrossTabLogout(user?.id || '', currentCompany?.id);
        signOut();
      }
    };

    // Notificar outras abas quando há atividade
    const originalHandleActivity = handleActivity;
    const handleActivityWithBroadcast = () => {
      originalHandleActivity();
      try {
        channel.postMessage({ type: 'activity' });
      } catch (e) {
        // Ignora erro se canal fechado
      }
    };

    // Adicionar listeners de atividade
    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, handleActivityWithBroadcast, { passive: true });
    });

    // Iniciar timer
    resetTimer();

    return () => {
      // Cleanup
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, handleActivityWithBroadcast);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
      
      channel.close();
    };
  }, [user, timeoutMinutes, resetTimer, handleActivity, handleTimeout, signOut]);

  // Retornar informações úteis para debug/UI
  return {
    timeoutMinutes: timeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES,
    lastActivity: lastActivityRef.current,
  };
}
