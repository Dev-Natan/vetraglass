import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, DollarSign, CreditCard, Smartphone, Package, History, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  subtotal: number;
  discount_amount: number | null;
  discount_percent: number | null;
  payment_method: string;
  payment_status: string;
  created_at: string;
  notes: string | null;
  // Campos para suporte a vendas parciais
  sale_type?: 'full' | 'partial' | string;
  quote_id?: string | null;
  paid_amount?: number;
  pending_amount?: number;
}

interface SaleItem {
  id: string;
  item_name: string;
  item_unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  width: number | null;
  height: number | null;
  notes: string | null;
}

interface CashMovement {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string;
  payment_method?: string;
  created_at: string;
  origem: string | null;
}

interface DetalhesVendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  onPrint: (sale: Sale) => void;
}

const paymentMethodConfig = {
  dinheiro: { label: 'Dinheiro', icon: DollarSign, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cartao: { label: 'Cartão', icon: CreditCard, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  pix: { label: 'PIX', icon: Smartphone, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

export function DetalhesVendaDialog({ open, onOpenChange, sale, onPrint }: DetalhesVendaDialogProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Buscar itens da venda
  const { data: saleItems = [], isLoading } = useQuery({
    queryKey: ['sale-items', sale?.id],
    queryFn: async () => {
      if (!sale?.id) return [];
      
      const { data, error } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as SaleItem[];
    },
    enabled: !!sale?.id && open,
  });

  // Buscar histórico de pagamentos vinculados à venda
  const { data: paymentHistory = [] } = useQuery({
    queryKey: ['sale-payments', sale?.id],
    queryFn: async () => {
      if (!sale?.id) return [];
      
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('sale_id', sale.id)
        .eq('type', 'entrada')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as CashMovement[];
    },
    enabled: !!sale?.id && open,
  });

  if (!sale) return null;

  const config = paymentMethodConfig[sale.payment_method as keyof typeof paymentMethodConfig] || paymentMethodConfig.dinheiro;
  const PaymentIcon = config.icon;
  const isCancelled = sale.payment_status === 'cancelled';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Venda #{String(sale.sale_number).padStart(4, '0')}</span>
            {isCancelled && (
              <Badge variant="destructive">Cancelada</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da venda */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Data/Hora:</span>
              <p className="font-medium">
                {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">
                {sale.customer_name || <span className="italic text-muted-foreground">Consumidor</span>}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Pagamento:</span>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="outline" className={config.color}>
                  <PaymentIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <div className="mt-1 flex flex-col gap-1">
                {isCancelled ? (
                  <Badge variant="destructive">Cancelada</Badge>
                ) : sale.sale_type === 'partial' && (sale.pending_amount ?? 0) > 0 ? (
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                    Parcial
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    Paga
                  </Badge>
                )}
                {sale.quote_id && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    <FileText className="h-3 w-3 mr-1" />
                    Orçamento
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Itens da venda */}
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Itens da Venda
            </h4>
            
            {isLoading ? (
              <div className="h-20 flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              </div>
            ) : (
              <ScrollArea className="h-[200px] rounded-md border">
                <div className="p-3 space-y-3">
                  {saleItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-start text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-muted-foreground text-xs">
                          {item.quantity} {item.item_unit} × {formatCurrency(item.unit_price)}
                          {item.width && item.height && (
                            <span className="ml-2">({item.width} × {item.height} mm)</span>
                          )}
                        </p>
                      </div>
                      <span className={`font-medium ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>
                        {formatCurrency(item.total_price)}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <Separator />

          {/* Totais */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {sale.discount_amount && sale.discount_amount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Desconto ({sale.discount_percent || 0}%):</span>
                <span>-{formatCurrency(sale.discount_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className={isCancelled ? 'line-through text-muted-foreground' : ''}>
                {formatCurrency(sale.total_amount)}
              </span>
            </div>
            {/* Resumo de pagamentos para vendas parciais */}
            {sale.sale_type === 'partial' && (
              <div className="pt-2 space-y-1 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Recebido:</span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {formatCurrency(sale.paid_amount ?? 0)}
                  </span>
                </div>
                {(sale.pending_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo Pendente:</span>
                    <span className="text-orange-600 dark:text-orange-400 font-medium">
                      {formatCurrency(sale.pending_amount ?? 0)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Histórico de pagamentos */}
          {paymentHistory.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Pagamentos
                </h4>
                <div className="space-y-2">
                  {paymentHistory.map((payment) => (
                    <div key={payment.id} className="flex justify-between items-center text-sm p-2 rounded bg-muted/50">
                      <div>
                        <span className="text-muted-foreground">
                          {format(new Date(payment.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </span>
                        {payment.origem && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {payment.origem === 'orcamento' ? 'Entrada' : 'Faturamento'}
                          </Badge>
                        )}
                      </div>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        +{formatCurrency(payment.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Observações */}
          {sale.notes && (
            <>
              <Separator />
              <div>
                <span className="text-sm text-muted-foreground">Observações:</span>
                <p className="text-sm mt-1 bg-muted p-2 rounded">{sale.notes}</p>
              </div>
            </>
          )}

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onPrint(sale);
                onOpenChange(false);
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
