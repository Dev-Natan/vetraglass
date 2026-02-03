
# Plano: Mover Faturamento para o Módulo de Caixa

## Resumo da Alteração

O fluxo atual exige que o faturamento de uma OS seja feito diretamente no módulo de "Ordens de Serviço" ao clicar em "Faturar e Concluir". A alteração proposta separa esses dois passos:

1. **Concluir OS**: A OS é marcada como "concluída" (serviço finalizado), mas sem faturamento imediato
2. **Faturar no Caixa**: O orçamento vinculado fica disponível no Caixa para faturamento quando conveniente

## Novo Fluxo de Trabalho

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO ATUAL                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  OS Em Andamento ──► Clica "Faturar e Concluir" ──► OS Concluída + Faturada │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           NOVO FLUXO                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  OS Em Andamento ──► Clica "Concluir Serviço" ──► OS Concluída              │
│                                                      │                      │
│                                                      ▼                      │
│                            Orçamento disponível no Caixa para Faturamento   │
│                                                      │                      │
│                                                      ▼                      │
│                              Operador do Caixa ──► "Faturar Saldo"          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Alterações Técnicas

### 1. Página de Ordens de Serviço (`src/pages/OrdensServico.tsx`)

**Remover:**
- Importação e uso do `FaturarSaldoDialog`
- Estados `faturarDialogOpen` e `osToComplete`
- O diálogo de faturamento no final do componente

**Alterar:**
- Botão "Faturar e Concluir" → "Concluir Serviço"
- Ação do botão: chamar apenas `updateStatusMutation` com status `'completed'`
- Ícone: trocar `DollarSign` por `CheckCircle`

### 2. Página de Caixa (`src/pages/CaixaVendas.tsx`)

**Adicionar:**
- Nova query para buscar **OS concluídas com saldo pendente**
- Novo card/seção "Serviços Prontos para Faturamento"
- Lista de OS concluídas que ainda têm saldo a receber
- Botão "Faturar Saldo" que abre o `FaturarSaldoDialog`
- Estados para controlar o diálogo de faturamento

### 3. Componente FaturarSaldoDialog (`src/components/caixa/FaturarSaldoDialog.tsx`)

**Alterar:**
- Remover a lógica de mudança de status da OS (já estará concluída)
- Manter apenas a lógica de criação de venda e movimentação de caixa
- Atualizar apenas os campos financeiros da OS (`sale_id`, `paid_amount`, `pending_amount`)

### 4. Nova Query no Caixa

Buscar ordens de serviço com:
- `status = 'completed'`
- `pending_amount > 0` (ainda há saldo a receber)
- `sale_id IS NULL` (ainda não foi faturada)

---

## Benefícios da Alteração

1. **Separação de responsabilidades**: Produção (OS) vs Financeiro (Caixa)
2. **Flexibilidade**: Serviço pode ser concluído mesmo com caixa fechado
3. **Controle centralizado**: Todas as operações financeiras passam pelo Caixa
4. **Privacidade**: Equipe de produção não precisa acessar informações de valores
