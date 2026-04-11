
## Plano: Suporte a Produtos com Múltiplos Lados (Ex: Box de Canto)

### Problema
Produtos como **Box de Canto** têm dois lados com dimensões independentes (ex: Lado A = 1000mm, Lado B = 950mm). Hoje o sistema só aceita **uma largura (L) e uma altura (A)**, impossibilitando definir composições com fórmulas distintas para cada lado.

### Solução Proposta: Campo `side` na Composição

A abordagem mais simples e escalável é adicionar um campo **`side`** (lado) na tabela `product_template_items`, que indica a qual lado do produto aquele componente pertence. As fórmulas continuam usando `L` e `A`, mas o sistema substitui `L` pela dimensão do lado correto.

#### 1. Banco de Dados
- Adicionar coluna `side` (TEXT, nullable, default `null`) em `product_template_items` e `company_product_items`
  - `null` = componente usa as dimensões padrão (L × A) — comportamento atual
  - `'A'` = componente usa Largura do Lado A × Altura
  - `'B'` = componente usa Largura do Lado B × Altura
- Adicionar coluna `has_multiple_sides` (BOOLEAN, default `false`) em `product_templates` — marca quais produtos são "multi-lado"
- Adicionar colunas `width_b` e `height_b` (nullable) em `quote_items` — para armazenar as dimensões do segundo lado no orçamento

#### 2. Composição (Admin - ProductTemplates)
- Quando `has_multiple_sides = true`, exibir um **seletor de lado (A/B/Ambos)** ao adicionar/editar itens da composição
- Os itens ficam visualmente agrupados por lado com badges coloridos (ex: 🟦 Lado A / 🟩 Lado B)
- As seções existentes (Perfis, Componentes, Vidros, Contramarco) continuam funcionando normalmente, apenas com o filtro de lado adicional

#### 3. Orçamento (NovoOrcamentoDialog)
- Quando o produto selecionado tem `has_multiple_sides = true`, exibir **dois campos de largura** (Largura Lado A e Largura Lado B) em vez de um único
- A altura pode ser compartilhada ou independente conforme necessidade

#### 4. Motor de Cálculo (Produção e OS)
- No `evaluateFormula`, quando `side = 'B'`, substituir `L` pela largura do Lado B
- No `generateOSDocuments`, iterar a composição respeitando o lado de cada componente
- Na página de **Produção**, exibir dois campos de largura quando o produto selecionado tiver múltiplos lados

#### 5. Fluxo do Usuário (Exemplo Box de Canto)
1. Admin marca o produto "Box de Canto" como `has_multiple_sides = true`
2. Na composição, adiciona perfis do **Lado A** (ex: montante lado A com fórmula `A - 20`) e perfis do **Lado B** (ex: montante lado B com fórmula `A - 20`, trilho lado B com `L - 30`)
3. No orçamento, o vendedor informa: Lado A = 1000mm, Lado B = 950mm, Altura = 1900mm
4. O sistema calcula cada componente usando a largura do lado correspondente

### Resumo das Alterações
| Área | Arquivos | Alteração |
|------|----------|-----------|
| **Banco** | Migration | `side` em `product_template_items`/`company_product_items`, `has_multiple_sides` em `product_templates`, `width_b`/`height_b` em `quote_items` |
| **Admin** | `ProductTemplates.tsx`, `CompositionSections.tsx` | Toggle multi-lado, seletor de lado nos itens |
| **Orçamento** | `NovoOrcamentoDialog.tsx`, `AddProductPanel.tsx` | Campos de dimensão por lado |
| **Produção** | `Producao.tsx`, `ProductionHeader.tsx`, `generateOSDocuments.ts` | Cálculo e exibição por lado |
| **Motor** | `safeFormulaEvaluator.ts` | Suporte a contexto com `widthB` |
