
# Análise de Segurança do Login - Diagnóstico e Correções

## Diagnóstico: Por que o Sistema "Loga Sozinho"?

### Comportamento Identificado

O sistema **não está logando sozinho** - ele está **restaurando uma sessão válida** armazenada no navegador. Isso é comportamento esperado, mas pode ser problemático dependendo das necessidades de segurança.

```text
Fluxo Atual:
┌──────────────────┐    ┌─────────────────────┐    ┌─────────────────┐
│ Usuário abre app │ → │ Supabase verifica   │ → │ Se token válido │
│                  │    │ localStorage        │    │ → Login auto    │
└──────────────────┘    └─────────────────────┘    └─────────────────┘
```

### Causa Raiz

| Configuração | Valor Atual | Impacto |
|--------------|-------------|---------|
| `persistSession` | `true` | Sessão salva no localStorage |
| `autoRefreshToken` | `true` | Token renovado automaticamente |
| Token JWT expira | ~1 hora | Mas é renovado antes de expirar |
| Timeout de inatividade | **NÃO IMPLEMENTADO** | Configuração existe mas não funciona |

### Evidências nos Logs

```text
Console: "Auth event: SIGNED_IN Session: true"
         ↳ Indica restauração de sessão existente, não login novo

Auth Logs: "Session not found" no logout
         ↳ Indica tentativa de logout com sessão já expirada/inválida
```

---

## Vulnerabilidades de Segurança Identificadas

### CRÍTICO: Timeout de Inatividade Não Funciona

A página `ConfiguracoesSeguranca.tsx` permite configurar `session_timeout_minutes`, mas **não há código que implemente essa funcionalidade**.

```text
Configuração existe:     session_timeout_minutes: 480 (8 horas)
Implementação:           ❌ AUSENTE

Resultado: Usuários nunca são deslogados por inatividade,
           mesmo que o admin configure 1 hora de timeout.
```

### MÉDIO: Sessão Persistente Indefinidamente

Enquanto o token for renovado (usuário com aba aberta), a sessão persiste para sempre.

### BAIXO: localStorage Acessível

Tokens armazenados em localStorage podem ser acessados por scripts maliciosos (XSS).

---

## Plano de Correção

### Fase 1: Implementar Timeout de Inatividade (CRÍTICO)

Criar um hook que monitora atividade do usuário e força logout após inatividade.

**Arquivo NOVO:** `src/hooks/useSessionTimeout.ts`

```typescript
// Lógica:
// 1. Busca session_timeout_minutes da company_security_settings
// 2. Monitora eventos de interação (click, keypress, mousemove)
// 3. Reseta timer a cada interação
// 4. Quando timer expira → força logout
```

**Integração:** Adicionar hook ao `MainLayout.tsx` para todas as páginas protegidas.

### Fase 2: Melhorar Segurança da Sessão

| Melhoria | Implementação |
|----------|---------------|
| Invalidar sessões antigas | Limpar tokens antigos no login |
| Detectar sessões em múltiplos dispositivos | Alertar usuário (opcional) |
| Logout em todas as abas | Usar broadcast channel API |

### Fase 3: Log de Auditoria Aprimorado

Registrar eventos de segurança:
- Login com restauração de sessão
- Logout por timeout
- Tentativas de acesso com sessão expirada

---

## Arquivos a Criar/Modificar

### Fase 1 - Timeout de Inatividade

| Arquivo | Ação |
|---------|------|
| `src/hooks/useSessionTimeout.ts` | **CRIAR** - Hook de monitoramento |
| `src/components/layout/MainLayout.tsx` | Integrar hook |
| `src/components/layout/AdminLayout.tsx` | Integrar hook |

### Fase 2 - Melhorias de Sessão (Opcional)

| Arquivo | Ação |
|---------|------|
| `src/contexts/AuthContext.tsx` | Adicionar lógica de sincronização entre abas |

---

## Implementação Técnica do Hook

```typescript
// useSessionTimeout.ts

export function useSessionTimeout() {
  const { signOut, currentCompany } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  // Buscar configuração de timeout da empresa
  const { data: settings } = useQuery({
    queryKey: ['security-settings-timeout', currentCompany?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_security_settings')
        .select('session_timeout_minutes')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      return data?.session_timeout_minutes ?? 480; // 8h default
    },
    enabled: !!currentCompany?.id,
  });

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    const timeoutMs = (settings ?? 480) * 60 * 1000;
    timeoutRef.current = setTimeout(async () => {
      toast.warning('Sessão expirada por inatividade');
      await signOut();
    }, timeoutMs);
  }, [settings, signOut]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    events.forEach(event => 
      window.addEventListener(event, resetTimer, { passive: true })
    );
    
    resetTimer(); // Iniciar timer
    
    return () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer]);
}
```

---

## Resposta à Pergunta Original

### "O sistema está logando sozinho?"

**Não exatamente.** O que acontece é:

1. Usuário faz login uma vez
2. Token é salvo no localStorage
3. Ao reabrir o app, Supabase encontra o token válido
4. Sistema restaura a sessão automaticamente

**Isso é comportamento padrão e esperado**, mas pode ser ajustado:

| Opção | Como Fazer |
|-------|------------|
| **Desabilitar persistência** | Mudar `persistSession: false` no client (não recomendado para UX) |
| **Implementar timeout** | Fase 1 deste plano (RECOMENDADO) |
| **Exigir login a cada X horas** | Forçar renovação de sessão periodicamente |

---

## Resumo de Impactos

| Correção | Segurança | UX | Complexidade |
|----------|-----------|-----|--------------|
| Timeout de inatividade | Alta | Média (pode incomodar) | Baixa |
| Logout multi-aba | Média | Boa | Média |
| Auditoria aprimorada | Informativa | N/A | Baixa |

---

## Recomendação

Implementar a **Fase 1 (Timeout de Inatividade)** imediatamente, pois:
- A configuração já existe na interface mas não funciona
- É expectativa do usuário que funcione
- Resolve o problema de "sessão eterna"
