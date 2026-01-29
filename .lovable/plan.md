

# Plano: Dashboard Simplificado - Foco no Dia-a-Dia

## Visao Geral
Redesenhar o dashboard para mostrar apenas informacoes acionaveis do dia atual, removendo acoes rapidas (ja existem no menu) e graficos complexos. O foco sera em: **servicos do dia, compromissos, cobrancas e despesas do dia**.

---

## Nova Estrutura do Dashboard

```text
+-----------------------------------------------------------------------+
|                        DASHBOARD - Visao do Dia                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  +-----------------------+  +-----------------------+                 |
|  | Compromissos Hoje     |  | Cobrar Hoje           |                 |
|  | 3 agendamentos        |  | R$ 2.500              |                 |
|  +-----------------------+  +-----------------------+                 |
|                                                                       |
|  +-----------------------+  +-----------------------+                 |
|  | Pagar Hoje            |  | OS Vencendo/Atrasadas |                 |
|  | R$ 800                |  | 2 atencao             |                 |
|  +-----------------------+  +-----------------------+                 |
|                                                                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  +-------------------------------------------------------------+     |
|  | MINHA AGENDA DE HOJE                                         |     |
|  | Timeline visual com todos os compromissos do dia             |     |
|  |                                                              |     |
|  | 08:00 - Medicao - Joao Silva - Rua das Flores, 123           |     |
|  | 10:30 - Instalacao - Maria Santos - Av. Brasil, 456          |     |
|  | 14:00 - Entrega OS #0015 - Pedro Lima                        |     |
|  | 16:00 - Visita - Ana Costa                                   |     |
|  +-------------------------------------------------------------+     |
|                                                                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  +-------------------------+  +----------------------------------+   |
|  | COBRANCAS DO DIA        |  | DESPESAS DO DIA                  |   |
|  |                         |  |                                   |   |
|  | Cliente A - R$ 1.200    |  | Fornecedor X - R$ 400            |   |
|  | Cliente B - R$ 1.300    |  | Energia - R$ 200                 |   |
|  |                         |  | Aluguel - R$ 200                 |   |
|  | Total: R$ 2.500         |  | Total: R$ 800                    |   |
|  | [Registrar Recebimento] |  | [Pagar Despesa]                  |   |
|  +-------------------------+  +----------------------------------+   |
|                                                                       |
+-----------------------------------------------------------------------+
|                                                                       |
|  +-------------------------------------------------------------+     |
|  | OS QUE PRECISAM DE ATENCAO                                   |     |
|  | (Atrasadas ou vencendo hoje)                                 |     |
|  |                                                              |     |
|  | OS #0012 - Cliente X - 2 dias atrasada                       |     |
|  | OS #0015 - Cliente Y - Vence hoje                            |     |
|  +-------------------------------------------------------------+     |
|                                                                       |
+-----------------------------------------------------------------------+
```

---

## O Que REMOVER

| Componente | Motivo |
|------------|--------|
| Acoes Rapidas (Nova Venda, Novo Orcamento, Nova OS) | Ja existe no menu lateral |
| Links Rapidos (Clientes, Produtos, etc) | Redundante com sidebar |
| ProductionKPIs (4 cards) | Substituir por KPIs focados no dia |
| ProductionBlockedAlert | Manter apenas se tiver bloqueios |
| PendingPurchasesAlert | Mover para pagina de Compras |
| OverdueReceivablesAlert | Integrar na lista de cobrancas |
| FinancialOSSummary (mensal) | Muito detalhado, mover para Relatorios |
| SystemReminders | Integrar nas listas do dia |
| ProductionFlowChart | Mover para Relatorios |
| RevenueVsCostChart | Mover para Relatorios |
| RecentActivity | Baixo valor, remover |

---

## O Que CRIAR

### 1. `src/components/dashboard/DayOverviewCards.tsx`
4 cards compactos com resumo do dia:
- Compromissos Hoje (quantidade de agendamentos)
- Cobrar Hoje (valor total a receber hoje)
- Pagar Hoje (valor total de despesas vencendo hoje)
- OS Atencao (quantidade de OS atrasadas/vencendo)

### 2. `src/components/dashboard/TodaySchedule.tsx`
Timeline visual com todos os compromissos do dia:
- Agendamentos (medicao, instalacao, visita, entrega)
- OS com entrega prevista para hoje
- Ordenado por horario
- Icones coloridos por tipo
- Clicavel para ir aos detalhes

### 3. `src/components/dashboard/TodayReceivables.tsx`
Lista de cobrancas a fazer hoje:
- Clientes com parcelas vencendo hoje
- Parcelas ja atrasadas (destacadas)
- Valor total
- Botao de acao para registrar recebimento

### 4. `src/components/dashboard/TodayExpenses.tsx`
Lista de despesas a pagar hoje:
- Despesas com vencimento hoje
- Despesas ja atrasadas (destacadas)
- Valor total
- Botao de acao para pagar

### 5. `src/components/dashboard/OSAttentionList.tsx`
OS que precisam de atencao imediata:
- OS atrasadas (vermelho)
- OS vencendo hoje (amarelo)
- Dias de atraso
- Link para detalhes da OS

---

## Arquivos a Modificar

### 1. `src/pages/Index.tsx`
- Remover todas as importacoes de componentes antigos
- Substituir por novos componentes focados no dia
- Layout simplificado em 3 secoes:
  1. Cards de resumo do dia
  2. Agenda + Cobrancas/Despesas lado a lado
  3. OS que precisam de atencao

### 2. `src/hooks/useDashboardData.ts`
- Simplificar para buscar apenas dados do dia:
  - Agendamentos de hoje
  - Cobrancas de hoje (vencendo e atrasadas)
  - Despesas de hoje (vencendo e atrasadas)
  - OS atrasadas e vencendo hoje
- Remover queries de graficos (produtionFlow, revenueVsCost)
- Remover recentActivity

---

## Detalhes Tecnicos

### Queries Necessarias

```typescript
// Agendamentos de hoje
const todayAppointments = supabase
  .from('service_appointments')
  .select('*')
  .eq('scheduled_date', today)
  .neq('status', 'cancelled')
  .order('scheduled_time_start');

// Cobrancas de hoje + atrasadas
const todayReceivables = supabase
  .from('accounts_receivable')
  .select('*')
  .in('status', ['pending', 'partial'])
  .lte('due_date', today); // Hoje ou antes

// Despesas de hoje + atrasadas
const todayExpenses = supabase
  .from('expenses')
  .select('*')
  .eq('status', 'pending')
  .lte('due_date', today); // Hoje ou antes

// OS atrasadas ou vencendo hoje
const attentionOS = supabase
  .from('ordens_servico')
  .select('*')
  .in('status', ['pending', 'in_progress'])
  .lte('estimated_end', today);
```

### Cores e Icones

| Tipo | Cor | Icone |
|------|-----|-------|
| Medicao | Verde (#10b981) | MapPin |
| Instalacao | Azul (#3b82f6) | Wrench |
| Entrega | Rosa (#ec4899) | Truck |
| Visita | Roxo (#8b5cf6) | Users |
| Cobranca | Verde (#22c55e) | DollarSign |
| Despesa | Vermelho (#ef4444) | Receipt |
| OS Atrasada | Vermelho (#ef4444) | AlertTriangle |
| OS Hoje | Amarelo (#f59e0b) | Clock |

---

## Beneficios

| Antes | Depois |
|-------|--------|
| 11+ componentes | 5 componentes focados |
| Muitas queries | Queries otimizadas do dia |
| Scroll extenso | Tudo visivel sem scroll |
| Info dispersa | Foco no acionavel |
| Graficos historicos | Dados do momento |
| Acoes duplicadas | Interface limpa |

---

## Fluxo do Usuario

1. Usuario abre o dashboard
2. Ve 4 cards com resumo rapido do dia
3. Ve a agenda do dia em timeline
4. Ve lista de cobrancas a fazer com botao de acao
5. Ve lista de despesas a pagar com botao de acao
6. Ve OS que precisam de atencao imediata
7. Pode clicar em qualquer item para ir aos detalhes

