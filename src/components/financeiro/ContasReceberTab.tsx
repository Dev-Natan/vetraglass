import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, isPast, isToday, addDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  Filter,
  Receipt,
  Loader2,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { ReceivePaymentDialog } from '@/components/caixa/ReceivePaymentDialog';
import {
  ReceivableDetailsDialog,
  getReceivableOrigin,
  type ReceivableDetails,
} from '@/components/financeiro/ReceivableDetailsDialog';

interface Receivable {
  id: string;
  customer_name: string;
  description: string;
  total_amount: number;
  installment_number: number;
  total_installments: number;
  due_date: string;
  paid_date: string | null;
  paid_amount: number | null;
  status: string;
  payment_method: string | null;
  sale_id: string | null;
  ordem_servico_id: string | null;
  quote_id: string | null;
  client_id: string | null;
  notes: string | null;
  created_at: string;
  client?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    document: string | null;
  } | null;
}


type StatusFilter = 'all' | 'pending' | 'partial' | 'overdue' | 'paid';
type PeriodFilter = 'all' | 'today' | 'week' | 'month' | 'next60' | 'next90' | 'overdue';

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Clock },
  overdue: { label: 'Vencido', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: AlertTriangle },
  paid: { label: 'Pago', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  partial: { label: 'Parcial', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: Clock },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300', icon: Clock },
};

export function ContasReceberTab() {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('month');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | null>(null);
  const [detailsReceivable, setDetailsReceivable] = useState<Receivable | null>(null);
  const [receivePaymentMethod, setReceivePaymentMethod] = useState<'dinheiro' | 'pix' | 'transferencia' | 'cartao'>('dinheiro');

  // Fetch receivables
  const { data: receivables = [], isLoading } = useQuery({
    queryKey: ['accounts-receivable', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('accounts_receivable')
        .select(`
          *,
          client:clients(name, phone, email, document),
          sale:sales(payment_status),

          quote:quotes(status),
          ordem_servico:ordens_servico(status)
        `)
        .eq('company_id', currentCompany.id)
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Filtra apenas recebíveis vinculados a documentos cancelados.
      // Pagos permanecem na base para permitir o filtro "Liquidado".
      const filtered = (data as any[]).filter((r) => {
        if (r.status === 'cancelled') return false;
        if (r.sale && r.sale.payment_status === 'cancelled') return false;
        if (r.quote && (r.quote.status === 'cancelled' || r.quote.status === 'cancelado')) return false;
        if (r.ordem_servico && (r.ordem_servico.status === 'cancelled' || r.ordem_servico.status === 'cancelada')) return false;
        return true;
      });

      return filtered as Receivable[];
    },
    enabled: !!currentCompany?.id,
  });

  // Filter receivables
  const filteredReceivables = useMemo(() => {
    let filtered = [...receivables];

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => {
        if (statusFilter === 'overdue') {
          return r.status !== 'paid' && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date));
        }
        if (statusFilter === 'partial') {
          return r.status === 'partial' || (r.status !== 'paid' && (r.paid_amount || 0) > 0);
        }
        if (statusFilter === 'pending') {
          return r.status === 'pending' && !(r.paid_amount && r.paid_amount > 0);
        }
        return r.status === statusFilter;
      });
    }

    // Period filter (não se aplica ao histórico de liquidados)
    if (periodFilter !== 'all' && statusFilter !== 'paid') {
      const today = startOfDay(new Date());
      filtered = filtered.filter(r => {
        const dueDate = new Date(r.due_date);
        switch (periodFilter) {
          case 'today':
            return isToday(dueDate);
          case 'week':
            return dueDate >= today && dueDate <= addDays(today, 7);
          case 'month':
            return dueDate >= today && dueDate <= addDays(today, 30);
          case 'next60':
            return dueDate >= today && dueDate <= addDays(today, 60);
          case 'next90':
            return dueDate >= today && dueDate <= addDays(today, 90);
          case 'overdue':
            return isPast(dueDate) && !isToday(dueDate) && r.status !== 'paid';
          default:
            return true;
        }
      });
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.customer_name.toLowerCase().includes(search) ||
        r.description.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [receivables, statusFilter, periodFilter, searchTerm]);

  // Summary calculations
  const summary = useMemo(() => {
    const pending = receivables.filter(r => r.status === 'pending' || r.status === 'partial');
    const overdue = pending.filter(r => isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date)));
    const dueThisWeek = pending.filter(r => {
      const dueDate = new Date(r.due_date);
      const today = startOfDay(new Date());
      return dueDate >= today && dueDate <= addDays(today, 7);
    });
    const paid = receivables.filter(r => r.status === 'paid');

    return {
      totalPending: pending.reduce((sum, r) => sum + r.total_amount, 0),
      totalOverdue: overdue.reduce((sum, r) => sum + r.total_amount, 0),
      totalDueThisWeek: dueThisWeek.reduce((sum, r) => sum + r.total_amount, 0),
      totalPaid: paid.reduce((sum, r) => sum + (r.paid_amount || r.total_amount), 0),
      countPending: pending.length,
      countOverdue: overdue.length,
      countDueThisWeek: dueThisWeek.length,
    };
  }, [receivables]);

  // Format currency helper
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Status display helper
  const getStatusDisplay = (receivable: Receivable) => {
    if (receivable.status === 'paid') return statusConfig.paid;
    if (receivable.status === 'cancelled') return statusConfig.cancelled;
    if (isPast(new Date(receivable.due_date)) && !isToday(new Date(receivable.due_date))) {
      return statusConfig.overdue;
    }
    return statusConfig.pending;
  };

  // Abre o dialog de recebimento (gera movimento no caixa aberto)
  const handleReceiveClick = (receivable: Receivable) => {
    setSelectedReceivable(receivable);
    setReceiveDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total a Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalPending)}</div>
            <p className="text-xs text-muted-foreground">{summary.countPending} parcelas pendentes</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalOverdue)}</div>
            <p className="text-xs text-muted-foreground">{summary.countOverdue} parcelas atrasadas</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">Vence esta semana</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.totalDueThisWeek)}</div>
            <p className="text-xs text-muted-foreground">{summary.countDueThisWeek} parcelas</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Recebido (Total)</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">Histórico completo</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="partial">Pago Parcial</SelectItem>
            <SelectItem value="overdue">Vencidos</SelectItem>
            <SelectItem value="paid">Liquidado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Próx. 7 dias</SelectItem>
            <SelectItem value="month">Próx. 30 dias</SelectItem>
            <SelectItem value="next60">Próx. 60 dias</SelectItem>
            <SelectItem value="next90">Próx. 90 dias</SelectItem>
            <SelectItem value="overdue">Atrasados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / Origem</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredReceivables.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma parcela encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredReceivables.map((receivable) => {
                const statusDisplay = getStatusDisplay(receivable);
                const StatusIcon = statusDisplay.icon;
                return (
                  <TableRow
                    key={receivable.id}
                    className="cursor-pointer"
                    onClick={() => setDetailsReceivable(receivable)}
                  >
                    <TableCell className="font-medium">
                      <p className="truncate max-w-[180px]">
                        {receivable.client?.name || receivable.customer_name || '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {getReceivableOrigin(receivable)}
                        {receivable.client?.phone ? ` · ${receivable.client.phone}` : ''}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {receivable.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {receivable.installment_number}/{receivable.total_installments}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(receivable.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(receivable.total_amount)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusDisplay.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusDisplay.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Ver detalhes da cobrança"
                          onClick={() => setDetailsReceivable(receivable)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {receivable.status !== 'paid' && (
                          <Button
                            size="sm"
                            onClick={() => handleReceiveClick(receivable)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Receipt className="w-4 h-4 mr-1" />
                            Receber
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ReceivableDetailsDialog
        open={!!detailsReceivable}
        onOpenChange={(o) => !o && setDetailsReceivable(null)}
        receivable={detailsReceivable as unknown as ReceivableDetails}
        onReceive={() => detailsReceivable && handleReceiveClick(detailsReceivable)}
      />

      <ReceivePaymentDialog
        open={receiveDialogOpen}
        onOpenChange={(o) => {
          setReceiveDialogOpen(o);
          if (!o) setSelectedReceivable(null);
        }}
        receivable={selectedReceivable as any}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] });
        }}
      />

    </div>
  );
}
