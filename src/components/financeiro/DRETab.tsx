import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Percent, Loader2 } from 'lucide-react';
import { MonthSelector, getMonthDateRange } from '@/components/common/MonthSelector';
import { useDRE, DRE_GROUP_LABELS, DRE_GROUP_ORDER, type DRERow } from '@/hooks/useDRE';

interface DRETabProps {
  selectedMonth: Date;
  onMonthChange: (d: Date) => void;
}

const formatBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function DRETab({ selectedMonth, onMonthChange }: DRETabProps) {
  const range = getMonthDateRange(selectedMonth);
  const { data: rows = [], isLoading } = useDRE(range.start, range.end);

  const { byGroup, totalReceita, totalDespesa, resultado, margem } = useMemo(() => {
    const map = new Map<string, { kind: 'receita' | 'despesa'; total: number; items: DRERow[] }>();
    let receita = 0;
    let despesa = 0;
    for (const r of rows) {
      const key = r.dre_group;
      if (!map.has(key)) map.set(key, { kind: r.kind, total: 0, items: [] });
      const bucket = map.get(key)!;
      bucket.total += Number(r.amount || 0);
      bucket.items.push(r);
      if (r.kind === 'receita') receita += Number(r.amount || 0);
      else despesa += Number(r.amount || 0);
    }
    const resultado = receita - despesa;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;
    return { byGroup: map, totalReceita: receita, totalDespesa: despesa, resultado, margem };
  }, [rows]);

  const orderedGroups = DRE_GROUP_ORDER.filter((g) => byGroup.has(g));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">DRE Gerencial</h2>
          <p className="text-sm text-muted-foreground">
            Demonstrativo de Resultados por grupo do plano de contas (regime de caixa)
          </p>
        </div>
        <MonthSelector selectedDate={selectedMonth} onMonthChange={onMonthChange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="font-bold text-lg text-emerald-700 dark:text-emerald-300">{formatBRL(totalReceita)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-rose-200 dark:border-rose-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40">
              <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="font-bold text-lg text-rose-700 dark:text-rose-300">{formatBRL(totalDespesa)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={resultado >= 0 ? 'border-primary/30' : 'border-rose-400'}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Resultado Líquido</p>
            <p className={`font-bold text-2xl ${resultado >= 0 ? 'text-primary' : 'text-rose-600'}`}>
              {formatBRL(resultado)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Percent className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Margem</p>
              <p className={`font-bold text-lg ${margem >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
                {margem.toFixed(1)}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DRE por grupo */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-muted-foreground">Calculando DRE...</span>
          </CardContent>
        </Card>
      ) : orderedGroups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Nenhum lançamento no período. Registre pagamentos em "A Receber" e "A Pagar" para gerar o DRE.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento por Grupo</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {orderedGroups.map((groupKey) => {
                const bucket = byGroup.get(groupKey)!;
                const isReceita = bucket.kind === 'receita';
                const pct = isReceita
                  ? (totalReceita > 0 ? (bucket.total / totalReceita) * 100 : 0)
                  : (totalDespesa > 0 ? (bucket.total / totalDespesa) * 100 : 0);
                return (
                  <div key={groupKey} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={isReceita ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300' : 'border-rose-500 text-rose-700 dark:text-rose-300'}
                        >
                          {isReceita ? '+ Receita' : '− Despesa'}
                        </Badge>
                        <span className="font-semibold text-foreground">
                          {DRE_GROUP_LABELS[groupKey] ?? groupKey}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${isReceita ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
                          {formatBRL(bucket.total)}
                        </p>
                        <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% do {isReceita ? 'total receitas' : 'total despesas'}</p>
                      </div>
                    </div>

                    {/* Subcategorias */}
                    <div className="pl-6 mt-2 space-y-1">
                      {bucket.items
                        .sort((a, b) => Number(b.amount) - Number(a.amount))
                        .map((item, idx) => (
                          <div
                            key={(item.category_id ?? 'none') + idx}
                            className="flex items-center justify-between text-sm py-1"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ background: item.category_color }}
                              />
                              <span className="text-muted-foreground">{item.category_name}</span>
                              <Badge variant="secondary" className="text-[10px] h-4">
                                {item.count}
                              </Badge>
                            </div>
                            <span className="font-medium tabular-nums">{formatBRL(Number(item.amount))}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                );
              })}

              {/* Linha de resultado final */}
              <div className="p-4 bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">= Resultado Líquido</span>
                  <span className={`font-bold text-xl ${resultado >= 0 ? 'text-primary' : 'text-rose-600'}`}>
                    {formatBRL(resultado)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
