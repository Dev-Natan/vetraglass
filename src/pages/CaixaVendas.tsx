import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Lock, Plus, Unlock, TrendingUp, TrendingDown, FileText, ClipboardList, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useCompanyNotifications } from '@/hooks/useCompanyNotifications';
import { useCashAudits } from '@/hooks/useCashAudits';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PaymentConfig } from '@/components/caixa/InstallmentPaymentSheet';
import { calculateFormulaQuantity } from '@/utils/safeFormulaEvaluator';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';

import { FecharCaixaDialog } from '@/components/caixa/FecharCaixaDialog';
import { AbrirCaixaDialog } from '@/components/caixa/AbrirCaixaDialog';
import { NovaVendaDialog, VendaItem } from '@/components/caixa/NovaVendaDialog';
import { CaixaResumo } from '@/components/caixa/CaixaResumo';
import { VendasTable } from '@/components/caixa/VendasTable';
import { CancelarVendaDialog } from '@/components/caixa/CancelarVendaDialog';
import { DetalhesVendaDialog } from '@/components/caixa/DetalhesVendaDialog';
import { MovimentacaoCaixaDialog } from '@/components/caixa/MovimentacaoCaixaDialog';
import { CaixaAlertasHoje } from '@/components/caixa/CaixaAlertasHoje';
import { CaixaMovimentacoesTable } from '@/components/caixa/CaixaMovimentacoesTable';
import { PendingDepositsAlert } from '@/components/caixa/PendingDepositsAlert';
import { ReceivePaymentDialog } from '@/components/caixa/ReceivePaymentDialog';
import { generateSalePdf } from '@/utils/generateSalePdf';
import { generateDailyCashPdf } from '@/utils/generateDailyCashPdf';
import { FaturarSaldoDialog } from '@/components/caixa/FaturarSaldoDialog';

interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  subtotal: number;
  discount_amount: number | null;
  discount_percent: number | null;
  payment_method: string;
  payment_status: string;
  created_at: string;
  notes: string | null;
  // Campos para suporte a vendas parciais
  sale_type?: 'full' | 'partial' | string;
  quote_id?: string | null;
  paid_amount?: number;
  pending_amount?: number;
}

export default function CaixaVendas() {
  const { currentCompany, user } = useAuth();
  const { isAdmin, isManager } = usePermissions();
  const { requestCashOpen, isRequestingCashOpen } = useCompanyNotifications();
  const { submitForAudit, isSubmittingForAudit } = useCashAudits();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Module tutorial trigger
  useModuleTutorialTrigger('caixa-vendas');
  
  const [hasRequestedCashOpen, setHasRequestedCashOpen] = useState(false);
  
  const [abrirCaixaOpen, setAbrirCaixaOpen] = useState(false);
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false);
  const [novaVendaOpen, setNovaVendaOpen] = useState(false);
  const [cancelarVendaOpen, setCancelarVendaOpen] = useState(false);
  const [detalhesVendaOpen, setDetalhesVendaOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  // Removed periodFilter - showing only current cash register data
  const [pendingOpenNewSale, setPendingOpenNewSale] = useState(false);
  
  // Dialog movimentação do caixa do dia
  const [movimentacaoCaixaOpen, setMovimentacaoCaixaOpen] = useState(false);
  
  // Dialog recebimento de pagamento
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<{
    id: string;
    customer_name: string;
    description: string;
    total_amount: number;
    paid_amount: number | null;
    installment_number: number;
    total_installments: number;
    due_date: string;
    status: string;
    sale_id?: string | null;
    ordem_servico_id?: string | null;
    quote_id?: string | null;
  } | null>(null);

  // Dialog faturamento de OS concluídas
  const [faturarDialogOpen, setFaturarDialogOpen] = useState(false);
  const [osToFaturar, setOsToFaturar] = useState<{
    id: string;
    os_number: number;
    customer_name: string;
    total_amount: number;
    paid_amount: number;
    pending_amount: number;
    quote_id: string | null;
    status: string;
  } | null>(null);

  // Buscar caixa da empresa (usado para abrir/fechar caixa)
  const { data: companyCash } = useQuery({
    queryKey: ['company-cash', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('company_cash')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar caixa aberto DO USUÁRIO ATUAL (sistema multiusuário)
  const { data: openCashRegister, isLoading: loadingCashRegister } = useQuery({
    queryKey: ['cash-register-open', currentCompany?.id, user?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !user?.id) return null;
      
      // Usar função RPC que busca apenas o caixa do usuário logado
      const { data, error } = await supabase.rpc('get_user_open_cash_register', {
        _company_id: currentCompany.id,
      });
      
      if (error) throw error;
      
      // A função retorna uma tabela, pegar o primeiro registro
      if (data && data.length > 0) {
        // Buscar dados completos do caixa
        const { data: fullRegister, error: fullError } = await supabase
          .from('cash_registers')
          .select('*')
          .eq('id', data[0].id)
          .single();
        if (fullError) throw fullError;
        return fullRegister;
      }
      
      return null;
    },
    enabled: !!currentCompany?.id && !!user?.id,
  });

  useEffect(() => {
    if (searchParams.get('novo') === 'true') {
      setPendingOpenNewSale(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (pendingOpenNewSale && openCashRegister) {
      setNovaVendaOpen(true);
      setPendingOpenNewSale(false);
    }
  }, [pendingOpenNewSale, openCashRegister]);

  // Buscar vendas do caixa atual
  const { data: todaySales = [] } = useQuery({
    queryKey: ['sales-today', openCashRegister?.id],
    queryFn: async () => {
      if (!openCashRegister?.id) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('cash_register_id', openCashRegister.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!openCashRegister?.id,
  });

  // Buscar movimentações do caixa atual
  const { data: cashMovements = [] } = useQuery({
    queryKey: ['cash-movements', openCashRegister?.id],
    queryFn: async () => {
      if (!openCashRegister?.id) return [];
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', openCashRegister.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!openCashRegister?.id,
  });

  // Buscar despesas com vencimento hoje
  const { data: expensesDueToday = [] } = useQuery({
    queryKey: ['expenses-due-today', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('due_date', today)
        .eq('status', 'pending')
        .order('amount', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar parcelas a receber hoje
  const { data: receivablesDueToday = [] } = useQuery({
    queryKey: ['receivables-due-today', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select('*, sales!left(payment_status)')
        .eq('company_id', currentCompany.id)
        .eq('due_date', today)
        .eq('status', 'pending')
        .order('total_amount', { ascending: false });

      if (error) throw error;
      
      // Filtrar parcelas de vendas canceladas
      return (data || []).filter(r => (r as any).sales?.payment_status !== 'cancelled');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar OS concluídas pendentes de faturamento
  const { data: completedOSPendingBilling = [] } = useQuery({
    queryKey: ['completed-os-pending-billing', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, os_number, customer_name, total_amount, paid_amount, pending_amount, quote_id, status, estimated_end, created_at')
        .eq('company_id', currentCompany.id)
        .eq('status', 'completed')
        .is('sale_id', null) // Ainda não foi faturada
        .gt('pending_amount', 0) // Tem saldo pendente
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });
  // Removed getDateRange and filteredSales - CaixaVendas now shows only current cash register data
  // Historical sales reports are available in Financeiro > Relatórios

  const { data: availableItems = [] } = useQuery({
    queryKey: ['available-items', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data: allItems, error: itemsError } = await supabase.from('item_templates').select('id, name, unit, type, linha, default_price').eq('is_active', true);
      if (itemsError) throw itemsError;
      const { data: companyPrices, error: pricesError } = await supabase.from('company_item_prices').select('item_template_id, price').eq('company_id', currentCompany.id);
      if (pricesError) throw pricesError;
      const priceMap = new Map<string, number>();
      (companyPrices || []).forEach(cp => { if (cp.item_template_id && cp.price !== null) priceMap.set(cp.item_template_id, cp.price); });
      return (allItems || []).map(item => ({ id: item.id, name: item.name, unit: item.unit, type: item.type, linha: item.linha, price: priceMap.get(item.id) ?? (item.default_price || 0), isDefaultPrice: !priceMap.has(item.id) }));
    },
    enabled: !!currentCompany?.id,
  });

  const { data: availableProducts = [] } = useQuery({
    queryKey: ['available-products', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase.from('company_products').select(`id, commercial_name, base_price, product_template_id, product_template:product_templates (name, category, linha)`).eq('company_id', currentCompany.id).eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Buscar orçamentos aprovados com status financeiro (usando VIEW)
  const { data: approvedQuotesWithFinancial = [] } = useQuery({
    queryKey: ['approved-quotes-financial', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      // Buscar status financeiro da VIEW
      const { data: financialData, error: financialError } = await supabase
        .from('quote_financial_status')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gt('pending_amount', 0) // Apenas orçamentos com saldo pendente
        .order('created_at', { ascending: false });
      
      if (financialError) throw financialError;
      if (!financialData?.length) return [];
      
      // Buscar os itens dos orçamentos
      const quoteIds = financialData.map(q => q.quote_id);
      const { data: quotesWithItems, error: itemsError } = await supabase
        .from('quotes')
        .select(`
          id, quote_number, customer_name, total_amount, final_amount, status, created_at,
          quote_items (id, description, quantity, unit_price, total_price, width, height, company_product_id, product_template_id)
        `)
        .in('id', quoteIds);
      
      if (itemsError) throw itemsError;
      
      // Mesclar dados financeiros com itens
      return (quotesWithItems || []).map(quote => {
        const financial = financialData.find(f => f.quote_id === quote.id);
        return {
          ...quote,
          total_deposits: financial?.total_deposits || 0,
          total_sold: financial?.total_sold || 0,
          pending_amount: financial?.pending_amount || quote.final_amount,
          financial_status: financial?.financial_status || 'pending',
        };
      });
    },
    enabled: !!currentCompany?.id,
  });

  // Calcular resumo do caixa
  const cashSummary = useMemo(() => {
    const openingAmount = openCashRegister?.opening_amount || 0;
    const activeSales = todaySales.filter((s) => s.payment_status !== 'cancelled');
    const totalDinheiro = activeSales.filter((s) => s.payment_method === 'dinheiro').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCartao = activeSales.filter((s) => s.payment_method === 'cartao').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalPix = activeSales.filter((s) => s.payment_method === 'pix').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalVendas = totalDinheiro + totalCartao + totalPix;
    
    // Movimentações do caixa do dia
    const totalEntradas = cashMovements.filter(m => m.type === 'entrada').reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalSaidas = cashMovements.filter(m => m.type === 'saida').reduce((sum, m) => sum + (m.amount || 0), 0);
    
    const expectedAmount = openingAmount + totalDinheiro + totalEntradas - totalSaidas;

    return { openingAmount, totalDinheiro, totalCartao, totalPix, totalVendas, expectedAmount, totalEntradas, totalSaidas };
  }, [openCashRegister, todaySales, cashMovements]);

  // Abrir caixa usando o fixed_fund
  const openCashMutation = useMutation({
    mutationFn: async (openingAmount: number) => {
      if (!currentCompany?.id || !user?.id) throw new Error('Dados inválidos');
      const { data, error } = await supabase.rpc('open_daily_cash', {
        _company_id: currentCompany.id,
        _opening_amount: openingAmount,
        _user_id: user.id,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; cash_register_id?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao abrir caixa');
      }
      return result;
    },
    onSuccess: () => {
      toast.success('Caixa aberto com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      setAbrirCaixaOpen(false);
    },
    onError: (error: Error) => toast.error(`Erro ao abrir caixa: ${error.message}`),
  });

  // Submeter fechamento para auditoria (não fecha diretamente)
  const handleSubmitForAudit = async (counts: Array<{ payment_method: string; amount: number }>, notes: string) => {
    if (!openCashRegister?.id) throw new Error('Caixa não está aberto');
    
    await submitForAudit({
      cashRegisterId: openCashRegister.id,
      counts,
      notes,
    });
    
    setFecharCaixaOpen(false);
    queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
  };

  // Mutation: Nova venda com suporte a parcelamento
  const newSaleMutation = useMutation({
    mutationFn: async (data: { items: VendaItem[]; customerName: string; paymentConfig: PaymentConfig; discountPercent: number; discountAmount: number; subtotal: number; total: number; quoteId?: string }) => {
      if (!openCashRegister?.id || !currentCompany?.id || !user?.id) throw new Error('Caixa não está aberto');
      
      const { paymentConfig } = data;

      // CORREÇÃO: Quando a venda vem de um orçamento, verificar entradas já recebidas
      let depositsTotalReceived = 0;
      let existingDeposits: Array<{ id: string; amount: number; cash_movement_id: string | null }> = [];
      let existingPartialSale: { id: string } | null = null;

      if (data.quoteId) {
        // Buscar depósitos já recebidos do orçamento
        const { data: deposits } = await supabase
          .from('quote_deposits')
          .select('id, amount, cash_movement_id')
          .eq('quote_id', data.quoteId)
          .eq('status', 'received');

        existingDeposits = deposits || [];
        depositsTotalReceived = existingDeposits.reduce((sum, d) => sum + Number(d.amount), 0);

        // Buscar venda parcial existente
        const { data: partialSale } = await supabase
          .from('sales')
          .select('id')
          .eq('quote_id', data.quoteId)
          .eq('sale_type', 'partial')
          .maybeSingle();

        existingPartialSale = partialSale;
      }

      // Calcular valor real a cobrar (total - entradas já recebidas)
      const saldoRestante = Math.max(0, data.total - depositsTotalReceived);
      const totalPaidNow = paymentConfig.paidAmount;
      // O paid_amount total inclui as entradas anteriores + o que está sendo pago agora
      const totalPaidAmount = depositsTotalReceived + Math.min(totalPaidNow, saldoRestante);
      const pendingAfterSale = Math.max(0, data.total - totalPaidAmount);
      const isPaidInFull = pendingAfterSale <= 0;
      const paymentStatus = isPaidInFull ? 'paid' : 'partial';
      
      let sale: any;

      if (data.quoteId && existingPartialSale) {
        // Atualizar venda parcial existente para venda completa
        const { data: updatedSale, error: updateError } = await supabase.from('sales')
          .update({
            total_amount: data.total,
            subtotal: data.subtotal,
            discount_percent: data.discountPercent,
            discount_amount: data.discountAmount,
            paid_amount: totalPaidAmount,
            pending_amount: pendingAfterSale,
            payment_method: paymentConfig.method,
            payment_status: paymentStatus,
            sale_type: isPaidInFull ? 'full' : 'partial',
          })
          .eq('id', existingPartialSale.id)
          .select()
          .single();
        if (updateError) throw updateError;
        sale = updatedSale;
      } else {
        // Criar nova venda
        const { data: newSale, error: saleError } = await supabase.from('sales').insert({ 
          company_id: currentCompany.id, 
          cash_register_id: openCashRegister.id, 
          customer_name: data.customerName || null, 
          subtotal: data.subtotal, 
          discount_percent: data.discountPercent, 
          discount_amount: data.discountAmount, 
          total_amount: data.total, 
          payment_method: paymentConfig.method, 
          payment_status: paymentStatus,
          paid_amount: totalPaidAmount,
          pending_amount: pendingAfterSale,
          sold_by: user.id,
          quote_id: data.quoteId || null,
          sale_type: data.quoteId ? (isPaidInFull ? 'full' : 'partial') : undefined,
        }).select().single();
        
        if (saleError) throw saleError;
        sale = newSale;
      }

      // Se houve entradas de orçamento, transferir vínculos e marcar como faturadas
      if (data.quoteId && existingDeposits.length > 0) {
        // Transferir cash_movements das entradas para a venda
        for (const deposit of existingDeposits) {
          if (deposit.cash_movement_id) {
            await supabase.from('cash_movements')
              .update({ origem: 'venda', sale_id: sale.id })
              .eq('id', deposit.cash_movement_id);
          }
        }
        // Marcar depósitos como faturados
        await supabase.from('quote_deposits')
          .update({ status: 'billed' })
          .eq('quote_id', data.quoteId)
          .eq('status', 'received');
      }
      
      // Create sale items
      const saleItems = data.items.map((item) => ({ sale_id: sale.id, item_template_id: item.itemTemplateId || null, company_product_id: item.companyProductId || null, item_name: item.name, item_unit: item.unit, quantity: item.quantity, unit_price: item.unitPrice, total_price: item.totalPrice, width: item.width || null, height: item.height || null }));
      await supabase.from('sale_items').insert(saleItems);
      
      // Create accounts_receivable if there are installments
      if (paymentConfig.installments.length > 0) {
        const installmentsToInsert = paymentConfig.installments.map((inst) => ({
          company_id: currentCompany.id,
          sale_id: sale.id,
          customer_name: data.customerName || 'Cliente não identificado',
          description: `Venda #${String(sale.sale_number).padStart(4, '0')} - Parcela ${inst.number}/${paymentConfig.installments.length}`,
          total_amount: inst.amount,
          installment_number: inst.number,
          total_installments: paymentConfig.installments.length,
          due_date: format(inst.dueDate, 'yyyy-MM-dd'),
          status: 'pending',
          payment_method: paymentConfig.method,
          created_by: user.id,
        }));
        
        const { error: receivablesError } = await supabase.from('accounts_receivable').insert(installmentsToInsert);
        if (receivablesError) {
          console.error('Error creating receivables:', receivablesError);
          // Don't throw - sale was created, just log the error
        }
      }
      
      // Stock deductions - só executa na venda total (evita baixa duplicada em vendas parciais de orçamento)
      const isPartialQuoteSale = data.quoteId && !isPaidInFull;
      
      // Se for venda parcial de orçamento, verificar se OS já consumiu materiais
      let osAlreadyConsumed = false;
      if (data.quoteId) {
        const { data: osData } = await supabase
          .from('ordens_servico')
          .select('id')
          .eq('quote_id', data.quoteId)
          .in('status', ['completed'])
          .limit(1);
        if (osData && osData.length > 0) {
          const { data: consumed } = await supabase
            .from('material_consumption')
            .select('id')
            .eq('ordem_servico_id', osData[0].id)
            .eq('status', 'consumed')
            .limit(1);
          osAlreadyConsumed = !!(consumed && consumed.length > 0);
        }
      }
      
      const shouldDeductStock = !isPartialQuoteSale && !osAlreadyConsumed;
      const stockDeductions: Map<string, number> = new Map();
      for (const item of data.items) {
        if (item.itemTemplateId && !item.isProduct) {
          // Verificar se é um item de área (m²) - vidro, chaparia, etc.
          const template = availableItems.find(t => t.id === item.itemTemplateId);
          let deductionQty = item.quantity;
          
          if ((template?.unit === 'm²' || template?.unit === 'm2') && item.width && item.height) {
            // Calcular área em m²: (largura_mm × altura_mm) / 1.000.000
            const areaM2 = (item.width / 1000) * (item.height / 1000) * item.quantity;
            deductionQty = areaM2;
          }
          
          stockDeductions.set(item.itemTemplateId, (stockDeductions.get(item.itemTemplateId) || 0) + deductionQty);
        }
        if (item.isProduct) {
          const companyProductId = item.companyProductId;
          let productTemplateId = item.productTemplateId;
          if (!productTemplateId && companyProductId) {
            const product = availableProducts.find(p => p.id === companyProductId);
            productTemplateId = product?.product_template_id;
          }
          
          // 1. Buscar composição da empresa (company_product_items) - prioridade
          let hasCompanyComposition = false;
          if (companyProductId) {
            const { data: companyItems } = await supabase
              .from('company_product_items')
              .select('item_template_id, company_item_id, quantity_formula, pieces_quantity, width_formula, height_formula')
              .eq('company_product_id', companyProductId);
            
            if (companyItems && companyItems.length > 0) {
              hasCompanyComposition = true;
              for (const ci of companyItems) {
                if (ci.quantity_formula) {
                  const qty = calculateFormulaQuantity(ci.quantity_formula, item.width, item.height, ci.pieces_quantity || 1) * item.quantity;
                  if (qty > 0) {
                    // Suporta tanto item_template_id quanto company_item_id
                    const key = ci.item_template_id || `ci:${ci.company_item_id}`;
                    stockDeductions.set(key, (stockDeductions.get(key) || 0) + qty);
                  }
                }
              }
            }
          }
          
          // 2. Fallback: composição do template global (product_template_items)
          if (!hasCompanyComposition && productTemplateId) {
            const { data: templateItems } = await supabase.from('product_template_items').select('item_template_id, quantity_formula, pieces_quantity').eq('product_template_id', productTemplateId).or(`company_id.is.null,company_id.eq.${currentCompany.id}`);
            for (const ti of templateItems || []) {
              if (ti.item_template_id && ti.quantity_formula) {
                const qty = calculateFormulaQuantity(ti.quantity_formula, item.width, item.height, ti.pieces_quantity || 1) * item.quantity;
                if (qty > 0) stockDeductions.set(ti.item_template_id, (stockDeductions.get(ti.item_template_id) || 0) + qty);
              }
            }
          }
        }
      }
      // Deduzir estoque e registrar movimentações (apenas se não for venda parcial e OS não consumiu)
      if (!shouldDeductStock) {
        console.log('Baixa de estoque ignorada:', isPartialQuoteSale ? 'venda parcial de orçamento' : 'materiais já consumidos pela OS');
      }
      for (const [key, deductionQty] of shouldDeductStock ? stockDeductions : new Map()) {
        let stockItem;
        const isCompanyItem = key.startsWith('ci:');
        
        if (isCompanyItem) {
          const companyItemId = key.replace('ci:', '');
          const { data } = await supabase.from('company_stock').select('id, quantity, company_item_id, item_template_id').eq('company_id', currentCompany.id).eq('company_item_id', companyItemId).maybeSingle();
          stockItem = data;
        } else {
          const { data } = await supabase.from('company_stock').select('id, quantity, company_item_id, item_template_id').eq('company_id', currentCompany.id).eq('item_template_id', key).maybeSingle();
          stockItem = data;
        }
        
        if (stockItem) {
          await supabase.from('company_stock').update({ quantity: Math.max(0, stockItem.quantity - deductionQty) }).eq('id', stockItem.id);
          
          await supabase.from('stock_movements').insert({
            company_id: currentCompany.id,
            company_item_id: stockItem.company_item_id,
            item_template_id: stockItem.item_template_id || (isCompanyItem ? null : key),
            type: 'saida',
            category: 'venda_direta',
            quantity: deductionQty,
            unit_cost: 0,
            description: `Venda #${String(sale.sale_number).padStart(4, '0')}`,
            reference_id: sale.id,
            reference_type: 'sale',
            created_by: user.id,
          });
        }
      }
      if (data.quoteId) await supabase.from('quotes').update({ status: 'invoiced' }).eq('id', data.quoteId);
      const { data: sellerEmployee } = await supabase.from('employees').select('id, commission_enabled').eq('company_id', currentCompany.id).eq('user_id', user.id).eq('commission_enabled', true).maybeSingle();
      if (sellerEmployee?.commission_enabled) await supabase.rpc('calculate_sale_commission', { _sale_id: sale.id, _employee_id: sellerEmployee.id });
      return sale;
    },
    onSuccess: (sale) => { 
      toast.success(`Venda #${String(sale.sale_number).padStart(4, '0')} registrada!`); 
      queryClient.invalidateQueries({ queryKey: ['sales-today'] }); 
      queryClient.invalidateQueries({ queryKey: ['company-stock'] }); 
      queryClient.invalidateQueries({ queryKey: ['approved-quotes'] }); 
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['pending-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['quote-deposits'] });
      setNovaVendaOpen(false); 
    },
    onError: (error: Error) => toast.error(`Erro ao registrar venda: ${error.message}`),
  });

  // Mutation: Cancelar venda (mantido igual, resumido)
  const cancelSaleMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      if (!currentCompany?.id || !user?.id) throw new Error('Dados incompletos para cancelamento');
      
      // Chamar a função RPC para cancelamento atômico (transação no banco)
      const { data, error } = await supabase.rpc('cancel_sale', {
        p_sale_id: saleId,
        p_company_id: currentCompany.id,
        p_user_id: user.id,
        p_reason: reason
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; sale_number?: number };
      if (!result.success) throw new Error(result.error || 'Erro ao cancelar venda');

      return result;
    },
    onSuccess: (result) => { 
      toast.success(`Venda #${String(result.sale_number).padStart(4, '0')} cancelada com sucesso! O orçamento voltou ao status "Pendente" e a Ordem de Serviço foi removida para reprocessamento.`);
      queryClient.invalidateQueries({ queryKey: ['sales-today'] }); 
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] }); 
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['approved-quotes-financial'] });
      queryClient.invalidateQueries({ queryKey: ['completed-os-pending-billing'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      setCancelarVendaOpen(false); 
      setSelectedSale(null); 
    },
    onError: (error: Error) => toast.error(`Erro ao cancelar venda: ${error.message}`),
  });

  const handleCancelSale = (sale: Sale) => { setSelectedSale(sale); setCancelarVendaOpen(true); };
  const handlePrintReceipt = async (sale: Sale) => {
    try {
      const { data: fullSale } = await supabase.from('sales').select('*').eq('id', sale.id).single();
      const { data: saleItems } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
      generateSalePdf(fullSale, saleItems || [], currentCompany ? { name: currentCompany.name, cnpj: currentCompany.cnpj, phone: currentCompany.phone, email: currentCompany.email, address: currentCompany.address } : null);
      toast.success('Comprovante gerado com sucesso!');
    } catch { toast.error('Erro ao gerar comprovante'); }
  };
  const handleViewDetails = (sale: Sale) => { setSelectedSale(sale); setDetalhesVendaOpen(true); };

  // Handler: Pagar despesa via caixa do dia
  const handlePayExpense = async (expense: { id: string; description: string; amount: number }) => {
    if (!openCashRegister?.id || !currentCompany?.id || !user?.id) {
      toast.error('Caixa não está aberto');
      return;
    }
    try {
      // Criar movimento de saída no caixa
      await supabase.from('cash_movements').insert({
        company_id: currentCompany.id,
        cash_register_id: openCashRegister.id,
        type: 'saida',
        category: 'despesa',
        amount: expense.amount,
        description: `Pgto despesa: ${expense.description}`,
        expense_id: expense.id,
        payment_method: 'dinheiro',
        created_by: user.id,
      });
      // Atualizar status da despesa
      await supabase.from('expenses').update({ status: 'paid', paid_date: new Date().toISOString() }).eq('id', expense.id);
      toast.success('Despesa paga com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-due-today'] });
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  // Handler: Receber parcela via caixa do dia - abre dialog com suporte a pagamento parcial
  const handleReceivePayment = async (receivable: { 
    id: string; 
    customer_name: string; 
    description?: string;
    total_amount: number; 
    paid_amount?: number | null;
    installment_number: number; 
    total_installments: number;
    due_date?: string;
    status?: string;
    sale_id?: string | null;
    ordem_servico_id?: string | null;
  }) => {
    if (!openCashRegister?.id) {
      toast.error('Caixa não está aberto');
      return;
    }

    // Validar se a venda está cancelada
    if (receivable.sale_id) {
      const { data: sale } = await supabase.from('sales').select('payment_status').eq('id', receivable.sale_id).single();
      if (sale?.payment_status === 'cancelled') {
        toast.error('Esta venda está cancelada e não pode receber pagamentos.');
        return;
      }
    }
    setSelectedReceivable({
      id: receivable.id,
      customer_name: receivable.customer_name,
      description: receivable.description || `Parcela ${receivable.installment_number}/${receivable.total_installments}`,
      total_amount: receivable.total_amount,
      paid_amount: receivable.paid_amount || null,
      installment_number: receivable.installment_number,
      total_installments: receivable.total_installments,
      due_date: receivable.due_date || format(new Date(), 'yyyy-MM-dd'),
      status: receivable.status || 'pending',
      sale_id: receivable.sale_id || null,
      ordem_servico_id: receivable.ordem_servico_id || null,
    });
    setReceivePaymentOpen(true);
  };

  const isCashOpen = !!openCashRegister && openCashRegister.status === 'open';
  const isPendingAudit = !!openCashRegister && openCashRegister.status === 'pending_audit';

  const handleExportDailyPdf = () => {
    if (!openCashRegister) return;
    
    generateDailyCashPdf(
      openCashRegister,
      cashMovements,
      todaySales,
      {
        openingAmount: cashSummary.openingAmount,
        totalDinheiro: cashSummary.totalDinheiro,
        totalCartao: cashSummary.totalCartao,
        totalPix: cashSummary.totalPix,
        totalVendas: cashSummary.totalVendas,
        totalEntradas: cashSummary.totalEntradas,
        totalSaidas: cashSummary.totalSaidas,
        saldoDinheiro: cashSummary.openingAmount + cashSummary.totalDinheiro + cashSummary.totalEntradas - cashSummary.totalSaidas,
      },
      currentCompany ? {
        name: currentCompany.name,
        cnpj: currentCompany.cnpj,
        address: currentCompany.address,
        phone: currentCompany.phone,
      } : null,
      'download'
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Caixa & Vendas
            </h1>
            {isCashOpen && openCashRegister && (
              <p className="text-sm text-muted-foreground mt-1">
                Caixa aberto em {format(new Date(openCashRegister.opened_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
          {(isCashOpen || isPendingAudit) && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExportDailyPdf}>
                <FileText className="mr-2 h-4 w-4" />
                Relatório PDF
              </Button>
              {isCashOpen && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setMovimentacaoCaixaOpen(true)}>
                    <TrendingUp className="mr-1 h-4 w-4" />
                    <TrendingDown className="mr-2 h-4 w-4" />
                    Movimentação
                  </Button>
                  <Button variant="outline" onClick={() => setFecharCaixaOpen(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    Fechar Caixa
                  </Button>
                  <Button onClick={() => setNovaVendaOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Venda
                  </Button>
                </>
              )}
            </div>
          )}
        </div>


        {loadingCashRegister ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (isCashOpen || isPendingAudit) ? (
          <>
            {isPendingAudit && (
              <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 mb-6">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-full">
                      <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-100">Fechamento em Auditoria</p>
                      <p className="text-sm text-amber-700 dark:text-amber-400">Os valores foram congelados. Aguarde a aprovação do gerente.</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-amber-500 text-amber-600">Pendente</Badge>
                </CardContent>
              </Card>
            )}
            <CaixaResumo
              openingAmount={cashSummary.openingAmount}
              totalDinheiro={cashSummary.totalDinheiro}
              totalCartao={cashSummary.totalCartao}
              totalPix={cashSummary.totalPix}
              totalVendas={cashSummary.totalVendas}
              totalEntradas={cashSummary.totalEntradas}
              totalSaidas={cashSummary.totalSaidas}
              companyCashBalance={companyCash?.current_balance}
              fixedFund={companyCash?.fixed_fund}
            />

            {/* Entradas de Orçamento Pendentes */}
            {openCashRegister?.id && (
              <PendingDepositsAlert cashRegisterId={openCashRegister.id} />
            )}

            {/* Alertas do Dia (despesas e parcelas vencendo) */}
            <CaixaAlertasHoje
              expensesDueToday={expensesDueToday}
              receivablesDueToday={receivablesDueToday}
              onPayExpense={handlePayExpense}
              onReceivePayment={handleReceivePayment}
              disabled={!isCashOpen}
            />

            {/* Serviços Prontos para Faturamento */}
            {completedOSPendingBilling.length > 0 && (
              <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-green-600" />
                    Serviços Prontos para Faturamento
                    <Badge variant="secondary" className="ml-auto">{completedOSPendingBilling.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {completedOSPendingBilling.map((os) => (
                      <div
                        key={os.id}
                        className="p-4 rounded-lg border bg-card hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-bold text-sm">
                              OS #{String(os.os_number).padStart(4, '0')}
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                              {os.customer_name}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                            Concluída
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Saldo pendente</p>
                            <p className="font-semibold text-primary">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.pending_amount)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setOsToFaturar({
                                id: os.id,
                                os_number: os.os_number,
                                customer_name: os.customer_name,
                                total_amount: os.total_amount,
                                paid_amount: os.paid_amount,
                                pending_amount: os.pending_amount,
                                quote_id: os.quote_id,
                                status: os.status,
                              });
                              setFaturarDialogOpen(true);
                            }}
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            Faturar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Movimentações do Caixa do Dia */}
            <CaixaMovimentacoesTable movements={cashMovements} />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-semibold">Vendas do Caixa Atual</CardTitle>
                <Badge variant="secondary">{todaySales.filter(s => s.payment_status !== 'cancelled').length} vendas</Badge>
              </CardHeader>
              <CardContent>
                <VendasTable sales={todaySales} onViewDetails={handleViewDetails} onCancelSale={handleCancelSale} onPrintReceipt={handlePrintReceipt} />
              </CardContent>
            </Card>

          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Caixa Fechado</h3>
              <p className="text-muted-foreground mb-4">
                Abra o caixa para começar a registrar vendas e movimentações.
              </p>
              <Button onClick={() => setAbrirCaixaOpen(true)}>
                <Unlock className="mr-2 h-4 w-4" />
                Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <AbrirCaixaDialog 
        open={abrirCaixaOpen} 
        onOpenChange={setAbrirCaixaOpen} 
        onConfirm={(amount) => openCashMutation.mutateAsync(amount)} 
        companyCash={companyCash} 
        isLoading={openCashMutation.isPending} 
      />
      <FecharCaixaDialog open={fecharCaixaOpen} onOpenChange={setFecharCaixaOpen} onConfirm={handleSubmitForAudit} summary={cashSummary} companyCash={companyCash} cashRegisterId={openCashRegister?.id} isLoading={isSubmittingForAudit} />
      <NovaVendaDialog open={novaVendaOpen} onOpenChange={setNovaVendaOpen} onConfirm={(data) => newSaleMutation.mutateAsync(data)} availableItems={availableItems} approvedQuotes={approvedQuotesWithFinancial} isLoading={newSaleMutation.isPending} />
      <CancelarVendaDialog open={cancelarVendaOpen} onOpenChange={setCancelarVendaOpen} sale={selectedSale} onConfirm={(saleId, reason) => cancelSaleMutation.mutateAsync({ saleId, reason })} isLoading={cancelSaleMutation.isPending} />
      <DetalhesVendaDialog open={detalhesVendaOpen} onOpenChange={setDetalhesVendaOpen} sale={selectedSale} onPrint={handlePrintReceipt} />

      {/* Dialog Movimentação Caixa do Dia */}
      {openCashRegister && (
        <MovimentacaoCaixaDialog
          open={movimentacaoCaixaOpen}
          onOpenChange={setMovimentacaoCaixaOpen}
          cashRegisterId={openCashRegister.id}
          currentDailyBalance={cashSummary.expectedAmount}
        />
      )}

      {/* Dialog Receber Pagamento - suporta pagamento parcial */}
      <ReceivePaymentDialog
        open={receivePaymentOpen}
        onOpenChange={setReceivePaymentOpen}
        receivable={selectedReceivable}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
          queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
          queryClient.invalidateQueries({ queryKey: ['cash-summary'] });
        }}
      />

      {/* Dialog Faturar OS Concluída */}
      {osToFaturar && (
        <FaturarSaldoDialog
          open={faturarDialogOpen}
          onOpenChange={(open) => {
            setFaturarDialogOpen(open);
            if (!open) setOsToFaturar(null);
          }}
          ordemServico={osToFaturar}
          onSuccess={() => {
            setFaturarDialogOpen(false);
            setOsToFaturar(null);
            queryClient.invalidateQueries({ queryKey: ['completed-os-pending-billing'] });
            queryClient.invalidateQueries({ queryKey: ['sales-today'] });
            queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
            queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
          }}
        />
      )}
    </MainLayout>
  );
}
