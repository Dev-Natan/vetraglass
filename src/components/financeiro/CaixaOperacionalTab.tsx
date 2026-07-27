import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useCompanyNotifications } from '@/hooks/useCompanyNotifications';
import { useCashAudits } from '@/hooks/useCashAudits';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShoppingCart, Lock, Plus, Unlock, TrendingUp, TrendingDown, FileText, ClipboardList, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Componentes do caixa
import { FecharCaixaDialog } from '@/components/caixa/FecharCaixaDialog';
import { AbrirCaixaDialog } from '@/components/caixa/AbrirCaixaDialog';
import { NovaVendaDialog } from '@/components/caixa/NovaVendaDialog';
import { CaixaResumo } from '@/components/caixa/CaixaResumo';
import { VendasTable } from '@/components/caixa/VendasTable';
import { CancelarVendaDialog } from '@/components/caixa/CancelarVendaDialog';
import { DetalhesVendaDialog } from '@/components/caixa/DetalhesVendaDialog';
import { MovimentacaoCaixaDialog } from '@/components/caixa/MovimentacaoCaixaDialog';
import { CaixaAlertasHoje } from '@/components/caixa/CaixaAlertasHoje';
import { CaixaMovimentacoesTable } from '@/components/caixa/CaixaMovimentacoesTable';
import { PendingDepositsAlert } from '@/components/caixa/PendingDepositsAlert';
import { ReceivePaymentDialog } from '@/components/caixa/ReceivePaymentDialog';
import { FaturarSaldoDialog } from '@/components/caixa/FaturarSaldoDialog';

// Hooks e Serviços
import { useCaixa } from '@/hooks/useCaixa';
import { useSales } from '@/hooks/useSales';
import { caixaService } from '@/services/caixaService';
import { saleService } from '@/services/saleService';
import { ordemServicoService } from '@/services/ordemServicoService';
import { generateSalePdf } from '@/utils/generateSalePdf';
import { generateDailyCashPdf } from '@/utils/generateDailyCashPdf';

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
  sale_type?: 'full' | 'partial' | string;
  quote_id?: string | null;
  paid_amount?: number;
  pending_amount?: number;
}

export function CaixaOperacionalTab() {
  const { currentCompany, user } = useAuth();
  const { submitForAudit, isSubmittingForAudit } = useCashAudits();
  const queryClient = useQueryClient();
  
  const [abrirCaixaOpen, setAbrirCaixaOpen] = useState(false);
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false);
  const [novaVendaOpen, setNovaVendaOpen] = useState(false);
  const [cancelarVendaOpen, setCancelarVendaOpen] = useState(false);
  const [detalhesVendaOpen, setDetalhesVendaOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [movimentacaoCaixaOpen, setMovimentacaoCaixaOpen] = useState(false);
  const [receivePaymentOpen, setReceivePaymentOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<any>(null);
  const [faturarDialogOpen, setFaturarDialogOpen] = useState(false);
  const [osToFaturar, setOsToFaturar] = useState<any>(null);

  const { 
    companyCash, 
    openCashRegister, 
    lastClosingAmount,
    isLoading: loadingCashRegister,
    openCash,
    isOpening
  } = useCaixa();


  const { createSale, cancelSale, isCreating, isCancelling } = useSales();

  const { data: todaySales = [] } = useQuery({
    queryKey: ['sales-today', openCashRegister?.id],
    queryFn: () => saleService.fetchTodaySales(openCashRegister!.id),
    enabled: !!openCashRegister?.id,
  });

  const { data: cashMovements = [] } = useQuery({
    queryKey: ['cash-movements', openCashRegister?.id],
    queryFn: () => caixaService.fetchCashMovements(openCashRegister!.id),
    enabled: !!openCashRegister?.id,
  });

  const { data: expensesDueToday = [] } = useQuery({
    queryKey: ['expenses-due-today', currentCompany?.id],
    queryFn: () => caixaService.fetchExpensesDueToday(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  const { data: receivablesDueToday = [] } = useQuery({
    queryKey: ['receivables-due-today', currentCompany?.id],
    queryFn: () => caixaService.fetchReceivablesDueToday(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  const { data: completedOSPendingBilling = [] } = useQuery({
    queryKey: ['completed-os-pending-billing', currentCompany?.id],
    queryFn: () => ordemServicoService.fetchCompletedOSPendingBilling(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  const { data: availableItems = [] } = useQuery({
    queryKey: ['available-items', currentCompany?.id],
    queryFn: () => saleService.fetchAvailableItems(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  const { data: availableProducts = [] } = useQuery({
    queryKey: ['available-products', currentCompany?.id],
    queryFn: () => saleService.fetchAvailableProducts(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  const { data: approvedQuotesWithFinancial = [] } = useQuery({
    queryKey: ['approved-quotes-financial', currentCompany?.id],
    queryFn: () => saleService.fetchApprovedQuotesFinancial(currentCompany!.id),
    enabled: !!currentCompany?.id,
  });

  const cashSummary = useMemo(() => {
    const openingAmount = openCashRegister?.opening_amount || 0;
    const activeSales = todaySales.filter((s) => s.payment_status !== 'cancelled');
    const totalDinheiroSales = activeSales.filter((s) => s.payment_method === 'dinheiro').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCartaoSales = activeSales.filter((s) => s.payment_method === 'cartao').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalPixSales = activeSales.filter((s) => s.payment_method === 'pix').reduce((sum, s) => sum + (s.total_amount || 0), 0);

    // Entradas de orçamento (depósitos) — deduplicar contra vendas geradas na conversão
    // (mesmo quote_id + mesmo valor + timestamp dentro de ±5s = mesma transação)
    const TOL = 5000;
    const salesRefs = activeSales.map((s: any) => ({
      quote_id: s.quote_id || null,
      method: s.payment_method,
      amount: Number(s.total_amount) || 0,
      ts: new Date(s.created_at || Date.now()).getTime(),
      used: false,
    }));
    const depositMovsRaw = cashMovements.filter((m: any) => m.type === 'entrada' && m.category === 'entrada_orcamento');
    const depositMovs = depositMovsRaw.filter((m: any) => {
      const amt = Number(m.amount) || 0;
      const ts = new Date(m.created_at || Date.now()).getTime();
      const qid = (m as any).quote_id || null;
      const hit = salesRefs.findIndex(
        (s) => !s.used && s.amount === amt && Math.abs(s.ts - ts) <= TOL && (!qid || !s.quote_id || s.quote_id === qid)
      );
      if (hit >= 0) { salesRefs[hit].used = true; return false; }
      return true;
    });
    const sumByMethod = (method: string) => depositMovs
      .filter((m: any) => (m.payment_method || 'dinheiro') === method)
      .reduce((sum: number, m: any) => sum + (m.amount || 0), 0);

    const totalDinheiro = totalDinheiroSales + sumByMethod('dinheiro');
    const totalCartao = totalCartaoSales + sumByMethod('cartao') + sumByMethod('cartao_debito') + sumByMethod('cartao_credito');
    const totalPix = totalPixSales + sumByMethod('pix');
    const totalVendas = totalDinheiro + totalCartao + totalPix;

    const isSaleLinked = (m: any) =>
      m.sale_id || m.quote_id || m.ordem_servico_id ||
      m.category === 'entrada_orcamento' || m.category === 'venda' || m.category === 'venda_dinheiro' ||
      m.category === 'abertura' || m.category === 'abertura_caixa';

    // Movimentações manuais (reforço/sangria) que afetam somente o dinheiro físico
    const totalEntradas = cashMovements
      .filter(m => m.type === 'entrada' && !isSaleLinked(m))
      .reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalSaidas = cashMovements.filter(m => m.type === 'saida' && (m as any).category !== 'abertura' && (m as any).category !== 'abertura_caixa').reduce((sum, m) => sum + (m.amount || 0), 0);

    // Dinheiro esperado no caixa físico = abertura + vendas em dinheiro + entradas manuais - saídas
    const expectedAmount = openingAmount + totalDinheiro + totalEntradas - totalSaidas;

    return { openingAmount, totalDinheiro, totalCartao, totalPix, totalVendas, expectedAmount, totalEntradas, totalSaidas };
  }, [openCashRegister, todaySales, cashMovements]);

  const handleOpenCash = async (openingAmount: number) => {
    openCash(openingAmount);
    setAbrirCaixaOpen(false);
  };

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

  const handlePayExpense = async (expense: { id: string; description: string; amount: number }) => {
    if (!openCashRegister?.id || !currentCompany?.id || !user?.id) {
      toast.error('Caixa não está aberto');
      return;
    }
    try {
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
      await supabase.from('expenses').update({ status: 'paid', paid_date: new Date().toISOString() }).eq('id', expense.id);
      toast.success('Despesa paga com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['expenses-due-today'] });
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    }
  };

  const handleReceivePayment = async (receivable: any) => {
    if (!openCashRegister?.id) {
      toast.error('Caixa não está aberto');
      return;
    }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Caixa & Vendas
          </h2>
          {isCashOpen && openCashRegister && (
            <p className="text-xs text-muted-foreground mt-1">
              Caixa aberto em {format(new Date(openCashRegister.opened_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
        {isCashOpen && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportDailyPdf}>
              <FileText className="mr-2 h-4 w-4" />
              Relatório PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMovimentacaoCaixaOpen(true)}>
              <TrendingUp className="mr-1 h-4 w-4" />
              <TrendingDown className="mr-2 h-4 w-4" />
              Movimentação
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFecharCaixaOpen(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Fechar Caixa
            </Button>
            <Button size="sm" onClick={() => setNovaVendaOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Venda
            </Button>
          </div>
        )}
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

          {openCashRegister?.id && (
            <PendingDepositsAlert cashRegisterId={openCashRegister.id} />
          )}

          <CaixaAlertasHoje
            expensesDueToday={expensesDueToday}
            receivablesDueToday={receivablesDueToday}
            onPayExpense={handlePayExpense}
            onReceivePayment={handleReceivePayment}
            disabled={!isCashOpen}
          />

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
                  {completedOSPendingBilling.map((os: any) => (
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

          <CaixaMovimentacoesTable movements={cashMovements} />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Vendas do Caixa Atual</CardTitle>
              <Badge variant="secondary">{todaySales.filter((s: any) => s.payment_status !== 'cancelled').length} vendas</Badge>
            </CardHeader>
            <CardContent>
              <VendasTable sales={todaySales} onViewDetails={handleViewDetails} onCancelSale={handleCancelSale} onPrintReceipt={handlePrintReceipt} showCancelButton={true} />
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

      {/* Dialogs */}
      <AbrirCaixaDialog 
        open={abrirCaixaOpen} 
        onOpenChange={setAbrirCaixaOpen} 
        onConfirm={handleOpenCash} 
        companyCash={companyCash} 
        suggestedAmount={lastClosingAmount}
        isLoading={isOpening} 
      />

      <FecharCaixaDialog open={fecharCaixaOpen} onOpenChange={setFecharCaixaOpen} onConfirm={handleSubmitForAudit} summary={cashSummary} companyCash={companyCash} cashRegisterId={openCashRegister?.id} isLoading={isSubmittingForAudit} />
      <NovaVendaDialog 
        open={novaVendaOpen} 
        onOpenChange={setNovaVendaOpen} 
        onConfirm={(data) => createSale({ 
          ...data, 
          cashRegisterId: openCashRegister!.id, 
          companyId: currentCompany!.id, 
          userId: user!.id, 
          availableItems, 
          availableProducts 
        })} 
        availableItems={availableItems} 
        approvedQuotes={approvedQuotesWithFinancial} 
        isLoading={isCreating} 
      />
      <CancelarVendaDialog open={cancelarVendaOpen} onOpenChange={setCancelarVendaOpen} sale={selectedSale} onConfirm={(saleId, reason) => cancelSale({ saleId, companyId: currentCompany!.id, userId: user!.id, reason })} isLoading={isCancelling} />
      <DetalhesVendaDialog open={detalhesVendaOpen} onOpenChange={setDetalhesVendaOpen} sale={selectedSale} onPrint={handlePrintReceipt} />

      {openCashRegister && (
        <MovimentacaoCaixaDialog
          open={movimentacaoCaixaOpen}
          onOpenChange={setMovimentacaoCaixaOpen}
          cashRegisterId={openCashRegister.id}
          currentDailyBalance={cashSummary.expectedAmount}
        />
      )}

      <ReceivePaymentDialog
        open={receivePaymentOpen}
        onOpenChange={setReceivePaymentOpen}
        receivable={selectedReceivable}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['receivables-due-today'] });
          queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
          queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
          queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
          queryClient.invalidateQueries({ queryKey: ['sales-today'] });
        }}
      />

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
    </div>
  );
}
