## Diagnóstico

Ao aprovar um orçamento em `useApprovalMutation.ts`, o código cria a Ordem de Serviço, mas **nunca insere registros na tabela `os_items`**. Em vez disso, monta uma lista em memória com `id: crypto.randomUUID()` (IDs fictícios) e passa para `generateOSDocuments`.

Resultado:
- `os_items` fica vazio → a aba de produto/componentes da OS não mostra nada.
- Cada `insert` em `os_cutting_plan`, `os_glass_projects` e `os_materials` referencia `os_item_id` inexistente → o insert falha silenciosamente (erros só caem em `console.warn`), zerando o plano de corte, vidros e materiais.

Confirmado no banco: as OS aprovadas recentes têm `os_items=0/1` mas `cuts=0`, `glass=0`, `mats=0`.

## Correção (somente backend de aprovação — sem mexer em UI)

Arquivo: `src/components/orcamentos/_aprovar-orcamento/hooks/useApprovalMutation.ts`

Entre o passo 2 (criação da OS) e o passo 5 (geração de documentos):

1. **Inserir os_items reais** a partir dos `items` do orçamento, um registro por item, copiando:
   - `os_id`, `quote_item_id`, `product_name = item.description`
   - `quantity`, `product_id = item.product_template_id`
   - Dimensões venda: `largura_venda/altura_venda` (+ `_b`, `_c` quando existirem) a partir de `item.width/height/width_b/height_b/width_c/height_c`
   - Dimensões produção (inicializadas iguais às de venda): `largura_producao/altura_producao` (+ `_b`, `_c`)
   - Campos legados `width_sold/height_sold/width_production/height_production` (NOT NULL no schema) preenchidos com os mesmos valores
2. **Capturar os IDs retornados** (`.select('id, quote_item_id, product_id, ...')`).
3. **Montar `osItems` para `generateOSDocuments`** usando os IDs reais e os campos extras já lidos do `quote_item` (`include_contramarco`, `glass_thickness`, `glass_color`, dimensões B/C).
4. **Repassar a mesma lista** para `generateMaterialConsumption` (já espera o mesmo shape).
5. Manter os warnings, mas adicionar `console.error` quando o insert de `os_items` falhar (esse é crítico).

Arquivo: `src/components/orcamentos/_aprovar-orcamento/types.ts`
- Estender `ApprovalQuoteItem` com `width_c?`, `height_c?`, `include_contramarco?` (opcionais) para que os dados já carregados sejam repassados corretamente. Nenhum consumer atual quebra (campos opcionais).

Arquivo: `src/components/orcamentos/VisualizarOrcamentoDialog.tsx` (somente leitura da query de items)
- Garantir que a consulta de `items` que alimenta o dialog inclua `width_c, height_c, include_contramarco` (se ainda não inclui). Sem mudanças de UI.

## Validação

- Aprovar um orçamento de teste e conferir no banco:
  - `select count(*) from os_items where os_id = :nova_os` > 0
  - `select count(*) from os_cutting_plan where ordem_servico_id = :nova_os` > 0
  - `select count(*) from os_materials where ordem_servico_id = :nova_os` > 0
  - Para produtos com vidro: `os_glass_projects` > 0
- Abrir a OS recém-criada em `/ordens-servico` e confirmar que aparecem: lista de produtos, plano de corte e componentes/vidros com tamanhos calculados pelas fórmulas.

## Fora de escopo

- Não alterar lógica de cálculo em `generateOSDocuments.ts` (já está correta).
- Não mexer em UI da página de OS nem no fluxo financeiro do aprovar.
