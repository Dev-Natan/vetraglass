## Problema
Na aba "A Receber" (/financeiro?tab=receber) estão aparecendo recebíveis com status `paid` e `cancelled`, além do botão "Receber" aparecer em cancelados. O filtro padrão "Pendentes" deveria já esconder pagos, mas a lista mostra registros cancelados/pagos mesmo assim — provavelmente porque:

1. O filtro pós-query remove apenas recebíveis vinculados a documentos (sale/quote/OS) cancelados, mas NÃO remove recebíveis com `status = 'cancelled'` direto na tabela `accounts_receivable`.
2. O `statusFilter` default é `'pending'`, mas pelos prints aparecem `paid` e `cancelado` — sugere que algo está mostrando "Todos" ou que a tela usa outra fonte.

## Mudanças (apenas frontend, em `src/components/financeiro/ContasReceberTab.tsx`)

1. **No `queryFn`**, excluir do resultado qualquer recebível com `r.status === 'cancelled'` (além das exclusões por documento cancelado já existentes).

2. **No `useMemo` de `filteredReceivables`**, garantir que a aba sempre esconda:
   - `status === 'paid'`
   - `status === 'cancelled'`
   
   Independente do filtro de status escolhido (a aba "A Receber" é sobre o que falta receber). Pagos continuam acessíveis via aba/relatório próprio; aqui não aparecem mais.

3. **Remover a opção "Pagos"** do `Select` de Status (já que a aba não deve listar pagos). Manter: Todos (=pendentes+vencidos+parciais), Pendentes, Vencidos.

4. **Botão "Receber"**: já está condicional a `status !== 'paid'`. Adicionar `&& status !== 'cancelled'` por segurança (não deve nem aparecer, mas dupla proteção).

5. **Card de resumo "Recebido (Total)"**: manter como está (é informativo histórico) — não foi pedido remover.

Nenhuma alteração de backend/migração necessária — é puramente de apresentação na aba.
