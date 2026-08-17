import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  Check,
  XCircle,
  Banknote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { MonthSelector } from '@/components/common/MonthSelector';

interface Commission {
  id: string;
  company_id: string;
  employee_id: string;
  sale_id: string;
  sale_amount: number;
  commission_percent: number;
  commission_amount: number;
  status: string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  employee?: {
    id: string;
    name: string;
    email: string | null;
  };
  sale?: {
    id: string;
    sale_number: number;
    customer_name: string | null;
    created_at: string;
  };
}

interface Employee {
  id: string;
  name: string;
  commission_enabled: boolean;
  commission_percent: number;
  commission_type: string;
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'cancelled';

interface CommissionsTabProps {
  selectedMonth?: Date;
  onMonthChange?: (date: Date) => void;
}

export function CommissionsTab({ selectedMonth: externalMonth, onMonthChange }: CommissionsTabProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();

  // Use internal state if no external control
  const [internalMonth, setInternalMonth] = useState(new Date());
  const selectedMonth = externalMonth ?? internalMonth;
  const handleMonthChange = onMonthChange ?? setInternalMonth;
  
  const dateRange = { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');

  // Fetch employees with commission enabled
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-commission', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, commission_enabled, commission_percent, commission_type')
        .eq('company_id', currentCompany.id)
        .eq('commission_enabled', true)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch commissions
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions', currentCompany?.id, selectedMonth.getMonth(), selectedMonth.getFullYear()],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('employee_commissions')
        .select(`
          *,
          employee:employees(id, name, email),
          sale:sales(id, sale_number, customer_name, created_at)
        `)
        .eq('company_id', currentCompany.id)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Commission[];
    },
    enabled: !!currentCompany?.id,
  });

  // Filtered commissions
  const filteredCommissions = useMemo(() => {
    return commissions.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (employeeFilter !== 'all' && c.employee_id !== employeeFilter) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesEmployee = c.employee?.name?.toLowerCase().includes(search);
        const matchesSale = c.sale?.sale_number?.toString().includes(search);
        const matchesCustomer = c.sale?.customer_name?.toLowerCase().includes(search);
        if (!matchesEmployee && !matchesSale && !matchesCustomer) return false;
      }
      return true;
    });
  }, [commissions, statusFilter, employeeFilter, searchTerm]);

  // Summary
  const summary = useMemo(() => {
    const pending = filteredCommissions.filter(c => c.status === 'pending');
    const paid = filteredCommissions.filter(c => c.status === 'paid');
    
    return {
      totalPending: pending.reduce((sum, c) => sum + c.commission_amount, 0),
      totalPaid: paid.reduce((sum, c) => sum + c.commission_amount, 0),
      countPending: pending.length,
      countPaid: paid.length,
      totalSales: filteredCommissions.reduce((sum, c) => sum + c.sale_amount, 0),
    };
  }, [filteredCommissions]);

  // Pay commission mutation
  const payCommissionMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { data: openRegister, error: registerError } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('company_id', currentCompany?.id)
        .eq('opened_by', user?.id)
        .eq('status', 'open')
        .maybeSingle();
      if (registerError) throw registerError;
      if (!openRegister) throw new Error('Abra seu caixa antes de pagar comissões');

      const { data, error } = await supabase.rpc('pay_employee_commissions_transactional', {
        _commission_ids: [id],
        _cash_register_id: openRegister.id,
        _operation_key: crypto.randomUUID(),
        _notes: notes || null,
      });
      if (error) throw error;
      const result = data as { success?: boolean } | null;
      if (!result?.success) throw new Error('O pagamento transacional não foi confirmado');
    },
    onSuccess: () => {
      toast.success('Comissão marcada como paga!');
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      setPayDialogOpen(false);
      setSelectedCommission(null);
      setPaymentNotes('');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Cancel commission mutation
  const cancelCommissionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_commissions')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Comissão cancelada!');
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Pay multiple commissions
  const payMultipleMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const pendingCommissions = filteredCommissions.filter(
        c => c.employee_id === employeeId && c.status === 'pending'
      );
      
      if (pendingCommissions.length === 0) return;

      const { data: openRegister, error: registerError } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('company_id', currentCompany?.id)
        .eq('opened_by', user?.id)
        .eq('status', 'open')
        .maybeSingle();
      if (registerError) throw registerError;
      if (!openRegister) throw new Error('Abra seu caixa antes de pagar comissões');

      const { data, error } = await supabase.rpc('pay_employee_commissions_transactional', {
        _commission_ids: pendingCommissions.map((commission) => commission.id),
        _cash_register_id: openRegister.id,
        _operation_key: crypto.randomUUID(),
        _notes: 'Pagamento em lote',
      });
      if (error) throw error;
      const result = data as { success?: boolean } | null;
      if (!result?.success) throw new Error('O pagamento transacional não foi confirmado');
    },
    onSuccess: () => {
      toast.success('Comissões pagas com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleOpenPayDialog = (commission: Commission) => {
    setSelectedCommission(commission);
    setPaymentNotes('');
    setPayDialogOpen(true);
  };

  // Employee summary for quick view
  const employeeSummary = useMemo(() => {
    const summaryMap = new Map<string, { name: string; pending: number; paid: number; count: number }>();
    
    for (const c of filteredCommissions) {
      if (!c.employee) continue;
      const existing = summaryMap.get(c.employee_id) || { name: c.employee.name, pending: 0, paid: 0, count: 0 };
      existing.count++;
      if (c.status === 'pending') {
        existing.pending += c.commission_amount;
      } else if (c.status === 'paid') {
        existing.paid += c.commission_amount;
      }
      summaryMap.set(c.employee_id, existing);
    }
    
    return Array.from(summaryMap.entries()).map(([id, data]) => ({ id, ...data }));
  }, [filteredCommissions]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendas</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</div>
            <p className="text-xs text-muted-foreground">{filteredCommissions.length} vendas com comissão</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
            <Clock className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.totalPending)}</div>
            <p className="text-xs text-muted-foreground">{summary.countPending} comissões pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pago</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</div>
            <p className="text-xs text-muted-foreground">{summary.countPaid} comissões pagas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Funcionários</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">com comissão ativa</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Quick Summary */}
      {employeeSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Resumo por Funcionário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employeeSummary.map((emp) => (
                <div 
                  key={emp.id} 
                  className="p-4 rounded-lg border border-border bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{emp.name}</span>
                    <Badge variant="secondary">{emp.count} vendas</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pendente:</span>
                    <span className="font-medium text-yellow-600">{formatCurrency(emp.pending)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pago:</span>
                    <span className="font-medium text-green-600">{formatCurrency(emp.paid)}</span>
                  </div>
                  {emp.pending > 0 && (
                    <Button 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => payMultipleMutation.mutate(emp.id)}
                      disabled={payMultipleMutation.isPending}
                    >
                      <Banknote className="w-4 h-4 mr-2" />
                      Pagar Todas Pendentes
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por funcionário, venda ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <MonthSelector 
          selectedDate={selectedMonth} 
          onMonthChange={handleMonthChange}
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="paid">Pagas</SelectItem>
            <SelectItem value="cancelled">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-[180px]">
            <Users className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Funcionário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Commissions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead className="text-right">Valor Venda</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma comissão encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredCommissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell>
                      {format(new Date(commission.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-medium">
                        #{String(commission.sale?.sale_number || 0).padStart(4, '0')}
                      </span>
                    </TableCell>
                    <TableCell>{commission.sale?.customer_name || 'Cliente não identificado'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium">{commission.employee?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(commission.sale_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{commission.commission_percent}%</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary">
                      {formatCurrency(commission.commission_amount)}
                    </TableCell>
                    <TableCell>
                      {commission.status === 'pending' && (
                        <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                          <Clock className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                      {commission.status === 'paid' && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Pago
                        </Badge>
                      )}
                      {commission.status === 'cancelled' && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                          <XCircle className="w-3 h-3 mr-1" />
                          Cancelado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {commission.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenPayDialog(commission)}
                              title="Marcar como pago"
                            >
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => cancelCommissionMutation.mutate(commission.id)}
                              title="Cancelar"
                            >
                              <XCircle className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {commission.paid_at && (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(commission.paid_at), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento de Comissão</DialogTitle>
            <DialogDescription>
              Confirme o pagamento da comissão para {selectedCommission?.employee?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCommission && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Venda:</span>
                  <span className="font-medium">#{String(selectedCommission.sale?.sale_number || 0).padStart(4, '0')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor da Venda:</span>
                  <span className="font-medium">{formatCurrency(selectedCommission.sale_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Percentual:</span>
                  <span className="font-medium">{selectedCommission.commission_percent}%</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-medium">Valor a Pagar:</span>
                  <span className="font-bold text-lg text-primary">{formatCurrency(selectedCommission.commission_amount)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações (opcional)</Label>
                <Textarea
                  id="notes"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Observações sobre o pagamento..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => selectedCommission && payCommissionMutation.mutate({ id: selectedCommission.id, notes: paymentNotes })}
              disabled={payCommissionMutation.isPending}
            >
              <Check className="w-4 h-4 mr-2" />
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
