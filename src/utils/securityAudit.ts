import { supabase } from '@/integrations/supabase/client';

export type SecurityEventType = 
  | 'session_restored'
  | 'session_timeout'
  | 'manual_logout'
  | 'cross_tab_logout'
  | 'login_success'
  | 'login_failed'
  | 'password_changed';

interface SecurityAuditParams {
  event: SecurityEventType;
  userId?: string;
  companyId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra eventos de segurança no log de auditoria
 */
export async function logSecurityEvent({
  event,
  userId,
  companyId,
  metadata = {}
}: SecurityAuditParams): Promise<void> {
  try {
    // Anonymous login failures cannot be written from the browser. Keeping anon
    // denied is intentional; server-side auth telemetry owns that event class.
    if (!userId || event === 'login_failed') return;

    // Não bloquear a UI esperando o log
    const auditMetadata = {
      ...metadata,
      user_agent: navigator.userAgent,
      timestamp_local: new Date().toISOString(),
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
    };

    // Fire and forget - não bloqueia a execução
    supabase
      .rpc('log_authenticated_security_event', {
        _event: event,
        _company_id: companyId || undefined,
        _metadata: auditMetadata,
      })
      .then(({ error }) => {
        if (error) {
          console.warn('Falha ao registrar evento de segurança:', error.message);
        }
      });
  } catch (error) {
    // Nunca deixar erro de log afetar a aplicação
    console.warn('Erro ao registrar auditoria:', error);
  }
}

/**
 * Registra restauração de sessão (auto-login)
 */
export function logSessionRestored(userId: string, companyId?: string): void {
  logSecurityEvent({
    event: 'session_restored',
    userId,
    companyId,
    metadata: { 
      source: 'localStorage',
      description: 'Sessão restaurada automaticamente do armazenamento local'
    }
  });
}

/**
 * Registra timeout de sessão por inatividade
 */
export function logSessionTimeout(userId: string, companyId?: string, inactiveMinutes?: number): void {
  logSecurityEvent({
    event: 'session_timeout',
    userId,
    companyId,
    metadata: { 
      inactive_minutes: inactiveMinutes,
      description: 'Sessão encerrada por inatividade'
    }
  });
}

/**
 * Registra logout manual do usuário
 */
export function logManualLogout(userId: string, companyId?: string): void {
  logSecurityEvent({
    event: 'manual_logout',
    userId,
    companyId,
    metadata: { 
      description: 'Usuário realizou logout manualmente'
    }
  });
}

/**
 * Registra logout propagado de outra aba
 */
export function logCrossTabLogout(userId: string, companyId?: string): void {
  logSecurityEvent({
    event: 'cross_tab_logout',
    userId,
    companyId,
    metadata: { 
      description: 'Logout sincronizado de outra aba do navegador'
    }
  });
}

/**
 * Registra login bem-sucedido
 */
export function logLoginSuccess(userId: string, email: string): void {
  logSecurityEvent({
    event: 'login_success',
    userId,
    metadata: { 
      email,
      description: 'Login realizado com sucesso'
    }
  });
}

/**
 * Registra tentativa de login falha
 */
export function logLoginFailed(email: string, reason: string): void {
  logSecurityEvent({
    event: 'login_failed',
    metadata: { 
      email,
      reason,
      description: 'Tentativa de login falhou'
    }
  });
}
