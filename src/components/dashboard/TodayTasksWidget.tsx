import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar, 
  ClipboardList, 
  Truck, 
  MapPin,
  Clock,
  User,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CACHE_TIMES } from '@/lib/queryConfig';

interface TodayTask {
  id: string;
  type: 'os' | 'delivery' | 'appointment';
  title: string;
  subtitle: string;
  time?: string;
  status: string;
  priority?: string;
}

export function TodayTasksWidget() {
  const { currentCompany } = useAuth();
  const navigate = useNavigate();
  const today = format(new Date(), 'yyyy-MM-dd');

  // OS com entrega/produção para hoje
  const { data: todayOS = [] } = useQuery({
    queryKey: ['today-os', currentCompany?.id, today],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('ordens_servico')
        .select('id, os_number, customer_name, status, priority, estimated_end, current_stage')
        .eq('company_id', currentCompany.id)
        .in('status', ['pending', 'in_progress'])
        .eq('estimated_end', today)
        .order('priority', { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  // Agendamentos de hoje
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['today-appointments', currentCompany?.id, today],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('service_appointments')
        .select('id, title, customer_name, appointment_type, status, scheduled_time_start, scheduled_time_end, customer_address')
        .eq('company_id', currentCompany.id)
        .eq('scheduled_date', today)
        .neq('status', 'cancelled')
        .order('scheduled_time_start', { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  // Montar lista unificada de tarefas
  const tasks: TodayTask[] = [
    // Agendamentos primeiro (por horário)
    ...todayAppointments.map((apt) => ({
      id: apt.id,
      type: 'appointment' as const,
      title: apt.title || apt.customer_name || 'Agendamento',
      subtitle: apt.appointment_type === 'delivery' 
        ? `Entrega - ${apt.customer_address || 'Endereço não informado'}`
        : apt.appointment_type === 'measurement'
          ? `Medição - ${apt.customer_name || ''}`
          : apt.customer_name || '',
      time: apt.scheduled_time_start 
        ? format(new Date(`2000-01-01T${apt.scheduled_time_start}`), 'HH:mm')
        : undefined,
      status: apt.status,
    })),
    // OS com prazo hoje
    ...todayOS.map((os) => ({
      id: os.id,
      type: 'os' as const,
      title: `OS #${os.os_number}`,
      subtitle: os.customer_name || 'Cliente não informado',
      status: os.status,
      priority: os.priority,
    })),
  ];

  // Ordenar por horário (agendamentos com horário primeiro)
  tasks.sort((a, b) => {
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
  });

  const getTypeIcon = (type: TodayTask['type'], appointmentType?: string) => {
    if (type === 'os') return ClipboardList;
    if (appointmentType === 'delivery') return Truck;
    if (appointmentType === 'measurement') return MapPin;
    return Calendar;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-xs">Pendente</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="text-xs">Em andamento</Badge>;
      case 'confirmed':
        return <Badge className="bg-success/20 text-success text-xs">Confirmado</Badge>;
      case 'completed':
        return <Badge className="bg-success text-success-foreground text-xs">Concluído</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const handleTaskClick = (task: TodayTask) => {
    if (task.type === 'os') {
      navigate(`/ordens-servico/${task.id}`);
    } else {
      navigate('/agenda');
    }
  };

  if (tasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4 text-primary" />
            Tarefas de Hoje
            <Badge variant="secondary" className="ml-1">
              {tasks.length}
            </Badge>
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <a href="/agenda" className="text-xs gap-1">
              Ver agenda <ArrowRight className="h-3 w-3" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[220px] pr-3">
          <div className="space-y-2">
            {tasks.map((task) => {
              const Icon = task.type === 'appointment' 
                ? getTypeIcon(task.type, task.subtitle.includes('Entrega') ? 'delivery' : task.subtitle.includes('Medição') ? 'measurement' : undefined)
                : ClipboardList;

              return (
                <button
                  key={`${task.type}-${task.id}`}
                  onClick={() => handleTaskClick(task)}
                  className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      task.type === 'os' 
                        ? 'bg-primary/10' 
                        : task.subtitle.includes('Entrega')
                          ? 'bg-success/10'
                          : 'bg-muted'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        task.type === 'os' 
                          ? 'text-primary' 
                          : task.subtitle.includes('Entrega')
                            ? 'text-success'
                            : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {task.title}
                        </span>
                        {task.time && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                            <Clock className="h-3 w-3" />
                            {task.time}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {task.subtitle}
                      </p>
                      <div className="mt-1.5">
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
