
## Plano: Incluir Imagens Personalizadas nos PDFs

### Problema Identificado
As imagens adicionadas pelos usuários a **produtos** (`company_products`) e **itens/materiais** (`company_items`) não estão sendo exibidas nos PDFs gerados porque:

1. **Fonte de dados incompleta**: A query em `VisualizarOrcamentoDialog.tsx` busca imagens **apenas** de `product_templates`, ignorando:
   - `company_products.image_url` (produtos personalizados da empresa)
   - `company_items.image_url` (itens/materiais da empresa)

2. **Hierarquia de prioridade ausente**: Quando um produto da empresa tem imagem personalizada, ela deveria ter prioridade sobre a imagem do template.

### Análise Técnica

A tabela `quote_items` tem três referências de imagem:

| Coluna | Tabela de Origem | Descrição |
|--------|------------------|-----------|
| `company_product_id` | `company_products` | Produtos personalizados com `image_url` |
| `product_template_id` | `product_templates` | Templates de produtos com `image_url` |
| `company_item_id` | `company_items` | Itens/materiais com `image_url` |

**Query atual (incompleta):**
```sql
SELECT *, product_templates(image_url, linha, category)
FROM quote_items WHERE quote_id = ?
```

**Query corrigida:**
```sql
SELECT *,
  product_templates(image_url, linha, category),
  company_products(image_url, linha),
  company_items(image_url)
FROM quote_items WHERE quote_id = ?
```

### Mudanças Necessárias

#### 1. Atualizar `VisualizarOrcamentoDialog.tsx`
Modificar a query de itens para incluir imagens de todas as fontes:

```typescript
const { data, error } = await supabase
  .from('quote_items')
  .select(`
    *,
    product_templates (image_url, linha, category),
    company_products (image_url, linha),
    company_items (image_url)
  `)
  .eq('quote_id', quote.id);
```

#### 2. Atualizar a Lógica de Seleção de Imagem
Criar hierarquia de prioridade para imagens:

```text
Prioridade de Imagem:
1. company_products.image_url (se existir)
2. product_templates.image_url (fallback para templates)
3. company_items.image_url (para itens avulsos)
```

#### 3. Atualizar Interface `QuoteItem`
Adicionar tipos para as novas relações:

```typescript
interface QuoteItem {
  // ... campos existentes
  product_templates?: { image_url: string | null; linha: string | null; category: string | null } | null;
  company_products?: { image_url: string | null; linha: string | null } | null;
  company_items?: { image_url: string | null } | null;
}
```

#### 4. Atualizar a Preparação de Dados para PDF
Modificar a função que prepara itens para o PDF:

```typescript
const itemsForPdf = items.map(item => ({
  // ... outros campos
  image_url: 
    item.company_products?.image_url ||    // Prioridade 1: Produto personalizado
    item.product_templates?.image_url ||   // Prioridade 2: Template
    item.company_items?.image_url ||       // Prioridade 3: Item avulso
    null,
  linha: 
    item.company_products?.linha ||
    item.product_templates?.linha || 
    null,
}));
```

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/orcamentos/VisualizarOrcamentoDialog.tsx` | Expandir query para incluir `company_products` e `company_items` |

### Fluxo Visual

```text
┌─────────────────────────────────────────────────────────────┐
│                     quote_items                             │
│  ┌──────────────────┬──────────────────┬─────────────────┐ │
│  │ company_product  │ product_template │  company_item   │ │
│  │     _id          │      _id         │     _id         │ │
│  └────────┬─────────┴────────┬─────────┴────────┬────────┘ │
│           │                  │                   │          │
│           ▼                  ▼                   ▼          │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│   │ company_      │  │ product_      │  │ company_      │  │
│   │ products      │  │ templates     │  │ items         │  │
│   │               │  │               │  │               │  │
│   │ image_url ◄───┼──┼── PRIORIDADE ─┼──┼──► image_url  │  │
│   └───────────────┘  └───────────────┘  └───────────────┘  │
│                             │                               │
│                             ▼                               │
│                     ┌───────────────┐                       │
│                     │ PDF Generator │                       │
│                     │               │                       │
│                     │ Usa a imagem  │                       │
│                     │ disponível    │                       │
│                     │ com maior     │                       │
│                     │ prioridade    │                       │
│                     └───────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### Observações
- A função `generateQuotePdf` já suporta `image_url` nos itens, então **não precisa de alteração**
- O problema está exclusivamente na **fonte de dados** que não busca imagens de produtos/itens personalizados
- Após a correção, todas as imagens (templates ou personalizadas) serão exibidas corretamente no PDF
