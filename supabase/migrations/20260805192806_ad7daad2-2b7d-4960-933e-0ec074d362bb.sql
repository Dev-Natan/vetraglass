-- Hotfix: Corrigir orçamentos marcados como 'converted' (Quitados) mas que ainda possuem saldo devedor nas vendas vinculadas.
-- Isso reativa o botão "Receber" e o status "Parcial" na interface.

UPDATE public.quotes q
SET status = 'approved'
FROM public.sales s
WHERE s.quote_id = q.id
  AND s.pending_amount > 0.01
  AND q.status = 'converted';

-- Garantir integridade do cálculo de saldo pendente nas vendas
UPDATE public.sales
SET pending_amount = total_amount - paid_amount
WHERE ABS(pending_amount - (total_amount - paid_amount)) > 0.01;
