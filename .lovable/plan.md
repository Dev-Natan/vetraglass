## Problema

Na página de Ordens de Serviço, o plano de corte exibe os perfis de alumínio, mas **não mostra os vidros** dos produtos.

Causa identificada em `src/utils/generateOSDocuments.ts`:

- A função `getGlassFormulas` busca os vidros somente na tabela `glass_line_formulas`, que está **vazia** (0 registros no banco).
- Os vidros dos produtos hoje são cadastrados como itens da composição em `product_template_items` (com `item_templates.type = 'glass'`) — há 13 registros usando esse modelo (fórmulas de largura/altura, lados, peças por produto etc.).
- Resultado: nenhum vidro é gerado, `glass_cuts_data` fica vazio e a UI não exibe a seção "Plano de Corte de Vidros".

## Correção

Ajustar **apenas** `src/utils/generateOSDocuments.ts` para que os vidros venham da composição do produto, mantendo `glass_line_formulas` como fonte secundária/legado.

### Mudanças

1. **Nova função `getGlassCompositionItems(productTemplateId)`**
   - Consulta `product_template_items` (com join em `item_templates`) filtrando `type = 'glass'` e `company_id is null` (mesma regra usada para perfis).
   - Retorna: `name`, `width_formula`, `height_formula`, `pieces_quantity`, `pieces_formula`, `quantity_formula`, `side`, `item_template_id`.

2. **No loop de cada `osItem`** (após calcular perfis, antes de calcular `glassCuts`):
   - Buscar a composição de vidros através da nova função.
   - Para cada item de vidro:
     - Determinar lados (mesma lógica usada nos perfis: respeita `has_multiple_sides` e o campo `side` — "A", "B", "Ambos" ou nulo).
     - Calcular `calcWidth` / `calcHeight` via `evaluateFormula` com o contexto completo (`width`, `height`, `widthB`, `heightB`, `widthC`, `heightC`).
     - Calcular `piecesQty` (usa `pieces_formula` se existir, senão `pieces_quantity`).
     - `totalQty = piecesQty * quantity`.
     - `areaM2 = (calcWidth/1000) * (calcHeight/1000) * totalQty`.
     - `isMovable`: `true` se o nome **não** contiver "fixo" (case-insensitive); caso contrário `false`.
     - Inserir no array `glassCuts` no mesmo formato já consumido por `os_cutting_plan` e `os_glass_projects`.
   - Se `glass_line_formulas` retornar resultados, continuar processando-os (compatibilidade), mas hoje a fonte primária passa a ser a composição.

3. **Bloco de accessories**: já filtra `type !== 'glass'`, não precisa de mudança.

4. **Sem mudanças de schema**, sem migrations, sem alterações de UI — `OSCuttingPlan.tsx` e `OSGlassUnifiedView.tsx` já renderizam corretamente quando `glass_cuts_data` está preenchido.

### Validação

- Após salvar, ao aprovar um orçamento (ou clicar em "Recalcular" em uma OS existente), o plano de corte deve listar os vidros com fórmulas, dimensões calculadas, quantidade total e área.
- O resumo de "Painéis" e "m² total" no topo passa a refletir os vidros.
