import { SupportTicket } from '@/hooks/useSupportTickets';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bug, Lightbulb, HelpCircle, CreditCard, MessageSquare } from 'lucide-react';

interface TicketListProps {
  tickets: SupportTicket[];
  selectedTicketId: string | null;
  onSelectTicket: (ticketId: string) => void;
}

const statusConfig = {
  open: { label: 'Aberto', color: 'bg-blue-500' },
  in_progress: { label: 'Em andamento', color: 'bg-yellow-500' },
  waiting: { label: 'Aguardando', color: 'bg-orange-500' },
  resolved: { label: 'Resolvido', color: 'bg-green-500' },
  closed: { label: 'Fechado', color: 'bg-muted-foreground' },
};

const categoryIcons = {
  bug: Bug,
  feature: Lightbulb,
  question: HelpCircle,
  billing: CreditCard,
  other: MessageSquare,
};

export function TicketList({ tickets, selectedTicketId, onSelectTicket }: TicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">Nenhum ticket encontrado</p>
        <p className="text-xs mt-1">Crie um novo ticket para iniciar</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tickets.map((ticket) => {
        const status = statusConfig[ticket.status];
        const CategoryIcon = categoryIcons[ticket.category];

        return (
          <button
            key={ticket.id}
            onClick={() => onSelectTicket(ticket.id)}
            className={cn(
              'w-full text-left p-3 rounded-lg border transition-colors',
              selectedTicketId === ticket.id
                ? 'bg-accent border-primary'
                : 'bg-card hover:bg-accent/50 border-border'
            )}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-muted">
                <CategoryIcon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-muted-foreground">
                    #{ticket.ticket_number}
                  </span>
                  <div className={cn('h-2 w-2 rounded-full', status.color)} />
                  <span className="text-xs text-muted-foreground">
                    {status.label}
                  </span>
                </div>
                <p className="font-medium text-sm truncate">{ticket.subject}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(ticket.updated_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
              {ticket.priority === 'urgent' && (
                <Badge variant="destructive" className="text-xs">
                  Urgente
                </Badge>
              )}
              {ticket.priority === 'high' && (
                <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                  Alta
                </Badge>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
