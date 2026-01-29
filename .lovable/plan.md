

# Plano de Otimização SEM Cache

## Diagnóstico: Por que está lento?

O sistema faz **muitas requisições ao banco**, todas em **sequência** ou **paralelas não otimizadas**:

### Contagem de Queries por Página

| Página | Componentes | Queries |
|--------|-------------|---------|
| Login (AuthContext) | 3 consultas sequenciais | ~1-2s |
| Dashboard (Index) | 14 componentes com queries independentes | ~15-20 queries |
| AdminCompanies | 1 query otimizada (já feito) | OK |

### Dashboard - Detalhamento das Queries

```text
ProductionKPIs ............ 3 queries (OS total, in_progress, overdue)
FinancialOSSummary ........ 5 queries (deposits, receivables, pending, expenses, completed)
ProductionBlockedAlert .... 1 query
PendingPurchasesAlert ..... 1 query
FinancialAlerts ........... 3 queries (expenses, overdue, receivables today)
TodayTasksWidget .......... 2 queries (OS today, appointments)
OSDueTodayWidget .......... 1 query
SystemReminders ........... 1 query
ProductionFlowChart ....... 1 query
RevenueVsCostChart ........ 1 query
RecentActivity ............ 3 queries (sales, quotes, orders)
─────────────────────────────────────────
TOTAL                       ~22 queries no Dashboard
```

---

## Estratégias SEM Cache

### 1. Lazy Loading Total (Maior Impacto)

Converter as 10 páginas core para lazy loading:

**Antes:** Bundle inicial ~600KB (10 páginas + dependências)
**Depois:** Bundle inicial ~150KB (só Landing + Auth)

```typescript
// src/App.tsx - Carregar sob demanda
const Index = lazy(() => import("./pages/Index"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Produtos = lazy(() => import("./pages/Produtos"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const OrdensServico = lazy(() => import("./pages/OrdensServico"));
const CaixaVendas = lazy(() => import("./pages/CaixaVendas"));
const Estoque = lazy(() => import("./pages/Estoque"));
const PlanoCorte = lazy(() => import("./pages/PlanoCorte"));
const ProdutosLinha = lazy(() => import("./pages/ProdutosLinha"));
```

| Métrica | Antes | Depois |
|---------|-------|--------|
| Bundle inicial | ~600KB | ~150KB |
| Tempo de login | 2-3s | 0.5-1s |
| Trade-off | N/A | 100-200ms por módulo na 1ª vez |

---

### 2. Paralelizar Queries do AuthContext

As 3 queries do login são executadas **em sequência**:

```typescript
// ATUAL: Sequencial (~1.5s total)
const saasAdmin = await supabase.from('saas_admins')...  // 300ms
const profile = await supabase.from('profiles')...       // 300ms
const companies = await supabase.from('user_companies')... // 300ms

// OTIMIZADO: Paralelo (~400ms total)
const [saasAdmin, profile, companies] = await Promise.all([
  supabase.from('saas_admins').select('id').eq('user_id', userId).maybeSingle(),
  supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
  supabase.from('user_companies').select(`...`).eq('user_id', userId).eq('is_active', true),
]);
```

| Métrica | Antes | Depois |
|---------|-------|--------|
| Login completo | 1.5-2s | 0.4-0.6s |
| Queries | 3 sequenciais | 3 paralelas |

---

### 3. Agregação de Dados do Dashboard

Criar uma **única função** que busca todos os dados em paralelo:

**Arquivo:** `src/hooks/useDashboardData.ts` (NOVO)

```typescript
export function useDashboardData() {
  const { currentCompany } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard-all', currentCompany?.id],
    queryFn: async () => {
      // Todas as 22 queries executadas em paralelo (Promise.all)
      const [
        osStats,
        materialsStats,
        receivablesStats,
        financialData,
        blockedOrders,
        pendingPurchases,
        financialAlerts,
        todayTasks,
        todayOS,
        systemReminders,
        productionFlow,
        revenueVsCost,
        recentActivity,
      ] = await Promise.all([
        fetchOSStats(companyId),
        fetchMaterialsStats(companyId),
        fetchReceivablesStats(companyId),
        fetchFinancialOSSummary(companyId),
        fetchBlockedOrders(companyId),
        fetchPendingPurchases(companyId),
        fetchFinancialAlerts(companyId),
        fetchTodayTasks(companyId),
        fetchTodayOS(companyId),
        fetchSystemReminders(companyId),
        fetchProductionFlow(companyId),
        fetchRevenueVsCost(companyId),
        fetchRecentActivity(companyId),
      ]);
      
      return { osStats, materialsStats, ... };
    },
  });
}
```

**Impacto:** De 22 queries sequenciais (~5-6s) para 22 paralelas (~0.5-1s)

---

### 4. Componentes Recebem Props (Não Fazem Queries)

**Antes:** Cada componente faz sua própria query
**Depois:** Dashboard distribui dados como props

```typescript
// Index.tsx (Antes)
<ProductionKPIs />  // Faz 3 queries internas
<FinancialOSSummary />  // Faz 5 queries internas

// Index.tsx (Depois)
const { data } = useDashboardData();  // 1 hook, todas queries paralelas

<ProductionKPIs data={data.osStats} />  // Só renderiza
<FinancialOSSummary data={data.financialData} />  // Só renderiza
```

---

### 5. Memoização de Componentes de Lista

Evita re-renders desnecessários em listas:

```typescript
// Componentes que renderizam múltiplos itens
export const QuoteCard = memo(function QuoteCard({ quote, onEdit }) {
  // ...
}, (prev, next) => prev.quote.id === next.quote.id);

export const OSCard = memo(function OSCard({ os }) {
  // ...
}, (prev, next) => prev.os.id === next.os.id);

export const ClientCard = memo(function ClientCard({ client }) {
  // ...
});
```

---

### 6. Select Específico (Menos Dados na Rede)

Buscar apenas campos necessários:

```typescript
// Antes: Traz TODOS os campos
const { data } = await supabase.from('quotes').select('*');

// Depois: Só campos usados
const { data } = await supabase
  .from('quotes')
  .select('id, quote_number, customer_name, status, final_amount, created_at');
```

**Impacto:** 30-50% menos dados transferidos

---

## Resumo de Impactos

| Otimização | Impacto no Tempo | Complexidade |
|------------|------------------|--------------|
| Lazy Loading Total | -75% bundle inicial | Baixa |
| AuthContext Paralelo | -60% tempo login | Baixa |
| Dashboard Agregado | -80% tempo dashboard | Média |
| Componentes com Props | Menos re-fetches | Média |
| Memoização | Menos re-renders | Baixa |
| Select Específico | -30% transferência | Baixa |

---

## Prioridade de Implementação

### Fase 1 (Impacto Imediato)
1. **Lazy Loading Total** - `src/App.tsx`
2. **AuthContext Paralelo** - `src/contexts/AuthContext.tsx`

### Fase 2 (Dashboard Rápido)
3. **useDashboardData** - NOVO hook agregador
4. **Index.tsx** - Usar hook e distribuir props
5. **Componentes Dashboard** - Receber props

### Fase 3 (Refinamentos)
6. **Memoização** - Componentes de lista
7. **Select Específico** - Queries otimizadas

---

## Arquivos a Modificar

### Fase 1 (2 arquivos)
| Arquivo | Mudança |
|---------|---------|
| `src/App.tsx` | Lazy loading nas 10 páginas core |
| `src/contexts/AuthContext.tsx` | Promise.all nas 3 queries |

### Fase 2 (16 arquivos)
| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useDashboardData.ts` | **NOVO** - Agregador |
| `src/pages/Index.tsx` | Usar hook, distribuir props |
| 14 componentes dashboard | Receber data via props |

### Fase 3 (Incremental)
| Arquivo | Mudança |
|---------|---------|
| Componentes de Cards | React.memo() |
| Queries diversas | select() específico |

