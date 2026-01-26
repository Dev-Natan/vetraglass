
## Correção do Processo de Venda - Registro de Entradas e Parcelas

### Problemas Identificados

Após análise detalhada do código, identifiquei os seguintes problemas no fluxo de aprovação de orçamentos:

#### 1. Entrada (Sinal) Não Registrada na Tabela Correta
O sistema possui uma tabela `quote_deposits` projetada para rastrear entradas/sinais de orçamentos, porém o diálogo de aprovação (`AprovarOrcamentoDialog.tsx`) **NÃO insere registros nessa tabela**. Ele apenas cria um registro de "venda parcial" na tabela `sales`.

**Impacto:**
- A entrada não aparece no Dashboard Financeiro da OS (que busca em `quote_deposits`)
- Os alertas de "Entradas Pendentes" no Caixa não funcionam
- A visibilidade do sinal fica comprometida em várias telas

#### 2. Parcelas Sendo Criadas Mesmo Quando Não Deveriam
A lógica de criação de parcelas usa `pendingAmount > 0`, mas não considera corretamente o tipo de condição de pagamento (à vista vs parcelado).

---

### Correções Planejadas

#### Arquivo: `src/components/orcamentos/AprovarOrcamentoDialog.tsx`

**Mudança 1: Criar registro em `quote_deposits`**

```text
Após a linha 319 (criação da OS), adicionar:

if (hasEntry) {
  // Criar registro de depósito/entrada
  await supabase.from('quote_deposits').insert({
    company_id: currentCompany.id,
    quote_id: quote.id,
    ordem_servico_id: ordemServico.id,
    customer_name: quote.customer_name,
    customer_phone: quote.customer_phone,
    amount: entryValue,
    payment_method: entryPaymentMethod,
    status: isCaixaAberto ? 'received' : 'pending',
    cash_register_id: isCaixaAberto ? openCashRegister.id : null,
    created_by: user.id,
  });
}
```

**Mudança 2: Adicionar registro de `accounts_receivable` para a entrada**

A entrada também deve aparecer em `accounts_receivable` com tipo `entrada_orcamento`:

```text
if (hasEntry) {
  await supabase.from('accounts_receivable').insert({
    company_id: currentCompany.id,
    ordem_servico_id: ordemServico.id,
    quote_id: quote.id,
    customer_name: quote.customer_name,
    description: `Entrada - Orç. #${quote.quote_number.toString().padStart(4, '0')}`,
    total_amount: entryValue,
    paid_amount: isCaixaAberto ? entryValue : null,
    status: isCaixaAberto ? 'paid' : 'pending',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    receivable_type: 'entrada_orcamento',
    installment_number: 0,
    total_installments: 0,
    created_by: user.id,
  });
}
```

**Mudança 3: Atualizar OS com `paid_amount` incluindo a entrada**

Garantir que a OS reflita o valor já recebido:

```text
// Linha 292-318: Na criação da OS
paid_amount: hasEntry && isCaixaAberto ? entryValue : 0,
```

---

### Arquivo: `src/components/ordens-servico/OSFinancialDashboard.tsx`

**Mudança 4: Fallback para exibição de entrada**

Se não houver `quote_deposits`, buscar em `sales` com `sale_type: 'partial'`:

```text
// Adicionar lógica de fallback no query
const { data: entrySale } = useQuery({
  queryKey: ['os-entry-sale', ordemServicoId],
  queryFn: async () => {
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('ordem_servico_id', ordemServicoId)
      .eq('sale_type', 'partial')
      .maybeSingle();
    return data;
  },
  enabled: !!ordemServicoId && !depositInfo,
});
```

---

### Resumo das Alterações

| Componente | Alteração |
|------------|-----------|
| `AprovarOrcamentoDialog.tsx` | Inserir em `quote_deposits` ao aprovar |
| `AprovarOrcamentoDialog.tsx` | Criar `accounts_receivable` tipo `entrada_orcamento` |
| `AprovarOrcamentoDialog.tsx` | Atualizar `paid_amount` da OS corretamente |
| `OSFinancialDashboard.tsx` | Adicionar fallback para exibir entrada via `sales` |

---

### Resultado Esperado

Após as correções:
- A entrada aparecerá no Dashboard Financeiro da OS
- Os alertas de depósitos pendentes funcionarão corretamente
- O valor da entrada será exibido nas vendas do caixa
- As parcelas serão criadas apenas para o saldo restante
- O rastreamento financeiro será consistente em todo o sistema

---

### Detalhes Técnicos

**Tabelas Envolvidas:**
- `quote_deposits` - Rastreia entradas/sinais de orçamentos
- `accounts_receivable` - Unifica todas as cobranças (entrada + parcelas)
- `sales` - Registra movimentações de caixa
- `ordens_servico` - Armazena totais (total, pago, pendente)

**Fluxo Corrigido:**
```text
Aprovar Orçamento
       │
       ▼
┌──────────────────┐
│ Criar OS         │
│ paid_amount = 0  │
│ ou entryValue    │
└────────┬─────────┘
         │
    Tem entrada?
    ┌────┴────┐
   SIM       NÃO
    │         │
    ▼         │
┌────────────┐│
│ INSERT     ││
│ quote_     ││
│ deposits   ││
└─────┬──────┘│
      │       │
      ▼       │
┌────────────┐│
│ INSERT     ││
│ accounts_  ││
│ receivable ││
│ (entrada)  ││
└─────┬──────┘│
      │       │
      ▼       ▼
┌─────────────────┐
│ Caixa aberto?   │
│ → INSERT sales  │
│ → INSERT sale_  │
│   items         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ INSERT accounts_│
│ receivable      │
│ (parcelas)      │
└─────────────────┘
```
