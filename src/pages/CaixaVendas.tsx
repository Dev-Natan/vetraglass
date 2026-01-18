import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Lock, Plus, Unlock, TrendingUp, TrendingDown, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Parser } from 'expr-eval';

import { AbrirCaixaDialog } from '@/components/caixa/AbrirCaixaDialog';
import { FecharCaixaDialog } from '@/components/caixa/FecharCaixaDialog';
import { NovaVendaDialog, VendaItem } from '@/components/caixa/NovaVendaDialog';
import { CaixaResumo } from '@/components/caixa/CaixaResumo';
import { VendasTable } from '@/components/caixa/VendasTable';
import { CancelarVendaDialog } from '@/components/caixa/CancelarVendaDialog';
import { DetalhesVendaDialog } from '@/components/caixa/DetalhesVendaDialog';
import { MovimentacaoCaixaDialog } from '@/components/caixa/MovimentacaoCaixaDialog';
import { CaixaAlertasHoje } from '@/components/caixa/CaixaAlertasHoje';
import { CaixaMovimentacoesTable } from '@/components/caixa/CaixaMovimentacoesTable';
import { generateSalePdf } from '@/utils/generateSalePdf';
import { generateDailyCashPdf } from '@/utils/generateDailyCashPdf';

function calculateFormulaQuantity(formula: string, width: number, height: number, piecesQty: number): number {
  try {
    const L = width / 1000;
    const A = height / 1000;
    let processedFormula = formula
      .replace(/largura/gi, 'L')
      .replace(/altura/gi, 'A')
      .replace(/,/g, '.');
    const parser = new Parser();
    const result = parser.evaluate(processedFormula, { L, A, l: L, a: A });
    return (result / 1000) * piecesQty;
  } catch (error) {
    console.error('Erro ao calcular fórmula:', formula, error);
    return 0;
  }
}

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
}

export default function CaixaVendas() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
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

  // Buscar caixa aberto
  const { data: openCashRegister, isLoading: loadingCashRegister } = useQuery({
    queryKey: ['cash-register-open', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
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
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('due_date', today)
        .eq('status', 'pending')
        .order('total_amount', { ascending: false });
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

  const { data: approvedQuotes = [] } = useQuery({
    queryKey: ['approved-quotes', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase.from('quotes').select(`id, quote_number, customer_name, total_amount, final_amount, status, created_at, quote_items (id, description, quantity, unit_price, total_price, width, height, company_product_id, product_template_id)`).eq('company_id', currentCompany.id).eq('status', 'approved').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
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

  // Mutation: Abrir caixa (usando função SQL com todas as regras)
  const openCashMutation = useMutation({
    mutationFn: async (openingAmount: number) => {
      if (!currentCompany?.id || !user?.id) throw new Error('Dados inválidos');

      // Usar função SQL que implementa todas as regras de abertura
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

  // Mutation: Fechar caixa (usando função SQL com compensação automática)
  const closeCashMutation = useMutation({
    mutationFn: async ({ actualAmount, notes }: { actualAmount: number; notes: string }) => {
      if (!openCashRegister?.id || !user?.id || !currentCompany?.id) throw new Error('Dados inválidos');
      
      // Usar função SQL que implementa todas as regras de fechamento
      const { data, error } = await supabase.rpc('close_daily_cash', {
        _cash_register_id: openCashRegister.id,
        _actual_amount: actualAmount,
        _notes: notes || null,
        _user_id: user.id,
      });
      
      if (error) throw error;
      
      const result = data as { 
        success: boolean; 
        error?: string; 
        net_excess?: number;
        compensation?: { total_compensated: number };
      };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao fechar caixa');
      }
      
      return result;
    },
    onSuccess: (result) => {
      const compensation = result?.compensation?.total_compensated || 0;
      if (compensation > 0) {
        toast.success(`Caixa fechado! R$ ${compensation.toFixed(2)} compensados de adiantamentos anteriores.`, { duration: 5000 });
      } else {
        toast.success('Caixa fechado com sucesso!');
      }
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      queryClient.invalidateQueries({ queryKey: ['pending-advances'] });
      setFecharCaixaOpen(false);
    },
    onError: (error: Error) => toast.error(`Erro ao fechar caixa: ${error.message}`),
  });

  // Mutation: Nova venda (mantido igual, resumido)
  const newSaleMutation = useMutation({
    mutationFn: async (data: { items: VendaItem[]; customerName: string; paymentMethod: 'dinheiro' | 'cartao' | 'pix'; discountPercent: number; discountAmount: number; subtotal: number; total: number; quoteId?: string }) => {
      if (!openCashRegister?.id || !currentCompany?.id || !user?.id) throw new Error('Caixa não está aberto');
      const { data: sale, error: saleError } = await supabase.from('sales').insert({ company_id: currentCompany.id, cash_register_id: openCashRegister.id, customer_name: data.customerName || null, subtotal: data.subtotal, discount_percent: data.discountPercent, discount_amount: data.discountAmount, total_amount: data.total, payment_method: data.paymentMethod, payment_status: 'paid', sold_by: user.id }).select().single();
      if (saleError) throw saleError;
      const saleItems = data.items.map((item) => ({ sale_id: sale.id, item_template_id: item.itemTemplateId || null, company_product_id: item.companyProductId || null, item_name: item.name, item_unit: item.unit, quantity: item.quantity, unit_price: item.unitPrice, total_price: item.totalPrice, width: item.width || null, height: item.height || null }));
      await supabase.from('sale_items').insert(saleItems);
      
      // Stock deductions (simplified - kept same logic)
      const stockDeductions: Map<string, number> = new Map();
      for (const item of data.items) {
        if (item.itemTemplateId && !item.isProduct) {
          stockDeductions.set(item.itemTemplateId, (stockDeductions.get(item.itemTemplateId) || 0) + item.quantity);
        }
        if (item.isProduct && item.width && item.height) {
          let productTemplateId = item.productTemplateId;
          if (!productTemplateId && item.companyProductId) {
            const product = availableProducts.find(p => p.id === item.companyProductId);
            productTemplateId = product?.product_template_id;
          }
          if (productTemplateId) {
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
      for (const [itemTemplateId, deductionQty] of stockDeductions) {
        const { data: stockItem } = await supabase.from('company_stock').select('id, quantity').eq('company_id', currentCompany.id).eq('item_template_id', itemTemplateId).maybeSingle();
        if (stockItem) await supabase.from('company_stock').update({ quantity: Math.max(0, stockItem.quantity - deductionQty) }).eq('id', stockItem.id);
      }
      if (data.quoteId) await supabase.from('quotes').update({ status: 'invoiced' }).eq('id', data.quoteId);
      const { data: sellerEmployee } = await supabase.from('employees').select('id, commission_enabled').eq('company_id', currentCompany.id).eq('user_id', user.id).eq('commission_enabled', true).maybeSingle();
      if (sellerEmployee?.commission_enabled) await supabase.rpc('calculate_sale_commission', { _sale_id: sale.id, _employee_id: sellerEmployee.id });
      return sale;
    },
    onSuccess: (sale) => { toast.success(`Venda #${String(sale.sale_number).padStart(4, '0')} registrada!`); queryClient.invalidateQueries({ queryKey: ['sales-today'] }); queryClient.invalidateQueries({ queryKey: ['company-stock'] }); queryClient.invalidateQueries({ queryKey: ['approved-quotes'] }); setNovaVendaOpen(false); },
    onError: (error: Error) => toast.error(`Erro ao registrar venda: ${error.message}`),
  });

  // Mutation: Cancelar venda (mantido igual, resumido)
  const cancelSaleMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      const { data: saleItems } = await supabase.from('sale_items').select('id, item_template_id, company_product_id, quantity, width, height').eq('sale_id', saleId);
      const stockRestorations: Map<string, number> = new Map();
      for (const item of saleItems || []) {
        if (item.item_template_id && !item.company_product_id) stockRestorations.set(item.item_template_id, (stockRestorations.get(item.item_template_id) || 0) + item.quantity);
        if (item.company_product_id && item.width && item.height) {
          const { data: cp } = await supabase.from('company_products').select('product_template_id').eq('id', item.company_product_id).single();
          if (cp?.product_template_id) {
            const { data: templateItems } = await supabase.from('product_template_items').select('item_template_id, quantity_formula, pieces_quantity').eq('product_template_id', cp.product_template_id).or(`company_id.is.null,company_id.eq.${currentCompany.id}`);
            for (const ti of templateItems || []) {
              if (ti.item_template_id && ti.quantity_formula) {
                const qty = calculateFormulaQuantity(ti.quantity_formula, item.width, item.height, ti.pieces_quantity || 1) * item.quantity;
                if (qty > 0) stockRestorations.set(ti.item_template_id, (stockRestorations.get(ti.item_template_id) || 0) + qty);
              }
            }
          }
        }
      }
      for (const [itemTemplateId, restoreQty] of stockRestorations) {
        const { data: stockItem } = await supabase.from('company_stock').select('id, quantity').eq('company_id', currentCompany.id).eq('item_template_id', itemTemplateId).maybeSingle();
        if (stockItem) await supabase.from('company_stock').update({ quantity: stockItem.quantity + restoreQty }).eq('id', stockItem.id);
      }
      const { data: sale, error } = await supabase.from('sales').update({ payment_status: 'cancelled', notes: reason ? `Cancelado: ${reason}` : 'Venda cancelada' }).eq('id', saleId).select().single();
      if (error) throw error;
      return sale;
    },
    onSuccess: (sale) => { toast.success(`Venda #${String(sale.sale_number).padStart(4, '0')} cancelada!`); queryClient.invalidateQueries({ queryKey: ['sales-today'] }); queryClient.invalidateQueries({ queryKey: ['company-stock'] }); setCancelarVendaOpen(false); setSelectedSale(null); },
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

  // Handler: Receber parcela via caixa do dia
  const handleReceivePayment = async (receivable: { id: string; customer_name: string; total_amount: number; installment_number: number; total_installments: number }) => {
    if (!openCashRegister?.id || !currentCompany?.id || !user?.id) {
      toast.error('Caixa não está aberto');
      return;
    }
    try {
      // Criar movimento de entrada no caixa
      await supabase.from('cash_movements').insert({
        company_id: currentCompany.id,
        cash_register_id: openCashRegister.id,
        type: 'entrada',
        category: 'recebimento',
        amount: receivable.total_amount,
        description: `Parcela ${receivable.installment_number}/${receivable.total_installments} - ${receivable.customer_name}`,
        receivable_id: receivable.id,
        payment_method: 'dinheiro',
        created_by: user.id,
      });
      // Atualizar status da parcela
      await supabase.from('accounts_receivable').update({ 
        status: 'paid', 
        paid_date: new Date().toISOString(),
        paid_amount: receivable.total_amount,
        payment_method: 'dinheiro'
      }).eq('id', receivable.id);
      toast.success('Parcela recebida com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  const isCashOpen = !!openCashRegister;

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
          <div className="flex flex-wrap gap-2">
            {isCashOpen ? (
              <>
                <Button variant="outline" size="sm" onClick={handleExportDailyPdf}>
                  <FileText className="mr-2 h-4 w-4" />
                  Relatório PDF
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMovimentacaoCaixaOpen(true)}>
                  <TrendingUp className="mr-1 h-4 w-4 text-green-600" />
                  <TrendingDown className="mr-2 h-4 w-4 text-red-600" />
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
            ) : (
              <Button onClick={() => setAbrirCaixaOpen(true)}>
                <Unlock className="mr-2 h-4 w-4" />
                Abrir Caixa
              </Button>
            )}
          </div>
        </div>


        {loadingCashRegister ? (
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : isCashOpen ? (
          <>
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

            {/* Alertas do Dia (despesas e parcelas vencendo) */}
            <CaixaAlertasHoje
              expensesDueToday={expensesDueToday}
              receivablesDueToday={receivablesDueToday}
              onPayExpense={handlePayExpense}
              onReceivePayment={handleReceivePayment}
              disabled={!isCashOpen}
            />

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
              <p className="text-muted-foreground mb-4">Abra o caixa para começar a registrar vendas.</p>
              <Button onClick={() => setAbrirCaixaOpen(true)}>
                <Unlock className="mr-2 h-4 w-4" />
                Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <AbrirCaixaDialog open={abrirCaixaOpen} onOpenChange={setAbrirCaixaOpen} onConfirm={(amount) => openCashMutation.mutateAsync(amount)} companyCash={companyCash} isLoading={openCashMutation.isPending} />
      <FecharCaixaDialog open={fecharCaixaOpen} onOpenChange={setFecharCaixaOpen} onConfirm={(actualAmount, notes) => closeCashMutation.mutateAsync({ actualAmount, notes })} summary={cashSummary} companyCash={companyCash} cashRegisterId={openCashRegister?.id} isLoading={closeCashMutation.isPending} />
      <NovaVendaDialog open={novaVendaOpen} onOpenChange={setNovaVendaOpen} onConfirm={(data) => newSaleMutation.mutateAsync(data)} availableItems={availableItems} approvedQuotes={approvedQuotes} isLoading={newSaleMutation.isPending} />
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
    </MainLayout>
  );
}
