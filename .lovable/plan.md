

# Plano: Corrigir Seleção de Produtos no Orçamento

## Problema Identificado

O painel de adição de produtos aos orçamentos (`AddProductPanel`) está buscando produtos da biblioteca global (`product_templates`) ao invés de filtrar pelos produtos realmente ativados pela empresa. Isso causa:

1. Linhas e categorias sendo populadas a partir de templates globais
2. Produtos inativos ou não habilitados aparecendo na lista
3. Falta de organização hierárquica clara por linha → categoria → produto

## Solução Proposta

Reorganizar a busca de dados para priorizar os produtos da empresa (`company_products`) e exibir apenas os ativos.

---

## Mudanças Técnicas

### 1. Refatorar Consulta de Produtos (`AddProductPanel.tsx`)

**Antes:** 
- Busca todos os `product_templates` ativos globalmente
- Filtra manualmente pelos IDs ativados em `company_products`

**Depois:**
- Buscar diretamente de `company_products` onde `is_active = true` e `company_id = currentCompany.id`
- Fazer join com `product_templates` para obter imagens e metadados quando aplicável
- Incluir produtos personalizados (`is_custom = true`)

```text
┌─────────────────────────────────────────────────────────┐
│  Nova Estrutura de Dados                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  company_products (is_active = true)                    │
│      ├── Template-based: join product_templates         │
│      │   └── Herda: imagem, linha, categoria            │
│      │                                                  │
│      └── Custom (is_custom = true)                      │
│          └── Usa: campos diretos do company_products    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. Atualizar Filtros de Linha e Categoria

Modificar os filtros para extrair linhas e categorias a partir dos **produtos ativos da empresa**:

```typescript
// Linhas disponíveis - extraídas dos produtos ativos
const linhas = useMemo(() => {
  const linhaSet = new Set<string>();
  activeCompanyProducts?.forEach(p => {
    const linha = p.linha || p.product_template?.linha;
    if (linha) linhaSet.add(linha);
  });
  return Array.from(linhaSet).sort();
}, [activeCompanyProducts]);

// Categorias para a linha selecionada
const categories = useMemo(() => {
  if (!selectedLinha) return [];
  const catSet = new Set<string>();
  activeCompanyProducts
    ?.filter(p => (p.linha || p.product_template?.linha) === selectedLinha)
    .forEach(p => {
      const cat = p.category || p.product_template?.category;
      if (cat) catSet.add(cat);
    });
  return Array.from(catSet).sort();
}, [activeCompanyProducts, selectedLinha]);
```

### 3. Melhorar Consulta SQL

Nova query com join otimizado:

```sql
company_products
  .select(`
    id,
    commercial_name,
    base_price,
    price_per_sqm,
    description,
    image_url,
    linha,
    category,
    is_custom,
    uses_glass,
    product_template_id,
    product_template:product_templates (
      id, name, description, category, linha, image_url
    )
  `)
  .eq('company_id', currentCompany.id)
  .eq('is_active', true)
```

### 4. Atualizar Grid de Produtos

O grid de seleção exibirá:
- **Nome comercial** da empresa (ou nome do template se não personalizado)
- **Imagem** do produto (empresa ou template)
- **Badge "Personalizado"** para produtos `is_custom = true`
- Filtrado por **linha selecionada** e **categoria selecionada**

### 5. Atualizar ProductSelectionSheet.tsx (Opcional)

Se este componente ainda for utilizado, aplicar as mesmas correções para manter consistência.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/orcamentos/AddProductPanel.tsx` | Refatorar queries e filtros |
| `src/components/orcamentos/ProductSelectionSheet.tsx` | Mesma lógica de filtros |

---

## Fluxo de Seleção Atualizado

```text
┌────────────────────────────────────────────────────┐
│   Seleção de Produto para Orçamento                │
├────────────────────────────────────────────────────┤
│                                                    │
│  1. Selecionar LINHA                               │
│     └── Dropdown com linhas dos produtos ativos    │
│                                                    │
│  2. Selecionar CATEGORIA (chips)                   │
│     └── Filtrado pela linha selecionada            │
│                                                    │
│  3. Selecionar PRODUTO (grid visual)               │
│     └── Apenas produtos ativos da empresa          │
│     └── Mostra nome comercial + imagem             │
│                                                    │
│  4. Definir dimensões e adicionar                  │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

- Dropdown de **Linha** mostra apenas linhas com produtos ativados
- Chips de **Categoria** mostram apenas categorias da linha selecionada  
- Grid de **Produtos** exibe somente produtos ativos da empresa
- Produtos personalizados aparecem com badge distintivo
- Performance otimizada com uma única query principal

