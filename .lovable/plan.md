

# Plano: Permitir Alteração Direta do Saldo Real

## Problema Identificado

Atualmente:
1. O campo "Saldo Real" **só aparece na criação inicial** (quando `!isEditMode`)
2. A mutation de configuração **só atualiza o `fixed_fund`**, ignorando o saldo
3. Não existe forma de ajustar o saldo real sem gerar movimentação

## Solução

Criar uma **opção separada** para o admin ajustar diretamente o saldo real da empresa sem gerar movimentações no histórico financeiro. Isso é útil para correções ou quando o usuário cadastra um valor inicial errado.

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FLUXO DE ALTERAÇÃO DO SALDO                             │
└─────────────────────────────────────────────────────────────────────────────┘

Método 1: Ajuste Direto (SEM movimentação)
─────────────────────────────────────────
Admin clica em "Ajustar Saldo" → Informa novo valor → Salvo diretamente

Método 2: Entrada/Saída (COM movimentação) - já existe
─────────────────────────────────────────
Admin clica em "Depósito" ou "Retirada" → Gera registro no histórico
```

## Mudanças na Interface

### 1. Adicionar Botão "Ajustar Saldo" no Card de Saldo Real

```text
┌─────────────────────────────────────────────────────┐
│ 💰 Saldo Real da Empresa          [Ajustar] [⚙️]   │
│                                                     │
│     R$ 450,00                                       │
│     Valor que a empresa possui em caixa/banco       │
└─────────────────────────────────────────────────────┘
```

### 2. Novo Dialog: Ajustar Saldo Diretamente

```text
┌────────────────────────────────────────────────────┐
│ 💰 Ajustar Saldo da Empresa                        │
│                                                    │
│ ⚠️ Esta ação NÃO gera movimentação no histórico    │
│    financeiro. Use apenas para correções.          │
│                                                    │
│ Saldo atual:      R$ 450,00                        │
│                                                    │
│ Novo saldo (R$):                                   │
│ ┌────────────────────────────────────┐             │
│ │ 2.500,00                           │             │
│ └────────────────────────────────────┘             │
│                                                    │
│ Motivo da correção: (opcional)                     │
│ ┌────────────────────────────────────┐             │
│ │ Correção do saldo inicial          │             │
│ └────────────────────────────────────┘             │
│                                                    │
│             [Cancelar] [Confirmar Ajuste]          │
└────────────────────────────────────────────────────┘
```

## Mudanças Técnicas

### Arquivo 1: `src/components/caixa/AjustarSaldoDialog.tsx` (NOVO)

Criar novo componente de dialog para ajuste direto:

| Campo | Descrição |
|-------|-----------|
| `newBalance` | Input para o novo saldo |
| `reason` | Textarea opcional para motivo |
| Alerta visual | Explicando que não gera movimentação |

### Arquivo 2: `src/components/financeiro/CaixaEmpresaTab.tsx`

Adicionar:

1. Estado para controlar o novo dialog: `adjustBalanceOpen`
2. Nova mutation para atualizar saldo diretamente:
```typescript
const adjustBalanceMutation = useMutation({
  mutationFn: async (newBalance: number) => {
    await supabase
      .from('company_cash')
      .update({ 
        current_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('company_id', currentCompany.id);
  },
});
```

3. Botão "Ajustar" no card de Saldo Real
4. Importar e renderizar o novo dialog

### Arquivo 3: `src/components/caixa/MovimentoCaixaEmpresaDialog.tsx`

Remover a condição `{!isEditMode}` do campo de saldo inicial, permitindo que ele apareça sempre. Isso dá ao admin a opção de ajustar o saldo também via configuração.

**OU** manter o dialog de config apenas para fundo fixo, e usar o novo dialog para saldo.

**Decisão:** Criar dialog separado para ajuste de saldo, mantendo config apenas para fundo fixo (mais claro para o usuário).

## Resumo dos Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/caixa/AjustarSaldoDialog.tsx` | **CRIAR** - Novo dialog para ajuste direto |
| `src/components/financeiro/CaixaEmpresaTab.tsx` | Adicionar botão + mutation + dialog |

## Fluxo Final para o Admin

O admin terá 3 opções para gerenciar o saldo:

| Opção | Quando usar | Gera movimentação? |
|-------|-------------|-------------------|
| **Ajustar Saldo** | Correção de valores errados, ajuste inicial | Não |
| **Depósito** | Dinheiro físico entrou na empresa | Sim |
| **Retirada** | Dinheiro saiu da empresa | Sim |

## Critérios de Aceite

1. Admin pode ajustar o saldo real da empresa a qualquer momento
2. Ajuste direto NÃO gera movimentação no histórico
3. Depósito e Retirada continuam gerando movimentações normalmente
4. Alerta visual informa que o ajuste não gera histórico
5. Campo opcional para motivo da correção (para referência interna)

