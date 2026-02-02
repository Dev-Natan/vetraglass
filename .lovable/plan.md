
# Plano: Corrigir Fluxo Automático de Vendas de Orçamento com Entrada

## Resumo do Problema

O sistema atual possui **falhas críticas** no fluxo financeiro de orçamentos:

1. O botão "Concluir" na lista de OS **ignora o faturamento**, simplesmente mudando o status sem registrar a venda
2. O componente `FaturarSaldoDialog` **existe mas nunca é usado**
3. O `cash_movement` da entrada **não está sendo vinculado** à venda parcial (o `sale_id` permanece `NULL`)
4. Não há validação para impedir conclusão de OS sem faturamento

## Arquitetura Proposta

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                    FLUXO CORRETO DE ORÇAMENTO → VENDA                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. APROVAR ORÇAMENTO (com entrada R$ 1.000)                               │
│     ├── quote_deposits ────► amount: 1.000, status: received               │
│     ├── cash_movements ────► origem: orcamento, sale_id: VINCULADO ✓       │
│     ├── sales (partial) ───► total: 1.000, paid: 1.000                     │
│     └── ordens_servico ────► created, paid: 1.000, pending: 764            │
│                                                                             │
│  2. TRABALHAR NA OS                                                         │
│     └── Produção, corte, instalação...                                      │
│                                                                             │
│  3. CONCLUIR OS (OBRIGATÓRIO via FaturarSaldoDialog)                       │
│     ├── Valida que está em status 'in_progress'                            │
│     ├── Abre FaturarSaldoDialog automaticamente                            │
│     ├── Mostra entrada já recebida (R$ 1.000)                              │
│     ├── Calcula saldo restante (R$ 764)                                    │
│     └── Registra forma de pagamento do saldo                               │
│                                                                             │
│  4. FATURAMENTO                                                             │
│     ├── sales: UPDATE → total: 1.764, paid: 1.764, type: full             │
│     ├── cash_movements (entrada): UPDATE → origem: venda, sale_id: X       │
│     ├── cash_movements (saldo): INSERT → venda, 764                        │
│     ├── quote_deposits: UPDATE → status: billed                            │
│     ├── ordens_servico: UPDATE → status: completed, sale_id: X             │
│     └── accounts_receivable: UPDATE → status: paid                         │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

## Alterações Necessárias

### 1. `src/pages/OrdensServico.tsx` - Integrar FaturarSaldoDialog

**Problema**: O botão "Concluir" simplesmente muda o status sem faturar.

**Solução**: Interceptar a conclusão e abrir o `FaturarSaldoDialog` antes.

```typescript
// Adicionar imports
import { FaturarSaldoDialog } from '@/components/caixa/FaturarSaldoDialog';

// Adicionar estado
const [faturarDialogOpen, setFaturarDialogOpen] = useState(false);
const [osToComplete, setOsToComplete] = useState<OrdemServico | null>(null);

// Modificar botão "Concluir"
// ANTES:
onClick={() => updateStatusMutation.mutate({ id: os.id, status: 'completed' })}

// DEPOIS:
onClick={() => {
  setOsToComplete(os);
  setFaturarDialogOpen(true);
}}

// Adicionar o dialog ao final do componente
<FaturarSaldoDialog
  open={faturarDialogOpen}
  onOpenChange={setFaturarDialogOpen}
  ordemServico={osToComplete}
  onSuccess={() => {
    setOsToComplete(null);
    queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
  }}
/>
```

### 2. `src/components/orcamentos/AprovarOrcamentoDialog.tsx` - Corrigir Vinculação

**Problema**: O código tenta vincular `cash_movement.sale_id` mas o banco mostra `NULL`.

**Solução**: Verificar se o update está sendo executado corretamente e adicionar tratamento de erro.

```typescript
// Linha ~454-458 - Adicionar verificação de erro
if (cashMovement?.id && sale?.id) {
  const { error: linkError } = await supabase
    .from('cash_movements')
    .update({ sale_id: sale.id })
    .eq('id', cashMovement.id);
  
  if (linkError) {
    console.error('ERRO ao vincular cash_movement à venda:', linkError);
  } else {
    console.log('✓ cash_movement vinculado à venda:', cashMovement.id, '→', sale.id);
  }
}
```

### 3. `src/components/caixa/FaturarSaldoDialog.tsx` - Ajustes Finais

O componente já está bem implementado, mas precisa de pequenos ajustes:

- Garantir que o diálogo funcione mesmo quando `quote_id` é null
- Melhorar mensagens de feedback
- Adicionar fallback se não houver entradas registradas

### 4. Adicionar Validação de Faturamento (Segurança)

Impedir que uma OS seja marcada como `completed` diretamente via banco sem passar pelo fluxo:

```typescript
// No mutation de update de status, antes de permitir 'completed':
if (status === 'completed') {
  // Verificar se a OS tem valor pendente
  const { data: os } = await supabase
    .from('ordens_servico')
    .select('pending_amount')
    .eq('id', id)
    .single();
    
  if (os && os.pending_amount > 0) {
    throw new Error('OS possui saldo pendente. Use o faturamento para concluir.');
  }
}
```

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/pages/OrdensServico.tsx` | Modificar | Integrar FaturarSaldoDialog no fluxo de conclusão |
| `src/components/orcamentos/AprovarOrcamentoDialog.tsx` | Modificar | Corrigir vinculação do cash_movement à venda |
| `src/components/caixa/FaturarSaldoDialog.tsx` | Modificar | Ajustes de robustez e feedback |

## Validação de Dados Existentes

Para os dados já no banco que estão inconsistentes, um script de correção será necessário:

```sql
-- Corrigir cash_movements sem sale_id mas com quote_deposit vinculado
UPDATE cash_movements cm
SET sale_id = s.id
FROM quote_deposits qd
JOIN sales s ON s.quote_id = qd.quote_id AND s.sale_type = 'partial'
WHERE cm.id = qd.cash_movement_id
  AND cm.sale_id IS NULL
  AND cm.origem = 'orcamento';
```

## Benefícios

1. **Fluxo obrigatório**: Impossível concluir OS sem faturar
2. **Rastreabilidade**: Toda entrada vinculada à venda final
3. **Histórico unificado**: Uma única venda com todo o histórico
4. **Sem duplicação**: Entradas são transferidas, não recriadas
5. **Auditoria**: Possível rastrear todo o ciclo financeiro

## Seção Técnica

### Diagrama de Sequência

```text
Usuário         OrdensServico.tsx       FaturarSaldoDialog        Supabase
   │                   │                        │                     │
   │  Click "Concluir" │                        │                     │
   │──────────────────>│                        │                     │
   │                   │ setState(osToComplete) │                     │
   │                   │ setDialogOpen(true)    │                     │
   │                   │───────────────────────>│                     │
   │                   │                        │ Query: deposits     │
   │                   │                        │────────────────────>│
   │                   │                        │<────────────────────│
   │                   │     Render Dialog      │                     │
   │<───────────────────────────────────────────│                     │
   │                   │                        │                     │
   │  Confirma Faturar │                        │                     │
   │──────────────────────────────────────────>│                     │
   │                   │                        │ Update sales        │
   │                   │                        │ Update cash_mov     │
   │                   │                        │ Update OS→completed │
   │                   │                        │────────────────────>│
   │                   │                        │<────────────────────│
   │                   │   onSuccess()          │                     │
   │                   │<───────────────────────│                     │
   │   Toast: "Faturado!"                       │                     │
   │<──────────────────│                        │                     │
```

### Queries Críticas

A integração irá usar estas queries chave:

1. **Buscar entradas**: `quote_deposits` WHERE `status IN ('received', 'pending')`
2. **Buscar venda parcial**: `sales` WHERE `ordem_servico_id = X AND sale_type = 'partial'`
3. **Atualizar venda**: `UPDATE sales SET sale_type = 'full', paid_amount = total`
4. **Transferir movimentos**: `UPDATE cash_movements SET origem = 'venda', sale_id = X`
