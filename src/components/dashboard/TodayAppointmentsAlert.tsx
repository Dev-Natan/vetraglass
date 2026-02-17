import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, User, Wrench, Ruler, Eye, ChevronRight } from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';


interface Appointment {
  id: string;
  title: string;
  appointment_type: string;
  scheduled_date: string;
  scheduled_time_start: string | null;
  scheduled_time_end: string | null;
  customer_name: string | null;
  customer_address: string | null;
  status: string;
  color: string;
}

const appointmentTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  medicao: { label: "Medição", icon: Ruler, color: "#10b981" },
  instalacao: { label: "Instalação", icon: Wrench, color: "#3b82f6" },
  manutencao: { label: "Manutenção", icon: Wrench, color: "#f59e0b" },
  visita: { label: "Visita", icon: Eye, color: "#8b5cf6" },
};

export function TodayAppointmentsAlert() {
  const { currentCompany } = useAuth();
  const navigate = useNavigate();
  const today = new Date();

  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['today-appointments', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const todayStr = format(today, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('service_appointments')
        .select('id, title, appointment_type, scheduled_date, scheduled_time_start, scheduled_time_end, customer_name, customer_address, status, color')
        .eq('company_id', currentCompany.id)
        .eq('scheduled_date', todayStr)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_time_start', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!currentCompany?.id,
    
  });

  if (todayAppointments.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Agendamentos de Hoje
          <Badge variant="secondary" className="ml-1">
            {todayAppointments.length}
          </Badge>
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs"
          onClick={() => navigate('/agenda')}
        >
          Ver Agenda
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {todayAppointments.slice(0, 3).map((apt) => {
            const config = appointmentTypeConfig[apt.appointment_type];
            const Icon = config?.icon || Calendar;
            
            return (
              <div
                key={apt.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-background/80 border"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: (apt.color || config?.color || '#3b82f6') + '20' }}
                >
                  <Icon 
                    className="h-5 w-5" 
                    style={{ color: apt.color || config?.color || '#3b82f6' }} 
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{apt.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {apt.scheduled_time_start && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {apt.scheduled_time_start.slice(0, 5)}
                        {apt.scheduled_time_end && ` - ${apt.scheduled_time_end.slice(0, 5)}`}
                      </span>
                    )}
                    {apt.customer_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {apt.customer_name}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs flex-shrink-0"
                  style={{ 
                    backgroundColor: (apt.color || config?.color || '#3b82f6') + '15',
                    borderColor: apt.color || config?.color || '#3b82f6',
                    color: apt.color || config?.color || '#3b82f6'
                  }}
                >
                  {config?.label || apt.appointment_type}
                </Badge>
              </div>
            );
          })}
          {todayAppointments.length > 3 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              + {todayAppointments.length - 3} outros agendamentos
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
