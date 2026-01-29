

# Plano: Desativar Cache Completamente (Zero Cache)

## Objetivo

Eliminar todos os mecanismos de cache do sistema para garantir que os dados sejam sempre buscados frescos do servidor, resolvendo problemas de sincronização entre telas.

---

## Alterações Necessárias

### 1. Remover PWA / Service Worker (`vite.config.ts`)

O Service Worker é o principal vilão - ele cacheia arquivos JS, CSS, HTML e até chamadas de API.

**Antes:**
```typescript
VitePWA({
  selfDestroying: mode === 'development',
  devOptions: { enabled: mode === 'development' },
  registerType: 'autoUpdate',
  workbox: {
    // Cache de assets e Supabase...
  }
})
```

**Depois:**
```typescript
// PWA COMPLETAMENTE REMOVIDO
// Comentar ou remover todo o bloco VitePWA
```

**Impacto:**
- Sem instalação como app
- Sem cache de arquivos
- Sem funcionamento offline
- Sempre versão mais recente

---

### 2. Limpar Service Workers Existentes (`src/main.tsx`)

Substituir a lógica de atualização por uma lógica de remoção completa de SWs antigos:

**Antes:**
```typescript
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {...});
  // Lógica de atualização periódica
}
```

**Depois:**
```typescript
// Desregistrar todos os Service Workers existentes
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
  // Limpar caches do Service Worker
  if ('caches' in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    });
  }
}
```

---

### 3. Desativar Cache do React Query (`src/lib/queryConfig.ts`)

**Antes:**
```typescript
queries: {
  staleTime: CACHE_TIMES.SEMI_STATIC.staleTime,  // 2 minutos
  gcTime: CACHE_TIMES.SEMI_STATIC.gcTime,        // 5 minutos
  refetchOnWindowFocus: false,
  refetchOnMount: true,
}
```

**Depois:**
```typescript
queries: {
  staleTime: 0,           // Dados sempre "stale"
  gcTime: 0,              // Sem garbage collection cache
  refetchOnWindowFocus: true,   // Recarregar ao focar
  refetchOnMount: 'always',     // Sempre recarregar
  refetchOnReconnect: true,
}
```

---

### 4. Limpeza de Storage no Logout (`src/contexts/AuthContext.tsx`)

Já está parcialmente implementado, mas vamos garantir limpeza completa:

**Adicionar no signOut:**
```typescript
// Limpar TODO o localStorage (não só currentCompanyId)
localStorage.clear();
sessionStorage.clear();
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `vite.config.ts` | Remover/comentar plugin VitePWA |
| `src/main.tsx` | Desregistrar SWs e limpar caches |
| `src/lib/queryConfig.ts` | staleTime: 0, gcTime: 0 |
| `src/contexts/AuthContext.tsx` | localStorage.clear() no logout |

---

## Considerações

**Prós:**
- Dados sempre atualizados
- Zero problemas de sincronização
- Comportamento previsível
- Usuário sempre vê versão mais recente

**Contras:**
- Mais requisições ao servidor
- Sem funcionamento offline
- App não pode ser "instalado" no celular
- Carregamento pode parecer mais lento

---

## Resultado Esperado

Após as alterações:
1. Produtos desativados desaparecem imediatamente dos orçamentos
2. Mudanças são refletidas instantaneamente em todas as telas
3. Não há mais dados em cache causando inconsistências
4. Sistema sempre busca dados frescos do servidor

