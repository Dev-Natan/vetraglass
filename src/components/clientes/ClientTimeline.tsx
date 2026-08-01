import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShoppingCart, 
  FileText, 
  ClipboardList,
  DollarSign,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientTimelineProps {
  clientId: string;
}

interface TimelineEvent {
  id: string;
  type: 'sale' | 'quote' | 'os' | 'payment';
  title: string;
  description: string;
  amount?: number;
  status: string;
  date: Date;
  icon: typeof ShoppingCart;
  color: string;
}

export function ClientTimeline({ clientId }: ClientTimelineProps) {
  const { currentCompany } = useAuth();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['client-timeline', clientId, currentCompany?.id],
    enabled: !!currentCompany?.id && !!clientId,
    queryFn: async () => {
      const [salesResult, quotesResult, osResult, paymentsResult] = await Promise.all([
        supabase
          .from('sales')
          .select('id, sale_number, total_amount, payment_status, created_at')
          .eq('company_id', currentCompany!.id)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(20),
        
        supabase
          .from('quotes')
          .select('id, quote_number, final_amount, status, created_at')
          .eq('company_id', currentCompany!.id)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(20),
        
        supabase
          .from('ordens_servico')
          .select('id, os_number, total_amount, status, created_at')
          .eq('company_id', currentCompany!.id)
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(20),
        
        supabase
          .from('cash_movements')
          .select('id, description, amount, type, created_at')
          .eq('company_id', currentCompany!.id)
          .or(`cliente_id.eq.${clientId},fornecedor_id.eq.${clientId}`)
          .order('created_at', { ascending: false })
          .limit(20)
      ]);

      const timeline: TimelineEvent[] = [];

      // Vendas
      (salesResult.data || []).forEach((sale: any) => {
        timeline.push({
          id: `sale-${sale.id}`,
          type: 'sale',
          title: `Venda #${sale.sale_number}`,
          description: sale.payment_status === 'paid' ? 'Paga' : 'Pendente',
          amount: sale.total_amount,
          status: sale.payment_status,
          date: new Date(sale.created_at),
          icon: ShoppingCart,
          color: 'bg-green-500'
        });
      });

      // Orçamentos
      (quotesResult.data || []).forEach((quote: any) => {
        timeline.push({
          id: `quote-${quote.id}`,
          type: 'quote',
          title: `Orçamento #${quote.quote_number}`,
          description: getQuoteStatusLabel(quote.status),
          amount: quote.final_amount,
          status: quote.status,
          date: new Date(quote.created_at),
          icon: FileText,
          color: 'bg-blue-500'
        });
      });

      // OS
      (osResult.data || []).forEach((os: any) => {
        timeline.push({
          id: `os-${os.id}`,
          type: 'os',
          title: `OS #${os.os_number.toString().padStart(4, '0')}`,
          description: getOSStatusLabel(os.status),
          amount: os.total_amount,
          status: os.status,
          date: new Date(os.created_at),
          icon: ClipboardList,
          color: 'bg-purple-500'
        });
      });

      // Pagamentos / Movimentações
      (paymentsResult.data || []).forEach((payment: any) => {
        timeline.push({
          id: `payment-${payment.id}`,
          type: 'payment',
          title: payment.type === 'income' ? 'Entrada / Recebimento' : 'Saída / Pagamento',
          description: payment.description || 'Movimentação manual',
          amount: payment.amount,
          status: 'paid',
          date: new Date(payment.created_at),
          icon: DollarSign,
          color: payment.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'
        });
      });

      // Ordenar por data
      return timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
    }
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhuma interação registrada</p>
        <p className="text-sm">Vendas, orçamentos e OS aparecerão aqui</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="relative">
        {/* Linha vertical */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex gap-4 relative">
              {/* Ícone */}
              <div className={`w-10 h-10 rounded-full ${event.color} flex items-center justify-center flex-shrink-0 z-10`}>
                <event.icon className="h-5 w-5 text-white" />
              </div>

              {/* Conteúdo */}
              <div className="flex-1 bg-muted/50 rounded-lg p-3 border">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                  {event.amount && (
                    <span className="font-semibold text-sm whitespace-nowrap">
                      {formatCurrency(event.amount)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(event.date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  <span className="mx-1">•</span>
                  {formatDistanceToNow(event.date, { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function getQuoteStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    pending: 'Pendente',
    sent: 'Enviado',
    approved: 'Aprovado',
    rejected: 'Rejeitado'
  };
  return labels[status] || status;
}

function getOSStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    in_progress: 'Em Andamento',
    completed: 'Concluída',
    delivered: 'Entregue',
    cancelled: 'Cancelada'
  };
  return labels[status] || status;
}
