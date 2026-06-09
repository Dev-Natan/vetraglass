## Problema

Na aba **Financeiro → Contas a Receber**, clicar em "Receber" apenas exibe um toast informando que o recebimento deve ser feito pelo Caixa. Isso obriga o usuário a navegar para outra tela.

## Solução

Reaproveitar o componente `src/components/caixa/ReceivePaymentDialog.tsx` que já implementa todo o fluxo correto:
- Verifica se há caixa aberto (alerta se não houver).
- Cria `cash_movements` (entrada com `category: 'recebimento_parcela'`), gerando fluxo no caixa.
- Atualiza `accounts_receivable` (paid_amount / status).
- Propaga para `sales` e `ordens_servico` vinculados.
- Suporta pagamento parcial e seleção de forma de pagamento (Dinheiro / Cartão / PIX).

## Alterações

**Arquivo único:** `src/components/financeiro/ContasReceberTab.tsx`

1. Importar `ReceivePaymentDialog` de `@/components/caixa/ReceivePaymentDialog`.
2. Adicionar estado local:
   ```ts
   const [receivingPayment, setReceivingPayment] = useState<Receivable | null>(null);
   ```
3. Substituir `handleReceiveClick` — remover o `toast.info` e abrir o dialog:
   ```ts
   const handleReceiveClick = (receivable: Receivable) => {
     setReceivingPayment(receivable);
   };
   ```
4. Renderizar no final do JSX:
   ```tsx
   <ReceivePaymentDialog
     open={!!receivingPayment}
     onOpenChange={(o) => !o && setReceivingPayment(null)}
     receivable={receivingPayment}
     onSuccess={() => setReceivingPayment(null)}
   />
   ```
5. Garantir que o objeto `receivable` passado contém os campos exigidos (`customer_name`, `description`, `installment_number`, `total_installments`, `sale_id`, `ordem_servico_id`, `quote_id`) — adicionar map/cast se necessário.

## Comportamento resultante

- O recebimento acontece direto na aba Financeiro.
- Se o caixa estiver fechado, o próprio dialog mostra o aviso "Nenhum caixa aberto. Abra o caixa para receber pagamentos." (mensagem clara e acionável, no lugar correto).
- O movimento é registrado em `cash_movements` da sessão aberta, mantendo a integridade do fluxo diário de caixa.