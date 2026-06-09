import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar,
  Pencil,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Home,
  Zap,
  Droplets,
  Wifi,
  Users,
  MoreHorizontal,
  Building,
  Landmark,
  Receipt,
  Wrench,
  Package,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format, startOfMonth, endOfMonth, parseISO, isAfter, isBefore, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { MonthSelector } from '@/components/common/MonthSelector';

interface Expense {
  id: string;
  company_id: string;
  category: string;
  description: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  recurrence: string;
  employee_id: string | null;
  notes: string | null;
  created_at: string;
  parent_expense_id: string | null;
  recurrence_day: number | null;
  is_auto_generated: boolean;
}

const categoryConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  funcionarios: { label: 'Funcionários', icon: Users, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  aluguel: { label: 'Aluguel', icon: Home, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' },
  condominio: { label: 'Condomínio', icon: Building, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  emprestimo: { label: 'Empréstimo', icon: Landmark, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300' },
  financiamento: { label: 'Financiamento', icon: Receipt, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300' },
  energia: { label: 'Energia', icon: Zap, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  agua: { label: 'Água', icon: Droplets, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300' },
  internet: { label: 'Internet', icon: Wifi, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
  
  manutencao: { label: 'Manutenção', icon: Wrench, color: 'bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300' },
  materiais: { label: 'Materiais', icon: Package, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' },
  outros: { label: 'Outros', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  paid: { label: 'Pago', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  overdue: { label: 'Atrasado', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

const recurrenceOptions = [
  { value: 'none', label: 'Sem recorrência' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
];

interface ExpensesTabProps {
  selectedMonth?: Date;
  onMonthChange?: (date: Date) => void;
}

export function ExpensesTab({ selectedMonth: externalMonth, onMonthChange }: ExpensesTabProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  
  // Use internal state if no external control
  const [internalMonth, setInternalMonth] = useState(new Date());
  const selectedMonth = externalMonth ?? internalMonth;
  const handleMonthChange = onMonthChange ?? setInternalMonth;
  
  const dateRange = { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    category: 'outros',
    description: '',
    amount: 0,
    due_date: '',
    status: 'pending',
    payment_method: '',
    recurrence: 'none',
    notes: '',
  });

  // Fetch expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch employees for selection
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-list', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data } = await supabase
        .from('employees')
        .select('id, name')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && expense.status !== statusFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!expense.description.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, statusFilter, searchTerm]);

  // Calculate summary
  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const thisMonthExpenses = expenses.filter(e => {
      if (!e.due_date) return false;
      const dueDate = parseISO(e.due_date);
      return isAfter(dueDate, monthStart) && isBefore(dueDate, monthEnd);
    });

    const totalPending = expenses
      .filter(e => e.status === 'pending')
      .reduce((sum, e) => sum + e.amount, 0);
      
    const totalPaid = thisMonthExpenses
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + e.amount, 0);
      
    const totalOverdue = expenses
      .filter(e => e.status === 'overdue' || (e.status === 'pending' && e.due_date && isBefore(parseISO(e.due_date), now)))
      .reduce((sum, e) => sum + e.amount, 0);

    const byCategory = Object.keys(categoryConfig).reduce((acc, cat) => {
      acc[cat] = thisMonthExpenses
        .filter(e => e.category === cat && e.status !== 'cancelled')
        .reduce((sum, e) => sum + e.amount, 0);
      return acc;
    }, {} as Record<string, number>);

    return { totalPending, totalPaid, totalOverdue, byCategory };
  }, [expenses]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      
      const payload = {
        company_id: currentCompany.id,
        category: data.category,
        description: data.description,
        amount: data.amount,
        due_date: data.due_date || null,
        status: data.status,
        payment_method: data.payment_method || null,
        recurrence: data.recurrence,
        notes: data.notes || null,
      };

      if (data.id) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingExpense ? 'Despesa atualizada!' : 'Despesa cadastrada!');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Despesa removida!');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  // Mark as paid mutation - also generates next recurring expense
  const markAsPaidMutation = useMutation({
    mutationFn: async (expense: Expense) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');

      // First, mark as paid
      const { error: updateError } = await supabase
        .from('expenses')
        .update({ 
          status: 'paid', 
          paid_date: new Date().toISOString().split('T')[0] 
        })
        .eq('id', expense.id);
      if (updateError) throw updateError;
      
      // Check for open cash register
      const { data: openRegister } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')
        .maybeSingle();

      if (openRegister) {
        // Create cash movement for the payment
        await supabase
          .from('cash_movements')
          .insert({
            company_id: currentCompany.id,
            cash_register_id: openRegister.id,
            type: 'saida',
            category: 'despesa',
            amount: expense.amount,
            description: `Pagamento de despesa: ${expense.description}`,
            expense_id: expense.id,
            created_by: (await supabase.auth.getUser()).data.user?.id,
          });
      }

      // If it's a recurring expense, generate the next one
      if (expense.recurrence && expense.recurrence !== 'none') {
        const { data: nextExpenseId, error: rpcError } = await supabase
          .rpc('generate_next_recurring_expense', { expense_id: expense.id });
        
        if (rpcError) {
          console.error('Error generating next expense:', rpcError);
        }
        
        return { nextExpenseId };
      }
      
      return { nextExpenseId: null };
    },
    onSuccess: (data) => {
      if (data?.nextExpenseId) {
        toast.success('Despesa paga! Próxima parcela gerada automaticamente.', {
          icon: <RefreshCw className="w-4 h-4 text-green-500" />,
        });
      } else {
        toast.success('Despesa marcada como paga!');
      }
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const handleOpenDialog = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense);
      setFormData({
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        due_date: expense.due_date || '',
        status: expense.status,
        payment_method: expense.payment_method || '',
        recurrence: expense.recurrence,
        notes: expense.notes || '',
      });
    } else {
      setEditingExpense(null);
      setFormData({
        category: 'outros',
        description: '',
        amount: 0,
        due_date: '',
        status: 'pending',
        payment_method: '',
        recurrence: 'none',
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingExpense(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editingExpense?.id });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">A Pagar</span>
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.totalPending)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pago este mês</span>
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Atrasado</span>
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalOverdue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Funcionários</span>
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(summary.byCategory.funcionarios || 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Despesas por Categoria (Mês Atual)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {Object.entries(categoryConfig)
              .filter(([key]) => (summary.byCategory[key] || 0) > 0 || ['funcionarios', 'aluguel', 'emprestimo', 'energia'].includes(key))
              .map(([key, config]) => {
              const Icon = config.icon;
              const amount = summary.byCategory[key] || 0;
              return (
                <div 
                  key={key} 
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${categoryFilter === key ? 'border-primary bg-muted/50' : 'border-transparent bg-muted/30'}`}
                  onClick={() => setCategoryFilter(categoryFilter === key ? 'all' : key)}
                >
                  <div className={`p-1.5 rounded-md ${config.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">{config.label}</p>
                    <p className="font-semibold text-sm">{formatCurrency(amount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar despesa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Despesa
        </Button>
      </div>

      {/* Expenses Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recorrência</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma despesa encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => {
                const category = categoryConfig[expense.category] || categoryConfig.outros;
                const status = statusConfig[expense.status] || statusConfig.pending;
                const Icon = category.icon;
                
                return (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${category.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm">{category.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{expense.description}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(expense.amount)}</TableCell>
                    <TableCell>
                      {expense.due_date ? format(parseISO(expense.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>{status.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {expense.recurrence !== 'none' ? (
                        <div className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {recurrenceOptions.find(r => r.value === expense.recurrence)?.label}
                          </span>
                          {expense.is_auto_generated && (
                            <Badge variant="outline" className="text-xs py-0 px-1.5">
                              Auto
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {expense.status === 'pending' && (
                            <DropdownMenuItem 
                              onClick={() => markAsPaidMutation.mutate(expense)}
                              disabled={markAsPaidMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              {expense.recurrence !== 'none' ? 'Pagar e Gerar Próxima' : 'Marcar como Pago'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleOpenDialog(expense)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteMutation.mutate(expense.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={formData.category} 
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Ex: Conta de luz - Janeiro"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select 
                  value={formData.recurrence} 
                  onValueChange={(v) => setFormData({ ...formData, recurrence: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {recurrenceOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select 
                value={formData.payment_method} 
                onValueChange={(v) => setFormData({ ...formData, payment_method: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Anotações adicionais..."
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}