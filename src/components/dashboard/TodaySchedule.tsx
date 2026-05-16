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
    <Card className="border-border/40 shadow-sm overflow-hidden rounded-[2rem]">
      <CardHeader className="pb-4 pt-8 px-8 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            Agenda do Dia
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mr-1">HOJE</span>
            <Badge variant="outline" className="rounded-lg border-2 border-border font-black">
              {items.length} COMPROMISSOS
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
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
                className="flex items-center gap-6 p-6 hover:bg-primary/5 transition-all duration-300 group relative"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className={cn("p-4 rounded-[1.25rem] shadow-sm transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shrink-0", colorClass)}>
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    {item.time && (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg border border-border">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-black text-foreground">
                          {item.time}
                        </span>
                      </div>
                    )}
                    <h4 className="text-base font-bold text-foreground truncate tracking-tight group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1.5 font-medium flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 opacity-50" />
                    {item.subtitle}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0 ml-4">
                  <Badge variant={statusConfig.variant} className="px-3 py-1 font-black">
                    {statusConfig.label.toUpperCase()}
                  </Badge>
                  {item.osNumber && (
                    <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                      OS #{item.osNumber.toString().padStart(4, '0')}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
        
        <div className="p-6 bg-muted/30 border-t border-border/40">
          <Link 
            to="/ordens-servico?tab=calendario"
            className="flex items-center justify-center gap-2 text-sm font-black text-primary hover:text-primary/80 transition-all group tracking-tighter uppercase"
          >
            Ver calendário completo
            <div className="p-1 bg-primary/10 rounded-md transition-transform group-hover:translate-x-1">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
});
