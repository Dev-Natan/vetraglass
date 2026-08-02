import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CalendarClock } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmt = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface DueRow {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  category: string | null;
  supplier_name: string | null;
}

interface TodayDuesAlertProps {
  /** Chamado ao clicar em um alerta, para focar a conta na listagem. */
  onSelect?: (description: string) => void;
}

/**
 * Alerta de pendências: contas vencendo hoje e contas já vencidas
 * (salários, aluguéis/terrenos e demais despesas agendadas).
 */
export function TodayDuesAlert({ onSelect }: TodayDuesAlertProps) {
  const { currentCompany } = useAuth();
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');

  const { data } = useQuery({
    queryKey: ['today-dues', currentCompany?.id, today],
    queryFn: async () => {
      if (!currentCompany?.id) return { dueToday: [] as DueRow[], overdue: [] as DueRow[] };

      const { data: rows, error } = await supabase
        .from('expenses')
        .select('id, description, amount, due_date, category, supplier_name')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'overdue'])
        .lte('due_date', today)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const all = (rows || []) as DueRow[];
      return {
        dueToday: all.filter((r) => r.due_date === today),
        overdue: all.filter((r) => r.due_date < today),
      };
    },
    enabled: !!currentCompany?.id,
    staleTime: 0,
  });

  const dueToday = data?.dueToday ?? [];
  const overdue = data?.overdue ?? [];

  if (dueToday.length === 0 && overdue.length === 0) return null;

  const totalToday = dueToday.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalOverdue = overdue.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="font-semibold text-sm">Pendências do dia</span>
          {dueToday.length > 0 && (
            <Badge variant="outline" className="text-[11px]">
              {dueToday.length} vencendo hoje · {fmt(totalToday)}
            </Badge>
          )}
          {overdue.length > 0 && (
            <Badge variant="destructive" className="text-[11px]">
              {overdue.length} em atraso · {fmt(totalOverdue)}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[...dueToday, ...overdue].slice(0, 6).map((row) => (
            <Button
              key={row.id}
              type="button"
              variant="ghost"
              onClick={() => onSelect?.(row.description)}
              className="h-auto justify-between gap-3 rounded-md border bg-card px-3 py-2 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{row.description}</span>
                <span className="block text-[11px] text-muted-foreground">
                  <CalendarClock className="inline w-3 h-3 mr-1" />
                  {format(new Date(`${row.due_date}T00:00:00`), "dd 'de' MMM", { locale: ptBR })}
                  {row.supplier_name ? ` · ${row.supplier_name}` : ''}
                </span>
              </span>
              <span
                className={`shrink-0 text-sm font-semibold ${
                  row.due_date < today ? 'text-destructive' : 'text-foreground'
                }`}
              >
                {fmt(Number(row.amount) || 0)}
              </span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
