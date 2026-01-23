import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Phone, MessageCircle, DollarSign, ChevronRight, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface OverdueReceivable {
  id: string;
  customer_name: string;
  description: string;
  total_amount: number;
  due_date: string;
  ordem_servico_id: string | null;
  installment_number: number;
  total_installments: number;
  ordens_servico?: {
    os_number: number;
  } | null;
  clients?: {
    phone: string | null;
  } | null;
}

export function OverdueReceivablesAlert() {
  const { currentCompany } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const { data: overdueReceivables, isLoading } = useQuery({
    queryKey: ['overdue-receivables-alert', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      
      const { data, error } = await supabase
        .from('accounts_receivable')
        .select(`
          id,
          customer_name,
          description,
          total_amount,
          due_date,
          ordem_servico_id,
          installment_number,
          total_installments,
          ordens_servico (os_number),
          client_id
        `)
        .eq('company_id', currentCompany.id)
        .eq('status', 'pending')
        .lt('due_date', today)
        .order('due_date', { ascending: true })
        .limit(10);

      if (error) throw error;
      return (data || []) as OverdueReceivable[];
    },
    enabled: !!currentCompany?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (isLoading || !overdueReceivables || overdueReceivables.length === 0) {
    return null;
  }

  const totalOverdue = overdueReceivables.reduce((sum, r) => sum + r.total_amount, 0);

  const handleWhatsApp = (customerName: string) => {
    // This would need the customer phone - for now just show a message
    const message = encodeURIComponent(
      `Olá! Estamos entrando em contato referente ao pagamento pendente. Por favor, entre em contato conosco para regularizar.`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-destructive">Cobranças Vencidas</h3>
              <p className="text-sm text-muted-foreground">
                {overdueReceivables.length} parcela{overdueReceivables.length > 1 ? 's' : ''} • Total: {formatCurrency(totalOverdue)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive hover:text-destructive"
            onClick={() => navigate('/financeiro?tab=receivables')}
          >
            Ver todas
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {overdueReceivables.slice(0, 5).map((receivable) => {
            const daysOverdue = differenceInDays(new Date(), new Date(receivable.due_date));
            
            return (
              <div
                key={receivable.id}
                className="flex items-center justify-between p-3 rounded-lg bg-card border border-destructive/20"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center text-xs font-bold text-destructive">
                    {receivable.installment_number}/{receivable.total_installments}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{receivable.customer_name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>Venceu {format(new Date(receivable.due_date), 'dd/MM', { locale: ptBR })}</span>
                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                        {daysOverdue} dia{daysOverdue > 1 ? 's' : ''}
                      </Badge>
                      {receivable.ordens_servico?.os_number && (
                        <span className="text-muted-foreground">
                          OS #{String(receivable.ordens_servico.os_number).padStart(4, '0')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="font-bold text-destructive">{formatCurrency(receivable.total_amount)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                    onClick={() => handleWhatsApp(receivable.customer_name)}
                    title="Enviar cobrança por WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {overdueReceivables.length > 5 && (
          <div className="mt-3 text-center">
            <Button
              variant="link"
              size="sm"
              className="text-destructive"
              onClick={() => navigate('/financeiro?tab=receivables')}
            >
              +{overdueReceivables.length - 5} mais vencidas
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
