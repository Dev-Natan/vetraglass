import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { 
  ClipboardList, Search, Filter, Clock, CheckCircle, AlertCircle, 
  User, Calendar, DollarSign, ChevronRight, Play, XCircle,
  MoreHorizontal, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

type OSStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
type OSPriority = 'low' | 'normal' | 'high' | 'urgent';

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

const statusConfig: Record<OSStatus, { label: string; icon: typeof Clock; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', icon: AlertCircle, variant: 'secondary' },
  in_progress: { label: 'Em Andamento', icon: Clock, variant: 'default' },
  completed: { label: 'Concluída', icon: CheckCircle, variant: 'outline' },
  cancelled: { label: 'Cancelada', icon: XCircle, variant: 'destructive' },
};

const priorityConfig: Record<OSPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'text-muted-foreground' },
  normal: { label: 'Normal', color: 'text-blue-500' },
  high: { label: 'Alta', color: 'text-orange-500' },
  urgent: { label: 'Urgente', color: 'text-red-500' },
};

export default function OrdensServico() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OSStatus | 'all'>('all');

  // Fetch ordens de serviço
  const { data: ordens, isLoading } = useQuery({
    queryKey: ['ordens-servico', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('ordens_servico')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as OrdemServico[];
    },
    enabled: !!currentCompany?.id
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OSStatus }) => {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'in_progress') {
        updates.actual_start = new Date().toISOString().split('T')[0];
        updates.current_stage = 'Em produção';
      } else if (status === 'completed') {
        updates.actual_end = new Date().toISOString().split('T')[0];
        updates.current_stage = 'Finalizado';
      }
      
      const { error } = await supabase
        .from('ordens_servico')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    }
  });

  // Filter ordens
  const filteredOrdens = ordens?.filter(os => {
    const matchesSearch = os.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      os.os_number.toString().includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || os.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  // Stats
  const pendingCount = ordens?.filter(os => os.status === 'pending').length || 0;
  const inProgressCount = ordens?.filter(os => os.status === 'in_progress').length || 0;
  const completedCount = ordens?.filter(os => os.status === 'completed').length || 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />
              Ordens de Serviço
            </h1>
            <p className="text-muted-foreground">Acompanhe suas ordens de serviço</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-orange/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-action-orange" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-blue/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-action-blue" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{inProgressCount}</p>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-green/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-action-green" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{completedCount}</p>
              <p className="text-sm text-muted-foreground">Concluídas</p>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por cliente ou número..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {statusFilter === 'all' ? 'Todos' : statusConfig[statusFilter].label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                Todos
              </DropdownMenuItem>
              {Object.entries(statusConfig).map(([key, config]) => (
                <DropdownMenuItem key={key} onClick={() => setStatusFilter(key as OSStatus)}>
                  <config.icon className="w-4 h-4 mr-2" />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
          <div className="space-y-3">
            {filteredOrdens.map((os) => {
              const status = statusConfig[os.status];
              const priority = priorityConfig[os.priority || 'normal'];
              const StatusIcon = status.icon;
              
              return (
                <div
                  key={os.id}
                  className="section-card p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ClipboardList className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm text-muted-foreground">
                            OS #{os.os_number.toString().padStart(4, '0')}
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {os.customer_name}
                          </span>
                          <Badge variant={status.variant} className="gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                          <span className={`text-xs font-medium ${priority.color}`}>
                            {priority.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                          {os.current_stage && (
                            <span className="flex items-center gap-1">
                              <ChevronRight className="w-3 h-3" />
                              {os.current_stage}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(os.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          {os.estimated_end && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Previsão: {format(new Date(os.estimated_end), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-sm">
                            <span className="text-muted-foreground">Total:</span>{' '}
                            <span className="font-medium">{formatCurrency(os.total_amount)}</span>
                          </span>
                          {os.paid_amount > 0 && (
                            <span className="text-sm text-green-600">
                              Pago: {formatCurrency(os.paid_amount)}
                            </span>
                          )}
                          {os.pending_amount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Pendente: {formatCurrency(os.pending_amount)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {os.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => updateStatusMutation.mutate({ id: os.id, status: 'in_progress' })}
                          className="gap-1"
                        >
                          <Play className="w-3 h-3" />
                          Iniciar
                        </Button>
                      )}
                      {os.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: os.id, status: 'completed' })}
                          className="gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Concluir
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
