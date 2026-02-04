
# Plano: Garantir que Linhas, Categorias e Itens Criados pelo Admin Fiquem Disponíveis em Todo o Sistema

## Diagnóstico do Problema

Ao analisar o código, identifiquei a causa raiz:

1. O modal **"Registrar Entrada/Saída"** (`RegistrarMovimentoDialog`) extrai as linhas disponíveis a partir do campo `item_template.linha` dos itens **já existentes no estoque**
2. Se uma linha como "Forro PVC" ou "Chaparia" foi criada pelo admin mas **nenhum item ainda usa essa linha**, ela não aparece nos filtros
3. Isso contrasta com o `AddStockDialog` que usa corretamente o hook `useProductLinhas()` para buscar **todas as linhas cadastradas oficialmente**

**Dados do banco de dados:**
- `product_linhas`: "Forro PVC", "Chaparia", "Gold", "Suprema", etc.
- `item_templates.linha`: "Chaparia" (1 item), "Gold" (51 itens), mas "Forro PVC" NÃO existe em nenhum item ainda

## Solução Proposta

Modificar o `RegistrarMovimentoDialog` para usar **as linhas oficiais da tabela** (`useProductLinhas`) em vez de extrair das propriedades dos itens. Isso garante que:

- Toda linha criada pelo admin aparecerá imediatamente nos filtros
- Consistência em todo o sistema
- O mesmo padrão já usado em `AddStockDialog`

## Mudanças Técnicas

### 1. `src/components/estoque/RegistrarMovimentoDialog.tsx`

**Adicionar import do hook:**
```typescript
import { useProductLinhas } from '@/hooks/useProductLinhas';
```

**Usar o hook para buscar linhas oficiais:**
```typescript
// No início do componente:
const { data: productLinhas } = useProductLinhas();
```

**Substituir a lógica de extração de linhas:**

ANTES (extrai apenas das propriedades dos itens existentes):
```typescript
const availableLinhas = useMemo(() => {
  const linhas = new Set<string>();
  stockItems.forEach(item => {
    if (item.item_template?.linha) {
      linhas.add(item.item_template.linha);
    }
  });
  return Array.from(linhas).sort();
}, [stockItems]);
```

DEPOIS (busca todas as linhas oficiais do banco):
```typescript
const availableLinhas = useMemo(() => {
  // Linhas oficiais da tabela product_linhas
  const oficialLinhas = productLinhas?.map(l => l.name) || [];
  
  // Também incluir linhas existentes nos itens (para compatibilidade com dados legados)
  const linhasFromItems = new Set<string>();
  stockItems.forEach(item => {
    if (item.item_template?.linha) {
      linhasFromItems.add(item.item_template.linha);
    }
  });
  
  // Merge: oficiais + legados (sem duplicatas)
  const allLinhas = new Set([...oficialLinhas, ...linhasFromItems]);
  return Array.from(allLinhas).sort();
}, [productLinhas, stockItems]);
```

### 2. `src/pages/Estoque.tsx` (opcional mas recomendado)

Aplicar o mesmo padrão nos filtros da página principal de Estoque:

**Adicionar import:**
```typescript
import { useProductLinhas } from '@/hooks/useProductLinhas';
```

**Buscar linhas oficiais:**
```typescript
const { data: productLinhas } = useProductLinhas();

// Merge linhas oficiais com as existentes em item_templates
const linhas = useMemo(() => {
  const oficialLinhas = productLinhas?.map(l => l.name) || [];
  const uniqueLinhas = new Set<string>();
  
  // Adicionar oficiais
  oficialLinhas.forEach(l => uniqueLinhas.add(l));
  
  // Adicionar dos templates (compatibilidade)
  itemTemplates.forEach((t) => {
    if (t.linha) uniqueLinhas.add(t.linha);
  });
  
  return Array.from(uniqueLinhas).sort();
}, [productLinhas, itemTemplates]);
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `RegistrarMovimentoDialog.tsx` | Usar `useProductLinhas()` para popular seletor de linhas |
| `Estoque.tsx` | Usar `useProductLinhas()` no filtro de linhas da página principal |

## Resultado Esperado

Após as alterações:
- Toda linha criada pelo admin em `/admin/categories` aparecerá imediatamente nos filtros de:
  - Modal "Registrar Entrada"
  - Modal "Registrar Saída"
  - Filtros da página de Estoque
- O mesmo padrão será usado em todo o sistema (consistência)
- Compatibilidade mantida com dados legados (linhas existentes nos item_templates que não estão na tabela oficial)
