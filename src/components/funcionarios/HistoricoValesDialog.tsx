import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Wallet, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Employee } from '@/hooks/useEmployees';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function HistoricoValesDialog({ open, onOpenChange, employee }: Props) {
  const { currentCompany } = useAuth();

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['employee-vales', employee?.id, currentCompany?.id],
    enabled: !!employee?.id && !!currentCompany?.id && open,
    queryFn: async () => {
      const { data, error } = await (supabase.from('cash_movements') as any)
        .select('id, amount, description, category, created_at, expense_id, payment_method')
        .eq('company_id', currentCompany!.id)
        .eq('funcionario_id', employee!.id)
        .eq('type', 'saida')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        amount: number;
        description: string | null;
        category: string | null;
        created_at: string;
        expense_id: string | null;
        payment_method: string | null;
      }>;
    },
  });

  const expenseIds = Array.from(new Set(movements.map((m) => m.expense_id).filter(Boolean))) as string[];

  const { data: expensesMap = {} } = useQuery({
    queryKey: ['employee-vales-expenses', expenseIds],
    enabled: expenseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, description, amount, paid_amount, status, due_date')
        .in('id', expenseIds);
      if (error) throw error;
      const map: Record<string, any> = {};
      (data || []).forEach((e: any) => {
        map[e.id] = e;
      });
      return map;
    },
  });

  const totalVales = movements.reduce((s, m) => s + (Number(m.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Histórico de Vales e Pagamentos
          </DialogTitle>
          <DialogDescription>
            {employee?.name} — Total lançado: <span className="font-semibold">{brl(totalVales)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum vale ou pagamento registrado para este funcionário.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Salário Vinculado</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => {
                  const exp = m.expense_id ? expensesMap[m.expense_id] : null;
                  const paid = Number(exp?.paid_amount || 0);
                  const total = Number(exp?.amount || 0);
                  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">
                        {format(new Date(m.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.description || m.category || 'Vale'}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-rose-600">
                        {brl(Number(m.amount))}
                      </TableCell>
                      <TableCell className="text-xs">
                        {exp ? (
                          <div>
                            <div className="font-medium">{exp.description}</div>
                            <div className="text-muted-foreground">
                              {brl(paid)} / {brl(total)} ({pct}%)
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {exp ? (
                          exp.status === 'paid' ? (
                            <Badge className="bg-emerald-600">Quitado</Badge>
                          ) : paid > 0 ? (
                            <Badge variant="secondary">Parcial</Badge>
                          ) : (
                            <Badge variant="outline">Pendente</Badge>
                          )
                        ) : (
                          <Badge variant="outline">Sem salário</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
