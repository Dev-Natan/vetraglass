import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import type { Sale, PaymentFilter, StatusFilter } from '@/types/financeiro';
import { useAuth } from '@/contexts/AuthContext';

import { MainLayout } from '@/components/layout/MainLayout';
import { 
  DollarSign, 
  ArrowUpRight, 
  Search,
  Filter,
  Eye,
  Printer,
  FileText,
  Wallet,
  Users,
  History as HistoryIcon,
  PieChart,
  BarChart3,
  Receipt,
  Settings,
  ShoppingCart
} from 'lucide-react';
import { FormasPagamentoDialog } from '@/components/orcamentos/FormasPagamentoDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { DetalhesVendaDialog } from '@/components/caixa/DetalhesVendaDialog';
import { generateSalePdf } from '@/utils/generateSalePdf';
import { ExpensesTab } from '@/components/financeiro/ExpensesTab';
import { CommissionsTab } from '@/components/financeiro/CommissionsTab';
import { ContasReceberTab } from '@/components/financeiro/ContasReceberTab';
import { ContasPagarTab } from '@/components/financeiro/ContasPagarTab';
import { PlanoContasTab } from '@/components/financeiro/PlanoContasTab';
import { BankAccountsTab } from '@/components/financeiro/BankAccountsTab';
import { CaixaEmpresaTab } from '@/components/financeiro/CaixaEmpresaTab';
import { CaixaReportTab } from '@/components/financeiro/CaixaReportTab';
import { FinancialDashboard } from '@/components/financeiro/FinancialDashboard';
import { CaixaOperacionalTab } from '@/components/financeiro/CaixaOperacionalTab';
import { MonthSelector, getMonthDateRange } from '@/components/common/MonthSelector';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';
import { PaginationControls } from '@/components/common/PaginationControls';
import { Landmark, BookOpen } from 'lucide-react';

const paymentMethodConfig = {
  dinheiro: { label: 'Dinheiro', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cartao: { label: 'Cartão', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  pix: { label: 'PIX', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

const statusConfig = {
  paid: { label: 'Pago', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

export default function Financeiro() {
  const { currentCompany } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  useModuleTutorialTrigger('financeiro');
  useModuleTutorialTrigger('caixa-vendas');

  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const dateRange = getMonthDateRange(selectedMonth);

  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) return tabParam;
    return sessionStorage.getItem('financeiro-active-tab') || 'dashboard';
  });

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams, activeTab]);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    sessionStorage.setItem('financeiro-active-tab', value);
    setSearchParams({ tab: value });
    setCurrentPage(1);
  };

  const { data: salesData = { items: [], totalCount: 0 }, isLoading } = useQuery({
    queryKey: ['sales-financeiro-audit', currentCompany?.id, selectedMonth.getMonth(), selectedMonth.getFullYear(), currentPage, pageSize],
    queryFn: async () => {
      if (!currentCompany?.id) return { items: [], totalCount: 0 };
      
      let query = supabase
        .from('sales')
        .select('*', { count: 'exact' })
        .eq('company_id', currentCompany.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());

      if (activeTab === 'auditoria-vendas') {
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to).order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { items: (data as Sale[]) || [], totalCount: count || 0 };
    },
    enabled: !!currentCompany?.id,
  });

  const sales = salesData.items;
  const totalSalesCount = salesData.totalCount;

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      if (paymentFilter !== 'all' && sale.payment_method !== paymentFilter) return false;
      if (statusFilter !== 'all' && sale.payment_status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesNumber = sale.sale_number.toString().includes(search);
        const matchesCustomer = sale.customer_name?.toLowerCase().includes(search);
        if (!matchesNumber && !matchesCustomer) return false;
      }
      return true;
    });
  }, [sales, paymentFilter, statusFilter, searchTerm]);

  const summary = useMemo(() => {
    const activeSales = filteredSales.filter(s => s.payment_status !== 'cancelled');
    const cancelledSales = filteredSales.filter(s => s.payment_status === 'cancelled');
    
    return {
      totalReceitas: activeSales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
      totalCancelado: cancelledSales.reduce((sum, s) => sum + (s.total_amount || 0), 0),
      countActive: activeSales.length,
      countCancelled: cancelledSales.length,
    };
  }, [filteredSales]);

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailsDialogOpen(true);
  };

  const handlePrintReceipt = async (sale: Sale) => {
    try {
      const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
      const { data: company } = await supabase.from('companies').select('*').eq('id', currentCompany?.id).single();
      if (company) {
        generateSalePdf(sale, items || [], company);
        toast.success('Comprovante gerado!');
      }
    } catch (error) {
      toast.error('Erro ao gerar comprovante');
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-primary" />
              Gestão Financeira e Auditoria
            </h1>
            <p className="text-muted-foreground text-sm">Controle gerencial, análise de resultados e auditoria de movimentações</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => setIsPaymentDialogOpen(true)} 
            className="gap-2 h-10 sm:h-11 px-4"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Configurar Pagamentos</span>
          </Button>
        </header>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="flex flex-wrap w-full h-auto p-1 bg-muted/50 border gap-1">
            <TabsTrigger value="dashboard" className="gap-2 py-2 flex-1 min-w-[120px]">
              <PieChart className="w-4 h-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="caixa" className="gap-2 py-2 flex-1 min-w-[120px]">
              <ShoppingCart className="w-4 h-4" /> Caixa Diário
            </TabsTrigger>
            <TabsTrigger value="caixa-empresa" className="gap-2 py-2 flex-1 min-w-[120px]">
              <Wallet className="w-4 h-4" /> Fluxo Empresa
            </TabsTrigger>
            <TabsTrigger value="receber" className="gap-2 py-2 flex-1 min-w-[120px]">
              <DollarSign className="w-4 h-4" /> A Receber
            </TabsTrigger>
            <TabsTrigger value="pagar" className="gap-2 py-2 flex-1 min-w-[120px]">
              <FileText className="w-4 h-4" /> A Pagar
            </TabsTrigger>
            <TabsTrigger value="comissoes" className="gap-2 py-2 flex-1 min-w-[120px]">
              <Users className="w-4 h-4" /> Comissões
            </TabsTrigger>
            <TabsTrigger value="contas-bancarias" className="gap-2 py-2 flex-1 min-w-[120px]">
              <Landmark className="w-4 h-4" /> Bancos
            </TabsTrigger>
            <TabsTrigger value="plano-contas" className="gap-2 py-2 flex-1 min-w-[120px]">
              <BookOpen className="w-4 h-4" /> Plano de Contas
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-2 py-2 flex-1 min-w-[120px]">
              <HistoryIcon className="w-4 h-4" /> Auditoria
            </TabsTrigger>
            <TabsTrigger value="auditoria-vendas" className="gap-2 py-2 flex-1 min-w-[120px]">
              <Receipt className="w-4 h-4" /> Vendas
            </TabsTrigger>
            <TabsTrigger value="despesas" className="gap-2 py-2 flex-1 min-w-[120px]">
              <FileText className="w-4 h-4" /> Despesas (legado)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <FinancialDashboard />
          </TabsContent>

          <TabsContent value="caixa" className="mt-6">
            <CaixaOperacionalTab />
          </TabsContent>

          <TabsContent value="caixa-empresa" className="mt-6">
            <CaixaEmpresaTab selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </TabsContent>

          <TabsContent value="relatorios" className="mt-6 space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4 text-primary" />
                  Trilha de Auditoria Gerencial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Monitoramento de todas as movimentações financeiras. Registros históricos são imutáveis para fins de segurança e transparência.
                </p>
              </CardContent>
            </Card>
            <CaixaReportTab selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </TabsContent>

          <TabsContent value="auditoria-vendas" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <span className="text-sm text-muted-foreground block mb-1">Receita Líquida (Filtro)</span>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalReceitas)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{summary.countActive} vendas processadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <span className="text-sm text-muted-foreground block mb-1">Estornos / Cancelados</span>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalCancelado)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{summary.countCancelled} registros</p>
                </CardContent>
              </Card>
              <Card className="bg-muted/30">
                <CardContent className="pt-6 flex flex-col justify-center h-full">
                  <p className="text-xs text-muted-foreground italic">
                    Visualização exclusiva para auditoria. Operações de venda e cancelamento devem ser realizadas no Caixa.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filtros de Auditoria
                  </CardTitle>
                  <MonthSelector selectedDate={selectedMonth} onMonthChange={setSelectedMonth} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar venda ou cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Pagamento" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Métodos</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="paid">Pagos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="cancelled">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Venda</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Pagamento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10">Carregando auditoria...</TableCell></TableRow>
                      ) : filteredSales.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum registro encontrado.</TableCell></TableRow>
                      ) : filteredSales.map((sale) => {
                        const status = statusConfig[sale.payment_status as keyof typeof statusConfig] || statusConfig.paid;
                        const isCancelled = sale.payment_status === 'cancelled';
                        return (
                          <TableRow key={sale.id} className={isCancelled ? 'opacity-50' : ''}>
                            <TableCell className="font-mono text-xs">#{String(sale.sale_number).padStart(4, '0')}</TableCell>
                            <TableCell className="text-xs">{format(new Date(sale.created_at), "dd/MM HH:mm", { locale: ptBR })}</TableCell>
                            <TableCell className="text-sm font-medium">{sale.customer_name || 'Consumidor'}</TableCell>
                            <TableCell className={isCancelled ? 'line-through text-muted-foreground' : 'font-semibold'}>{formatCurrency(sale.total_amount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={paymentMethodConfig[sale.payment_method as keyof typeof paymentMethodConfig]?.color}>
                                {paymentMethodConfig[sale.payment_method as keyof typeof paymentMethodConfig]?.label || sale.payment_method}
                              </Badge>
                            </TableCell>
                            <TableCell><Badge variant="secondary" className={status.color}>{status.label}</Badge></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDetails(sale)}><Eye className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePrintReceipt(sale)}><Printer className="h-3.5 w-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {totalSalesCount > pageSize && (
                  <div className="pt-4 border-t">
                    <PaginationControls currentPage={currentPage} totalPages={Math.ceil(totalSalesCount / pageSize)} totalItems={totalSalesCount} pageSize={pageSize} onPageChange={setCurrentPage} onPageSizeChange={setPageSize} />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receber" className="mt-6">
            <ContasReceberTab />
          </TabsContent>

          <TabsContent value="comissoes" className="mt-6">
            <CommissionsTab selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </TabsContent>

          <TabsContent value="despesas" className="mt-6">
            <ExpensesTab selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </TabsContent>
        </Tabs>
      </div>

      <DetalhesVendaDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        sale={selectedSale}
        onPrint={handlePrintReceipt}
      />

      <FormasPagamentoDialog 
        open={isPaymentDialogOpen} 
        onOpenChange={setIsPaymentDialogOpen} 
      />
    </MainLayout>
  );
}
