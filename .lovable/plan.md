
# Corrigir Categorias do Admin e Hierarquia de Itens

## Diagnóstico

### Problema 1: Categorias criadas no Admin não refletem no sistema

O filtro de categorias no estoque (`StockFilters.tsx`) usa valores **hardcoded**:

```tsx
// ATUAL - Valores fixos no código
<SelectItem value="profile">Perfis</SelectItem>
<SelectItem value="glass">Vidros</SelectItem>
<SelectItem value="sheet">Chaparias</SelectItem>
<SelectItem value="accessory">Acessórios</SelectItem>
<SelectItem value="service">Serviços</SelectItem>
```

Ao invés de usar os tipos dinâmicos da tabela `item_types` que o admin gerencia.

---

### Problema 2: Hierarquia Linha → Categoria → Item

Atualmente o `AddStockDialog.tsx` agrupa itens apenas por **Linha**:

```
Suprema/
├── Perfil SU-001
├── Perfil SU-007
└── Vidro Incolor

Temperados/
├── Vidro Fumê
└── Vidro Verde
```

O usuário quer a hierarquia completa:

```
Suprema/
├── Perfis/
│   ├── Perfil SU-001
│   └── Perfil SU-007
└── Vidros/
    └── Vidro Incolor

Temperados/
├── Vidros/
│   ├── Vidro Fumê
│   └── Vidro Verde
```

---

## Solução

### 1. Tornar o filtro de categorias dinâmico no Estoque

**Arquivo**: `src/components/estoque/StockFilters.tsx`

Atualmente o componente recebe `linhas` como props mas não recebe `itemTypes`. Vamos:

1. Adicionar nova prop `itemTypes` ao componente
2. Renderizar dinamicamente as categorias a partir dos tipos do banco
3. Usar as labels e cores dinâmicas

### 2. Atualizar a página de Estoque para passar os tipos

**Arquivo**: `src/pages/Estoque.tsx`

1. Importar e usar o hook `useItemTypes`
2. Passar os tipos dinâmicos para `StockFilters`

### 3. Implementar hierarquia Linha → Tipo → Item no AddStockDialog

**Arquivo**: `src/components/estoque/AddStockDialog.tsx`

1. Modificar o agrupamento para usar dois níveis
2. Primeiro agrupar por Linha
3. Dentro de cada Linha, agrupar por Tipo (usando o hook `useItemTypes` para labels)
4. Exibir os itens dentro de cada Tipo

---

## Detalhes Técnicos

### Modificação em StockFilters.tsx

```tsx
// ADICIONAR nova prop
interface StockFiltersProps {
  // ...props existentes
  itemTypes?: Array<{ slug: string; name: string }>;
}

// RENDERIZAR dinamicamente
<SelectContent>
  <SelectItem value="all">Todas categorias</SelectItem>
  {itemTypes?.map((type) => (
    <SelectItem key={type.slug} value={type.slug}>
      {type.name}
    </SelectItem>
  ))}
</SelectContent>
```

### Modificação em Estoque.tsx

```tsx
import { useItemTypes } from '@/hooks/useItemTypes';

// Dentro do componente
const { data: itemTypes } = useItemTypes();

// Passar para StockFilters
<StockFilters
  itemTypes={itemTypes?.map(t => ({ slug: t.slug, name: t.name }))}
  // ...outras props
/>
```

### Modificação em AddStockDialog.tsx - Hierarquia Dupla

```tsx
// Nova estrutura de agrupamento
const itemsByLinhaAndType = useMemo(() => {
  const grouped: Record<string, Record<string, typeof filteredItems>> = {};
  
  filteredItems.forEach(item => {
    const linhaKey = item.linha || 'Sem Linha';
    const typeKey = item.type;
    
    if (!grouped[linhaKey]) grouped[linhaKey] = {};
    if (!grouped[linhaKey][typeKey]) grouped[linhaKey][typeKey] = [];
    
    grouped[linhaKey][typeKey].push(item);
  });
  
  return grouped;
}, [filteredItems]);

// Renderização com hierarquia dupla
{Object.keys(itemsByLinhaAndType).map(linhaKey => (
  <div key={linhaKey}>
    <h3>Linha: {linhaKey}</h3>
    {Object.keys(itemsByLinhaAndType[linhaKey]).map(typeKey => (
      <div key={typeKey}>
        <h4>Categoria: {itemTypeLabels[typeKey]}</h4>
        {/* Grid de itens */}
      </div>
    ))}
  </div>
))}
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/estoque/StockFilters.tsx` | Adicionar prop `itemTypes` e renderizar dinamicamente |
| `src/pages/Estoque.tsx` | Importar `useItemTypes` e passar para StockFilters |
| `src/components/estoque/AddStockDialog.tsx` | Implementar agrupamento duplo Linha → Tipo → Item |

---

## Resultado Esperado

1. **Categorias dinâmicas**: Tipos criados no admin aparecerão automaticamente nos filtros do estoque
2. **Hierarquia completa**: Itens organizados por Linha → Categoria → Nome do Item
3. **Sincronização em tempo real**: Alterações no admin refletem imediatamente no sistema das empresas
