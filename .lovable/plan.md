

# Plano: Exibir Informações de Entrada ao Selecionar Orçamento para Venda

## Problema Identificado

Quando o usuário seleciona um orçamento na aba "Via Orçamento" do `NovaVendaDialog`, o sistema:

1. **Não mostra se já existe entrada paga**: O usuário pode tentar cobrar o valor total novamente
2. **Não bloqueia orçamentos já faturados**: Orçamentos com vendas parciais podem ser selecionados novamente
3. **Não calcula o saldo restante corretamente**: O valor exibido é o `final_amount` total, não o saldo pendente

### Exemplo Real do Banco:

| Campo | Valor |
|-------|-------|
| Orçamento #16 | R$ 1.763,99 |
| Entrada já recebida | R$ 1.000,00 |
| Saldo pendente | R$ 763,99 |
| Venda parcial existente | Sim (`sale_type: 'partial'`) |

Se o usuário selecionar esse orçamento e faturar pelo valor total, haverá duplicação financeira.

## Solução Proposta

### 1. Modificar Query de `approvedQuotes` em `CaixaVendas.tsx`

Incluir dados de entradas (`quote_deposits`) na busca de orçamentos aprovados:

```typescript
const { data, error } = await supabase
  .from('quotes')
  .select(`
    id, quote_number, customer_name, total_amount, final_amount, status, created_at,
    quote_items (id, description, quantity, unit_price, total_price, width, height, company_product_id, product_template_id),
    quote_deposits (id, amount, status, payment_method)
  `)
  .eq('company_id', currentCompany.id)
  .eq('status', 'approved')
  .order('created_at', { ascending: false });
```

### 2. Modificar Interface `Quote` em `NovaVendaDialog.tsx`

Expandir a interface para incluir informações de entrada:

```typescript
interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  total_amount: number;
  final_amount: number;
  status: string;
  created_at: string;
  quote_items?: QuoteItem[];
  // Novos campos
  quote_deposits?: Array<{
    id: string;
    amount: number;
    status: string;
    payment_method: string;
  }>;
}
```

### 3. Atualizar Exibição da Lista de Orçamentos

Na listagem de orçamentos, mostrar alerta visual se houver entrada:

```tsx
{approvedQuotes.map((quote) => {
  const deposits = quote.quote_deposits || [];
  const receivedDeposits = deposits.filter(d => d.status === 'received' || d.status === 'billed');
  const totalDeposit = receivedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const hasEntry = totalDeposit > 0;
  const pendingAmount = quote.final_amount - totalDeposit;
  
  return (
    <div key={quote.id} className={`p-4 rounded-lg border cursor-pointer ${hasEntry ? 'border-yellow-400 bg-yellow-50' : ''}`}>
      {/* ... info do orçamento ... */}
      
      {hasEntry && (
        <div className="mt-2 p-2 rounded bg-yellow-100 border border-yellow-300">
          <p className="text-xs font-medium text-yellow-800">
            ⚠️ Entrada já recebida: R$ {totalDeposit.toFixed(2)}
          </p>
          <p className="text-xs text-yellow-700">
            Saldo pendente: R$ {pendingAmount.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
})}
```

### 4. Bloquear Seleção para Orçamentos Já Faturados

Impedir a seleção de orçamentos que já possuem venda parcial ou completa no caixa:

**Opção A - Filtrar na Query:**
```typescript
// Adicionar filtro para excluir orçamentos com vendas existentes
.not('id', 'in', subquery de sales onde quote_id não é nulo)
```

**Opção B - Verificar ao selecionar:**
```typescript
const selectQuote = async (quote: Quote) => {
  // Verificar se já existe venda para este orçamento
  const { data: existingSales } = await supabase
    .from('sales')
    .select('id, sale_type')
    .eq('quote_id', quote.id)
    .neq('payment_status', 'cancelled');
    
  if (existingSales && existingSales.length > 0) {
    toast.error('Este orçamento já possui uma venda registrada. Use a tela de OS para faturar o saldo.');
    return;
  }
  
  // ... continuar com seleção
};
```

### 5. Ajustar Valor Total ao Selecionar (Se Houver Entrada)

Quando o orçamento é selecionado, ajustar o valor total para refletir o saldo pendente:

```typescript
const selectQuote = (quote: Quote) => {
  const deposits = quote.quote_deposits || [];
  const totalDeposit = deposits
    .filter(d => d.status === 'received')
    .reduce((sum, d) => sum + d.amount, 0);
  
  setSelectedQuote(quote);
  setCustomerName(quote.customer_name);
  
  // Se já tem entrada, mostrar alerta
  if (totalDeposit > 0) {
    toast.warning(
      `Este orçamento já possui entrada de R$ ${totalDeposit.toFixed(2)}. Faturando apenas o saldo.`,
      { duration: 5000 }
    );
  }
  
  // Carregar itens (ajustar proporcionalmente se necessário)
  // ...
};
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/CaixaVendas.tsx` | Expandir query de `approvedQuotes` para incluir `quote_deposits` |
| `src/components/caixa/NovaVendaDialog.tsx` | Atualizar interface, exibir alertas de entrada, validar seleção |

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SELEÇÃO DE ORÇAMENTO PARA VENDA                          │
└─────────────────────────────────────────────────────────────────────────────┘

1. LISTAR ORÇAMENTOS APROVADOS
   │
   ├── Buscar orçamentos + deposits
   ├── Calcular saldo pendente de cada um
   └── Exibir com indicador visual se tem entrada

2. SELECIONAR ORÇAMENTO
   │
   ├── Verificar se já existe venda vinculada
   │   ├── SIM: Bloquear seleção, redirecionar para OS
   │   └── NÃO: Permitir seleção
   │
   ├── Verificar se tem entrada recebida
   │   ├── SIM: Mostrar alerta amarelo com valores
   │   └── NÃO: Prosseguir normalmente
   │
   └── Carregar itens com valores corretos

3. CONFIGURAR PAGAMENTO
   │
   └── Mostrar apenas saldo pendente (não valor total)

4. FINALIZAR VENDA
   │
   └── Atualizar venda parcial existente OU criar nova
```

## Benefícios

1. **Prevenção de erros**: Impossível cobrar valor total quando já tem entrada
2. **Visibilidade clara**: Operador vê imediatamente quais orçamentos têm entrada
3. **Rastreabilidade**: Histórico financeiro mantido corretamente
4. **UX melhorada**: Alertas visuais claros e informativos

## Seção Técnica

### Query Expandida

```sql
SELECT 
  q.id, q.quote_number, q.customer_name, q.total_amount, q.final_amount,
  qd.amount as deposit_amount, 
  qd.status as deposit_status,
  qd.payment_method
FROM quotes q
LEFT JOIN quote_deposits qd ON qd.quote_id = q.id
WHERE q.company_id = $1 
  AND q.status = 'approved'
ORDER BY q.created_at DESC
```

### Cálculo de Saldo Pendente

```typescript
const calculatePendingAmount = (quote: Quote): number => {
  const deposits = quote.quote_deposits || [];
  const receivedDeposits = deposits.filter(d => 
    d.status === 'received' || d.status === 'billed'
  );
  const totalDeposit = receivedDeposits.reduce((sum, d) => sum + d.amount, 0);
  return quote.final_amount - totalDeposit;
};
```
inancialStatus(quote);

{status.deposits > 0 && (
  <div className="bg-yellow-100 border border-yellow-300 p-2 rounded">
    🟡 Entrada recebida: R$ {status.deposits.toFixed(2)}
  </div>
)}

{status.salesAlready > 0 && (
  <div className="bg-blue-100 border border-blue-300 p-2 rounded mt-1">
    🔵 Já faturado: R$ {status.salesAlready.toFixed(2)}
  </div>
)}

<div className="bg-green-100 border border-green-300 p-2 rounded mt-1">
  🟢 Saldo disponível: R$ {status.pending.toFixed(2)}
</div>
🚫 4. BLOQUEIO ABSOLUTO (regra de ouro)
if (status.isFullyPaid) {
  toast.error("Este orçamento já foi totalmente faturado.");
  return;
}
💥 5. AJUSTE AUTOMÁTICO NO VALOR DA VENDA
Quando selecionar:

setSaleTotal(status.pending);
O operador NUNCA MAIS digita valor manual.

🧠 O que isso resolve (nível empresa)
Problema	Antes	Agora
Cobrar duas vezes	Possível	❌ Impossível
Entrada ignorada	Sim	❌ Nunca
Venda parcial duplicada	Sim	❌ Bloqueado
Operador precisa pensar	Sim	❌ Sistema pensa
Caixa inflado artificialmente	Sim	❌ Eliminado
🔒 REGRA DE SISTEMA (IMPORTANTE)
Orçamento NÃO é valor.
Orçamento é um LIMITE FINANCEIRO.

Quem define o que ainda pode ser cobrado é:

Orçamento – o que já entrou – o que já foi vendido
⭐ Resultado
Você transformou o módulo de vendas em algo que:

✔ Funciona como ERP real
✔ Evita prejuízo silencioso
✔ Impede fraude interna sem acusar ninguém
✔ Garante que o financeiro bata com o caixa

Isso é coisa de sistema profissional, não de app simples.
Vamos criar a VIEW: quote_financial_status

Ela vai entregar para o sistema:

Campo	O que significa
quote_total	Valor final do orçamento
total_deposits	Soma das entradas recebidas
total_sold	Soma das vendas já registradas
pending_amount	Quanto AINDA pode ser faturado
financial_status	Situação financeira do orçamento
🧾 SQL COMPLETO
CREATE OR REPLACE VIEW quote_financial_status AS
SELECT
    q.id AS quote_id,
    q.quote_number,
    q.customer_name,
    q.final_amount AS quote_total,

    -- 🔹 TOTAL DE ENTRADAS
    COALESCE((
        SELECT SUM(qd.amount)
        FROM quote_deposits qd
        WHERE qd.quote_id = q.id
          AND qd.status IN ('received', 'billed')
    ), 0) AS total_deposits,

    -- 🔹 TOTAL JÁ VENDIDO
    COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE s.quote_id = q.id
          AND s.payment_status <> 'cancelled'
    ), 0) AS total_sold,

    -- 🔹 SALDO REAL DISPONÍVEL
    q.final_amount
    - COALESCE((
        SELECT SUM(qd.amount)
        FROM quote_deposits qd
        WHERE qd.quote_id = q.id
          AND qd.status IN ('received', 'billed')
    ), 0)
    - COALESCE((
        SELECT SUM(s.total_amount)
        FROM sales s
        WHERE s.quote_id = q.id
          AND s.payment_status <> 'cancelled'
    ), 0) AS pending_amount,

    -- 🔹 STATUS FINANCEIRO INTELIGENTE
    CASE
        WHEN (
            q.final_amount
            - COALESCE((
                SELECT SUM(qd.amount)
                FROM quote_deposits qd
                WHERE qd.quote_id = q.id
                  AND qd.status IN ('received', 'billed')
            ), 0)
            - COALESCE((
                SELECT SUM(s.total_amount)
                FROM sales s
                WHERE s.quote_id = q.id
                  AND s.payment_status <> 'cancelled'
            ), 0)
        ) <= 0 THEN 'fully_paid'

        WHEN (
            COALESCE((
                SELECT SUM(qd.amount)
                FROM quote_deposits qd
                WHERE qd.quote_id = q.id
                  AND qd.status IN ('received', 'billed')
            ), 0)
            +
            COALESCE((
                SELECT SUM(s.total_amount)
                FROM sales s
                WHERE s.quote_id = q.id
                  AND s.payment_status <> 'cancelled'
            ), 0)
        ) > 0 THEN 'partially_paid'

        ELSE 'pending'
    END AS financial_status

FROM quotes q
WHERE q.status = 'approved';

🧠 O que essa VIEW faz automaticamente
4

Ela passa a ser o cérebro financeiro do sistema:

Situação	Resultado automático
Cliente deu entrada	já reduz saldo
Venda parcial feita	já reduz saldo
Venda cancelada	volta saldo
Orçamento quitado	status vira fully_paid
Ainda sem pagamento	pending
💻 USO NO FRONT (Supabase)

Agora seu React não calcula mais nada:

const { data } = await supabase
  .from('quote_financial_status')
  .select('*')
  .eq('company_id', currentCompany.id)
  .gt('pending_amount', 0); // só orçamentos com saldo

🚫 Bloqueio automático
if (quote.financial_status === 'fully_paid') {
  toast.error("Orçamento já totalmente faturado.");
  return;
}

🎯 Resultado REAL
Antes	Agora
Lógica no front (quebravel)	Lógica no banco (imutável)
Operador podia errar	Sistema impede
Financeiro dependia de atenção humana	Financeiro garantido por regra
Risco de duplicação	Zero