import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Calculator,
  Printer
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, getMonth, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateDasFromMonthData } from '@/utils/generateDasPdf';
import { toast } from 'sonner';

interface TaxReportsProps {
  sales: {
    id: string;
    sale_number: number;
    total_amount: number;
    payment_status: string;
    payment_method: string;
    created_at: string;
    customer_name: string | null;
  }[];
  taxConfig: {
    aliquota_efetiva: number;
    anexo_simples: string;
    faixa_simples: number;
  } | null;
  company?: {
    name: string;
    cnpj: string;
  } | null;
}

type ReportPeriod = 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'year';

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function TaxReports({ sales, taxConfig, company }: TaxReportsProps) {
  const [period, setPeriod] = useState<ReportPeriod>('current_month');

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getMonthsForPeriod = (p: ReportPeriod): Date[] => {
    const now = new Date();
    const months: Date[] = [];
    
    switch (p) {
      case 'current_month':
        months.push(now);
        break;
      case 'last_month':
        months.push(subMonths(now, 1));
        break;
      case 'last_3_months':
        for (let i = 0; i < 3; i++) {
          months.push(subMonths(now, i));
        }
        break;
      case 'last_6_months':
        for (let i = 0; i < 6; i++) {
          months.push(subMonths(now, i));
        }
        break;
      case 'year':
        for (let i = 0; i < 12; i++) {
          months.push(subMonths(now, i));
        }
        break;
    }
    
    return months.reverse();
  };

  const monthlyData = useMemo(() => {
    const months = getMonthsForPeriod(period);
    const aliquota = taxConfig?.aliquota_efetiva || 4.0;
    
    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthSales = sales.filter(sale => {
        if (sale.payment_status === 'cancelled') return false;
        const saleDate = new Date(sale.created_at);
        return saleDate >= monthStart && saleDate <= monthEnd;
      });
      
      const faturamento = monthSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const imposto = faturamento * (aliquota / 100);
      const liquido = faturamento - imposto;
      
      return {
        month: monthDate,
        monthName: monthNames[getMonth(monthDate)],
        year: getYear(monthDate),
        faturamento,
        imposto,
        liquido,
        countSales: monthSales.length,
        vencimentoDAS: new Date(getYear(monthDate), getMonth(monthDate) + 1, 20),
      };
    });
  }, [sales, period, taxConfig]);

  const totals = useMemo(() => {
    return monthlyData.reduce((acc, m) => ({
      faturamento: acc.faturamento + m.faturamento,
      imposto: acc.imposto + m.imposto,
      liquido: acc.liquido + m.liquido,
      countSales: acc.countSales + m.countSales,
    }), { faturamento: 0, imposto: 0, liquido: 0, countSales: 0 });
  }, [monthlyData]);

  const handleExportCSV = () => {
    const headers = ['Mês/Ano', 'Faturamento', 'Imposto (DAS)', 'Líquido', 'Qtd Vendas', 'Vencimento DAS'];
    const rows = monthlyData.map(m => [
      `${m.monthName}/${m.year}`,
      m.faturamento.toFixed(2),
      m.imposto.toFixed(2),
      m.liquido.toFixed(2),
      m.countSales.toString(),
      format(m.vencimentoDAS, 'dd/MM/yyyy'),
    ]);
    
    rows.push(['TOTAL', totals.faturamento.toFixed(2), totals.imposto.toFixed(2), totals.liquido.toFixed(2), totals.countSales.toString(), '']);
    
    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-fiscal-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Relatórios Fiscais
          </h3>
          <p className="text-sm text-muted-foreground">
            Acompanhamento mensal para apuração do Simples Nacional
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Mês atual</SelectItem>
              <SelectItem value="last_month">Mês passado</SelectItem>
              <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
              <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
              <SelectItem value="year">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Faturamento Total</span>
              <TrendingUp className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totals.faturamento)}</p>
            <p className="text-xs text-muted-foreground mt-1">{totals.countSales} vendas no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total de Impostos</span>
              <Calculator className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.imposto)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {((totals.imposto / totals.faturamento) * 100 || 0).toFixed(2)}% do faturamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Receita Líquida</span>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.liquido)}</p>
            <p className="text-xs text-muted-foreground mt-1">Após impostos</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apuração Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Imposto (DAS)</TableHead>
                  <TableHead className="text-right">Líquido</TableHead>
                  <TableHead className="text-center">Vendas</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.map((m, idx) => {
                  const isPast = m.vencimentoDAS < new Date();
                  const isCurrentMonth = getMonth(new Date()) === getMonth(m.month) && getYear(new Date()) === getYear(m.month);
                  
                  const handleExportDas = () => {
                    if (!company) {
                      toast.error('Dados da empresa não disponíveis');
                      return;
                    }
                    generateDasFromMonthData(
                      {
                        month: m.month,
                        faturamento: m.faturamento,
                        imposto: m.imposto,
                        vencimentoDAS: m.vencimentoDAS,
                      },
                      company,
                      taxConfig
                    );
                    toast.success(`DAS de ${m.monthName}/${m.year} exportado!`);
                  };

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {m.monthName}/{m.year}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(m.faturamento)}</TableCell>
                      <TableCell className="text-right text-red-600">{formatCurrency(m.imposto)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(m.liquido)}</TableCell>
                      <TableCell className="text-center">{m.countSales}</TableCell>
                      <TableCell>{format(m.vencimentoDAS, 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-center">
                        {isCurrentMonth ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            Em aberto
                          </Badge>
                        ) : isPast ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                            Vencido
                          </Badge>
                        ) : (
                          <Badge variant="outline">Futuro</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleExportDas}
                          disabled={!company || m.faturamento === 0}
                          title="Exportar DAS em PDF"
                        >
                          <Printer className="w-4 h-4 mr-1" />
                          DAS
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.faturamento)}</TableCell>
                  <TableCell className="text-right text-red-600">{formatCurrency(totals.imposto)}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(totals.liquido)}</TableCell>
                  <TableCell className="text-center">{totals.countSales}</TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                Sobre o Relatório Fiscal
              </p>
              <p className="text-blue-700 dark:text-blue-400">
                Este relatório apresenta a base de cálculo para o DAS (Documento de Arrecadação do Simples Nacional).
                O vencimento do DAS é sempre no dia 20 do mês subsequente ao período de apuração.
                Para emitir o DAS, acesse o Portal do Simples Nacional com seu certificado digital.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
