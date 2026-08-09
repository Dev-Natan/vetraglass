## Objetivo
Permitir que cada empresa personalize um produto global (ex.: Janela Correr 2 Folhas Suprema) — trocando perfis, ajustando fórmulas, editando dados básicos e preço — sem afetar o template global nem outras empresas. Manter botão de **reset ao padrão** (total e por item), e **congelar orçamentos antigos** com a versão usada no momento.

## Estado atual (já existe)
- `company_products` já é o "fork" por empresa (unique `company_id + product_template_id`) e tem flag `is_custom`.
- `company_product_items` já armazena a composição por empresa (perfis, vidros, fórmulas, ângulos, peças).
- `product_templates` + `product_template_items` são o padrão global.
- Falta: fluxo de fork on-demand, UI de edição em "Meus Produtos", rastreamento de campos sobrescritos, reset e snapshot em orçamentos.

## O que será feito

### 1. Banco
- Adicionar em `company_products`:
  - `overridden_fields jsonb default '[]'` — lista de campos customizados (`['linha','composition','base_price',...]`) para reset granular e badge "Customizado".
  - `customized_at timestamptz` — quando foi personalizado.
- Adicionar em `quote_items`:
  - `composition_snapshot jsonb` — snapshot da composição usada no momento da emissão do orçamento (itens, fórmulas, ângulos, dados do produto). Congela o histórico.
- RPCs:
  - `fork_product_template(p_template_id)` → cria `company_products` + copia todos os `product_template_items` para `company_product_items` da empresa que chama. Idempotente (retorna existente se já forked).
  - `reset_company_product(p_company_product_id)` → apaga customização e recopia do template (reset total).
  - `reset_company_product_field(p_company_product_id, p_field)` → reseta apenas um campo (composição, preço, nome, etc.) reaplicando do template.
  - `reset_company_product_item(p_company_product_item_id)` → reseta apenas 1 item da composição para o padrão do template.

### 2. UI — Página "Meus Produtos" (`/produtos`)
- Card do produto ganha botão **"Personalizar"** (chama `fork_product_template` se ainda não existir e abre editor).
- Novo modal/página de edição por empresa com 4 abas:
  - **Dados**: nome comercial, descrição, imagem, linha, categoria.
  - **Composição**: reaproveita o split-view já existente em `ProductTemplates.tsx` (adicionar/remover/editar itens, fórmulas, ângulos).
  - **Fórmulas de corte**: edição rápida por item da composição.
  - **Preço**: `base_price`, `price_per_sqm`, `margin_percent`.
- Cada campo/aba exibe badge **"Customizado"** quando presente em `overridden_fields`, com botão **"Restaurar padrão"** ao lado (reset granular).
- Header do editor tem botão **"Resetar tudo ao padrão original"** (reset total, com confirmação).
- Card na listagem mostra badge global "Customizado" quando `is_custom = true`.

### 3. Motor de cálculo do orçamento
- `useDynamicCompositionPricing.ts` já consulta `company_product_items` — continua funcionando; apenas garantir que ao selecionar um produto no orçamento ele consulte a versão da empresa (forkada) e não caia no template global.
- `AddProductPanel` / `ProductSelectionSheet`: ao inserir produto no orçamento, chamar `fork_product_template` automaticamente na primeira vez (transparente ao usuário) para garantir que exista `company_product_id`.

### 4. Snapshot em orçamentos
- Ao salvar `quote_items`, gravar `composition_snapshot` com a composição atual + dados do produto.
- Ao abrir orçamento antigo (edição/PDF/OS), usar `composition_snapshot` como fonte de verdade — orçamentos antigos ficam congelados mesmo se a empresa alterar o produto depois.
- Novos orçamentos sempre pegam a versão vigente do `company_products`.

### 5. Feedback visual
- Badges "Customizado" nos cards e nos campos.
- Toast ao personalizar / resetar.
- Confirmação clara antes de reset total.

## Não incluído
- Versionamento histórico completo por produto (só o snapshot dentro do orçamento).
- Compartilhar customização entre empresas.
- Alterar o template global — permanece exclusivo do admin SaaS.

## Arquivos principais a tocar
- Migration nova (colunas + RPCs).
- `src/pages/Produtos.tsx` e `src/pages/EditarProdutoEmpresa.tsx` (editor por empresa).
- `src/components/produtos/*` (abas de composição/dados/preço reutilizadas).
- `src/components/orcamentos/_novo-orcamento/*` (fork automático + gravar snapshot).
- `src/hooks/useDynamicCompositionPricing.ts` (ler snapshot em orçamentos antigos).
- `src/utils/generateQuotePdf.ts` / OS (ler snapshot).