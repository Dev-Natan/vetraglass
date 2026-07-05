## Objetivo

Ocultar completamente das telas das Empresas qualquer linha que esteja com `is_active = false` em `product_linhas` (gerenciada pelo Admin SaaS), sem apagar dados nem afetar documentos históricos.

## Diagnóstico

O campo `linha` em `company_products` e `product_templates` é armazenado como texto (ex.: "SUPREMA", "suprema"). Hoje as telas montam os grupos de linhas lendo esse texto diretamente, sem cruzar com a tabela `product_linhas`. Por isso a "Suprema" continua aparecendo mesmo desativada.

O hook `useProductLinhas()` (sem argumento) já retorna somente linhas ativas — basta usar esse conjunto como filtro em todos os pontos onde a Empresa escolhe/vê linhas para uso operacional.

## Alterações

### 1. `src/pages/Produtos.tsx` (catálogo em blocos/cards)
- Consumir `useProductLinhas()` (já importado) e montar um `Set` case-insensitive com `slug` e `name` das linhas ativas.
- Em `filteredLinhas`, descartar qualquer entrada cujo `linhaName` não pertença ao set — vale tanto para templates do sistema quanto para `company_products` com `is_custom = true` que estejam vinculados a uma linha desativada.
- Manter a exceção "Personalizado" / "Sem Linha" visível (não pertence a `product_linhas`).
- Atualizar o contador do cabeçalho ("N linhas ativas/inativas") já reflete o filtro automaticamente.

### 2. `src/components/orcamentos/AddProductPanel.tsx` (adicionar produto ao orçamento)
- No `useMemo` que monta `linhas`, filtrar `linhaSet` contra o conjunto de linhas ativas de `useProductLinhas()`.
- Isso remove a linha desativada dos botões de escolha e da contagem.

### 3. `src/components/orcamentos/ProductSelectionSheet.tsx` (sheet passo-a-passo)
- Mesma filtragem no `useMemo` de `linhas`.
- Adicionar `useProductLinhas()` (ainda não usado neste arquivo).

### 4. `src/components/orcamentos/AddItemPanel.tsx` (itens/materiais)
- Confirmar/ajustar filtragem análoga sobre os chips de linha.

### Não alterar (preservação de histórico)
- `ProdutosLinha.tsx` (detalhe de uma linha) e telas de visualização/impressão de orçamentos e OS antigos continuam sem filtrar por `is_active`. Se um documento antigo referenciar uma linha hoje desativada, o texto continuará aparecendo normalmente.
- Nenhuma migração de banco: a coluna `is_active` e o toggle no Admin já existem e funcionam.

## Regra de matching (importante)

Para comparar o texto salvo em `company_products.linha` / `product_templates.linha` com as linhas ativas, usar comparação **case-insensitive contra `slug` e `name`** (`toLowerCase()`), replicando a lógica já presente em `getLinhaLabel` do `Produtos.tsx`. Isso evita falsos negativos com variações de caixa.

## Validação

1. Desativar "Suprema" em `/admin/categories` → aba Linhas.
2. Em uma empresa: `/produtos` não mostra mais o card "Suprema"; contador atualiza.
3. Novo orçamento → `AddProductPanel` e `ProductSelectionSheet` não listam "Suprema".
4. Abrir orçamento antigo que usava "Suprema" → linha ainda aparece no detalhe/impressão.
5. Reativar "Suprema" no admin → volta a aparecer imediatamente em todos os pontos.
