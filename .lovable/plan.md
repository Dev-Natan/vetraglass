

## Objetivo
Configurar o PWA para ser menos agressivo no cache, priorizando sempre buscar atualizações do servidor antes de usar arquivos em cache.

---

## Mudanças Técnicas

**Arquivo**: `vite.config.ts`

### 1. Alterar estratégia de cache do Workbox

| Configuração | Antes | Depois |
|--------------|-------|--------|
| `runtimeCaching` handler | `NetworkFirst` (apenas Supabase) | `NetworkFirst` para **todos** os recursos |
| `skipWaiting` | não definido | `true` (ativa SW imediatamente) |
| `clientsClaim` | não definido | `true` (assume controle de abas abertas) |

### 2. Adicionar cache-busting para assets

```text
workbox: {
  skipWaiting: true,          // ← NOVO: Ativa o novo SW imediatamente
  clientsClaim: true,         // ← NOVO: Assume controle de todas as abas
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  runtimeCaching: [
    {
      urlPattern: /\.(?:js|css|html)$/i,      // ← NOVO: Arquivos principais
      handler: 'NetworkFirst',                 // ← Busca servidor primeiro
      options: {
        cacheName: 'app-assets',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60  // 1 hora (era 24h para Supabase)
        },
        networkTimeoutSeconds: 3  // ← NOVO: Timeout de 3s antes de usar cache
      }
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 60 * 60  // Reduzido de 24h para 1h
        },
        networkTimeoutSeconds: 5
      }
    }
  ]
}
```

---

## Comportamento Esperado

```text
┌─────────────────────────────────────────────────────────┐
│  FLUXO DE CARREGAMENTO                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Usuário abre o app                                    │
│           │                                             │
│           ▼                                             │
│   ┌───────────────┐                                     │
│   │ Busca servidor│ ◀── Prioridade 1                    │
│   └───────┬───────┘                                     │
│           │                                             │
│     Online?                                             │
│    ┌──────┴──────┐                                      │
│    │ SIM         │ NÃO                                  │
│    ▼             ▼                                      │
│  Versão       Cache local                               │
│  mais         (fallback)                                │
│  recente                                                │
│                                                         │
│  ✓ Atualizações aparecem imediatamente                  │
│  ✓ App ainda funciona offline                           │
│  ✓ Cache expira em 1 hora (antes: 24 horas)             │
└─────────────────────────────────────────────────────────┘
```

---

## Resumo das Alterações

| Item | Impacto |
|------|---------|
| `skipWaiting: true` | Service Worker atualiza instantaneamente |
| `clientsClaim: true` | Novas versões assumem controle imediato |
| `NetworkFirst` para JS/CSS/HTML | Sempre busca servidor primeiro |
| `networkTimeoutSeconds: 3` | Espera 3 segundos antes de usar cache |
| Cache reduzido para 1 hora | Versões antigas expiram mais rápido |

---

## Resultado

Após essa mudança:
- Você sempre verá a versão mais recente do modal ao recarregar a página
- O app ainda funcionará offline (usando cache como fallback)
- Não precisará mais limpar cache manualmente

