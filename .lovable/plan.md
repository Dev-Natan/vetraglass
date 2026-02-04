

# Plano: Permitir que Usuários Criem Seus Próprios Itens

## Objetivo

Dar liberdade aos usuários para criar itens (materiais) personalizados para suas empresas, já que nem todos os itens serão adicionados pelo administrador do sistema. Isso permitirá que cada empresa gerencie os materiais específicos do seu negócio.

## Contexto Atual

O sistema já possui a estrutura necessária:
- A tabela `company_items` tem o campo `is_custom: boolean`
- A tabela `company_stock` permite `item_template_id` como NULL (para itens sem template global)
- As políticas RLS já permitem que usuários da empresa façam INSERT/UPDATE/DELETE em `company_items`
- O padrão `CreateCustomProductDialog` já existe para produtos e pode ser replicado para itens

Atualmente, o `AddStockDialog` só permite selecionar itens de templates globais criados pelo admin.

## Solução

Criar um componente `CreateCustomItemDialog` que permite aos usuários:
1. Definir nome, descrição e unidade do item
2. Selecionar categoria (Perfil, Vidro, Acessório, Serviço, Chaparia) ou criar nova
3. Selecionar linha de produto ou criar nova
4. Definir preço de custo e venda
5. Registrar a compra inicial (entrada no estoque)

## Mudanças Técnicas

### 1. Criar `CreateCustomItemDialog.tsx`

Novo componente em `src/components/estoque/CreateCustomItemDialog.tsx`:

- Formulário com campos:
  - Nome do item (obrigatório)
  - Descrição (opcional)
  - Categoria/Tipo: Select com opções do banco (`item_types`) + opção "Nova categoria"
  - Linha: Select com linhas do banco (`product_linhas`) + opção "Nova linha"
  - Unidade: Select (un, m, m², kg, etc.) - pré-preenchido baseado na categoria
  - Quantidade inicial (obrigatório)
  - Custo unitário (obrigatório)
  - Preço de venda (obrigatório)
  - Estoque mínimo (opcional)
  - Dados fiscais (colapsável, opcional)

- Fluxo de salvamento:
  1. Criar registro em `company_items` com `is_custom: true`, `item_template_id: null`
  2. Criar registro em `company_stock` com `item_template_id: null`, `company_item_id` vinculado
  3. Registrar movimento de entrada em `stock_movements`

### 2. Atualizar `AddStockDialog.tsx`

- Adicionar botão "Criar Item Personalizado" no cabeçalho ou na área de filtros
- Ao clicar, abrir o `CreateCustomItemDialog`
- Após criar o item, fechar o dialog de criação e atualizar a lista

### 3. Atualizar página `/estoque` (Estoque.tsx)

- Adicionar botão "Novo Item" no header da página (ao lado de "Registrar Compra")
- Itens customizados aparecem normalmente na listagem com um badge "Personalizado"

### 4. Atualizar componentes de visualização

- `StockItemCard.tsx` e `StockGridView.tsx`: Mostrar badge visual para itens customizados (`is_custom: true`)

## Estrutura do CreateCustomItemDialog

```
┌─────────────────────────────────────────────────┐
│  ✨ Criar Item Personalizado                    │
│  ─────────────────────────────────────────────  │
│  ⚠️ Itens personalizados são exclusivos        │
│     da sua empresa.                             │
│  ─────────────────────────────────────────────  │
│                                                 │
│  Nome do Item *                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Ex: Parafuso Especial 5mm                │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌──────────────────┐ ┌──────────────────────┐ │
│  │ Categoria *      │ │ Linha               │ │
│  │ [Acessório    ▼] │ │ [Suprema         ▼] │ │
│  │ + Nova categoria │ │ + Nova linha        │ │
│  └──────────────────┘ └──────────────────────┘ │
│                                                 │
│  ┌──────────────────┐ ┌──────────────────────┐ │
│  │ Unidade *        │ │ Qtd. Inicial *       │ │
│  │ [un           ▼] │ │ [100              ]  │ │
│  └──────────────────┘ └──────────────────────┘ │
│                                                 │
│  ┌──────────────────┐ ┌──────────────────────┐ │
│  │ Custo (R$) *     │ │ Venda (R$) *         │ │
│  │ [0,50          ] │ │ [1,00             ]  │ │
│  └──────────────────┘ └──────────────────────┘ │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Margem: 100% • R$ 0,50 lucro             │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ▸ Dados Fiscais (Opcional)                    │
│                                                 │
│  ─────────────────────────────────────────────  │
│           [Cancelar]  [Criar e Registrar Compra]│
└─────────────────────────────────────────────────┘
```

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/estoque/CreateCustomItemDialog.tsx` | **NOVO** - Dialog para criar item personalizado |
| `src/components/estoque/AddStockDialog.tsx` | Adicionar botão para abrir CreateCustomItemDialog |
| `src/pages/Estoque.tsx` | Adicionar botão "Novo Item" no header |
| `src/components/estoque/StockItemCard.tsx` | Badge "Personalizado" para itens customizados |
| `src/components/estoque/StockGridView.tsx` | Badge "Personalizado" para itens customizados |
| `src/hooks/useStockData.ts` | Incluir `is_custom` do company_items nos dados |

## Resultado Esperado

Após as alterações:

1. Usuários podem criar itens personalizados diretamente na página de Estoque
2. Itens customizados aparecem com badge "Personalizado" na lista
3. Cada empresa tem liberdade de adicionar materiais que usa, sem depender do admin
4. Os itens customizados funcionam normalmente em:
   - Registrar Entrada/Saída
   - Composição de produtos (quando aplicável)
   - Orçamentos e Ordens de Serviço
   - Relatórios de estoque

## Benefícios

- **Autonomia**: Empresas não dependem do admin para adicionar materiais
- **Flexibilidade**: Cada empresa pode ter seu catálogo único de itens
- **Escalabilidade**: O sistema suporta milhares de itens customizados por empresa
- **Compatibilidade**: Itens customizados seguem a mesma estrutura dos templates

