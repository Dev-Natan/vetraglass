import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths } from 'date-fns';
import { generateOSDocuments } from '@/utils/generateOSDocuments';
import { generateMaterialConsumption, linkReservationsToConsumption } from '@/utils/generateMaterialConsumption';
import { parseAmount } from '../utils';
import type { ApprovalQuote, ApprovalQuoteItem, ApprovalFormState } from '../types';

interface Params {
  quote: ApprovalQuote | null;
  items: ApprovalQuoteItem[];
  companyId: string | undefined;
  userId: string | undefined;
  openCashRegister: { id: string } | null | undefined;
  totalOriginal: number;
  valorFinal: number;
  formState: ApprovalFormState;
  onClose: () => void;
  onSuccess?: () => void;
}

export function useApprovalMutation({
  quote, items, companyId, userId, openCashRegister,
  totalOriginal, valorFinal, formState, onClose, onSuccess,
}: Params) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (!quote || !companyId || !userId) throw new Error('Dados incompletos');

      const {
        selectedFormaId, entryAmount, entryPaymentMethod, cardActualReceived,
        balanceDueDate, receiveOnCompletion, estimatedEnd, priority, notes,
      } = formState;

      const entryValue = parseAmount(entryAmount);
      const hasEntry = entryValue > 0;
      const isCaixaAberto = !!openCashRegister;
      const pendingAmount = valorFinal - entryValue;
      const osPaidAmount = hasEntry && isCaixaAberto ? entryValue : 0;

      if (hasEntry && !isCaixaAberto) {
        throw new Error('Caixa precisa estar aberto para registrar entrada');
      }

      // 1. Update quote
      const { error: quoteUpdateError } = await supabase
        .from('quotes')
        .update({
          status: 'approved',
          forma_pagamento_id: selectedFormaId,
          condicao_pagamento_id: null,
          valor_original: totalOriginal,
          valor_final_aprovado: valorFinal,
          approved_at: new Date().toISOString(),
          approved_by: userId,
        })
        .eq('id', quote.id);
      if (quoteUpdateError) throw quoteUpdateError;

      // 2. Create OS
      const { data: ordemServico, error: osError } = await supabase
        .from('ordens_servico')
        .insert({
          company_id: companyId,
          quote_id: quote.id,
          customer_name: quote.customer_name,
          customer_phone: quote.customer_phone,
          customer_email: quote.customer_email,
          customer_address: quote.customer_address,
          status: 'pending',
          priority,
          estimated_end: estimatedEnd?.toISOString().split('T')[0],
          total_amount: valorFinal,
          paid_amount: osPaidAmount,
          pending_amount: valorFinal - osPaidAmount,
          notes,
          current_stage: 'Aguardando início',
          stages: JSON.stringify([
            { name: 'Aguardando início', completed: false },
            { name: 'Em produção', completed: false },
            { name: 'Instalação', completed: false },
            { name: 'Finalizado', completed: false },
          ]),
        })
        .select()
        .single();
      if (osError) throw osError;

      let saleId: string | null = null;

      // 3. Entry handling
      if (hasEntry) {
        const { data: quoteDeposit, error: depositError } = await supabase
          .from('quote_deposits')
          .insert({
            company_id: companyId,
            quote_id: quote.id,
            ordem_servico_id: ordemServico.id,
            customer_name: quote.customer_name,
            customer_phone: quote.customer_phone,
            amount: entryValue,
            payment_method: entryPaymentMethod,
            status: isCaixaAberto ? 'received' : 'pending',
            cash_register_id: isCaixaAberto ? openCashRegister?.id : null,
            created_by: userId,
          })
          .select('id')
          .single();
        if (depositError) console.error('Error creating deposit:', depositError);

        const { error: entryReceivableError } = await supabase
          .from('accounts_receivable')
          .insert({
            company_id: companyId,
            ordem_servico_id: ordemServico.id,
            quote_id: quote.id,
            customer_name: quote.customer_name,
            description: `Entrada - Orç. #${quote.quote_number.toString().padStart(4, '0')}`,
            total_amount: entryValue,
            paid_amount: isCaixaAberto ? entryValue : 0,
            status: isCaixaAberto ? 'paid' : 'pending',
            due_date: format(new Date(), 'yyyy-MM-dd'),
            receivable_type: 'entrada_orcamento',
            installment_number: 0,
            total_installments: 0,
            created_by: userId,
          });
        if (entryReceivableError) console.error('Error creating entry receivable:', entryReceivableError);

        if (openCashRegister) {
          const cardNetAmount = entryPaymentMethod === 'cartao' && cardActualReceived
            ? parseAmount(cardActualReceived)
            : entryValue;
          const cardFee = entryPaymentMethod === 'cartao' && cardActualReceived
            ? entryValue - cardNetAmount
            : 0;

          const movementDescription = cardFee > 0
            ? `Entrada - Orç. #${quote.quote_number.toString().padStart(4, '0')} - ${quote.customer_name} (Taxa cartão: R$ ${cardFee.toFixed(2)})`
            : `Entrada - Orç. #${quote.quote_number.toString().padStart(4, '0')} - ${quote.customer_name}`;

          const { data: cashMovement, error: cashMovementError } = await supabase
            .from('cash_movements')
            .insert({
              cash_register_id: openCashRegister.id,
              company_id: companyId,
              type: 'entrada',
              category: 'entrada_orcamento',
              amount: cardNetAmount,
              description: movementDescription,
              payment_method: entryPaymentMethod,
              created_by: userId,
              origem: 'orcamento',
            })
            .select('id')
            .single();
          if (cashMovementError) console.error('Error creating cash movement:', cashMovementError);

          if (cashMovement?.id && quoteDeposit?.id) {
            await supabase
              .from('quote_deposits')
              .update({ cash_movement_id: cashMovement.id })
              .eq('id', quoteDeposit.id);
          }

          const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert({
              company_id: companyId,
              cash_register_id: openCashRegister.id,
              customer_name: quote.customer_name,
              subtotal: entryValue,
              total_amount: entryValue,
              payment_method: entryPaymentMethod,
              payment_status: 'paid',
              sale_type: 'partial',
              paid_amount: entryValue,
              pending_amount: pendingAmount,
              quote_id: quote.id,
              ordem_servico_id: ordemServico.id,
              sold_by: userId,
              notes: `Entrada do orçamento #${quote.quote_number.toString().padStart(4, '0')}`,
            })
            .select()
            .single();
          if (saleError) throw saleError;
          saleId = sale.id;

          if (cashMovement?.id && sale?.id) {
            const { error: linkError } = await supabase
              .from('cash_movements')
              .update({ sale_id: sale.id })
              .eq('id', cashMovement.id);
            if (linkError) console.error('ERRO ao vincular cash_movement à venda:', linkError);
          }

          await supabase.from('sale_items').insert({
            sale_id: sale.id,
            item_name: `Entrada - Orçamento #${quote.quote_number.toString().padStart(4, '0')}`,
            item_unit: 'un',
            quantity: 1,
            unit_price: entryValue,
            total_price: entryValue,
          });

          await supabase
            .from('ordens_servico')
            .update({ sale_id: sale.id })
            .eq('id', ordemServico.id);
        }
      }

      // 4. Pending receivable
      if (pendingAmount > 0) {
        const { error: receivablesError } = await supabase
          .from('accounts_receivable')
          .insert({
            company_id: companyId,
            ordem_servico_id: ordemServico.id,
            quote_id: quote.id,
            sale_id: saleId,
            customer_name: quote.customer_name,
            description: receiveOnCompletion
              ? `OS #${ordemServico.os_number} - Receber na conclusão`
              : `OS #${ordemServico.os_number} - Saldo a receber`,
            total_amount: pendingAmount,
            installment_number: 1,
            total_installments: 1,
            due_date: receiveOnCompletion
              ? (estimatedEnd ? format(estimatedEnd, 'yyyy-MM-dd') : format(addDays(new Date(), 30), 'yyyy-MM-dd'))
              : (balanceDueDate ? format(balanceDueDate, 'yyyy-MM-dd') : format(addDays(new Date(), 30), 'yyyy-MM-dd')),
            status: 'pending',
            created_by: userId,
            receivable_type: receiveOnCompletion ? 'saldo_conclusao' : 'saldo_final',
          });
        if (receivablesError) console.error('Error creating receivables:', receivablesError);
      }

      // 5. Documents
      const docsResult = await generateOSDocuments(ordemServico.id, items);
      if (!docsResult.success) console.warn('Error generating OS documents:', docsResult.error);

      // 6. Material consumption
      const consumptionResult = await generateMaterialConsumption(
        ordemServico.id,
        companyId,
        items.map(item => ({
          id: item.id,
          description: item.description,
          width: item.width,
          height: item.height,
          quantity: item.quantity,
          company_product_id: item.company_product_id,
          product_template_id: item.product_template_id,
        }))
      );
      if (!consumptionResult.success) console.warn('Error generating material consumption:', consumptionResult.error);

      await linkReservationsToConsumption(ordemServico.id);

      // 7. Delivery appointment
      if (estimatedEnd) {
        await supabase.from('service_appointments').insert({
          company_id: companyId,
          title: `Entrega OS #${ordemServico.os_number}`,
          appointment_type: 'delivery',
          status: 'pending',
          scheduled_date: format(estimatedEnd, 'yyyy-MM-dd'),
          all_day: true,
          customer_name: quote.customer_name,
          customer_phone: quote.customer_phone,
          customer_address: quote.customer_address,
          ordem_servico_id: ordemServico.id,
          quote_id: quote.id,
        });
      }

      return { ordemServico, saleId };
    },
    onSuccess: (data) => {
      const osNumber = data.ordemServico.os_number;
      toast({
        title: 'Orçamento aprovado!',
        description: `OS #${osNumber} criada com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['quote-deposit'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['material-consumption'] });
      onClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao aprovar orçamento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
