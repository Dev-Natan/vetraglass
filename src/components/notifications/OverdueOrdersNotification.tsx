import { Bell, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useOverdueOrders } from '@/hooks/useOverdueOrders';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function OverdueOrdersNotification() {
  const { data: overdueOrders, isLoading } = useOverdueOrders();
  
  const hasOverdue = overdueOrders && overdueOrders.length > 0;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`relative ${hasOverdue ? 'text-destructive hover:text-destructive' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Bell className="w-5 h-5" />
          {hasOverdue && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {overdueOrders.length > 9 ? '9+' : overdueOrders.length}
              </span>
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-foreground">Notificações</span>
          </div>
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center">
              <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            </div>
          ) : !hasOverdue ? (
            <div className="p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhuma notificação
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Todas as OS estão em dia!
              </p>
            </div>
          ) : (
            <div>
              <div className="px-3 py-2 bg-destructive/10 border-b border-destructive/20">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {overdueOrders.length} OS {overdueOrders.length === 1 ? 'atrasada' : 'atrasadas'}
                  </span>
                </div>
              </div>
              
              {overdueOrders.map((os) => (
                <Link
                  key={os.id}
                  to="/ordens-servico"
                  className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        OS #{os.os_number.toString().padStart(4, '0')}
                      </span>
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        {os.days_overdue} {os.days_overdue === 1 ? 'dia' : 'dias'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">
                      {os.customer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Previsão: {format(new Date(os.estimated_end), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2" />
                </Link>
              ))}
            </div>
          )}
        </div>
        
        {hasOverdue && (
          <div className="p-2 border-t border-border">
            <Link to="/ordens-servico">
              <Button variant="ghost" className="w-full text-sm">
                Ver todas as OS
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
