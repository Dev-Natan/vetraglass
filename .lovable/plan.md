
# Plano: Corrigir Preservação do Desconto do Orçamento na Aprovação

## Problemas Identificados

Analisando o código e o banco de dados, identifiquei **dois problemas** no fluxo de desconto:

### Problema 1: Desconto do Orçamento Ignorado

| Etapa | O que acontece | O que deveria acontecer |
|-------|----------------|-------------------------|
| Criação | Orçamento com 10% desconto → `final_amount = 900` | OK |
| Aprovação | Sistema usa `totalOriginal = SUM(items.total_price) = 1000` | Deveria usar `final_amount = 900` |
| Resultado | Desconto de 10% **perdido** | Desconto deveria ser **preservado** |

**Causa Raiz:**
```typescript
// src/hooks/usePriceRevision.ts linha 136
const totalOriginal = items.reduce((sum, item) => sum + item.total_price, 0);
// ↑ Soma os preços dos ITENS, ignora o desconto do ORÇAMENTO
```

### Problema 2: Desconto Duplicado da Condição de Pagamento

O banco de dados mostra que existe uma condição "À vista com 5% desconto":

| Condição | desconto_percent |
|----------|-----------------|
| À vista com 5% desconto | 5% |
| À vista sem desconto | 0% |
| 2x sem juros | 0% |

Quando o usuário já aplicou 10% de desconto no orçamento e depois seleciona "À vista com 5% desconto", o sistema aplica **5% adicional**, resultando em ~15% de desconto total.

---

## Solução Proposta

### Arquitetura da Correção

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO CORRETO DE DESCONTOS                               │
└─────────────────────────────────────────────────────────────────────────────┘

ANTES (errado):                          DEPOIS (correto):
───────────────                          ─────────────────

  valorBase = SUM(items.total_price)      valorBase = quote.final_amount
       = R$ 1.000,00                           = R$ 900,00 (já com 10%)
             │                                       │
             ▼                                       ▼
  Condição "À vista 5%"                   Condição "À vista SEM desconto"
  aplica -5%                              (escolhida automaticamente se
             │                             já há desconto no orçamento)
             ▼                                       │
  valorFinal = R$ 950,00                  valorFinal = R$ 900,00
             │                                       │
             ▼                                       ▼
  ERRADO: perdeu 10%                      CORRETO: preservou 10%
          e aplicou 5%
```

---

## Mudanças Técnicas

### 1. Modificar Interface do Quote no AprovarOrcamentoDialog

**Arquivo:** `src/components/orcamentos/AprovarOrcamentoDialog.tsx`

Adicionar campos de desconto à interface Quote:

```typescript
interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address?: string | null;
  total_amount: number;          // Subtotal (sem desconto)
  discount_percent?: number;     // NOVO: % de desconto
  discount_amount?: number;      // NOVO: Valor do desconto
  final_amount: number;          // Valor final (com desconto)
  created_at?: string;
}
```

### 2. Usar `final_amount` como Base de Cálculo

**Arquivo:** `src/components/orcamentos/AprovarOrcamentoDialog.tsx`

Modificar o cálculo do `valorBase` para usar `quote.final_amount` quando não houver reajuste de preços:

```typescript
// Valor base considera o desconto JÁ APLICADO no orçamento
const valorBase = useMemo(() => {
  if (useCurrentPrices) {
    // Se usar preços atuais, recalcula com base nos itens revisados
    return revisedItems.reduce((sum, item) => {
      const useCurrentForItem = itemPriceOverrides[item.id] !== false;
      return sum + (useCurrentForItem && item.currentCalculatedTotal 
        ? item.currentCalculatedTotal 
        : item.total_price);
    }, 0);
  }
  // Se não usar preços atuais, usa o final_amount do orçamento
  // que JÁ inclui o desconto aplicado na criação
  return quote?.final_amount || totalOriginal;
}, [useCurrentPrices, revisedItems, itemPriceOverrides, totalOriginal, quote]);
```

### 3. Exibir Informação do Desconto Existente

Mostrar ao usuário que já existe um desconto aplicado:

```typescript
// Indicador de desconto existente
const quoteDiscountPercent = quote?.discount_percent || 0;
const hasExistingDiscount = quoteDiscountPercent > 0;

// Na UI, mostrar aviso:
{hasExistingDiscount && (
  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200">
    <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
      <Percent className="w-4 h-4" />
      <span className="font-medium">
        Desconto de {quoteDiscountPercent}% já aplicado no orçamento
      </span>
    </div>
    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
      Valor original: {formatCurrency(quote.total_amount)} → 
      Valor com desconto: {formatCurrency(quote.final_amount)}
    </p>
  </div>
)}
```

### 4. Inteligência na Seleção de Condição de Pagamento

Quando já existe desconto no orçamento, sugerir condições SEM desconto adicional:

```typescript
// Auto-selecionar condição sem desconto se já houver desconto no orçamento
useEffect(() => {
  if (hasExistingDiscount && condicoesPagamento.length > 0) {
    // Procurar condição sem desconto
    const condicaoSemDesconto = condicoesPagamento.find(c => 
      c.desconto_percent === 0 && c.parcelas === 1
    );
    if (condicaoSemDesconto) {
      setSelectedCondicaoId(condicaoSemDesconto.id);
    }
  }
}, [hasExistingDiscount, condicoesPagamento]);
```

### 5. Mostrar Resumo Completo de Descontos

Na etapa de confirmação, mostrar breakdown completo:

```text
┌─────────────────────────────────────────────────┐
│ Resumo de Valores                               │
├─────────────────────────────────────────────────┤
│ Subtotal (itens)           R$ 1.000,00          │
│ Desconto do orçamento (10%)   -R$ 100,00        │
│ Valor com desconto          R$ 900,00           │
│ Desconto condição pagto (0%)    R$ 0,00         │
│ ────────────────────────────────────────        │
│ VALOR FINAL                 R$ 900,00           │
└─────────────────────────────────────────────────┘
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/orcamentos/AprovarOrcamentoDialog.tsx` | Usar `final_amount`, exibir desconto existente |
| `src/pages/Orcamentos.tsx` | Passar `discount_percent`, `discount_amount` para o dialog |

---

## Fluxo Correto Após Correção

```text
Cenário: Orçamento com 10% de desconto
─────────────────────────────────────

1. Criação do orçamento:
   - Subtotal: R$ 1.000,00
   - Desconto: 10%
   - Final: R$ 900,00 ✓

2. Aprovação:
   - valorBase = quote.final_amount = R$ 900,00 ✓
   - Exibe: "Desconto de 10% já aplicado"
   - Auto-seleciona: "À vista sem desconto"

3. Condição de pagamento:
   - "À vista sem desconto": valor permanece R$ 900,00 ✓
   - "2x sem juros": 2x de R$ 450,00 ✓

4. Resultado final:
   - Valor da OS: R$ 900,00 ✓
   - Desconto preservado ✓
```

---

## Caso Especial: Reajuste de Preços

Se o usuário optar por "Usar preços atuais" (reajuste), o desconto original deve ser reaplicado:

```typescript
// Se usar preços atuais, reaplicar % de desconto do orçamento
const valorBaseComReajuste = revisedItems.reduce(...); // soma dos itens atualizados
const valorBaseAjustado = hasExistingDiscount 
  ? valorBaseComReajuste * (1 - quoteDiscountPercent / 100)
  : valorBaseComReajuste;
```

---

## Critérios de Aceite

1. **Desconto preservado:** Se orçamento tem 10% desconto, aprovação usa R$ 900 (não R$ 1.000)
2. **Indicador visual:** Mostra "Desconto de 10% já aplicado" na aprovação
3. **Seleção inteligente:** Se há desconto, pré-seleciona condição sem desconto adicional
4. **Breakdown completo:** Resumo mostra subtotal, desconto orçamento, desconto condição, valor final
5. **Reajuste correto:** Se usar preços atuais, reaplicar % de desconto aos novos valores
6. **Sem duplicação:** Não aplicar desconto de condição sobre valor já descontado (a menos que intencionalmente selecionado)

---

## Seção Técnica

### Mudança Principal no valorBase

```typescript
// ANTES (errado):
const valorBase = useMemo(() => {
  if (useCurrentPrices) {
    return revisedItems.reduce(...);
  }
  return totalOriginal; // ← Soma dos itens, ignora desconto
}, ...);

// DEPOIS (correto):
const valorBase = useMemo(() => {
  if (useCurrentPrices) {
    // Recalcular com preços atuais E reaplicar desconto
    const revisedTotal = revisedItems.reduce(...);
    const quoteDiscountPercent = quote?.discount_percent || 0;
    return revisedTotal * (1 - quoteDiscountPercent / 100);
  }
  // Usar final_amount que JÁ tem o desconto
  return quote?.final_amount || totalOriginal;
}, ...);
```

### Dados Passados ao Dialog

```typescript
// src/pages/Orcamentos.tsx - ao chamar AprovarOrcamentoDialog
// O Quote já tem discount_percent e final_amount da query
// Só precisamos garantir que esses campos estão na interface
```
