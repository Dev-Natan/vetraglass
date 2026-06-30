# Módulo Financeiro Vetra — Plano de Implementação

Objetivo: transformar o financeiro atual (recibos + caixa básico) em uma central de gestão financeira completa para vidraçarias, com Contas a Receber/Pagar, Fluxo de Caixa projetado, DRE gerencial, Conciliação bancária e Cobrança automatizada (PIX/Boleto).

## Diagnóstico do estado atual

Já existe na base:
- `accounts_receivable`, `expenses`, `cash_registers`, `cash_movements`, `company_cash_movements`
- `quote_deposits`, `sales`, `ordens_servico`, `employee_commissions`
- `financial_periods`, `financial_audit_logs`
- `condicoes_pagamento`, `formas_pagamento`, `company_payment_settings`

Gaps principais: não há Contas a Pagar estruturado, fluxo de caixa só registra realizado (sem projeção), não há DRE por categoria, sem conciliação bancária, cobrança PIX/boleto é manual.

---

## Fase 1 — Fundação: Plano de Contas e Contas a Pagar

**Tabelas novas**
- `financial_categories` — plano de contas hierárquico (Receita/Despesa → grupo → subcategoria), com `dre_group` (Receita Bruta, Deduções, CMV, Despesas Operacionais, Financeiras).
- `accounts_payable` — espelho de `accounts_receivable`: fornecedor, vencimento, valor, parcelas, status (aberto/pago/atrasado), categoria, anexo NF.
- `payable_installments` e `receivable_installments` — parcelamento nativo (1 título → N parcelas, cada uma com vencimento e status próprio).
- `bank_accounts` — contas bancárias da empresa (banco, agência, conta, saldo inicial, tipo: corrente/poupança/caixa).

**Migrar**: `expenses` vira input de `accounts_payable` quando tem vencimento futuro; valor já pago vai direto para `cash_movements`.

**UI**
- `/financeiro/contas-pagar` — lista com filtros (vencidos, hoje, 7d, 30d), badges de status, ações rápidas (pagar, editar, anexar comprovante).
- `/financeiro/plano-contas` — árvore editável (Admin da empresa).
- Categorização obrigatória em todo lançamento.

## Fase 2 — Fluxo de Caixa Projetado e DRE

**Tabela `cash_flow_forecast`** (view materializada) — une AR + AP + caixa atual por dia/semana/mês.

**Páginas**
- `/financeiro/fluxo-caixa` — gráfico de barras (entradas/saídas) + linha de saldo projetado 30/60/90 dias, alerta de saldo negativo futuro.
- `/financeiro/dre` — DRE gerencial mensal (Receita Bruta → Deduções → Receita Líquida → CMV → Lucro Bruto → Despesas Operacionais → EBITDA → Resultado), comparativo mês anterior, exportar PDF/Excel.
- `/financeiro/dashboard` — refinar o existente: KPIs (Recebido vs Previsto, Inadimplência %, Ticket Médio, Margem, Top 5 despesas).

**RPC** `calculate_dre(company_id, start, end)` agregando vendas + AP + comissões + impostos por `dre_group`.

## Fase 3 — Cobrança Automatizada (PIX + Boleto)

**Integração Asaas** (recomendado para PMEs brasileiras — PIX/boleto/cartão num único gateway com tarifa baixa).

- Edge function `asaas-create-charge` — cria cobrança ao gerar AR.
- Edge function `asaas-webhook` — atualiza `accounts_receivable.status` quando pago, lança automaticamente em `cash_movements`.
- Botão "Enviar cobrança" em cada receivable → gera QR Code PIX + link boleto + envia por WhatsApp.
- Régua de cobrança: 3 dias antes (lembrete), no dia (cobrança), 3/7/15 dias após (escalonamento), com templates configuráveis.

Secret necessária: `ASAAS_API_KEY` (solicitada via add_secret após aprovação).

## Fase 4 — Conciliação Bancária

- Upload de extrato OFX/CSV em `/financeiro/conciliacao`.
- Algoritmo de match automático por valor + data ± 2 dias contra `cash_movements` pendentes.
- Tela de revisão: 3 colunas (extrato | match sugerido | ações) — confirmar, ignorar, criar novo lançamento.
- Tabela `bank_statements` + `bank_statement_entries` com flag `reconciled`.

## Fase 5 — Comissões, Impostos e Fechamento

- Refinar `employee_commissions`: cálculo automático na conversão de orçamento → venda, vinculado a `accounts_payable` quando vence.
- `company_tax_config` já existe — gerar provisão de impostos automática (Simples/Lucro Presumido) por venda, lançada como AP futuro.
- Fechamento mensal: bloquear edição de lançamentos via `financial_periods` (já existe), exigir Admin para reabrir.

---

## Detalhes técnicos

```text
Arquitetura de camadas:
┌─────────────────────────────────────────────┐
│  UI: /financeiro/* (dashboard, AR, AP, FC,  │
│      DRE, Conciliação, Plano de Contas)     │
├─────────────────────────────────────────────┤
│  Hooks: useFinancialKPIs, useCashFlow,      │
│         useDRE, useReconciliation           │
├─────────────────────────────────────────────┤
│  RPCs: calculate_dre, project_cash_flow,    │
│        match_bank_entries                   │
├─────────────────────────────────────────────┤
│  Tables: financial_categories, AR, AP,      │
│   installments, bank_accounts, statements   │
├─────────────────────────────────────────────┤
│  Edge Functions: asaas-create-charge,       │
│   asaas-webhook, ofx-parser                 │
└─────────────────────────────────────────────┘
```

- RLS por `company_id` em todas as tabelas novas, GRANT padrão autenticado + service_role.
- React Query com `staleTime: 0` (memória de projeto).
- Auditoria via `financial_audit_logs` em toda mutation.
- Permissões: apenas Admin/Financeiro acessam DRE e Plano de Contas; vendedores veem apenas seus AR.

## Entregáveis por fase

| Fase | Tempo estimado | Tabelas | Páginas |
|------|----------------|---------|---------|
| 1 — Fundação + AP | médio | 4 | 2 |
| 2 — Fluxo + DRE | médio | 1 view | 3 |
| 3 — Cobrança PIX | grande | 0 | 1 + integração |
| 4 — Conciliação | médio | 2 | 1 |
| 5 — Comissão/Imposto/Fechamento | pequeno | 0 | refino |

## Decisões pendentes (responder antes de iniciar)

1. **Por onde começar?** Sugiro **Fase 1 + 2** juntas (entrega valor imediato sem dependência externa).
2. **Gateway de cobrança:** confirma Asaas, prefere Mercado Pago, ou pula a Fase 3 por enquanto?
3. **Conciliação:** importante agora ou pode ficar para v2?
4. **Multi-conta bancária:** sua empresa-alvo costuma ter 1 ou várias contas?

Aprovando o plano, começo pela Fase 1 (Plano de Contas + Contas a Pagar + parcelamento nativo).
