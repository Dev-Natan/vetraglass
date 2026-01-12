import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  ArrowUpRight, 
  Search,
  Filter,
  Calendar,
  Eye,
  Printer,
  XCircle,
  Smartphone,
  FileText,
  Download,
  Settings,
  Receipt,
  BarChart3
} from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, startOfMonth, endOfMonth, startOfWeek, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CancelarVendaDialog } from '@/components/caixa/CancelarVendaDialog';
import { DetalhesVendaDialog } from '@/components/caixa/DetalhesVendaDialog';
import { generateSalePdf } from '@/utils/generateSalePdf';
import { Parser } from 'expr-eval';
import { TaxDashboard } from '@/components/financeiro/TaxDashboard';
import { TaxReports } from '@/components/financeiro/TaxReports';
import { TaxCategories } from '@/components/financeiro/TaxCategories';
import { TaxConfigDialog } from '@/components/financeiro/TaxConfigDialog';

type PeriodFilter = 'today' | 'week' | 'month' | 'last_month' | 'custom' | 'all';
type PaymentFilter = 'all' | 'dinheiro' | 'cartao' | 'pix';
type StatusFilter = 'all' | 'paid' | 'pending' | 'cancelled';

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
  sale_type: string | null;
  created_at: string;
  notes: string | null;
  ordem_servico_id: string | null;
  quote_id: string | null;
}

const paymentMethodConfig = {
  dinheiro: { label: 'Dinheiro', icon: DollarSign, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cartao: { label: 'Cartão', icon: CreditCard, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  pix: { label: 'PIX', icon: Smartphone, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

const statusConfig = {
  paid: { label: 'Pago', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

// Formula calculation helper
function calculateFormulaQuantity(formula: string, width: number, height: number, piecesQty: number): number {
  try {
    const parser = new Parser();
    const widthM = width / 1000;
    const heightM = height / 1000;
    const expr = parser.parse(formula.toLowerCase()
      .replace(/largura/g, 'l')
      .replace(/altura/g, 'a')
      .replace(/l/g, String(widthM))
      .replace(/a/g, String(heightM)));
    return expr.evaluate({}) * piecesQty;
  } catch {
    return piecesQty;
  }
}

export default function Financeiro() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  // Filters
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [activeTab, setActiveTab] = useState('vendas');
  const [taxConfigOpen, setTaxConfigOpen] = useState(false);

  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Get date range based on period filter
  const getDateRange = (period: PeriodFilter) => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'custom':
        return { 
          start: customDateRange.from ? startOfDay(customDateRange.from) : null, 
          end: customDateRange.to ? endOfDay(customDateRange.to) : null 
        };
      case 'all':
      default:
        return { start: null, end: null };
    }
  };

  // Fetch all sales with filters
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales-financeiro', currentCompany?.id, periodFilter, customDateRange],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { start, end } = getDateRange(periodFilter);

      let query = supabase
        .from('sales')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (start) {
        query = query.gte('created_at', start.toISOString());
      }
      if (end) {
        query = query.lte('created_at', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch tax config
  const { data: taxConfig } = useQuery({
    queryKey: ['tax-config', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data } = await supabase
        .from('company_tax_config')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch tax categories
  const { data: taxCategories = [] } = useQuery({
    queryKey: ['tax-categories', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data } = await supabase
        .from('tax_categories')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('name');
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch sale taxes
  const { data: saleTaxes = [] } = useQuery({
    queryKey: ['sale-taxes', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data } = await supabase
        .from('sale_taxes')
        .select('*')
        .eq('company_id', currentCompany.id);
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Save tax config mutation
  const saveTaxConfigMutation = useMutation({
    mutationFn: async (config: { regime_tributario: string; faixa_simples: number; aliquota_efetiva: number; anexo_simples: string; receita_bruta_12_meses: number }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      const { data, error } = await supabase
        .from('company_tax_config')
        .upsert({ ...config, company_id: currentCompany.id }, { onConflict: 'company_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Configuração tributária salva!');
      queryClient.invalidateQueries({ queryKey: ['tax-config'] });
      setTaxConfigOpen(false);
    },
  });

  // Tax category mutations
  const addCategoryMutation = useMutation({
    mutationFn: async (cat: { name: string; ncm_code: string | null; description: string | null; aliquota_ibs: number; aliquota_cbs: number; aliquota_is: number }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      const { error } = await supabase.from('tax_categories').insert({ ...cat, company_id: currentCompany.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-categories'] }),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; ncm_code: string | null; description: string | null; aliquota_ibs: number; aliquota_cbs: number; aliquota_is: number }> }) => {
      const { error } = await supabase.from('tax_categories').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-categories'] }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-categories'] }),
  });

  // Apply client-side filters
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      // Payment method filter
      if (paymentFilter !== 'all' && sale.payment_method !== paymentFilter) return false;
      
      // Status filter
      if (statusFilter !== 'all' && sale.payment_status !== statusFilter) return false;
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesNumber = sale.sale_number.toString().includes(search);
        const matchesCustomer = sale.customer_name?.toLowerCase().includes(search);
        if (!matchesNumber && !matchesCustomer) return false;
      }
      
      return true;
    });
  }, [sales, paymentFilter, statusFilter, searchTerm]);

  // Calculate summary
  const summary = useMemo(() => {
    const activeSales = filteredSales.filter(s => s.payment_status !== 'cancelled');
    const cancelledSales = filteredSales.filter(s => s.payment_status === 'cancelled');
    
    const totalReceitas = activeSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalDinheiro = activeSales.filter(s => s.payment_method === 'dinheiro').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCartao = activeSales.filter(s => s.payment_method === 'cartao').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalPix = activeSales.filter(s => s.payment_method === 'pix').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCancelado = cancelledSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    
    return {
      totalReceitas,
      totalDinheiro,
      totalCartao,
      totalPix,
      totalCancelado,
      countActive: activeSales.length,
      countCancelled: cancelledSales.length,
    };
  }, [filteredSales]);

  // Cancel sale mutation
  const cancelSaleMutation = useMutation({
    mutationFn: async ({ saleId, reason }: { saleId: string; reason: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');

      // 1. Get sale items to restore stock
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('id, item_template_id, company_product_id, quantity, width, height')
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      // 2. Restore stock
      const stockRestorations: Map<string, number> = new Map();

      for (const item of saleItems || []) {
        if (item.item_template_id && !item.company_product_id) {
          const currentQty = stockRestorations.get(item.item_template_id) || 0;
          stockRestorations.set(item.item_template_id, currentQty + item.quantity);
        }
      }

      for (const item of saleItems || []) {
        if (item.company_product_id && item.width && item.height) {
          const { data: companyProduct } = await supabase
            .from('company_products')
            .select('product_template_id')
            .eq('id', item.company_product_id)
            .single();

          if (!companyProduct?.product_template_id) continue;

          const { data: templateItems } = await supabase
            .from('product_template_items')
            .select('item_template_id, quantity_formula, pieces_quantity')
            .eq('product_template_id', companyProduct.product_template_id)
            .or(`company_id.is.null,company_id.eq.${currentCompany.id}`);

          for (const templateItem of templateItems || []) {
            if (!templateItem.item_template_id || !templateItem.quantity_formula) continue;

            const componentQty = calculateFormulaQuantity(
              templateItem.quantity_formula,
              item.width,
              item.height,
              templateItem.pieces_quantity || 1
            ) * item.quantity;

            if (componentQty > 0) {
              const currentQty = stockRestorations.get(templateItem.item_template_id) || 0;
              stockRestorations.set(templateItem.item_template_id, currentQty + componentQty);
            }
          }
        }
      }

      for (const [itemTemplateId, restoreQty] of stockRestorations) {
        const { data: stockItem } = await supabase
          .from('company_stock')
          .select('id, quantity')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', itemTemplateId)
          .maybeSingle();

        if (stockItem) {
          await supabase
            .from('company_stock')
            .update({ quantity: stockItem.quantity + restoreQty })
            .eq('id', stockItem.id);
        }
      }

      // 3. Update sale status
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .update({
          payment_status: 'cancelled',
          notes: reason ? `Cancelado: ${reason}` : 'Venda cancelada',
        })
        .eq('id', saleId)
        .select()
        .single();

      if (saleError) throw saleError;
      return sale;
    },
    onSuccess: (sale) => {
      toast.success(`Venda #${String(sale.sale_number).padStart(4, '0')} cancelada!`);
      queryClient.invalidateQueries({ queryKey: ['sales-financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      setCancelDialogOpen(false);
      setSelectedSale(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cancelar venda: ${error.message}`);
    },
  });

  const handleViewDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDetailsDialogOpen(true);
  };

  const handleCancelSale = (sale: Sale) => {
    setSelectedSale(sale);
    setCancelDialogOpen(true);
  };

  const handlePrintReceipt = async (sale: Sale) => {
    try {
      const { data: items } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id);

      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', currentCompany?.id)
        .single();

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-primary" />
              Financeiro
            </h1>
            <p className="text-muted-foreground">Gestão de vendas e movimentações financeiras</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Receitas</span>
                <ArrowUpRight className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalReceitas)}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.countActive} vendas</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Dinheiro</span>
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalDinheiro)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Cartão</span>
                <CreditCard className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalCartao)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">PIX</span>
                <Smartphone className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalPix)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Cancelados</span>
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalCancelado)}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.countCancelled} vendas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número ou cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mês</SelectItem>
                  <SelectItem value="last_month">Mês passado</SelectItem>
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {periodFilter === 'custom' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Calendar className="w-4 h-4" />
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, 'dd/MM')} - {format(customDateRange.to, 'dd/MM')}
                          </>
                        ) : (
                          format(customDateRange.from, 'dd/MM/yyyy')
                        )
                      ) : (
                        'Selecionar período'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={customDateRange as { from: Date | undefined; to?: Date | undefined }}
                      onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                      locale={ptBR}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              )}

              <Select value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as PaymentFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Sales Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Vendas
              </CardTitle>
              <Badge variant="secondary">{filteredSales.length} registros</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma venda encontrada com os filtros aplicados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Venda</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => {
                      const paymentConfig = paymentMethodConfig[sale.payment_method as keyof typeof paymentMethodConfig] || paymentMethodConfig.dinheiro;
                      const PaymentIcon = paymentConfig.icon;
                      const status = statusConfig[sale.payment_status as keyof typeof statusConfig] || statusConfig.paid;
                      const isCancelled = sale.payment_status === 'cancelled';

                      return (
                        <TableRow key={sale.id} className={isCancelled ? 'opacity-60' : ''}>
                          <TableCell className="font-medium">
                            #{String(sale.sale_number).padStart(4, '0')}
                            {sale.sale_type === 'partial' && (
                              <Badge variant="outline" className="ml-2 text-xs">Entrada</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>{sale.customer_name || '-'}</TableCell>
                          <TableCell className={isCancelled ? 'line-through' : 'font-medium'}>
                            {formatCurrency(sale.total_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={paymentConfig.color}>
                              <PaymentIcon className="w-3 h-3 mr-1" />
                              {paymentConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={status.color}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleViewDetails(sale)}
                                title="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handlePrintReceipt(sale)}
                                title="Imprimir comprovante"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {!isCancelled && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleCancelSale(sale)}
                                  title="Cancelar venda"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <CancelarVendaDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        sale={selectedSale}
        onConfirm={(saleId, reason) => cancelSaleMutation.mutateAsync({ saleId, reason })}
        isLoading={cancelSaleMutation.isPending}
      />

      <DetalhesVendaDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        sale={selectedSale}
        onPrint={handlePrintReceipt}
      />
    </MainLayout>
  );
}
