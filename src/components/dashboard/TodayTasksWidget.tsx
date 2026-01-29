import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowRight,
} from 'lucide-react';
import type { TodayTask } from '@/hooks/useDashboardData';

interface TodayTasksWidgetProps {
  data?: TodayTask[];
}

export const TodayTasksWidget = memo(function TodayTasksWidget({ data: tasks }: TodayTasksWidgetProps) {
  const navigate = useNavigate();

  const getTypeIcon = (type: TodayTask['type'], subtitle?: string) => {
    if (type === 'os') return ClipboardList;
    if (subtitle?.includes('Entrega')) return Truck;
    if (subtitle?.includes('Medição')) return MapPin;
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

  if (!tasks || tasks.length === 0) {
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
              const Icon = getTypeIcon(task.type, task.subtitle);

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
});
