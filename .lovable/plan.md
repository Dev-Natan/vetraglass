

# Plano: Otimização da Página de Empresas (AdminCompanies)

## Problema Identificado

A página de empresas está demorando muito para carregar devido a **múltiplas consultas sequenciais ao banco de dados**:

| Componente | Consultas | Tipo |
|------------|-----------|------|
| AuthContext | 3 consultas | saas_admins, profiles, user_companies |
| useAdminStats | 8 consultas | companies, item_templates (2x), product_templates, product_linhas, categories, tickets, profiles |
| AdminCompanies | 2 consultas | companies, user_companies |
| **Total** | **13 consultas** | Executadas em sequência |

Cada consulta espera a anterior terminar, causando o efeito de "cascata" que torna o carregamento lento.

---

## Solucao Proposta

### 1. Converter useAdminStats para Consultas Paralelas

**Antes:** 8 consultas executadas uma após a outra
**Depois:** 8 consultas executadas simultaneamente com `Promise.all()`

```typescript
// Exemplo da mudança
const [
  { count: companiesCount },
  { count: itemTemplatesCount },
  { count: productTemplatesCount },
  // ...
] = await Promise.all([
  supabase.from("companies").select("*", { count: "exact", head: true }),
  supabase.from("item_templates").select("*", { count: "exact", head: true }),
  supabase.from("product_templates").select("*", { count: "exact", head: true }),
  // ...
]);
```

**Ganho estimado:** De ~2-3 segundos para ~300-500ms

---

### 2. Otimizar AdminCompanies com JOIN no Banco

**Antes:** 2 consultas separadas + processamento no frontend
```typescript
// Consulta 1: Busca empresas
const { data: companiesData } = await supabase.from('companies').select('*');

// Consulta 2: Busca user_companies (todos!)
const { data: userCountsData } = await supabase.from('user_companies').select('company_id');

// Processa no frontend para contar usuarios
```

**Depois:** 1 consulta com agregacao usando subquery
```typescript
const { data: companiesData } = await supabase
  .from('companies')
  .select(`
    id, name, cnpj, email, phone, address, logo_url, created_at,
    user_companies(count)
  `)
  .order('created_at', { ascending: false });
```

**Ganho estimado:** Reduz 2 consultas para 1

---

### 3. Usar React Query com staleTime Adequado

A pagina ja usa state local, mas migrar para React Query permitira:
- Cache automatico entre navegacoes
- Revalidacao inteligente em background
- Estado de loading mais elegante

---

### 4. Adicionar Paginacao (para escalar)

Embora hoje existam apenas 6 empresas, preparar o sistema para crescer:
- Limite inicial de 50 empresas por pagina
- Paginacao server-side usando `.range(from, to)`

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/hooks/useAdminStats.ts` | Paralelizar consultas com Promise.all |
| `src/pages/admin/AdminCompanies.tsx` | Usar agregacao SQL + React Query |

---

## Impacto Esperado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Consultas ao banco | 13+ sequenciais | 3-4 paralelas |
| Tempo de carregamento | 2-4 segundos | < 500ms |
| Experiencia do usuario | Tela de loading prolongada | Carregamento instantaneo |

---

## Detalhes Tecnicos

### useAdminStats.ts - Paralelizacao

```typescript
queryFn: async (): Promise<AdminStats> => {
  const [
    companiesResult,
    itemTemplatesResult,
    activeItemTemplatesResult,
    productTemplatesResult,
    productLinhasResult,
    categoriesResult,
    ticketsResult,
    usersResult,
  ] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("item_templates").select("*", { count: "exact", head: true }),
    supabase.from("item_templates").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("product_templates").select("*", { count: "exact", head: true }),
    supabase.from("product_linhas").select("*", { count: "exact", head: true }),
    supabase.from("product_categories").select("*", { count: "exact", head: true }),
    supabase.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting"]),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  return {
    companiesCount: companiesResult.count || 0,
    activeCompaniesCount: companiesResult.count || 0,
    itemTemplatesCount: itemTemplatesResult.count || 0,
    productTemplatesCount: productTemplatesResult.count || 0,
    productLinhasCount: productLinhasResult.count || 0,
    categoriesCount: categoriesResult.count || 0,
    openTicketsCount: ticketsResult.count || 0,
    usersCount: usersResult.count || 0,
  };
}
```

### AdminCompanies.tsx - Migracao para React Query + JOIN

```typescript
import { useQuery } from '@tanstack/react-query';

// Hook dedicado
const { data: companies = [], isLoading } = useQuery({
  queryKey: ['admin-companies'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('companies')
      .select(`
        id, name, cnpj, email, phone, address, logo_url, created_at,
        user_companies(count)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data?.map(company => ({
      ...company,
      user_count: company.user_companies?.[0]?.count || 0
    })) || [];
  },
  enabled: isSaasAdmin,
  staleTime: 1000 * 60 * 2, // Cache por 2 minutos
});
```

