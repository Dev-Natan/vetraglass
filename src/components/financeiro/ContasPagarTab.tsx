import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialCategories } from '@/hooks/useFinancialCategories';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Plus, Search, CheckCircle, Clock, AlertCircle, Trash2, Pencil,
  Layers, Calendar, Receipt, Eye,
} from 'lucide-react';
import { format, addMonths, addDays, parseISO, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { MonthSelector, getMonthDateRange } from '@/components/common/MonthSelector';
import { PayableDetailsDialog, type PayableDetails } from '@/components/financeiro/PayableDetailsDialog';

type PeriodScope = 'month' | 'next30' | 'next60' | 'next90' | 'all';

interface Payable {
  id: string;
  company_id: string;
  description: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  paid_amount: number | null;
  status: string;
  category: string;
  category_id: string | null;
  bank_account_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_document: string | null;
  document_number: string | null;
  supplier?: {
    name: string | null;
    phone: string | null;
    email: string | null;
    document: string | null;
  } | null;
  installment_number: number;
  total_installments: number;
  parent_payable_id: string | null;
  notes: string | null;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
  paid: { label: 'Pago', cls: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  overdue: { label: 'Atrasado', cls: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
  cancelled: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

const fmt = (v: number) => (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface FormState {
  id?: string;
  description: string;
  supplier_id: string;
  supplier_name: string;
  supplier_document: string;
  category_id: string;
  bank_account_id: string;
  amount: number;
  due_date: string;
  document_number: string;
  notes: string;
  total_installments: number;
  installment_interval_days: number;
}

const emptyForm = (): FormState => ({
  description: '',
  supplier_id: '',
  supplier_name: '',
  supplier_document: '',
  category_id: '',
  bank_account_id: '',
  amount: 0,
  due_date: format(new Date(), 'yyyy-MM-dd'),
  document_number: '',
  notes: '',
  total_installments: 1,
  installment_interval_days: 30,
});

export function ContasPagarTab() {
  const { currentCompany } = useAuth();
  const qc = useQueryClient();
  const { data: categories = [] } = useFinancialCategories('despesa');
  const { data: bankAccounts = [] } = useBankAccounts(true);

  const initialSearch =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('search') || ''
      : '';

  const [month, setMonth] = useState(new Date());
  const [scope, setScope] = useState<PeriodScope>('next30');
  const monthRange = getMonthDateRange(month);
  const range = useMemo(() => {
    const today = startOfDay(new Date());
    if (scope === 'month') return { start: monthRange.start, end: monthRange.end };
    if (scope === 'next30') return { start: today, end: addDays(today, 30) };
    if (scope === 'next60') return { start: today, end: addDays(today, 60) };
    if (scope === 'next90') return { start: today, end: addDays(today, 90) };
    return null; // all
  }, [scope, monthRange.start, monthRange.end]);

  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [payDialog, setPayDialog] = useState<Payable | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payBankId, setPayBankId] = useState('');
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [detailsPayable, setDetailsPayable] = useState<Payable | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, email, document')
        .eq('company_id', currentCompany.id)
        .eq('client_type', 'fornecedor')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  const { data: payables = [], isLoading } = useQuery({
    queryKey: ['payables', currentCompany?.id, scope, month.getMonth(), month.getFullYear()],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      let q = supabase
        .from('expenses')
        .select('*, supplier:clients(name, phone, email, document)')
        .eq('company_id', currentCompany.id)
        .order('due_date', { ascending: true });
      if (range) {
        q = q
          .gte('due_date', format(range.start, 'yyyy-MM-dd'))
          .lte('due_date', format(range.end, 'yyyy-MM-dd'));
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data as Payable[]) || [];
    },
    enabled: !!currentCompany?.id,
    staleTime: 0,
    gcTime: 0,
  });

  const filtered = useMemo(() => {
    return payables.filter((p) => {
      if (statusFilter !== 'all') {
        const isOverdue = p.status === 'pending' && p.due_date && isBefore(parseISO(p.due_date), startOfDay(new Date()));
        if (statusFilter === 'overdue' && !isOverdue) return false;
        if (statusFilter !== 'overdue' && p.status !== statusFilter) return false;
      }
      if (categoryFilter !== 'all' && p.category_id !== categoryFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const hit =
          p.description?.toLowerCase().includes(s) ||
          p.supplier_name?.toLowerCase().includes(s) ||
          p.supplier?.name?.toLowerCase().includes(s) ||
          p.document_number?.toLowerCase().includes(s);
        if (!hit) return false;
      }
      return true;
    });
  }, [payables, search, statusFilter, categoryFilter]);

  const summary = useMemo(() => {
    const now = startOfDay(new Date());
    let totalPending = 0, totalPaid = 0, totalOverdue = 0;
    for (const p of payables) {
      if (p.status === 'cancelled') continue;
      const overdue = p.status === 'pending' && p.due_date && isBefore(parseISO(p.due_date), now);
      if (p.status === 'paid') totalPaid += Number(p.paid_amount ?? p.amount);
      else if (overdue) totalOverdue += Number(p.amount);
      else if (p.status === 'pending') totalPending += Number(p.amount);
    }
    return { totalPending, totalPaid, totalOverdue, count: payables.length };
  }, [payables]);

  const openNew = () => {
    const def = bankAccounts.find((b) => b.is_default) || bankAccounts[0];
    setForm({ ...emptyForm(), bank_account_id: def?.id || '' });
    setDialogOpen(true);
  };

  const openEdit = (p: Payable) => {
    setForm({
      id: p.id,
      description: p.description,
      supplier_id: p.supplier_id || '',
      supplier_name: p.supplier_name || '',
      supplier_document: p.supplier_document || '',
      category_id: p.category_id || '',
      bank_account_id: p.bank_account_id || '',
      amount: Number(p.amount),
      due_date: p.due_date || format(new Date(), 'yyyy-MM-dd'),
      document_number: p.document_number || '',
      notes: p.notes || '',
      total_installments: 1,
      installment_interval_days: 30,
    });
    setDialogOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async (f: FormState) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      if (!f.description.trim()) throw new Error('Informe a descrição');
      if (!f.amount || f.amount <= 0) throw new Error('Valor inválido');
      if (!f.due_date) throw new Error('Informe o vencimento');
      if (!f.supplier_id) throw new Error('Selecione o fornecedor de destino');

      const cat = categories.find((c) => c.id === f.category_id);
      const categoryLegacy = cat?.name || 'outros';

      if (f.id) {
        const { error } = await supabase.from('expenses').update({
          description: f.description,
          supplier_id: f.supplier_id || null,
          supplier_name: f.supplier_name || null,
          supplier_document: f.supplier_document || null,
          category_id: f.category_id || null,
          bank_account_id: f.bank_account_id || null,
          amount: f.amount,
          due_date: f.due_date,
          document_number: f.document_number || null,
          notes: f.notes || null,
          category: categoryLegacy,
        }).eq('id', f.id);
        if (error) throw error;
        return;
      }

      const total = Math.max(1, Math.floor(f.total_installments || 1));
      const baseDue = parseISO(f.due_date);
      const installmentAmount = total > 1 ? +(f.amount / total).toFixed(2) : f.amount;
      const lastAdjust = total > 1 ? +(f.amount - installmentAmount * (total - 1)).toFixed(2) : f.amount;

      const firstInsert = await supabase.from('expenses').insert({
        company_id: currentCompany.id,
        description: total > 1 ? `${f.description} (1/${total})` : f.description,
        supplier_id: f.supplier_id || null,
        supplier_name: f.supplier_name || null,
        supplier_document: f.supplier_document || null,
        category_id: f.category_id || null,
        bank_account_id: f.bank_account_id || null,
        amount: total > 1 ? installmentAmount : f.amount,
        due_date: f.due_date,
        document_number: f.document_number || null,
        notes: f.notes || null,
        category: categoryLegacy,
        installment_number: 1,
        total_installments: total,
        status: 'pending',
      }).select('id').single();
      if (firstInsert.error) throw firstInsert.error;

      if (total > 1) {
        const rows: any[] = [];
        for (let i = 2; i <= total; i++) {
          const due = addMonths(baseDue, i - 1);
          rows.push({
            company_id: currentCompany.id,
            description: `${f.description} (${i}/${total})`,
            supplier_id: f.supplier_id || null,
            supplier_name: f.supplier_name || null,
            supplier_document: f.supplier_document || null,
            category_id: f.category_id || null,
            bank_account_id: f.bank_account_id || null,
            amount: i === total ? lastAdjust : installmentAmount,
            due_date: format(due, 'yyyy-MM-dd'),
            document_number: f.document_number || null,
            notes: f.notes || null,
            category: categoryLegacy,
            installment_number: i,
            total_installments: total,
            parent_payable_id: firstInsert.data.id,
            status: 'pending',
          });
        }
        const { error: e2 } = await supabase.from('expenses').insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? 'Conta atualizada' : `Conta a pagar criada${form.total_installments > 1 ? ` em ${form.total_installments} parcelas` : ''}`);
      qc.invalidateQueries({ queryKey: ['payables'] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payMut = useMutation({
    mutationFn: async () => {
      if (!payDialog) return;
      if (!payAmount || payAmount <= 0) throw new Error('Valor inválido');
      const { error } = await supabase.from('expenses').update({
        status: 'paid',
        paid_date: payDate,
        paid_amount: payAmount,
        bank_account_id: payBankId || payDialog.bank_account_id,
      }).eq('id', payDialog.id);
      if (error) throw error;

      const bankId = payBankId || payDialog.bank_account_id;
      if (bankId) {
        const { data: bank } = await supabase
          .from('bank_accounts').select('current_balance').eq('id', bankId).single();
        if (bank) {
          await supabase.from('bank_accounts').update({
            current_balance: Number(bank.current_balance) - payAmount,
          }).eq('id', bankId);
        }
      }
    },
    onSuccess: () => {
      toast.success('Pagamento registrado');
      qc.invalidateQueries({ queryKey: ['payables'] });
      qc.invalidateQueries({ queryKey: ['bank-accounts'] });
      setPayDialog(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Removido');
      qc.invalidateQueries({ queryKey: ['payables'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <SumCard label="A pagar" value={summary.totalPending} icon={Clock} color="text-yellow-600" />
        <SumCard label="Atrasado" value={summary.totalOverdue} icon={AlertCircle} color="text-red-600" />
        <SumCard label="Pago no período" value={summary.totalPaid} icon={CheckCircle} color="text-green-600" />
        <SumCard label="Total no período" value={summary.totalPending + summary.totalPaid + summary.totalOverdue} icon={Calendar} color="text-foreground" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Contas a Pagar</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={scope} onValueChange={(v) => setScope(v as PeriodScope)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="next30">Próximos 30 dias</SelectItem>
                  <SelectItem value="next60">Próximos 60 dias</SelectItem>
                  <SelectItem value="next90">Próximos 90 dias</SelectItem>
                  <SelectItem value="month">Mês específico</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
              {scope === 'month' && (
                <MonthSelector selectedDate={month} onMonthChange={setMonth} />
              )}
              <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova conta</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, fornecedor ou documento…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="overdue">Atrasados</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="h-40 flex items-center justify-center">
              <span className="animate-spin mr-2">⏳</span> Carregando contas...
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Fornecedor / Destino</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Nenhuma conta a pagar no período.
                    </TableCell></TableRow>
                  ) : filtered.map((p) => {
                    const cat = categories.find((c) => c.id === p.category_id);
                    const overdue = p.status === 'pending' && p.due_date && isBefore(parseISO(p.due_date), startOfDay(new Date()));
                    const effectiveStatus = overdue ? 'overdue' : p.status;
                    const cfg = STATUS_CFG[effectiveStatus] || STATUS_CFG.pending;
                    return (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => setDetailsPayable(p)}>
                        <TableCell className="whitespace-nowrap">
                          {p.due_date ? format(parseISO(p.due_date), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                        </TableCell>
                        <TableCell className="max-w-[260px]">
                          <p className="truncate font-medium">{p.description}</p>
                          {p.document_number && (
                            <p className="text-xs text-muted-foreground">Doc: {p.document_number}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <p className="truncate max-w-[180px] font-medium">
                            {p.supplier?.name || p.supplier_name || '—'}
                          </p>
                          {(p.supplier?.phone || p.supplier?.document) && (
                            <p className="text-[11px] text-muted-foreground">
                              {p.supplier?.phone || p.supplier?.document}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {cat ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#64748b' }} />
                              <span className="text-xs">{cat.name}</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {p.total_installments > 1 ? (
                            <Badge variant="outline" className="gap-1">
                              <Layers className="w-3 h-3" />
                              {p.installment_number}/{p.total_installments}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">À vista</span>}
                        </TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">{fmt(Number(p.amount))}</TableCell>
                        <TableCell><Badge className={cfg.cls + ' border-0'}>{cfg.label}</Badge></TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver detalhes"
                              onClick={() => setDetailsPayable(p)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            {p.status !== 'paid' && p.status !== 'cancelled' && (
                              <Button size="sm" variant="outline" className="h-8" onClick={() => {
                                setPayDialog(p);
                                setPayAmount(Number(p.amount));
                                setPayBankId(p.bank_account_id || bankAccounts.find(b => b.is_default)?.id || '');
                                setPayDate(format(new Date(), 'yyyy-MM-dd'));
                              }}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pagar
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                              onClick={() => { if (confirm('Remover esta conta?')) deleteMut.mutate(p.id); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              {form.id ? 'Editar conta a pagar' : 'Nova conta a pagar'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Compra de vidro temperado lote #4521" />
            </div>
            <div>
              <Label>Fornecedor *</Label>
              <Select
                value={form.supplier_id}
                onValueChange={(v) => {
                  const sup = suppliers.find((s) => s.id === v);
                  setForm({
                    ...form,
                    supplier_id: v,
                    supplier_name: sup?.name || form.supplier_name,
                    supplier_document: sup?.document || form.supplier_document,
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar fornecedor" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Nenhum fornecedor cadastrado ainda.
                </p>
              )}
            </div>
            <div>
              <Label>CNPJ/CPF</Label>
              <Input value={form.supplier_document} onChange={(e) => setForm({ ...form, supplier_document: e.target.value })} />
            </div>
            <div>
              <Label>Categoria *</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color || '#64748b' }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Conta de pagamento</Label>
              <Select value={form.bank_account_id} onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor total *</Label>
              <Input type="number" step="0.01" value={form.amount}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>1º vencimento *</Label>
              <Input type="date" value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            {!form.id && (
              <>
                <div>
                  <Label className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Parcelas</Label>
                  <Input type="number" min={1} max={120} value={form.total_installments}
                    onChange={(e) => setForm({ ...form, total_installments: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Intervalo (dias)</Label>
                  <Input type="number" min={1} value={form.installment_interval_days}
                    onChange={(e) => setForm({ ...form, installment_interval_days: parseInt(e.target.value) || 30 })} />
                  <p className="text-[10px] text-muted-foreground mt-1">Parcelas geradas mensalmente a partir do 1º vencimento.</p>
                </div>
                {form.total_installments > 1 && form.amount > 0 && (
                  <div className="col-span-2 p-3 rounded-md bg-muted/50 text-xs">
                    <strong>{form.total_installments}x</strong> de aproximadamente{' '}
                    <strong>{fmt(form.amount / form.total_installments)}</strong> · total {fmt(form.amount)}
                  </div>
                )}
              </>
            )}
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <Label>Nº documento</Label>
                <Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} placeholder="NF, boleto…" />
              </div>
              <div>
                <Label>Observações</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PayableDetailsDialog
        open={!!detailsPayable}
        onOpenChange={(o) => !o && setDetailsPayable(null)}
        payable={
          detailsPayable
            ? ({
                ...detailsPayable,
                categoryName: categories.find((c) => c.id === detailsPayable.category_id)?.name || null,
              } as unknown as PayableDetails)
            : null
        }
        onPay={() => {
          if (!detailsPayable) return;
          setPayDialog(detailsPayable);
          setPayAmount(Number(detailsPayable.amount));
          setPayBankId(detailsPayable.bank_account_id || bankAccounts.find((b) => b.is_default)?.id || '');
          setPayDate(format(new Date(), 'yyyy-MM-dd'));
        }}
      />

      <Dialog open={!!payDialog} onOpenChange={(o) => !o && setPayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Registrar pagamento
            </DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-3">
              <div className="p-3 rounded-md bg-muted/40 text-sm">
                <p className="font-medium">{payDialog.description}</p>
                <p className="text-xs text-muted-foreground">Vencimento: {payDialog.due_date ? format(parseISO(payDialog.due_date), 'dd/MM/yyyy') : '—'} · Original: {fmt(Number(payDialog.amount))}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor pago</Label>
                  <Input type="number" step="0.01" value={payAmount}
                    onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Data do pagamento</Label>
                  <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Conta debitada</Label>
                  <Select value={payBankId} onValueChange={setPayBankId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar conta" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name} — {fmt(Number(b.current_balance))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialog(null)}>Cancelar</Button>
            <Button onClick={() => payMut.mutate()} disabled={payMut.isPending}>
              {payMut.isPending ? 'Registrando…' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SumCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{label}</span>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <p className={`text-2xl font-bold ${color}`}>{fmt(value)}</p>
      </CardContent>
    </Card>
  );
}
