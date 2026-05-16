import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, DollarSign, CreditCard, Smartphone, XCircle, Printer } from 'lucide-react';

interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  // Campos para suporte a vendas parciais
  sale_type?: 'full' | 'partial' | string;
  quote_id?: string | null;
  paid_amount?: number;
  pending_amount?: number;
}

interface VendasTableProps {
  sales: Sale[];
  onViewDetails?: (sale: Sale) => void;
  onCancelSale?: (sale: Sale) => void;
  onPrintReceipt?: (sale: Sale) => void;
  showCancelButton?: boolean;
}

const paymentMethodConfig = {
  dinheiro: { label: 'Dinheiro', icon: DollarSign, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  cartao: { label: 'Cartão', icon: CreditCard, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  pix: { label: 'PIX', icon: Smartphone, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

export function VendasTable({ sales, onViewDetails, onCancelSale, onPrintReceipt, showCancelButton = true }: VendasTableProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (sales.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground">Nenhuma venda registrada hoje.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">#</TableHead>
            <TableHead className="w-24">Hora</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead className="w-32">Pagamento</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-32 text-right">Total</TableHead>
            <TableHead className="w-24"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => {
            const config = paymentMethodConfig[sale.payment_method as keyof typeof paymentMethodConfig] || paymentMethodConfig.dinheiro;
            const Icon = config.icon;
            const isCancelled = sale.payment_status === 'cancelled';
            
            return (
              <TableRow key={sale.id} className={isCancelled ? 'opacity-60' : ''}>
                <TableCell className="font-mono text-sm">
                  {String(sale.sale_number).padStart(4, '0')}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(sale.created_at), 'HH:mm', { locale: ptBR })}
                </TableCell>
                <TableCell>
                  {sale.customer_name || (
                    <span className="text-muted-foreground italic">Consumidor</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={config.color}>
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {isCancelled ? (
                      <Badge variant="destructive">Cancelada</Badge>
                    ) : sale.sale_type === 'partial' && (sale.pending_amount ?? 0) > 0 ? (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
                        Parcial
                      </Badge>
                    ) : sale.payment_status === 'pending' ? (
                      <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                        Pendente
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Paga
                      </Badge>
                    )}
                    {sale.quote_id && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        Orçamento
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className={`text-right ${isCancelled ? 'line-through' : ''}`}>
                  <div className="flex flex-col items-end">
                    <span className="font-medium">{formatCurrency(sale.total_amount)}</span>
                    {sale.sale_type === 'partial' && (sale.pending_amount ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Recebido: {formatCurrency(sale.paid_amount ?? 0)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onViewDetails?.(sale)}
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onPrintReceipt?.(sale)}
                      title="Imprimir comprovante"
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    {showCancelButton && !isCancelled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onCancelSale?.(sale)}
                        title="Cancelar venda"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
