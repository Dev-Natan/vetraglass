
Objetivo
- Corrigir o layout do modal “Registrar Entrada/Saída” para que nenhum elemento fique por cima de outro (como no print).
- Melhorar a experiência: seleção de Item bem organizada por Hierarquia (Linha → Categoria → Itens), com imagens, busca e filtros funcionando.
- Garantir que os filtros “Linha” e “Categoria” realmente apareçam com opções (hoje isso pode falhar porque a página não está enviando `linha/type` para o modal).

O que está acontecendo hoje (causa provável)
- O modal atual mistura áreas com `flex-1`, `overflow-hidden` e uma lista de itens com altura fixa. Em telas menores/alturas menores, isso pode causar “empilhamento” visual e sobreposição.
- A página `/estoque` está passando para o modal apenas `{ id, name, unit, image_url }` do item_template, sem `linha` e `type`. Resultado:
  - Os seletores de Linha/Categoria ficam vazios ou inconsistentes.
  - A hierarquia Linha → Categoria não consegue organizar de verdade.
- Dentro do modal, `useItemTypeLabels()` está sendo usado de forma incorreta (ele retorna um objeto com `{ labels, colors, units }`, mas o código tenta acessar como se fosse um mapa direto). Isso não quebra tudo, mas impede os nomes bonitos das categorias.

Mudanças planejadas (alto nível)
1) Ajustar a estrutura do modal para layout “Header fixo + Conteúdo rolável + Footer fixo”
- Adotar o mesmo padrão já usado em `AddStockDialog` (que é estável):
  - `DialogContent` com `p-0 gap-0 flex flex-col max-h-[90vh]`
  - Header com padding e borda inferior
  - Corpo (conteúdo) com `flex-1 min-h-0 overflow-y-auto` (ou `ScrollArea`), para nunca “invadir” o footer
  - Footer com borda superior e background sólido (sempre visível)

2) Garantir que o modal receba `linha` e `type` corretamente
- Em `src/pages/Estoque.tsx`, ao montar `stockItems` para o `RegistrarMovimentoDialog`, incluir:
  - `item_template.type`
  - `item_template.linha`
- Assim o seletor de Linha/Categoria e a organização hierárquica passam a funcionar com dados reais.

3) Tornar os seletores “Todas as linhas/categorias” 100% consistentes
- Trocar o uso de string vazia no `Select` por um valor sentinel (ex.: `__all__`), evitando valores que não existem em nenhum `SelectItem`.
- Comportamento:
  - Valor exibido “Todas as linhas” = sentinel
  - Ao selecionar uma Linha: filtra e reseta Categoria
  - Categoria lista apenas as categorias disponíveis dentro da Linha selecionada (quando houver Linha)

4) Melhorar a seleção de itens com Hierarquia visual (Linha → Categoria → Itens) + imagens
- Reaproveitar o agrupamento já calculado no modal (`itemsByLinhaAndType`) e realmente renderizar por grupos:
  - Título de Linha (com contagem de itens)
  - Subtítulo de Categoria (com label do banco via `useItemTypeLabels().labels`)
  - Grid de itens com card contendo:
    - Imagem maior (padrão similar ao `StockGridView`: caixinha branca, `object-contain`)
    - Nome (line-clamp)
    - Estoque atual (badge)
    - Estado selecionado com borda/ring e ícone de check
- (Opcional, mas recomendado) Usar `Collapsible` por Linha para não ficar uma lista gigante quando tiver muitas linhas.

5) Corrigir o uso de `useItemTypeLabels`
- No `RegistrarMovimentoDialog`, trocar:
  - `const itemTypeLabels = useItemTypeLabels();`
  - para `const { labels: itemTypeLabels } = useItemTypeLabels();`
- Assim “Categoria” mostra o nome amigável definido no sistema (ao invés do slug).

Arquivos que serão alterados
- src/pages/Estoque.tsx
  - Incluir `linha` e `type` no objeto `item_template` passado para `RegistrarMovimentoDialog` (entrada e saída).
- src/components/estoque/RegistrarMovimentoDialog.tsx
  - Refatorar layout do modal (header/body/footer com rolagem correta).
  - Ajustar selects (sentinel “todas”, reset de categoria).
  - Renderização organizada por Linha → Categoria → Itens com cards e imagens.
  - Ajustar `useItemTypeLabels` e pequenos detalhes de UI (tamanhos, espaçamentos, responsivo).

Critérios de aceite (o que vai ficar “certo”)
- No modal “Registrar Entrada” e “Registrar Saída”:
  - A grade de itens nunca ficará por cima dos campos de Quantidade/Motivo/Observação.
  - Se a tela for baixa, o conteúdo rola (scroll) e os botões Cancelar/Confirmar continuam acessíveis.
  - Os seletores de Linha e Categoria mostram opções reais.
  - A lista de itens aparece organizada por Linha e Categoria, com imagens visíveis.
  - Selecionar um item destaca claramente o card e exibe resumo do item selecionado.
  - Registrar entrada/saída continua funcionando como antes (sem quebrar o salvamento).

Plano de testes (manual, rápido)
- Abrir /estoque → Registrar Entrada:
  - Verificar que Linha/Categoria têm opções.
  - Buscar item pelo nome, filtrar por Linha e por Categoria.
  - Selecionar item, preencher quantidade/motivo/observação, Confirmar.
- Abrir /estoque → Registrar Saída:
  - Selecionar um item com estoque baixo/zero e confirmar que a UI lida bem (pelo menos não sobrepõe; e a validação de estoque insuficiente continua aparecendo quando aplicável).
- Testar em tela pequena (modo mobile no navegador) e em desktop para garantir que não existe sobreposição em nenhum breakpoint.

Riscos/atenções
- Evitar “scroll duplo” desagradável: vou manter o body rolável e o grid de itens com uma altura bem definida; se necessário, ajusto para uma única rolagem (dependendo do resultado visual).
- Garantir que os cards não fiquem pequenos demais em telas estreitas: o grid ficará responsivo (2 colunas no mobile, 3–6 no desktop conforme espaço).
