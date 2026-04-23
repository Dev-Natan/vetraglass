
## Objetivos
1.  Permitir a edição direta dos preços dos insumos (perfis, vidros, componentes) dentro da visualização de composição do produto.
2.  Garantir que a alteração de preço de um insumo em um produto reflita automaticamente em todos os outros produtos que utilizam o mesmo item.
3.  Sincronizar esses preços com o módulo de estoque (`company_items`).

## Arquitetura da Solução
A aplicação já utiliza uma tabela central (`company_items`) para armazenar os custos dos materiais de uma empresa. O componente `ProductCompositionPricing` consome esses dados para calcular o preço final. Transformaremos esse componente de "apenas visualização" em um "editor de custos centralizado".

## Mudanças Detalhadas

### 1. Frontend: Componente `ProductCompositionPricing.tsx`
*   **Novos Campos de Edição**: Na seção de "Detalhes por item", substituiremos o texto estático de custo por campos de entrada (`Input`) que permitem editar:
    *   **Perfis**: Custo por Barra, Custo por Kg ou Custo por Metro.
    *   **Vidros**: Custo por m².
    *   **Componentes/Acessórios**: Custo unitário.
*   **Nova Mutação**: Criar `updateItemPriceMutation` utilizando `supabase.from('company_items').update()`.
*   **Ação de Salvamento**: Adicionar um botão "Atualizar no Estoque" ao lado de cada item ou um botão global de "Sincronizar Preços do Estoque".
*   **Feedback em Tempo Real**: Ao salvar, disparar `queryClient.invalidateQueries` para que todos os cálculos de preço do produto (e de outros produtos abertos) sejam atualizados com os novos valores.

### 2. Frontend: Utilitário de Precificação (`pricingEngine.ts`)
*   Validar se as fórmulas de cálculo estão utilizando corretamente os campos de custo recém-editados para garantir consistência entre o que é exibido e o que é salvo.

### 3. Melhoria na UX
*   Adicionar um indicador visual (ex: ícone de link) informando que a edição daquele preço afetará outros produtos ("Este item é compartilhado entre X produtos").
*   Adicionar validação para evitar preços negativos ou formatos inválidos.

## Fluxo de Trabalho
1.  **Fase 1**: Atualizar a interface de `ProductCompositionPricing.tsx` para incluir os inputs de custo.
2.  **Fase 2**: Implementar a lógica de salvamento no Supabase para a tabela `company_items`.
3.  **Fase 3**: Testar a propagação: editar o preço de um perfil "U-001" no Produto A e verificar se o custo calculado do Produto B (que também usa "U-001") foi atualizado.
