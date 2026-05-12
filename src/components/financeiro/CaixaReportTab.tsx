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
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MonthSelector } from '@/components/common/MonthSelector';
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
import { generateCaixaReportPdf } from '@/utils/generateCaixaReportPdf';
import { generateFinancialReport } from '@/utils/generateFinancialReport';

type MovementTypeFilter = 'all' | 'entrada' | 'saida';

interface CaixaReportTabProps {
  selectedMonth?: Date;
  onMonthChange?: (date: Date) => void;
}

export function CaixaReportTab({ selectedMonth: externalMonth, onMonthChange }: CaixaReportTabProps) {
  const { currentCompany } = useAuth();
  
  // Use internal state if no external control
  const [internalMonth, setInternalMonth] = useState(new Date());
  const selectedMonth = externalMonth ?? internalMonth;
  const handleMonthChange = onMonthChange ?? setInternalMonth;
  
  const dateRange = { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
  
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>('all');

  // Fetch company cash movements
  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ['company-cash-movements-report', currentCompany?.id, selectedMonth.getMonth(), selectedMonth.getFullYear()],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('company_cash_movements')
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

  // Fetch daily cash registers for the period
  const { data: cashRegisters = [], isLoading: loadingRegisters } = useQuery({
    queryKey: ['cash-registers-report', currentCompany?.id, selectedMonth.getMonth(), selectedMonth.getFullYear()],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .gte('opened_at', dateRange.start.toISOString())
        .lte('opened_at', dateRange.end.toISOString())
        .order('opened_at', { ascending: false });

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
    return format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const handlePrint = () => {
    generateCaixaReportPdf(
      filteredMovements,
      summary,
      getPeriodLabel(),
      currentCompany ? {
        name: currentCompany.name,
        cnpj: currentCompany.cnpj,
        address: currentCompany.address,
        phone: currentCompany.phone,
        email: currentCompany.email,
        logo_url: currentCompany.logo_url,
      } : null,
      'print'
    );
  };

  const handleExportPdf = () => {
    generateCaixaReportPdf(
      filteredMovements,
      summary,
      getPeriodLabel(),
      currentCompany ? {
        name: currentCompany.name,
        cnpj: currentCompany.cnpj,
        address: currentCompany.address,
        phone: currentCompany.phone,
        email: currentCompany.email,
        logo_url: currentCompany.logo_url,
      } : null,
      'download'
    );
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

  const handleExportDRE = async () => {
    // 1. Get commissions paid in the month
    const { data: commissions } = await supabase
      .from('employee_commissions')
      .select('commission_amount')
      .eq('company_id', currentCompany?.id)
      .eq('status', 'paid')
      .gte('paid_at', dateRange.start.toISOString())
      .lte('paid_at', dateRange.end.toISOString());

    const totalCommissions = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

    // 2. Group expenses by category
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, category')
      .eq('company_id', currentCompany?.id)
      .eq('status', 'paid')
      .gte('paid_date', dateRange.start.toISOString().split('T')[0])
      .lte('paid_date', dateRange.end.toISOString().split('T')[0]);

    const expenseCategories: Record<string, number> = {};
    expenses?.forEach(e => {
      expenseCategories[e.category] = (expenseCategories[e.category] || 0) + Number(e.amount);
    });

    const totalExpenses = expenses?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

    // 3. Get total revenue from sales (paid in month)
    const { data: sales } = await supabase
      .from('sales')
      .select('total_amount')
      .eq('company_id', currentCompany?.id)
      .eq('payment_status', 'paid')
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString());

    const totalSales = sales?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;

    // 4. Get total revenue from receivables (paid in month)
    const { data: receivables } = await supabase
      .from('accounts_receivable')
      .select('paid_amount')
      .eq('company_id', currentCompany?.id)
      .eq('status', 'paid')
      .gte('paid_date', dateRange.start.toISOString().split('T')[0])
      .lte('paid_date', dateRange.end.toISOString().split('T')[0]);

    const totalReceivables = receivables?.reduce((sum, r) => sum + Number(r.paid_amount), 0) || 0;

    const reportData = {
      month: selectedMonth,
      revenue: {
        sales: totalSales,
        receivables: totalReceivables,
        total: totalSales + totalReceivables,
      },
      expenses: {
        byCategory: expenseCategories,
        total: totalExpenses,
      },
      commissions: {
        total: totalCommissions,
      },
      netProfit: (totalSales + totalReceivables) - (totalExpenses + totalCommissions),
    };

    generateFinancialReport(reportData, currentCompany ? { name: currentCompany.name, cnpj: currentCompany.cnpj } : null);
  };

  const isLoading = loadingMovements || loadingRegisters;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Relatório de Caixa
            </CardTitle>
            <MonthSelector 
              selectedDate={selectedMonth} 
              onMonthChange={handleMonthChange}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
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
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              <Button variant="default" size="sm" onClick={handleExportDRE} className="bg-blue-600 hover:bg-blue-700">
                <BarChart3 className="h-4 w-4 mr-2" />
                DRE Simplificado
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
