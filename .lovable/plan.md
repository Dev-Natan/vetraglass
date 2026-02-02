

# Plano: Corrigir Rastreamento de Entrada do Orçamento na Venda Final

## Problema Identificado

Quando um orçamento é **aprovado com entrada** e posteriormente **faturado**, o valor da entrada não está sendo corretamente vinculado e exibido no histórico da venda. O fluxo atual cria registros separados que não estão sendo corretamente mesclados.

### Diagnóstico Detalhado

**Situação Atual:**

| Etapa | O que acontece | Problema |
|-------|----------------|----------|
| 1. Aprovação com Entrada | Cria `quote_deposit`, `cash_movement`, e `sales (partial)` | O `cash_movement` fica com `sale_id: null` |
| 2. Faturamento Final | Busca `quote_deposits` mas não vincula corretamente | A venda final não reconhece a entrada anterior |

**Dados no Banco (exemplo real):**

```text
quote_deposits:
  - amount: R$ 1.000
  - cash_movement_id: a9b21ae7 (vinculado)
  - status: received

cash_movements:
  - amount: R$ 1.000
  - origem: orcamento
  - sale_id: NULL  ← PROBLEMA: deveria ter sale_id da venda parcial

sales (partial):
  - total_amount: R$ 1.000
  - sale_type: partial
  - pending_amount: R$ 764 ← Incorreto, deveria ser o restante do orçamento total
```

## Solução Proposta

Corrigir **dois pontos** no fluxo:

### 1. `AprovarOrcamentoDialog.tsx` - Vincular `cash_movement` à venda parcial

Quando a entrada é registrada na aprovação, o `cash_movement` já está sendo vinculado à venda (linha ~454-458), mas o código está após a criação da venda. Verificar se está funcionando corretamente.

**Mudança:** Garantir que ao criar o `cash_movement`, ele seja imediatamente vinculado à venda parcial:

```typescript
// Linha ~398-413: Já existe o update, mas precisa garantir execução
if (cashMovement?.id) {
  await supabase
    .from('cash_movements')
    .update({ sale_id: sale.id })
    .eq('id', cashMovement.id);
}
```

### 2. `FaturarSaldoDialog.tsx` - Reconhecer entrada da venda parcial existente

O problema principal está aqui. O diálogo de faturamento:
- Busca `quote_deposits` ✅
- Busca `sales` com `sale_type: 'partial'` ✅
- Mas quando cria a venda final, **não está vinculando** corretamente as entradas anteriores

**Correção no fluxo de faturamento (linhas ~141-163):**

Em vez de criar uma **nova venda** para substituir a parcial, o sistema deve:

1. **Atualizar a venda parcial existente** para se tornar a venda completa, ou
2. **Criar a venda final** e explicitamente marcar que as entradas anteriores fazem parte dela

**Abordagem Recomendada - Atualizar a venda parcial:**

```typescript
// Se já existe uma venda parcial, atualizar ela em vez de criar nova
if (existingPartialSale) {
  // Atualizar a venda parcial para venda completa
  await supabase
    .from('sales')
    .update({
      total_amount: totalOrcamento,
      paid_amount: entradaJaRecebida + saldoRestante,
      pending_amount: 0,
      payment_status: 'paid',
      sale_type: 'full',
      notes: `Faturamento completo - OS #${...}`,
    })
    .eq('id', existingPartialSale.id);
    
  // Usar o ID da venda existente
  saleId = existingPartialSale.id;
} else {
  // Criar nova venda (caso não exista parcial)
  // ... código atual
}
```

### 3. `QuoteFinancialDashboard.tsx` - Melhorar exibição das entradas

O componente atual busca apenas **um** `quote_deposit` com `.maybeSingle()`. Se houver múltiplas entradas (pagamentos parciais), elas não serão exibidas.

**Correção (linha ~72-76):**

```typescript
// Antes: .maybeSingle()
// Depois: buscar todas as entradas
const { data, error } = await supabase
  .from('quote_deposits')
  .select('*')
  .eq('quote_id', quoteId)
  .in('status', ['received', 'billed'])  // Incluir faturadas também
  .order('created_at', { ascending: true });

// Retornar array em vez de objeto único
return data || [];
```

E ajustar a exibição para mostrar **todas** as entradas:

```typescript
// Modificar effectiveDeposit para ser array
const allDeposits = depositInfo || [];
const totalDepositAmount = allDeposits.reduce((sum, d) => sum + d.amount, 0);
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO FINANCEIRO CORRIGIDO                                │
└─────────────────────────────────────────────────────────────────────────────┘

1. APROVAÇÃO COM ENTRADA (R$ 1.000)
   │
   ├── quote_deposits ─────────► amount: 1.000, status: received
   ├── cash_movements ─────────► origem: orcamento, sale_id: 123 ✓
   ├── accounts_receivable ────► entrada_orcamento: 1.000, status: paid
   └── sales (partial) ────────► total: 1.000, paid: 1.000, sale_id: 123

2. FATURAMENTO FINAL (Saldo R$ 764)
   │
   ├── sales (atualizar) ──────► total: 1.764, paid: 1.764, type: full
   ├── cash_movements (novo) ──► categoria: venda, amount: 764
   ├── quote_deposits ─────────► status: billed
   └── cash_movements (antigo)─► origem: venda, sale_id: 123 (transferido)

3. RESULTADO FINAL
   │
   └── Uma única venda com:
       ├── Total: R$ 1.764,00
       ├── Recebido: R$ 1.764,00
       ├── Histórico: Entrada R$ 1.000 + Saldo R$ 764
       └── Status: PAGO
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/orcamentos/AprovarOrcamentoDialog.tsx` | Garantir vinculação do `sale_id` no `cash_movement` |
| `src/components/caixa/FaturarSaldoDialog.tsx` | Atualizar venda parcial existente em vez de criar nova |
| `src/components/orcamentos/QuoteFinancialDashboard.tsx` | Buscar múltiplas entradas e exibir histórico completo |

## Benefícios

1. **Rastreabilidade completa**: Todas as entradas vinculadas à venda final
2. **Histórico unificado**: Uma única venda com todo o histórico de pagamentos
3. **Sem duplicação**: Evita criar múltiplas vendas para o mesmo orçamento
4. **Visualização correta**: Dashboard financeiro mostra entrada + saldo

