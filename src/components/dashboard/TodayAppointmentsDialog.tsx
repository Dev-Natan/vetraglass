import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Wrench, Truck, Users, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface TodayAppointmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  measurement: { label: 'Medição', icon: MapPin, color: 'text-emerald-600 bg-emerald-500/10' },
  installation: { label: 'Instalação', icon: Wrench, color: 'text-blue-600 bg-blue-500/10' },
  delivery: { label: 'Entrega', icon: Truck, color: 'text-pink-600 bg-pink-500/10' },
  visit: { label: 'Visita', icon: Users, color: 'text-purple-600 bg-purple-500/10' },
  maintenance: { label: 'Manutenção', icon: Wrench, color: 'text-amber-600 bg-amber-500/10' },
  other: { label: 'Compromisso', icon: Calendar, color: 'text-muted-foreground bg-muted' },
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  scheduled: { label: 'Agendado', variant: 'secondary' },
  confirmed: { label: 'Confirmado', variant: 'default' },
  in_progress: { label: 'Em andamento', variant: 'default' },
  completed: { label: 'Concluído', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
};

export function TodayAppointmentsDialog({ open, onOpenChange }: TodayAppointmentsDialogProps) {
  const { currentCompany } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['today-appointments-dialog', currentCompany?.id, today],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('service_appointments')
        .select('id, title, customer_name, appointment_type, status, scheduled_time_start, scheduled_time_end, customer_address, ordem_servico_id, all_day')
        .eq('company_id', currentCompany.id)
        .eq('scheduled_date', today)
        .neq('status', 'cancelled')
        .order('scheduled_time_start', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!currentCompany?.id,
  });

  const formatTime = (t: string | null) =>
    t ? format(new Date(`2000-01-01T${t}`), 'HH:mm') : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Compromissos de Hoje
          </DialogTitle>
          <DialogDescription>
            {format(new Date(), "dd 'de' MMMM, yyyy")} — {appointments.length} compromisso(s)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum compromisso para hoje</p>
            </div>
          ) : (
            appointments.map((apt) => {
              const cfg = typeConfig[apt.appointment_type] || typeConfig.other;
              const Icon = cfg.icon;
              const status = statusLabels[apt.status] || { label: apt.status, variant: 'secondary' as const };
              const start = formatTime(apt.scheduled_time_start);
              const end = formatTime(apt.scheduled_time_end);
              const link = apt.ordem_servico_id ? `/ordens-servico/${apt.ordem_servico_id}` : '/agenda';

              return (
                <div key={apt.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className={cn('p-2 rounded-lg shrink-0', cfg.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(start || apt.all_day) && (
                        <span className="text-sm font-semibold text-foreground inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {apt.all_day ? 'Dia todo' : `${start}${end ? ` – ${end}` : ''}`}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px] uppercase">{cfg.label}</Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate mt-1">
                      {apt.title || cfg.label}
                    </p>
                    {(apt.customer_name || apt.customer_address) && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {apt.customer_name || apt.customer_address}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                    <Link
                      to={link}
                      onClick={() => onOpenChange(false)}
                      className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Abrir <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t">
          <Link
            to="/agenda"
            onClick={() => onOpenChange(false)}
            className="text-sm text-primary hover:underline"
          >
            Ver agenda completa →
          </Link>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
