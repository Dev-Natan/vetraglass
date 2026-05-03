import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  FileText,
  Calendar,
  Download,
  BarChart3,
  PieChart,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RevenueChart } from '@/components/relatorios/RevenueChart';
import { PaymentMethodsChart } from '@/components/relatorios/PaymentMethodsChart';
import { SalesEvolutionChart } from '@/components/relatorios/SalesEvolutionChart';
import { TopProductsChart } from '@/components/relatorios/TopProductsChart';
import { StockSalesReport } from '@/components/relatorios/StockSalesReport';

type PeriodFilter = 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'current_year' | 'last_year';

const periodLabels: Record<PeriodFilter, string> = {
  current_month: 'Mês Atual',
  last_month: 'Mês Passado',
  last_3_months: 'Últimos 3 Meses',
  last_6_months: 'Últimos 6 Meses',
  current_year: 'Ano Atual',
  last_year: 'Ano Passado',
};

function getDateRange(period: PeriodFilter): { start: Date; end: Date } {
  const now = new Date();
  
  switch (period) {
    case 'current_month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'last_month':
      return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    case 'last_3_months':
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case 'last_6_months':
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    case 'current_year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'last_year':
      return { start: startOfYear(subMonths(now, 12)), end: endOfYear(subMonths(now, 12)) };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

export default function Relatorios() {
  const navigate = useNavigate();
  const { currentCompany } = useAuth();
  const [period, setPeriod] = useState<PeriodFilter>('current_month');
  const [activeTab, setActiveTab] = useState('geral');
  
  const dateRange = getDateRange(period);

  // Fetch sales data
  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['relatorios-sales', currentCompany?.id, period],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch quotes data
  const { data: quotes, isLoading: quotesLoading } = useQuery({
    queryKey: ['relatorios-quotes', currentCompany?.id, period],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch clients data
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['relatorios-clients', currentCompany?.id, period],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch OS data
  const { data: ordensServico, isLoading: osLoading } = useQuery({
    queryKey: ['relatorios-os', currentCompany?.id, period],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Previous period for comparison
  const previousDateRange = useMemo(() => {
    const diff = dateRange.end.getTime() - dateRange.start.getTime();
    return {
      start: new Date(dateRange.start.getTime() - diff),
      end: new Date(dateRange.end.getTime() - diff),
    };
  }, [dateRange]);

  // Fetch previous period sales for comparison
  const { data: previousSales } = useQuery({
    queryKey: ['relatorios-sales-previous', currentCompany?.id, period],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('created_at', previousDateRange.start.toISOString())
        .lte('created_at', previousDateRange.end.toISOString());
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const activeSales = sales?.filter(s => s.payment_status !== 'cancelled') || [];
    const previousActiveSales = previousSales?.filter(s => s.payment_status !== 'cancelled') || [];
    
    const totalRevenue = activeSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const previousRevenue = previousActiveSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    
    const totalSalesCount = activeSales.length;
    const previousSalesCount = previousActiveSales.length;
    const salesCountGrowth = previousSalesCount > 0 ? ((totalSalesCount - previousSalesCount) / previousSalesCount) * 100 : 0;
    
    const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
    const previousAvgTicket = previousSalesCount > 0 ? previousRevenue / previousSalesCount : 0;
    const ticketGrowth = previousAvgTicket > 0 ? ((avgTicket - previousAvgTicket) / previousAvgTicket) * 100 : 0;
    
    const approvedQuotes = quotes?.filter(q => q.status === 'approved').length || 0;
    const pendingQuotes = quotes?.filter(q => q.status === 'pending').length || 0;
    const totalQuotes = quotes?.length || 0;
    const conversionRate = totalQuotes > 0 ? (approvedQuotes / totalQuotes) * 100 : 0;
    
    const completedOS = ordensServico?.filter(os => os.status === 'completed').length || 0;
    const inProgressOS = ordensServico?.filter(os => os.status === 'in_progress').length || 0;
    const pendingOS = ordensServico?.filter(os => os.status === 'pending').length || 0;
    
    const newClients = clients?.length || 0;
    
    // Payment methods breakdown
    const paymentMethods = activeSales.reduce((acc, sale) => {
      const method = sale.payment_method || 'outros';
      acc[method] = (acc[method] || 0) + (sale.total_amount || 0);
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalRevenue,
      revenueGrowth,
      totalSalesCount,
      salesCountGrowth,
      avgTicket,
      ticketGrowth,
      approvedQuotes,
      pendingQuotes,
      totalQuotes,
      conversionRate,
      completedOS,
      inProgressOS,
      pendingOS,
      newClients,
      paymentMethods,
    };
  }, [sales, previousSales, quotes, ordensServico, clients]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const isLoading = salesLoading || quotesLoading || clientsLoading || osLoading;

  const paymentMethodLabels: Record<string, string> = {
    dinheiro: 'Dinheiro',
    pix: 'PIX',
    cartao_debito: 'Cartão Débito',
    cartao_credito: 'Cartão Crédito',
    boleto: 'Boleto',
    outros: 'Outros',
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Relatórios</h1>
              <p className="text-muted-foreground text-sm">
                Análises e estatísticas do seu negócio
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Faturamento</span>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
                  <div className="flex items-center gap-1">
                    {stats.revenueGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={stats.revenueGrowth >= 0 ? 'text-green-500 text-sm' : 'text-red-500 text-sm'}>
                      {formatPercent(stats.revenueGrowth)}
                    </span>
                    <span className="text-muted-foreground text-sm">vs período anterior</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Vendas</span>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{stats.totalSalesCount}</div>
                  <div className="flex items-center gap-1">
                    {stats.salesCountGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={stats.salesCountGrowth >= 0 ? 'text-green-500 text-sm' : 'text-red-500 text-sm'}>
                      {formatPercent(stats.salesCountGrowth)}
                    </span>
                    <span className="text-muted-foreground text-sm">vs período anterior</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ticket Médio</span>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{formatCurrency(stats.avgTicket)}</div>
                  <div className="flex items-center gap-1">
                    {stats.ticketGrowth >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={stats.ticketGrowth >= 0 ? 'text-green-500 text-sm' : 'text-red-500 text-sm'}>
                      {formatPercent(stats.ticketGrowth)}
                    </span>
                    <span className="text-muted-foreground text-sm">vs período anterior</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Novos Clientes</span>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-2xl font-bold">{stats.newClients}</div>
                  <div className="text-muted-foreground text-sm">
                    no período selecionado
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="geral" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="orcamentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Orçamentos</span>
            </TabsTrigger>
            <TabsTrigger value="ordens" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Ordens</span>
            </TabsTrigger>
            <TabsTrigger value="pagamentos" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Pagamentos</span>
            </TabsTrigger>
            <TabsTrigger value="estoque" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Estoque & Vendas</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Geral - Com Gráficos */}
          <TabsContent value="geral" className="space-y-4">
            {/* Gráficos Visuais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RevenueChart sales={sales || []} isLoading={isLoading} />
              <PaymentMethodsChart paymentMethods={stats.paymentMethods} isLoading={isLoading} />
            </div>
            
            <SalesEvolutionChart sales={sales || []} dateRange={dateRange} isLoading={isLoading} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TopProductsChart sales={sales || []} isLoading={isLoading} />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo do Período</CardTitle>
                  <CardDescription>
                    {format(dateRange.start, "dd 'de' MMMM", { locale: ptBR })} até {format(dateRange.end, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Faturamento</span>
                        <span className="font-medium">{formatCurrency(stats.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Vendas</span>
                        <span className="font-medium">{stats.totalSalesCount}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b">
                        <span className="text-muted-foreground">Ticket Médio</span>
                        <span className="font-medium">{formatCurrency(stats.avgTicket)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">Conversão</span>
                        <span className="font-medium">{stats.conversionRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Tab: Orçamentos */}
          <TabsContent value="orcamentos" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{stats.totalQuotes}</div>
                    <p className="text-muted-foreground text-sm mt-1">Orçamentos Criados</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{stats.approvedQuotes}</div>
                    <p className="text-muted-foreground text-sm mt-1">Aprovados</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{stats.pendingQuotes}</div>
                    <p className="text-muted-foreground text-sm mt-1">Pendentes</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Taxa de Conversão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${stats.conversionRate}%` }}
                    />
                  </div>
                  <span className="text-lg font-bold">{stats.conversionRate.toFixed(1)}%</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {stats.approvedQuotes} de {stats.totalQuotes} orçamentos foram convertidos em vendas
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Ordens de Serviço */}
          <TabsContent value="ordens" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{stats.pendingOS}</div>
                    <p className="text-muted-foreground text-sm mt-1">Pendentes</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{stats.inProgressOS}</div>
                    <p className="text-muted-foreground text-sm mt-1">Em Andamento</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{stats.completedOS}</div>
                    <p className="text-muted-foreground text-sm mt-1">Concluídas</p>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Distribuição de Status</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <div className="space-y-4">
                    {[
                      { label: 'Pendentes', value: stats.pendingOS, color: 'bg-muted-foreground' },
                      { label: 'Em Andamento', value: stats.inProgressOS, color: 'bg-primary/70' },
                      { label: 'Concluídas', value: stats.completedOS, color: 'bg-primary' },
                    ].map((item) => {
                      const total = stats.pendingOS + stats.inProgressOS + stats.completedOS;
                      const percent = total > 0 ? (item.value / total) * 100 : 0;
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{item.label}</span>
                            <span className="font-medium">{item.value}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${item.color} rounded-full transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Pagamentos */}
          <TabsContent value="pagamentos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
                <CardDescription>Distribuição do faturamento por forma de pagamento</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : Object.keys(stats.paymentMethods).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(stats.paymentMethods)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, value]) => {
                        const percent = stats.totalRevenue > 0 ? (value / stats.totalRevenue) * 100 : 0;
                        return (
                          <div key={method} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{paymentMethodLabels[method] || method}</span>
                              <span className="font-medium">{formatCurrency(value)}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">{percent.toFixed(1)}% do total</p>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma venda registrada no período
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Estoque & Vendas */}
          <TabsContent value="estoque" className="space-y-4">
            <StockSalesReport
              companyId={currentCompany?.id}
              sales={sales || []}
              isLoading={salesLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
