
## Fase 3: Validação Final e Propagação Automática no Banco

Embora a interface já mostre os valores atualizados, o custo total "cacheado" na tabela `company_products` (coluna `cost_per_sqm`) de outros produtos só muda quando esses produtos são abertos e salvos manualmente. Para que a atualização seja **realmente automática em todo o sistema** (incluindo listagens e relatórios), propomos:

1.  **Sincronização em Massa no Banco (Trigger SQL)**:
    *   Criar uma Função/Trigger no Supabase que, sempre que um preço em `company_items` for alterado, dispare um recálculo automático do `cost_per_sqm` e `price_per_sqm` para todos os produtos vinculados àquele item na tabela `company_products`.
    *   Isso garante que a lista geral de produtos mostre o preço atualizado sem intervenção manual.

2.  **Refinamento de Validação (UI/UX)**:
    *   Adicionar máscaras de moeda (R$) em tempo real nos inputs de custo para evitar erros de digitação.
    *   Implementar um "Modo de Edição em Lote" opcional, onde o usuário pode alterar vários itens e salvar todos de uma vez, em vez de um por um.

3.  **Teste de Stress e Integridade**:
    *   Validar o comportamento em produtos com fórmulas complexas (ex: perfis que dependem de altura e largura simultaneamente) para garantir que o `pricingEngine.ts` está processando os novos custos corretamente.

## Arquivos a serem alterados:
- `supabase/migrations/...` (Nova migração para o Trigger de recálculo automático).
- `src/components/produtos/ProductCompositionPricing.tsx` (Máscaras de entrada e validações).
