import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ShoppingCart, 
  FileText, 
  ClipboardList,
  Calendar,
  TrendingUp,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientPurchaseHistoryProps {
  clientId: string;
}

interface Sale {
  id: string;
  sale_number: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

interface Quote {
  id: string;
  quote_number: number;
  final_amount: number;
  status: string;
  created_at: string;
}

interface OrdemServico {
  id: string;
  os_number: number;
  total_amount: number;
  status: string;
  created_at: string;
}

export function ClientPurchaseHistory({ clientId }: ClientPurchaseHistoryProps) {
  const { currentCompany } = useAuth();

  // Fetch client sales
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['client-sales', clientId, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !clientId) return [];
      
      const { data, error } = await supabase
        .from('sales')
        .select('id, sale_number, total_amount, payment_method, payment_status, created_at')
        .eq('company_id', currentCompany.id)
        .eq('client_id', clientId)
        .neq('payment_status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as Sale[];
    },
    enabled: !!currentCompany?.id && !!clientId,
  });

  // Fetch client quotes - using separate fetch to avoid TS depth issues
  const { data: quotes = [], isLoading: quotesLoading } = useQuery<Quote[]>({
    queryKey: ['client-quotes', clientId, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !clientId) return [];
      
      // Using any to avoid TypeScript deep inference issues with Supabase
      const result = await (supabase as any)
        .from('quotes')
        .select('id, quote_number, final_amount, status, created_at')
        .eq('company_id', currentCompany.id)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (result.error) throw result.error;
      return result.data as Quote[];
    },
    enabled: !!currentCompany?.id && !!clientId,
  });

  // Fetch client service orders - using separate fetch to avoid TS depth issues
  const { data: ordensServico = [], isLoading: osLoading } = useQuery<OrdemServico[]>({
    queryKey: ['client-os', clientId, currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id || !clientId) return [];
      
      // Using any to avoid TypeScript deep inference issues with Supabase
      const result = await (supabase as any)
        .from('ordens_servico')
        .select('id, os_number, total_amount, status, created_at')
        .eq('company_id', currentCompany.id)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (result.error) throw result.error;
      return result.data as OrdemServico[];
    },
    enabled: !!currentCompany?.id && !!clientId,
  });

  const isLoading = salesLoading || quotesLoading || osLoading;

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const totalGasto = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
  const totalOrcamentos = quotes.length;
  const totalOS = ordensServico.length;

  const getStatusBadge = (status: string, type: 'sale' | 'quote' | 'os') => {
    const configs = {
      sale: {
        paid: { label: 'Pago', variant: 'outline' as const, className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30' },
        pending: { label: 'Pendente', variant: 'outline' as const, className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30' },
      },
      quote: {
        approved: { label: 'Aprovado', variant: 'outline' as const, className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30' },
        pending: { label: 'Pendente', variant: 'outline' as const, className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30' },
        sent: { label: 'Enviado', variant: 'outline' as const, className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30' },
        draft: { label: 'Rascunho', variant: 'outline' as const, className: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/30' },
        rejected: { label: 'Rejeitado', variant: 'outline' as const, className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30' },
      },
      os: {
        completed: { label: 'Concluído', variant: 'outline' as const, className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30' },
        in_progress: { label: 'Em Andamento', variant: 'outline' as const, className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30' },
        pending: { label: 'Pendente', variant: 'outline' as const, className: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30' },
      },
    };

    const config = configs[type][status as keyof typeof configs[typeof type]] || { label: status, variant: 'secondary' as const, className: '' };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const hasNoHistory = sales.length === 0 && quotes.length === 0 && ordensServico.length === 0;

  if (hasNoHistory) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum histórico de compras encontrado</p>
        <p className="text-sm">As vendas, orçamentos e OS deste cliente aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 dark:text-green-400">Total Gasto</span>
          </div>
          <p className="text-lg font-bold text-green-700 dark:text-green-400">
            {formatCurrency(totalGasto)}
          </p>
          <p className="text-xs text-green-600">{sales.length} compras</p>
        </div>

        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-blue-700 dark:text-blue-400">Orçamentos</span>
          </div>
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{totalOrcamentos}</p>
        </div>

        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-purple-700 dark:text-purple-400">OS</span>
          </div>
          <p className="text-lg font-bold text-purple-700 dark:text-purple-400">{totalOS}</p>
        </div>
      </div>

      <ScrollArea className="h-[300px]">
        <div className="space-y-3">
          {/* Sales */}
          {sales.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Últimas Vendas
              </h4>
              <div className="space-y-2">
                {sales.map((sale) => (
                  <div 
                    key={sale.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border"
                  >
                    <div>
                      <p className="font-medium text-sm">Venda #{sale.sale_number}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(sale.total_amount)}</p>
                      {getStatusBadge(sale.payment_status, 'sale')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quotes */}
          {quotes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Últimos Orçamentos
              </h4>
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <div 
                    key={quote.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border"
                  >
                    <div>
                      <p className="font-medium text-sm">Orçamento #{quote.quote_number}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(quote.final_amount)}</p>
                      {getStatusBadge(quote.status, 'quote')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service Orders */}
          {ordensServico.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Últimas OS
              </h4>
              <div className="space-y-2">
                {ordensServico.map((os) => (
                  <div 
                    key={os.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border"
                  >
                    <div>
                      <p className="font-medium text-sm">OS #{os.os_number.toString().padStart(4, '0')}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(os.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(os.total_amount)}</p>
                      {getStatusBadge(os.status, 'os')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
