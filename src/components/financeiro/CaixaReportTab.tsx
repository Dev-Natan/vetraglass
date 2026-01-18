import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText,
  Download,
  Calendar,
  Filter,
  Printer,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Wallet
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, subMonths, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
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

type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'custom';
type MovementTypeFilter = 'all' | 'entrada' | 'saida';

export function CaixaReportTab() {
  const { currentCompany } = useAuth();
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>('all');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  const getDateRange = (period: PeriodFilter) => {
    const now = new Date();
    switch (period) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
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
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  // Fetch company cash movements
  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ['company-cash-movements-report', currentCompany?.id, periodFilter, customDateRange],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { start, end } = getDateRange(periodFilter);
      
      let query = supabase
        .from('company_cash_movements')
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

  // Fetch daily cash registers for the period
  const { data: cashRegisters = [], isLoading: loadingRegisters } = useQuery({
    queryKey: ['cash-registers-report', currentCompany?.id, periodFilter, customDateRange],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { start, end } = getDateRange(periodFilter);
      
      let query = supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('opened_at', { ascending: false });

      if (start) {
        query = query.gte('opened_at', start.toISOString());
      }
      if (end) {
        query = query.lte('opened_at', end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Filtered movements
  const filteredMovements = useMemo(() => {
    if (typeFilter === 'all') return movements;
    return movements.filter(m => m.type === typeFilter);
  }, [movements, typeFilter]);

  // Summary calculations
  const summary = useMemo(() => {
    const totalEntradas = movements.filter(m => m.type === 'entrada').reduce((sum, m) => sum + m.amount, 0);
    const totalSaidas = movements.filter(m => m.type === 'saida').reduce((sum, m) => sum + m.amount, 0);
    const saldoLiquido = totalEntradas - totalSaidas;
    
    // Group by category
    const byCategory: Record<string, { entradas: number; saidas: number }> = {};
    movements.forEach(m => {
      if (!byCategory[m.category]) {
        byCategory[m.category] = { entradas: 0, saidas: 0 };
      }
      if (m.type === 'entrada') {
        byCategory[m.category].entradas += m.amount;
      } else {
        byCategory[m.category].saidas += m.amount;
      }
    });

    // Cash registers summary
    const registersOpened = cashRegisters.length;
    const registersClosed = cashRegisters.filter(r => r.status === 'closed').length;
    const totalExcessCollected = cashRegisters.reduce((sum, r) => sum + (r.excess_collected || 0), 0);
    const totalDifferences = cashRegisters.reduce((sum, r) => sum + (r.difference || 0), 0);

    return {
      totalEntradas,
      totalSaidas,
      saldoLiquido,
      byCategory,
      registersOpened,
      registersClosed,
      totalExcessCollected,
      totalDifferences,
      countMovements: movements.length,
    };
  }, [movements, cashRegisters]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      abertura_caixa: 'Abertura de Caixa',
      fechamento_caixa: 'Fechamento de Caixa',
      reforco_caixa: 'Reforço de Caixa',
      recolhimento: 'Recolhimento',
      deposito: 'Depósito',
      retirada: 'Retirada',
      ajuste: 'Ajuste',
      compensacao: 'Compensação',
      outro: 'Outro',
    };
    return labels[category] || category;
  };

  const getPeriodLabel = () => {
    const { start, end } = getDateRange(periodFilter);
    if (periodFilter === 'custom' && start && end) {
      return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
    }
    const labels: Record<string, string> = {
      today: 'Hoje',
      yesterday: 'Ontem',
      week: 'Esta Semana',
      month: 'Este Mês',
      last_month: 'Mês Passado',
    };
    return labels[periodFilter] || '';
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Data/Hora', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Saldo Após'];
    const rows = filteredMovements.map(m => [
      format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'),
      m.type === 'entrada' ? 'Entrada' : 'Saída',
      getCategoryLabel(m.category),
      m.description,
      m.amount.toFixed(2).replace('.', ','),
      m.balance_after.toFixed(2).replace('.', ','),
    ]);
    
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-caixa-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const isLoading = loadingMovements || loadingRegisters;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Period Filter */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Período</label>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger className="w-[160px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="yesterday">Ontem</SelectItem>
                  <SelectItem value="week">Esta Semana</SelectItem>
                  <SelectItem value="month">Este Mês</SelectItem>
                  <SelectItem value="last_month">Mês Passado</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Date Range */}
            {periodFilter === 'custom' && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Intervalo</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[260px] justify-start">
                      <Calendar className="h-4 w-4 mr-2" />
                      {customDateRange.from ? (
                        customDateRange.to ? (
                          <>
                            {format(customDateRange.from, 'dd/MM/yyyy')} - {format(customDateRange.to, 'dd/MM/yyyy')}
                          </>
                        ) : (
                          format(customDateRange.from, 'dd/MM/yyyy')
                        )
                      ) : (
                        'Selecionar datas'
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      initialFocus
                      mode="range"
                      defaultMonth={customDateRange.from}
                      selected={{ from: customDateRange.from, to: customDateRange.to }}
                      onSelect={(range) => setCustomDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Type Filter */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Tipo</label>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as MovementTypeFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex-1 flex justify-end items-end gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Entradas</span>
              <ArrowUpRight className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalEntradas)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Saídas</span>
              <ArrowDownRight className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalSaidas)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Saldo Líquido</span>
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <p className={`text-2xl font-bold ${summary.saldoLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.saldoLiquido)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Caixas Fechados</span>
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{summary.registersClosed}</p>
            <p className="text-xs text-muted-foreground">de {summary.registersOpened} abertos</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Summary */}
      {Object.keys(summary.byCategory).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Resumo por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(summary.byCategory).map(([category, values]) => (
                <div key={category} className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">{getCategoryLabel(category)}</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">+ {formatCurrency(values.entradas)}</span>
                    <span className="text-red-600">- {formatCurrency(values.saidas)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movements Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Movimentações - {getPeriodLabel()}
          </CardTitle>
          <Badge variant="secondary">{filteredMovements.length} registros</Badge>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma movimentação encontrada no período selecionado</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo Após</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {movement.type === 'entrada' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Entrada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getCategoryLabel(movement.category)}</TableCell>
                      <TableCell className="max-w-[250px] truncate">{movement.description}</TableCell>
                      <TableCell className={`text-right font-medium ${movement.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {movement.type === 'entrada' ? '+' : '-'}{formatCurrency(movement.amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(movement.balance_after)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Registers Table */}
      {cashRegisters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Caixas do Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Abertura</TableHead>
                    <TableHead>Fechamento</TableHead>
                    <TableHead className="text-right">Valor Abertura</TableHead>
                    <TableHead className="text-right">Valor Fechamento</TableHead>
                    <TableHead className="text-right">Diferença</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashRegisters.map((register) => (
                    <TableRow key={register.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(register.opened_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(register.opened_at), "HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {register.closed_at 
                          ? format(new Date(register.closed_at), "HH:mm", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(register.opening_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {register.closing_amount !== null 
                          ? formatCurrency(register.closing_amount)
                          : '-'
                        }
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        (register.difference || 0) === 0 
                          ? 'text-muted-foreground' 
                          : (register.difference || 0) > 0 
                            ? 'text-green-600' 
                            : 'text-red-600'
                      }`}>
                        {register.difference !== null 
                          ? formatCurrency(register.difference)
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant={register.status === 'open' ? 'default' : 'secondary'}>
                          {register.status === 'open' ? 'Aberto' : 'Fechado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
