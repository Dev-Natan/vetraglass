
# Plano de Otimização Completa do Módulo de Estoque

## Diagnóstico Atual

### Problemas Identificados

| Área | Problema | Impacto |
|------|----------|---------|
| **Performance** | 3 queries separadas no carregamento (stock, templates, prices) | Lentidão inicial |
| **Performance** | Lista renderiza sem memoização | Re-renders desnecessários |
| **Performance** | `select('*')` em company_stock | Transferência excessiva de dados |
| **UX** | Busca apenas por categoria | Difícil encontrar itens específicos |
| **UX** | Sem indicador visual de valor do estoque | Falta visão financeira |
| **Features** | Sem exportação de dados | Dificulta relatórios externos |
| **Features** | Alertas só mostram lista | Sem notificação proativa |
| **Features** | Sem código de barras/SKU | Dificulta gestão física |

---

## Estratégia de Otimização

### Fase 1: Performance (Impacto Imediato)

#### 1.1 Criar Hook Agregador de Estoque

**Arquivo NOVO:** `src/hooks/useStockData.ts`

Consolidar as 3 queries atuais em uma única execução paralela:

```text
ANTES (3 queries sequenciais ~1.5s):
  1. company_stock → aguarda
  2. item_templates → aguarda  
  3. company_item_prices → aguarda

DEPOIS (1 hook com Promise.all ~0.5s):
  Promise.all([
    fetchStock(),      ──┐
    fetchTemplates(),  ──┼── paralelo
    fetchPrices()      ──┘
  ])
```

Campos específicos ao invés de `select('*')`:
```typescript
// Stock: só campos necessários
.select('id, item_template_id, quantity, min_quantity, location, is_active, allow_fractional')

// Templates: só campos de exibição
.select('id, name, type, unit, image_url, linha')
```

#### 1.2 Memoizar Componente de Item

Criar componente `StockItemCard` com `React.memo()` para evitar re-renders:

```typescript
const StockItemCard = memo(function StockItemCard({ item, onEdit, onToggle }) {
  // ...render
}, (prev, next) => prev.item.id === next.item.id && prev.item.quantity === next.item.quantity);
```

#### 1.3 Virtualização para Listas Grandes

Implementar `@tanstack/react-virtual` quando estoque > 50 itens para renderizar apenas itens visíveis.

---

### Fase 2: Interface e Usabilidade

#### 2.1 Busca Avançada e Filtros

Adicionar ao topo da lista:
- **Campo de busca por nome** (já existe parcialmente, expandir)
- **Filtro por linha de produto**
- **Filtro por status** (com estoque baixo, normal, zerado)
- **Ordenação** (nome, quantidade, valor, última movimentação)

#### 2.2 KPIs Financeiros do Estoque

Adicionar cards de resumo no topo:

```text
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 📦 Total Itens  │ │ 💰 Valor Total  │ │ ⚠️ Estoque Baixo │ │ 📊 Giro Médio   │
│      127        │ │   R$ 45.230     │ │       8         │ │    12 dias      │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

Cálculos:
- **Valor Total**: Σ (quantidade × custo unitário)
- **Giro Médio**: Baseado em movimentações dos últimos 30 dias

#### 2.3 Visualização em Grid

Opção de alternar entre lista e grid visual:

```text
[Lista] [Grid]

Grid mode:
┌─────────┐ ┌─────────┐ ┌─────────┐
│  [IMG]  │ │  [IMG]  │ │  [IMG]  │
│ SU-007  │ │ SU-040  │ │ SU-123  │
│ 45 un   │ │ 12 un   │ │ 0 un ⚠️ │
└─────────┘ └─────────┘ └─────────┘
```

---

### Fase 3: Novas Funcionalidades

#### 3.1 Exportação para Excel

Botão "Exportar" que gera planilha com:
- Código/SKU do item
- Nome
- Categoria/Tipo
- Quantidade atual
- Quantidade mínima
- Localização
- Custo unitário
- Valor em estoque
- Status (ativo/inativo)

Usar biblioteca `exceljs` já instalada no projeto.

#### 3.2 Campo SKU/Código de Barras

Adicionar campo `sku` na tabela `company_stock` para código interno:
- Exibir na listagem
- Permitir busca por código
- Suporte futuro para leitor de código de barras

#### 3.3 Alertas Inteligentes de Reposição

Componente que mostra:
- Itens abaixo do mínimo
- Itens zerados
- Previsão de ruptura (baseado em consumo médio)
- Sugestão de quantidade a comprar

#### 3.4 Histórico de Movimentações por Item

No dialog de edição, adicionar aba com últimas movimentações do item específico:
- Data/hora
- Tipo (entrada/saída)
- Quantidade
- Motivo
- Usuário

---

## Arquivos a Modificar/Criar

### Fase 1 - Performance

| Arquivo | Ação |
|---------|------|
| `src/hooks/useStockData.ts` | **CRIAR** - Hook agregador |
| `src/pages/Estoque.tsx` | Usar novo hook, remover queries inline |
| `src/components/estoque/StockItemCard.tsx` | **CRIAR** - Componente memoizado |

### Fase 2 - UX

| Arquivo | Ação |
|---------|------|
| `src/components/estoque/StockKPIs.tsx` | **CRIAR** - Cards de resumo financeiro |
| `src/components/estoque/StockFilters.tsx` | **CRIAR** - Filtros avançados |
| `src/components/estoque/StockGridView.tsx` | **CRIAR** - Visualização em grid |
| `src/pages/Estoque.tsx` | Integrar novos componentes |

### Fase 3 - Features

| Arquivo | Ação |
|---------|------|
| `src/utils/exportStockToExcel.ts` | **CRIAR** - Função de exportação |
| `src/components/estoque/StockAlerts.tsx` | **CRIAR** - Alertas inteligentes |
| `src/components/estoque/ItemMovementsTab.tsx` | **CRIAR** - Histórico por item |
| `src/components/estoque/EditItemPriceDialog.tsx` | Adicionar aba de histórico |

### Migração de Banco (Opcional)

| Mudança | Descrição |
|---------|-----------|
| Adicionar `sku` em `company_stock` | Código interno do item |
| Adicionar `last_movement_at` em `company_stock` | Data da última movimentação |

---

## Resumo de Impactos Esperados

| Área | Métrica | Antes | Depois |
|------|---------|-------|--------|
| **Performance** | Tempo de carregamento | ~1.5s | ~0.5s |
| **Performance** | Re-renders por interação | Todos itens | Só alterados |
| **UX** | Tempo para encontrar item | 10-15s | 2-3s |
| **UX** | Visão financeira | Nenhuma | Completa |
| **Features** | Exportação | Manual | 1 clique |
| **Features** | Rastreabilidade | Básica | Completa |

---

## Ordem de Implementação

### Alta Prioridade (Impacto Imediato)
1. Hook agregador `useStockData`
2. Componente memoizado `StockItemCard`
3. KPIs financeiros do estoque
4. Filtros e busca avançada

### Média Prioridade (UX Aprimorada)
5. Exportação para Excel
6. Visualização em Grid
7. Histórico por item no dialog

### Baixa Prioridade (Features Avançadas)
8. Campo SKU/Código de barras (requer migração)
9. Alertas inteligentes com previsão
10. Virtualização para estoques grandes
