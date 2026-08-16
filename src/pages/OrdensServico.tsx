import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { 
  ClipboardList, Search, Clock, CheckCircle, AlertCircle, 
  User, Calendar, ChevronRight, Play, XCircle,
  MoreHorizontal, Eye, AlertTriangle, Wrench, Scissors
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useInvalidateStock } from '@/hooks/useInvalidateStock';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/common/PaginationControls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type PeriodFilter = 'all' | '7d' | '30d' | 'this_month' | 'last_month';

import { OSProductionBadge } from '@/components/ordens-servico/OSProductionBadge';
import { RomaneioReviewDialog } from '@/components/ordens-servico/RomaneioReviewDialog';
import { CuttingPlanCalculator } from '@/components/plano-corte/CuttingPlanCalculator';
import { useModuleTutorialTrigger } from '@/hooks/useModuleTutorialTrigger';
import { useOSCancellation } from '@/hooks/useOSCancellation';


type OSStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type OSPriority = 'low' | 'normal' | 'high' | 'urgent';
type MainTab = 'lista' | 'plano-corte';

interface OrdemServico {
  id: string;
  os_number: number;
  customer_name: string;
  customer_phone: string | null;
  status: OSStatus;
  priority: OSPriority;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  current_stage: string | null;
  estimated_end: string | null;
  created_at: string;
  quote_id: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', icon: AlertCircle, variant: 'secondary' },
  pendente: { label: 'Pendente', icon: AlertCircle, variant: 'secondary' },
  in_progress: { label: 'Em Andamento', icon: Clock, variant: 'default' },
  em_producao: { label: 'Em Produção', icon: Clock, variant: 'default' },
  completed: { label: 'Concluída', icon: CheckCircle, variant: 'outline' },
  concluida: { label: 'Concluída', icon: CheckCircle, variant: 'outline' },
  cancelled: { label: 'Cancelada', icon: XCircle, variant: 'destructive' },
  cancelada: { label: 'Cancelada', icon: XCircle, variant: 'destructive' },
};
const FALLBACK_STATUS = { label: 'Desconhecido', icon: AlertCircle, variant: 'secondary' as const };
const FALLBACK_PRIORITY = { label: 'Normal', color: 'text-blue-500' };

const priorityConfig: Record<OSPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'text-muted-foreground' },
  normal: { label: 'Normal', color: 'text-blue-500' },
  high: { label: 'Alta', color: 'text-orange-500' },
  urgent: { label: 'Urgente', color: 'text-red-500' },
};

export default function OrdensServico() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const invalidateStock = useInvalidateStock();
  
  // Module tutorial trigger
  useModuleTutorialTrigger('ordens-servico');
  
  // Main tab from URL
  const mainTab = (searchParams.get('tab') as MainTab) || 'lista';
  const setMainTab = (tab: MainTab) => {
    setSearchParams({ tab });
  };
  
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<OSStatus | 'all' | 'overdue'>(
    () => (searchParams.get('status') as OSStatus | 'all' | 'overdue') || 'in_progress'
  );
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(
    () => (searchParams.get('period') as PeriodFilter) || 'all'
  );

  // Persist filters in URL
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (statusFilter && statusFilter !== 'in_progress') next.set('status', statusFilter);
    else next.delete('status');
    if (periodFilter && periodFilter !== 'all') next.set('period', periodFilter);
    else next.delete('period');
    if (searchTerm) next.set('q', searchTerm);
    else next.delete('q');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, periodFilter, searchTerm]);
  const [romaneioOsId, setRomaneioOsId] = useState<string | null>(null);

  // Fetch ordens de serviço
  const { data: ordens, isLoading } = useQuery({
    queryKey: ['ordens-servico', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, os_number, customer_name, customer_phone, status, priority, total_amount, paid_amount, pending_amount, current_stage, estimated_end, created_at, quote_id')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as OrdemServico[];
    },
    enabled: !!currentCompany?.id,
    // Zero cache - sempre dados frescos
  });

  // Fetch today's appointments count
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: todayAppointmentsCount = 0 } = useQuery({
    queryKey: ['today-appointments-count', currentCompany?.id, todayStr],
    queryFn: async () => {
      if (!currentCompany?.id) return 0;
      const { count, error } = await supabase
        .from('service_appointments')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', currentCompany.id)
        .eq('scheduled_date', todayStr)
        .neq('status', 'cancelled');
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!currentCompany?.id,
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OSStatus }) => {
      if (status === 'in_progress') {
        const { error } = await supabase.rpc('start_os_production', {
          _ordem_servico_id: id,
        });
        if (error) throw error;
      } else if (status === 'cancelled') {
        const { error } = await supabase.rpc('cancel_os_materials', {
          _ordem_servico_id: id,
        });
        if (error) throw error;
      } else {
        throw new Error('Transição de status não permitida por este fluxo');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      invalidateStock();
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['material-consumption'] });
      toast.success('Status atualizado!');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao atualizar status: ${message}`);
    }
  });

  // Stats
  const today = new Date().toISOString().split('T')[0];
  const pendingCount = ordens?.filter(os => os.status === 'pending').length || 0;
  const inProgressCount = ordens?.filter(os => os.status === 'in_progress').length || 0;
  const completedCount = ordens?.filter(os => os.status === 'completed').length || 0;
  const cancelledCount = ordens?.filter(os => os.status === 'cancelled').length || 0;
  
  const overdueOrdens = ordens?.filter(os => 
    (os.status === 'pending' || os.status === 'in_progress') && 
    os.estimated_end && 
    os.estimated_end < today
  ) || [];
  const overdueCount = overdueOrdens.length;

  const isOverdue = (os: OrdemServico) => {
    return (os.status === 'pending' || os.status === 'in_progress') && 
      os.estimated_end && 
      os.estimated_end < today;
  };

  const getDaysOverdue = (estimated_end: string) => {
    const estimatedDate = new Date(estimated_end);
    const todayDate = new Date(today);
    const diffTime = todayDate.getTime() - estimatedDate.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Period range
  const getPeriodRange = (p: PeriodFilter): { start: Date | null; end: Date | null } => {
    const now = new Date();
    if (p === 'all') return { start: null, end: null };
    if (p === '7d') { const s = new Date(now); s.setDate(s.getDate() - 7); s.setHours(0,0,0,0); return { start: s, end: null }; }
    if (p === '30d') { const s = new Date(now); s.setDate(s.getDate() - 30); s.setHours(0,0,0,0); return { start: s, end: null }; }
    if (p === 'this_month') return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
    return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 1) };
  };
  const { start: periodStart, end: periodEnd } = getPeriodRange(periodFilter);

  // Filter ordens
  const filteredOrdens = ordens?.filter(os => {
    const matchesSearch = os.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.os_number.toString().includes(searchTerm);

    let matchesPeriod = true;
    if (periodStart || periodEnd) {
      const created = os.created_at ? new Date(os.created_at) : null;
      if (!created || isNaN(created.getTime())) matchesPeriod = false;
      else {
        if (periodStart && created < periodStart) matchesPeriod = false;
        if (periodEnd && created >= periodEnd) matchesPeriod = false;
      }
    }

    if (statusFilter === 'overdue') {
      return matchesSearch && matchesPeriod && isOverdue(os);
    }

    const matchesStatus = statusFilter === 'all' || os.status === statusFilter;
    return matchesSearch && matchesStatus && matchesPeriod;
  }) || [];

  // Pagination
  const {
    paginatedData,
    currentPage,
    totalPages,
    setPage,
    pageSize,
  } = usePagination(filteredOrdens, { initialPageSize: 20 });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              Ordens de Serviço
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Gerencie suas ordens de serviço e agendamentos</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Em Andamento</p>
                  <p className="text-2xl font-bold">{inProgressCount}</p>
                </div>
                <Wrench className="h-8 w-8 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200 dark:border-green-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Concluídas</p>
                  <p className="text-2xl font-bold">{completedCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-500/10 to-gray-600/5 border-gray-200 dark:border-gray-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Canceladas</p>
                  <p className="text-2xl font-bold">{cancelledCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-muted-foreground opacity-80" />
              </div>
            </CardContent>
          </Card>
          
          <Card className={`bg-gradient-to-br ${overdueCount > 0 ? 'from-red-500/10 to-red-600/5 border-red-200 dark:border-red-900' : 'from-gray-500/10 to-gray-600/5 border-gray-200 dark:border-gray-800'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Atrasadas</p>
                  <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-500' : ''}`}>{overdueCount}</p>
                </div>
                <AlertTriangle className={`h-8 w-8 opacity-80 ${overdueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Agenda Hoje</p>
                  <p className="text-2xl font-bold">{todayAppointmentsCount}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="lista" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Lista de OS
            </TabsTrigger>
            <TabsTrigger value="plano-corte" className="gap-2">
              <Scissors className="w-4 h-4" />
              Calculadora de Corte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="mt-6">
            {/* Status Tabs */}
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as OSStatus | 'all' | 'overdue')} className="w-full mb-4">
              <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
                <TabsTrigger value="all" className="gap-2">
                  Todas
                  <Badge variant="secondary" className="ml-1">{ordens?.length || 0}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Pendentes
                  <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Em Andamento
                  <Badge variant="secondary" className="ml-1">{inProgressCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Concluídas
                  <Badge variant="secondary" className="ml-1">{completedCount}</Badge>
                </TabsTrigger>
                <TabsTrigger value="cancelled" className="gap-2">
                  <XCircle className="w-3.5 h-3.5" />
                  Canceladas
                  <Badge variant="secondary" className="ml-1">{cancelledCount}</Badge>
                </TabsTrigger>
                {overdueCount > 0 && (
                  <TabsTrigger value="overdue" className="gap-2 text-red-500">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Atrasadas
                    <Badge variant="destructive" className="ml-1">{overdueCount}</Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>

            {/* Search + Period */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente ou número..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
                <SelectTrigger className="w-full sm:w-[200px] bg-background">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="this_month">Este mês</SelectItem>
                  <SelectItem value="last_month">Mês passado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* List */}
            {isLoading ? (
              <div className="section-card p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : filteredOrdens.length === 0 ? (
              <div className="section-card p-12 text-center">
                <ClipboardList className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="font-medium text-foreground mb-1">
                  {ordens?.length === 0 ? 'Nenhuma ordem de serviço' : 'Nenhum resultado encontrado'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {ordens?.length === 0 
                    ? 'Aprove um orçamento para criar sua primeira ordem de serviço.'
                    : 'Tente ajustar os filtros de busca.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {paginatedData.map((os) => {
                  const status = statusConfig[os.status] ?? FALLBACK_STATUS;
                  const priority = priorityConfig[os.priority || 'normal'] ?? FALLBACK_PRIORITY;
                  const StatusIcon = status.icon;
                  const overdue = isOverdue(os);
                  const daysLate = os.estimated_end ? getDaysOverdue(os.estimated_end) : 0;
                  
                  return (
                    <Card
                      key={os.id}
                      className={`overflow-hidden hover:shadow-lg transition-all cursor-pointer ${overdue ? 'border-red-500/50 bg-red-500/5' : ''}`}
                      onClick={() => navigate(`/ordens-servico/${os.id}`)}
                    >
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${overdue ? 'bg-red-500/20' : 'bg-primary/10'}`}>
                              {overdue ? (
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                              ) : (
                                <ClipboardList className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-foreground">
                                OS #{os.os_number.toString().padStart(4, '0')}
                              </div>
                              <Badge variant={status.variant} className="gap-1 text-xs">
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/ordens-servico/${os.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                {os.status !== 'completed' && os.status !== 'cancelled' && (
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => updateStatusMutation.mutate({ id: os.id, status: 'cancelled' })}
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Cancelar
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Customer */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{os.customer_name}</span>
                          </div>
                          
                          {overdue && (
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <AlertTriangle className="w-3 h-3" />
                                {daysLate} {daysLate === 1 ? 'dia atrasado' : 'dias atrasado'}
                              </Badge>
                            </div>
                          )}
                          
                          {os.current_stage && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ChevronRight className="w-4 h-4 shrink-0" />
                              <span>{os.current_stage}</span>
                            </div>
                          )}
                          
                          {/* Production Progress Badge */}
                          {(os.status === 'pending' || os.status === 'in_progress') && (
                            <OSProductionBadge ordemServicoId={os.id} />
                          )}
                        </div>

                        {/* Dates */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(os.created_at), "dd/MM/yy", { locale: ptBR })}
                          </span>
                          {os.estimated_end && (
                            <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : ''}`}>
                              <Clock className="w-3 h-3" />
                              Prev: {format(new Date(os.estimated_end), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          )}
                        </div>


                        {/* Actions */}
                        <div className="pt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                          {os.status === 'pending' && (
                            <Button
                              size="sm"
                              className="flex-1 gap-1"
                              onClick={() => updateStatusMutation.mutate({ id: os.id, status: 'in_progress' })}
                            >
                              <Play className="w-3 h-3" />
                              Iniciar
                            </Button>
                          )}
                          {os.status === 'in_progress' && (
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1 gap-1"
                              onClick={() => setRomaneioOsId(os.id)}
                            >
                              <CheckCircle className="w-3 h-3" />
                              Concluir Serviço
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            onClick={() => navigate(`/ordens-servico/${os.id}`)}
                          >
                            <Eye className="w-3 h-3" />
                            Detalhes
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {filteredOrdens.length > 0 && (
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filteredOrdens.length}
                pageSize={pageSize}
              />
            )}
          </TabsContent>

          <TabsContent value="plano-corte" className="mt-6">
            <CuttingPlanCalculator />
          </TabsContent>
        </Tabs>
      </div>

      {romaneioOsId && currentCompany?.id && (
        <RomaneioReviewDialog
          open={!!romaneioOsId}
          onOpenChange={(v) => { if (!v) setRomaneioOsId(null); }}
          ordemServicoId={romaneioOsId}
          companyId={currentCompany.id}
          onConfirmed={() => {
            setRomaneioOsId(null);
            queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
            queryClient.invalidateQueries({ queryKey: ['company-stock'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
            queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
            queryClient.invalidateQueries({ queryKey: ['material-consumption'] });
            invalidateStock();
          }}
        />
      )}

    </MainLayout>
  );
}
