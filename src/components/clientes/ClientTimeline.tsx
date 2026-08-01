import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ShoppingCart,
  FileText,
  DollarSign,
  Clock,
  Package,
  Receipt,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientTimelineProps {
  clientId: string;
  clientName?: string | null;
}

interface QuoteHistoryItem {
  id: string;
  quote_number: number;
  final_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  items: any[];
  deposits: any[];
  receivables: any[];
  expenses: any[];
}

export function ClientTimeline({ clientId, clientName }: ClientTimelineProps) {
  const { currentCompany } = useAuth();

  const { data: history, isLoading } = useQuery({
    queryKey: ['client-history-grouped', clientId, currentCompany?.id],
    enabled: !!currentCompany?.id && !!clientId,
    queryFn: async () => {
      const companyId = currentCompany!.id;

      // Buscar todos os orçamentos
      const { data: quotes } = await supabase
        .from('quotes')
        .select(`
          id, 
          quote_number, 
          final_amount, 
          total_amount, 
          status, 
          created_at,
          quote_items (
            id,
            description,
            width,
            height,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('company_id', companyId)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (!quotes) return { negotiation: [], approved: [] };

      const quoteIds = quotes.map(q => q.id);

      // Buscar financeiros vinculados a esses orçamentos
      const [depositsResult, receivablesResult, expensesResult] = await Promise.all([
        quoteIds.length
          ? supabase
              .from('quote_deposits')
              .select('id, quote_id, amount, status, created_at')
              .in('quote_id', quoteIds)
          : Promise.resolve({ data: [] }),
        quoteIds.length
          ? supabase
              .from('accounts_receivable')
              .select('id, quote_id, total_amount, paid_amount, status, created_at')
              .in('quote_id', quoteIds)
          : Promise.resolve({ data: [] }),
        supabase
          .from('expenses')
          .select('id, description, amount, status, created_at, client_id')
          .eq('company_id', companyId)
          .eq('client_id', clientId)
      ]);

      const deposits = depositsResult.data || [];
      const receivables = receivablesResult.data || [];
      const expenses = expensesResult.data || [];

      // Agrupar
      const grouped: QuoteHistoryItem[] = quotes.map(q => ({
        id: q.id,
        quote_number: q.quote_number,
        final_amount: Number(q.final_amount || q.total_amount || 0),
        total_amount: Number(q.total_amount || 0),
        status: q.status,
        created_at: q.created_at,
        items: (q as any).quote_items || [],
        deposits: deposits.filter(d => d.quote_id === q.id),
        receivables: receivables.filter(r => r.quote_id === q.id),
      }));

      return {
        negotiation: grouped.filter(q => 
          ['draft', 'pending', 'sent'].includes(String(q.status).toLowerCase())
        ),
        approved: grouped.filter(q => 
          !['draft', 'pending', 'sent'].includes(String(q.status).toLowerCase())
        ),
      };
    },
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const renderQuoteAccordion = (quotes: QuoteHistoryItem[]) => {
    if (quotes.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">Nenhum orçamento nesta categoria</p>
        </div>
      );
    }

    return (
      <Accordion type="single" collapsible className="w-full space-y-2">
        {quotes.map((quote) => {
          // Filtramos depósitos confirmados
          const confirmedDeposits = quote.deposits.filter(d => 
            ['received', 'paid', 'confirmado', 'pago'].includes(String(d.status).toLowerCase())
          );

          // Filtramos recebíveis. 
          // Regra: Se um orcamento tem depósitos confirmados E contas a receber, 
          // precisamos garantir que não estamos contando o mesmo valor duas vezes.
          // Geralmente, o sinal (deposit) é convertido em parte da conta a receber paga no momento da aprovação.
          
          const totalPagoDepositos = confirmedDeposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
          
          // Somamos apenas a parte paga das contas a receber que NÃO seja o depósito inicial 
          // (ou simplesmente confiamos que o paid_amount do receivable já reflete o total recebido para aquele título)
          const totalPagoReceivables = quote.receivables.reduce((sum, r) => sum + Number(r.paid_amount || 0), 0);

          // Cálculo do Valor Pago Real:
          // Se houver contas a receber, usamos o paid_amount delas (que deve centralizar o sinal + parcelas).
          // Se não houver, usamos os depósitos.
          const totalPago = quote.receivables.length > 0 
            ? totalPagoReceivables 
            : totalPagoDepositos;

          const saldoRestante = Math.max(0, Number((quote.final_amount - totalPago).toFixed(2)));

          return (
            <AccordionItem key={quote.id} value={quote.id} className="border rounded-lg px-4 bg-card">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-4 w-full text-left">
                  <div className="bg-primary/10 p-2 rounded-full hidden sm:block">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Orçamento #{quote.quote_number}</span>
                      <Badge variant={quote.status === 'approved' || quote.status === 'finalizado' ? 'default' : 'secondary'} className="text-[10px] uppercase h-5">
                        {getQuoteStatusLabel(quote.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(quote.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right mr-4">
                    <p className="text-sm font-semibold">{formatCurrency(quote.final_amount)}</p>
                    {saldoRestante > 0 && (
                      <p className="text-[10px] text-red-500 font-medium">Saldo: {formatCurrency(saldoRestante)}</p>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4 space-y-4">
                {/* Lista de Itens */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <Package className="h-3 w-3" />
                    Produtos e Serviços
                  </h4>
                  <div className="bg-muted/30 rounded-md border text-xs divide-y">
                    {quote.items.length > 0 ? (
                      quote.items.map((item) => (
                        <div key={item.id} className="p-2 flex justify-between items-center">
                          <div className="flex-1 pr-4">
                            <span className="font-medium">{item.description}</span>
                            {(item.width || item.height) && (
                              <span className="text-muted-foreground ml-2">
                                ({item.width || 0} x {item.height || 0})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 w-32 justify-end">
                            <span className="text-muted-foreground">x{item.quantity}</span>
                            <span className="font-medium">{formatCurrency(item.total_price)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-muted-foreground italic">
                        Nenhum item registrado
                      </div>
                    )}
                  </div>
                </div>

                {/* Financeiro */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
                    <Receipt className="h-3 w-3" />
                    Histórico Financeiro
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-muted/30 p-3 rounded-md border space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Valor Total:</span>
                        <span className="font-bold">{formatCurrency(quote.final_amount)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Valor Pago:</span>
                        <span className="font-bold text-green-600">{formatCurrency(totalPago)}</span>
                      </div>
                      <div className="border-t pt-2 flex justify-between text-xs">
                        <span className="font-medium">Saldo Restante:</span>
                        <span className={`font-bold ${saldoRestante > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {formatCurrency(saldoRestante)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 p-3 rounded-md border space-y-2">
                      <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Detalhamento Financeiro</h5>
                      {quote.deposits.length === 0 && quote.receivables.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">Nenhum registro financeiro</p>
                      ) : (
                        <div className="space-y-1">
                          {/* Exibimos depósitos apenas se não houver recebíveis vinculados (para evitar duplicidade visual) */}
                          {quote.receivables.length === 0 && quote.deposits.map((d) => (
                            <div key={d.id} className="flex justify-between text-[10px]">
                              <span className="truncate pr-2">Sinal/Entrada ({format(new Date(d.created_at), 'dd/MM')})</span>
                              <span className="font-medium text-green-600">+{formatCurrency(d.amount)}</span>
                            </div>
                          ))}
                          {quote.receivables.map((r) => (
                            <div key={r.id} className="space-y-1 border-b border-muted last:border-0 pb-1 mb-1">
                              <div className="flex justify-between text-[10px] font-medium">
                                <span>Título Financeiro</span>
                                <span>{formatCurrency(r.total_amount)}</span>
                              </div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-muted-foreground">Valor Recebido:</span>
                                <span className="text-green-600">+{formatCurrency(r.paid_amount || 0)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-6">
        <Tabs defaultValue="negotiation" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="negotiation" className="gap-2">
              <Clock className="h-4 w-4" />
              Em Negociação ({history?.negotiation.length || 0})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Aprovados/Concluídos ({history?.approved.length || 0})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="negotiation">
            {renderQuoteAccordion(history?.negotiation || [])}
          </TabsContent>
          
          <TabsContent value="approved">
            {renderQuoteAccordion(history?.approved || [])}
          </TabsContent>
        </Tabs>
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
    rejected: 'Rejeitado',
    finalizado: 'Finalizado',
    completed: 'Concluído',
    partial: 'Parcial',
  };
  return labels[status.toLowerCase()] || status;
}
