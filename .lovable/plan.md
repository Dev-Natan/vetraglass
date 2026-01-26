
# Plano: Precificação Integrada ao Produto

## Objetivo
Simplificar o sistema de precificação removendo o módulo separado (`/precos`) e integrando a definição de preços diretamente na página de produtos. Ao ativar um produto para venda, o usuário definirá o preço do produto e, se o produto contiver vidros, configurará também os preços por cor e espessura.

---

## Visão Geral das Mudanças

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO ATUAL                                  │
├─────────────────────────────────────────────────────────────────┤
│  Produtos ──────► Ativar ──────► Módulo Preços (separado)       │
│                                       ↓                         │
│                              Definir preço produto              │
│                              Definir matriz vidros              │
└─────────────────────────────────────────────────────────────────┘

                              ↓ ↓ ↓

┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO NOVO                                   │
├─────────────────────────────────────────────────────────────────┤
│  Produtos ──────► Ativar ──────► Definir Preços (no mesmo modal)│
│                                       ↓                         │
│                              ┌─ Preço base/m² do produto        │
│                              └─ Se tem vidro: matriz de preços  │
│                                 por cor × espessura             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Criar Novo Componente de Precificação para Ativação

**Arquivo:** `src/components/produtos/ProductPricingStep.tsx`

Este componente será integrado ao fluxo de ativação de produtos e incluirá:

- **Campos de Preço Base:**
  - Custo por m² (R$)
  - Preço de venda por m² (R$)
  - Margem de lucro calculada automaticamente

- **Seção de Vidros (condicional):**
  - Aparece apenas se o produto contiver componentes do tipo `glass`
  - Lista as cores de vidro disponíveis (ou permite criar novas)
  - Lista as espessuras disponíveis (ou permite criar novas)
  - Matriz simplificada para definir custo/preço por combinação

---

## 2. Modificar Diálogo de Ativação de Produto

**Arquivo:** `src/components/produtos/ActivateWithCompositionDialog.tsx`

**Alterações:**
- Adicionar uma nova etapa/tab "Preços" após a configuração de componentes
- Integrar o componente `ProductPricingStep`
- Detectar automaticamente se o produto tem vidros pelos componentes (`item_template.type === 'glass'`)
- Ao confirmar ativação, salvar:
  - `company_products.price_per_sqm` e `cost_per_sqm`
  - Entradas na `glass_price_matrix` se houver vidros configurados

**Fluxo do Diálogo:**
```text
┌────────────────────────────────────────────────────────┐
│            Ativar Produto para Venda                   │
├────────────────────────────────────────────────────────┤
│  [1. Componentes]  [2. Preços]  [3. Confirmar]         │
│                                                        │
│  Etapa 1: Selecionar/ajustar componentes               │
│  Etapa 2: Definir preço do produto + vidros            │
│  Etapa 3: Resumo e confirmação                         │
└────────────────────────────────────────────────────────┘
```

---

## 3. Criar Componente de Edição de Preços (Para Produtos Já Ativados)

**Arquivo:** `src/components/produtos/EditProductPricingDialog.tsx`

- Permite editar preços de produtos já habilitados
- Acessível via botão na listagem de produtos (tab "Habilitados")
- Mesma interface do `ProductPricingStep`, mas para edição

---

## 4. Atualizar Página de Produtos

**Arquivo:** `src/pages/ProdutosLinha.tsx`

**Alterações:**
- Adicionar botão "Editar Preços" para produtos habilitados
- Exibir indicador visual de "Preço configurado" ou "Sem preço"
- Mostrar o preço atual por m² no card do produto (se configurado)

---

## 5. Atualizar Diálogo de Produto Personalizado

**Arquivo:** `src/components/produtos/CreateCustomProductDialog.tsx`

**Alterações:**
- Adicionar checkbox "Produto contém vidro"
- Se marcado, exibir seção de configuração de preços de vidro
- Campos adicionais:
  - Custo por m² (já existe `base_price`, renomear para clareza)
  - Preço de venda por m²
  - Matriz de vidros (se aplicável)

---

## 6. Simplificar/Remover Módulo de Preços Separado

**Opção A - Remoção Completa:**
- Remover `/precos` do menu de navegação
- Depreciar `src/pages/PrecosEmpresa.tsx`
- Manter tabelas `glass_price_matrix`, `glass_colors`, `glass_thicknesses`

**Opção B - Manter como Visão Geral (Recomendado):**
- Simplificar `/precos` para ser apenas uma visualização consolidada
- Remover capacidade de edição (redirecionar para o produto específico)
- Servir como dashboard de preços configurados

---

## 7. Atualizar Hooks Existentes

**Arquivo:** `src/hooks/useGlassPricing.ts`

**Alterações:**
- Adicionar função para buscar preços de vidro por produto específico
- Criar hook `useProductGlassPricing(productId)` para gerenciar preços de vidro no contexto do produto

---

## Detalhes Técnicos

### Estrutura de Dados (Banco - sem alterações de schema)

As tabelas existentes já suportam o novo fluxo:
- `company_products`: `price_per_sqm`, `cost_per_sqm`
- `glass_price_matrix`: mantém a matriz por empresa

### Lógica de Detecção de Vidro

```typescript
// Detectar se produto tem vidro através dos componentes
const hasGlassComponents = components?.some(
  c => c.item_template?.type === 'glass'
);
```

### Validações

- Preço de venda deve ser maior ou igual ao custo
- Ao ativar produto com vidro, exigir ao menos uma configuração de cor/espessura
- Alertar se margem de lucro for negativa ou muito baixa

---

## Interface de Usuário - Prévia Visual

### Tab de Preços no Diálogo de Ativação

```text
┌──────────────────────────────────────────────────────────────┐
│  ⚡ Definir Preços                                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📦 Preço do Produto                                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Custo/m²:    R$ [_______]                              │ │
│  │  Venda/m²:    R$ [_______]                              │ │
│  │  Margem:      ⬤ 35.5%                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  🔷 Preços de Vidro (produto contém 2 painéis de vidro)     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Cores: [Incolor] [Verde] [Fumê] [Bronze] [+ Adicionar] │ │
│  │  Espessuras: [4mm] [6mm] [8mm] [+ Adicionar]            │ │
│  │                                                         │ │
│  │  Matriz de Preços:                                      │ │
│  │  ┌──────────┬─────────┬─────────┬─────────┐             │ │
│  │  │   Cor    │   4mm   │   6mm   │   8mm   │             │ │
│  │  ├──────────┼─────────┼─────────┼─────────┤             │ │
│  │  │ Incolor  │ C:___   │ C:___   │ C:___   │             │ │
│  │  │          │ V:___   │ V:___   │ V:___   │             │ │
│  │  ├──────────┼─────────┼─────────┼─────────┤             │ │
│  │  │ Verde    │ C:___   │ C:___   │ C:___   │             │ │
│  │  │          │ V:___   │ V:___   │ V:___   │             │ │
│  │  └──────────┴─────────┴─────────┴─────────┘             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│                    [Voltar]  [Ativar Produto]                │
└──────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/produtos/ProductPricingStep.tsx` | **Criar** | Componente de configuração de preços |
| `src/components/produtos/EditProductPricingDialog.tsx` | **Criar** | Diálogo para editar preços de produtos ativos |
| `src/components/produtos/GlassPricingMatrix.tsx` | **Criar** | Componente de matriz de preços de vidro (reutilizável) |
| `src/components/produtos/ActivateWithCompositionDialog.tsx` | **Modificar** | Adicionar etapa de preços |
| `src/components/produtos/CreateCustomProductDialog.tsx` | **Modificar** | Adicionar opção de vidro e preços |
| `src/pages/ProdutosLinha.tsx` | **Modificar** | Adicionar indicadores de preço e botão de edição |
| `src/hooks/useProductGlassPricing.ts` | **Criar** | Hook para gerenciar preços de vidro por produto |
| `src/pages/PrecosEmpresa.tsx` | **Simplificar** | Converter para visualização apenas |

---

## Benefícios da Mudança

1. **Experiência mais intuitiva**: Preço definido no contexto do produto
2. **Menos navegação**: Não precisa ir para outro módulo
3. **Fluxo completo**: Ativar produto + definir preço em um só lugar
4. **Contexto visual**: Ver o produto enquanto define o preço
5. **Menos erros**: Garantir que preços sejam configurados na ativação
6. ** Aplicar as mudanças no orçamento, para que ao escolher a cor do vidros ( pra produtos que tem vidros em sua composiçao) altere automaticamente