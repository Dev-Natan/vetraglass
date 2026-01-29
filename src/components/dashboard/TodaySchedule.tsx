import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, Wrench, Truck, Users, Clock, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

export interface ScheduleItem {
  id: string;
  type: 'appointment' | 'os_delivery';
  appointmentType?: string;
  title: string;
  subtitle: string;
  time?: string;
  status: string;
  osNumber?: number;
  link: string;
}

interface TodayScheduleProps {
  items?: ScheduleItem[];
}

const appointmentIcons: Record<string, React.ElementType> = {
  measurement: MapPin,
  installation: Wrench,
  delivery: Truck,
  visit: Users,
  maintenance: Wrench,
  other: Calendar,
};

const appointmentColors: Record<string, string> = {
  measurement: 'text-emerald-600 bg-emerald-500/10',
  installation: 'text-blue-600 bg-blue-500/10',
  delivery: 'text-pink-600 bg-pink-500/10',
  visit: 'text-purple-600 bg-purple-500/10',
  maintenance: 'text-amber-600 bg-amber-500/10',
  other: 'text-muted-foreground bg-muted',
  os_delivery: 'text-pink-600 bg-pink-500/10',
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  scheduled: { label: 'Agendado', variant: 'secondary' },
  confirmed: { label: 'Confirmado', variant: 'default' },
  completed: { label: 'Concluído', variant: 'outline' },
  in_progress: { label: 'Em andamento', variant: 'default' },
};

export const TodaySchedule = memo(function TodaySchedule({ items }: TodayScheduleProps) {
  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Agenda de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum compromisso para hoje</p>
            <Link 
              to="/ordens-servico?tab=calendario" 
              className="text-sm text-primary hover:underline mt-2 inline-block"
            >
              Ver calendário completo
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Agenda de Hoje
          </CardTitle>
          <Badge variant="outline">{items.length} compromisso(s)</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const Icon = item.type === 'os_delivery' 
            ? Truck 
            : appointmentIcons[item.appointmentType || 'other'] || Calendar;
          const colorClass = item.type === 'os_delivery'
            ? appointmentColors.os_delivery
            : appointmentColors[item.appointmentType || 'other'];
          const statusConfig = statusLabels[item.status] || { label: item.status, variant: 'secondary' as const };

          return (
            <Link 
              key={item.id} 
              to={item.link}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
            >
              <div className={`p-2 rounded-lg ${colorClass} shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {item.time && (
                    <span className="text-sm font-semibold text-foreground">
                      {item.time}
                    </span>
                  )}
                  <span className="text-sm font-medium text-foreground truncate">
                    {item.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {item.subtitle}
                </p>
              </div>
              <Badge variant={statusConfig.variant} className="shrink-0 text-xs">
                {statusConfig.label}
              </Badge>
            </Link>
          );
        })}
        
        <Link 
          to="/ordens-servico?tab=calendario"
          className="block text-center text-sm text-primary hover:underline pt-2"
        >
          Ver calendário completo →
        </Link>
      </CardContent>
    </Card>
  );
});
