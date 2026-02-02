
# Plano: Adaptar Página de Vendas (CaixaVendas) às Mudanças do Fluxo de Orçamentos

## Contexto das Mudanças Realizadas

O fluxo de venda de orçamentos foi corrigido para:
1. O botão "Concluir" na página de OS agora abre o `FaturarSaldoDialog`
2. Vendas parciais são atualizadas para vendas completas (em vez de criar novas)
3. Entradas (`cash_movements`) são vinculadas à venda final

## Problemas Atuais na Página de Vendas

A página `CaixaVendas` e seus componentes não reconhecem adequadamente:

| Componente | Problema |
|------------|----------|
| `VendasTable` | Mostra apenas "Paga" ou "Cancelada", não diferencia vendas parciais |
| `DetalhesVendaDialog` | Não exibe histórico de entradas vinculadas nem saldo pendente |
| `CaixaVendas` | Não filtra/destaca vendas de orçamentos vs vendas diretas |
| Resumo do caixa | Não considera entradas de orçamento nos cálculos |

## Alterações Necessárias

### 1. `src/components/caixa/VendasTable.tsx`

Adicionar suporte a novos status de pagamento:

**Antes:**
- `paid` → Badge verde "Paga"
- `cancelled` → Badge vermelha "Cancelada"

**Depois:**
- `paid` → Badge verde "Paga"
- `partial` → Badge amarela "Parcial" com indicador de valor recebido
- `pending` → Badge laranja "Pendente"
- `cancelled` → Badge vermelha "Cancelada"

Também adicionar coluna para diferenciar vendas de orçamento:
- Se `quote_id` existir → Badge "Orçamento"
- Se `sale_type === 'partial'` → Badge "Entrada"

### 2. `src/components/caixa/DetalhesVendaDialog.tsx`

Expandir para exibir informações financeiras completas:

- Buscar `accounts_receivable` vinculados à venda
- Exibir histórico de entradas pagas
- Mostrar saldo pendente se houver
- Exibir progressão de pagamentos (entrada → saldo)

### 3. `src/pages/CaixaVendas.tsx`

- Atualizar interface `Sale` para incluir `sale_type`, `quote_id`, `paid_amount`, `pending_amount`
- Modificar a query de vendas para incluir esses novos campos
- Atualizar `cashSummary` para considerar entradas de orçamento separadamente

### 4. `src/components/caixa/VendasTable.tsx` - Interface

Atualizar a interface `Sale` para receber campos adicionais:

```typescript
interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  // Novos campos
  sale_type?: 'full' | 'partial';
  quote_id?: string | null;
  paid_amount?: number;
  pending_amount?: number;
}
```

## Detalhes da Implementação

### VendasTable - Status Dinâmico

```typescript
// Configuração de status expandida
const paymentStatusConfig = {
  paid: { label: 'Paga', color: 'bg-green-100 text-green-700' },
  partial: { label: 'Parcial', color: 'bg-yellow-100 text-yellow-700' },
  pending: { label: 'Pendente', color: 'bg-orange-100 text-orange-700' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

// Renderização do status
{sale.sale_type === 'partial' && sale.pending_amount > 0 ? (
  <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
    Parcial ({formatCurrency(sale.paid_amount || 0)} / {formatCurrency(sale.total_amount)})
  </Badge>
) : isCancelled ? (
  <Badge variant="destructive">Cancelada</Badge>
) : (
  <Badge className="bg-green-100 text-green-700">Paga</Badge>
)}
```

### DetalhesVendaDialog - Histórico de Pagamentos

```typescript
// Nova query para buscar pagamentos
const { data: paymentHistory } = useQuery({
  queryKey: ['sale-payments', sale?.id],
  queryFn: async () => {
    if (!sale?.id) return [];
    
    const { data: movements } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('sale_id', sale.id)
      .order('created_at', { ascending: true });
    
    return movements || [];
  },
  enabled: !!sale?.id && open,
});

// Renderizar timeline de pagamentos
<div className="space-y-2">
  <h4>Histórico de Pagamentos</h4>
  {paymentHistory.map(payment => (
    <div key={payment.id} className="flex justify-between text-sm">
      <span>{format(new Date(payment.created_at), 'dd/MM HH:mm')}</span>
      <span className="text-green-600">+{formatCurrency(payment.amount)}</span>
    </div>
  ))}
</div>
```

### CaixaVendas - Query Atualizada

```typescript
// Query de vendas com campos adicionais
const { data: todaySales = [] } = useQuery({
  queryKey: ['sales-today', openCashRegister?.id],
  queryFn: async () => {
    if (!openCashRegister?.id) return [];
    const { data, error } = await supabase
      .from('sales')
      .select('*, quote_id, sale_type, paid_amount, pending_amount')
      .eq('cash_register_id', openCashRegister.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
  enabled: !!openCashRegister?.id,
});
```

## Arquivos a Modificar

| Arquivo | Alteração Principal |
|---------|---------------------|
| `src/components/caixa/VendasTable.tsx` | Adicionar status parcial, badges de origem, interface expandida |
| `src/components/caixa/DetalhesVendaDialog.tsx` | Adicionar histórico de pagamentos e resumo financeiro |
| `src/pages/CaixaVendas.tsx` | Expandir query de vendas para incluir novos campos |

## Benefícios

1. **Visibilidade completa**: Operador de caixa vê entradas de orçamento e saldos
2. **Rastreabilidade**: Cada pagamento aparece no histórico da venda
3. **Consistência**: Mesma informação na OS, Orçamento e Caixa
4. **Operação simplificada**: Status visual claro de cada venda
