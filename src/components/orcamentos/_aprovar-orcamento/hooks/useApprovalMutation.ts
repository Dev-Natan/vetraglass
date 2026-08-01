import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addMonths } from 'date-fns';
import { generateOSDocuments } from '@/utils/generateOSDocuments';
import { generateMaterialConsumption, linkReservationsToConsumption, reserveMaterialsForOS } from '@/utils/generateMaterialConsumption';
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
      const formaPagamentoId = selectedFormaId?.startsWith('fallback-') ? null : selectedFormaId;

      const entryValue = parseAmount(entryAmount);
      const hasEntry = entryValue > 0;
      const isCaixaAberto = !!openCashRegister;
      const pendingAmount = Number((valorFinal - entryValue).toFixed(2));
      const osPaidAmount = hasEntry && isCaixaAberto ? entryValue : 0;

      if (hasEntry && !isCaixaAberto) {
        throw new Error('Caixa precisa estar aberto para registrar entrada');
      }

      // 0. Guard: prevent duplicate OS for the same quote
      const { data: existingOS, error: existingOSError } = await supabase
        .from('ordens_servico')
        .select('id, os_number, status, sale_id')
        .eq('quote_id', quote.id)
        .maybeSingle();
      if (existingOSError) throw existingOSError;

      if (existingOS) {
        // Verificar status atual do orçamento
        const { data: currentQuote } = await supabase
          .from('quotes')
          .select('status')
          .eq('id', quote.id)
          .single();

        // Se o orçamento está pendente (foi cancelado/resetado), a OS é órfã → limpar e reaprovar
        if (currentQuote?.status === 'pending') {
          await supabase.from('material_consumption').delete().eq('ordem_servico_id', existingOS.id);
          await supabase.from('service_appointments').delete().eq('ordem_servico_id', existingOS.id);
          await supabase.from('quote_deposits').delete().eq('ordem_servico_id', existingOS.id);
          await supabase.from('accounts_receivable').update({ status: 'cancelled' }).eq('ordem_servico_id', existingOS.id);
          await supabase.from('ordens_servico').delete().eq('id', existingOS.id);
        } else {
          throw new Error(`Este orçamento já foi aprovado (OS #${existingOS.os_number}). Não é possível aprovar novamente.`);
        }
      }

      // 1. Update quote
      const { error: quoteUpdateError } = await supabase
        .from('quotes')
        .update({
          status: 'approved',
          forma_pagamento_id: formaPagamentoId,
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
          client_id: (quote as any).client_id || null,
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
            client_id: (quote as any).client_id || null,
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
            client_id: (quote as any).client_id || null,
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
              cliente_id: (quote as any).client_id || null,
              amount: cardNetAmount,
              description: movementDescription,
              payment_method: entryPaymentMethod,
              created_by: userId,
              origem: 'orcamento',
              quote_id: quote.id,
              ordem_servico_id: ordemServico.id,
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
              client_id: (quote as any).client_id || null,
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

      // 4. Pending receivables
      if (pendingAmount > 0) {
        let numInstallments = 1;
        let daysBetween = 30;
        let condicaoNome = 'Saldo';

        // Sempre 1 parcela pois removemos as condições de parcelamento complexas no aprovar
        const installmentAmount = pendingAmount;

        for (let i = 1; i <= numInstallments; i++) {
          const dueDate = receiveOnCompletion
            ? (estimatedEnd ? addDays(estimatedEnd, (i - 1) * daysBetween) : addDays(new Date(), 30 + (i - 1) * daysBetween))
            : (balanceDueDate ? addDays(balanceDueDate, (i - 1) * daysBetween) : addDays(new Date(), 30 + (i - 1) * daysBetween));

          await supabase
            .from('accounts_receivable')
            .insert({
              company_id: companyId,
              ordem_servico_id: ordemServico.id,
              quote_id: quote.id,
              sale_id: saleId,
              client_id: (quote as any).client_id || null,
              customer_name: quote.customer_name,
              description: `OS #${ordemServico.os_number} - ${condicaoNome || 'Saldo'} (${i}/${numInstallments})`,
              total_amount: i === numInstallments ? (pendingAmount - (installmentAmount * (numInstallments - 1))) : installmentAmount,
              installment_number: i,
              total_installments: numInstallments,
              due_date: format(dueDate, 'yyyy-MM-dd'),
              status: 'pending',
              created_by: userId,
              receivable_type: receiveOnCompletion ? 'saldo_conclusao' : 'saldo_final',
            });
        }
      }

      // 5. Insert real os_items from quote items
      const osItemsPayload = items.map(item => {
        const w = Number(item.width || 0);
        const h = Number(item.height || 0);
        const wb = item.width_b != null ? Number(item.width_b) : null;
        const hb = item.height_b != null ? Number(item.height_b) : null;
        const wc = item.width_c != null ? Number(item.width_c) : null;
        const hc = item.height_c != null ? Number(item.height_c) : null;
        return {
          os_id: ordemServico.id,
          quote_item_id: item.id,
          product_name: item.description,
          product_id: item.product_template_id ?? null,
          quantity: item.quantity,
          // legacy NOT NULL columns
          width_sold: w,
          height_sold: h,
          width_production: w,
          height_production: h,
          width_sold_b: wb,
          height_sold_b: hb,
          width_production_b: wb,
          height_production_b: hb,
          // current columns
          largura_venda: w,
          altura_venda: h,
          largura_venda_b: wb,
          altura_venda_b: hb,
          largura_venda_c: wc,
          altura_venda_c: hc,
          largura_producao: w,
          altura_producao: h,
          largura_producao_b: wb,
          altura_producao_b: hb,
          largura_producao_c: wc,
          altura_producao_c: hc,
        };
      });

      const { data: insertedOSItems, error: osItemsError } = await supabase
        .from('os_items')
        .insert(osItemsPayload)
        .select('id, quote_item_id, product_name, product_id, quantity, largura_producao, altura_producao, largura_producao_b, altura_producao_b, largura_producao_c, altura_producao_c');
      if (osItemsError) {
        console.error('Erro crítico ao inserir os_items:', osItemsError);
        throw osItemsError;
      }

      // 6. Documents — usar IDs reais + dados completos do quote_item
      const osItems = (insertedOSItems || []).map(row => {
        const src = items.find(i => i.id === row.quote_item_id);
        return {
          id: row.id,
          os_id: ordemServico.id,
          quote_item_id: row.quote_item_id,
          product_name: row.product_name,
          largura_producao: Number(row.largura_producao || 0),
          altura_producao: Number(row.altura_producao || 0),
          largura_producao_b: row.largura_producao_b,
          altura_producao_b: row.altura_producao_b,
          largura_producao_c: row.largura_producao_c,
          altura_producao_c: row.altura_producao_c,
          quantity: row.quantity,
          product_id: row.product_id,
          glass_thickness: src?.glass_thickness ?? null,
          glass_color: src?.glass_color ?? null,
          include_contramarco: src?.include_contramarco ?? true,
        };
      });

      const docsResult = await generateOSDocuments(ordemServico.id, osItems as any, companyId);
      if (!docsResult.success) console.error('Erro ao gerar documentos da OS:', docsResult.error);

      // 7. Material consumption
      const consumptionResult = await generateMaterialConsumption(
        ordemServico.id,
        companyId,
        osItems.map(item => ({
          id: item.id,
          os_id: item.os_id,
          product_name: item.product_name,
          largura_producao: item.largura_producao,
          altura_producao: item.altura_producao,
          quantity: item.quantity,
          product_id: item.product_id,
          quote_item_id: item.quote_item_id
        }))
      );
      if (!consumptionResult.success) console.warn('Error generating material consumption:', consumptionResult.error);

      await linkReservationsToConsumption(ordemServico.id);

      // 7.1 Reserva automática de estoque para a OS
      const reserveResult = await reserveMaterialsForOS(ordemServico.id);
      if (!reserveResult.success) console.warn('Erro ao reservar materiais:', reserveResult.error);

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
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
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
