import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowDownCircle, ArrowUpCircle, Wallet, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { addDays, addMonths, format, startOfDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCashFlowProjection } from '@/hooks/useCashFlowProjection';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Bar,
  Line,
} from 'recharts';

type Horizon = '30d' | '60d' | '90d' | 'month';

const formatBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function CashFlowTab() {
  const [horizon, setHorizon] = useState<Horizon>('30d');

  const { start, end } = useMemo(() => {
    const today = startOfDay(new Date());
    if (horizon === 'month') {
      const s = startOfMonth(today);
      return { start: s, end: addMonths(s, 1) };
    }
    const days = horizon === '30d' ? 30 : horizon === '60d' ? 60 : 90;
    return { start: today, end: addDays(today, days) };
  }, [horizon]);

  const { data: days = [], isLoading } = useCashFlowProjection(start, end);
  const { bankAccounts } = useBankAccounts();

  const totals = useMemo(() => {
    let realIn = 0, realOut = 0, projIn = 0, projOut = 0;
    for (const d of days) {
      realIn += Number(d.realized_in || 0);
      realOut += Number(d.realized_out || 0);
      projIn += Number(d.projected_in || 0);
      projOut += Number(d.projected_out || 0);
    }
    return { realIn, realOut, projIn, projOut };
  }, [days]);

  const saldoAtual = useMemo(
    () => (bankAccounts ?? []).filter((b) => b.active).reduce((s, b) => s + Number(b.current_balance || 0), 0),
    [bankAccounts]
  );

  // Saldo acumulado projetado
  const chartData = useMemo(() => {
    let saldo = saldoAtual;
    return days.map((d) => {
      const netReal = Number(d.realized_in || 0) - Number(d.realized_out || 0);
      const netProj = Number(d.projected_in || 0) - Number(d.projected_out || 0);
      saldo += netReal + netProj;
      return {
        date: format(new Date(d.date), 'dd/MM'),
        entradas: Number(d.realized_in || 0) + Number(d.projected_in || 0),
        saidas: -(Number(d.realized_out || 0) + Number(d.projected_out || 0)),
        saldo,
      };
    });
  }, [days, saldoAtual]);

  const saldoFinalProjetado = chartData.length ? chartData[chartData.length - 1].saldo : saldoAtual;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Fluxo de Caixa Projetado</h2>
          <p className="text-sm text-muted-foreground">
            Saldo atual + entradas e saídas confirmadas e previstas no horizonte selecionado
          </p>
        </div>
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          {(['30d', '60d', '90d', 'month'] as Horizon[]).map((h) => (
            <Button
              key={h}
              size="sm"
              variant={horizon === h ? 'default' : 'ghost'}
              onClick={() => setHorizon(h)}
            >
              {h === 'month' ? 'Mês atual' : h === '30d' ? '30 dias' : h === '60d' ? '60 dias' : '90 dias'}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo atual em bancos</p>
              <p className="font-bold text-lg">{formatBRL(saldoAtual)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <ArrowDownCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entradas previstas</p>
              <p className="font-bold text-lg text-emerald-700 dark:text-emerald-300">
                {formatBRL(totals.realIn + totals.projIn)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Realizado {formatBRL(totals.realIn)} · A receber {formatBRL(totals.projIn)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-200 dark:border-rose-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40">
              <ArrowUpCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saídas previstas</p>
              <p className="font-bold text-lg text-rose-700 dark:text-rose-300">
                {formatBRL(totals.realOut + totals.projOut)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Realizado {formatBRL(totals.realOut)} · A pagar {formatBRL(totals.projOut)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className={saldoFinalProjetado >= 0 ? 'border-primary/30' : 'border-rose-500'}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo projetado final</p>
              <p className={`font-bold text-lg ${saldoFinalProjetado >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                {formatBRL(saldoFinalProjetado)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projeção diária</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Calculando projeção...
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Sem dados para projetar no período selecionado.
            </div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number, name) => [formatBRL(Math.abs(v)), name as string]}
                    labelClassName="text-xs"
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="#2563eb" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por dia</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Realizado +</TableHead>
                  <TableHead className="text-right">Realizado −</TableHead>
                  <TableHead className="text-right">A receber</TableHead>
                  <TableHead className="text-right">A pagar</TableHead>
                  <TableHead className="text-right">Saldo dia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days
                  .filter((d) =>
                    Number(d.realized_in) + Number(d.realized_out) + Number(d.projected_in) + Number(d.projected_out) > 0
                  )
                  .map((d) => {
                    const saldoDia =
                      Number(d.realized_in) + Number(d.projected_in) - Number(d.realized_out) - Number(d.projected_out);
                    return (
                      <TableRow key={d.date}>
                        <TableCell className="font-medium">
                          {format(new Date(d.date), "dd 'de' MMM", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right text-emerald-600 tabular-nums">
                          {Number(d.realized_in) > 0 ? formatBRL(Number(d.realized_in)) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-rose-600 tabular-nums">
                          {Number(d.realized_out) > 0 ? formatBRL(Number(d.realized_out)) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(d.projected_in) > 0 ? (
                            <Badge variant="outline" className="border-emerald-400 text-emerald-700 dark:text-emerald-300">
                              {formatBRL(Number(d.projected_in))}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Number(d.projected_out) > 0 ? (
                            <Badge variant="outline" className="border-rose-400 text-rose-700 dark:text-rose-300">
                              {formatBRL(Number(d.projected_out))}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-semibold tabular-nums ${saldoDia >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
                          {formatBRL(saldoDia)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {days.every(
                  (d) =>
                    Number(d.realized_in) + Number(d.realized_out) + Number(d.projected_in) + Number(d.projected_out) === 0
                ) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Sem movimentações previstas no período.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
