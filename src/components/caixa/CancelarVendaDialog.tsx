import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Info, Receipt, Wallet } from 'lucide-react';

interface Sale {
  id: string;
  sale_number: number;
  customer_name: string | null;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

interface CancelarVendaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  onConfirm: (saleId: string, reason: string) => Promise<unknown>;
  isLoading?: boolean;
}

export function CancelarVendaDialog({
  open,
  onOpenChange,
  sale,
  onConfirm,
  isLoading,
}: CancelarVendaDialogProps) {
  const [reason, setReason] = useState('');

  // Buscar o que será removido (impacto do cancelamento)
  const { data: impact, isLoading: isLoadingImpact } = useQuery({
    queryKey: ['sale-cancellation-impact', sale?.id],
    queryFn: async () => {
      if (!sale?.id) return null;
      
      const [cashMovements, receivables] = await Promise.all([
        supabase.from('cash_movements').select('*').eq('sale_id', sale.id).eq('type', 'entrada'),
        supabase.from('accounts_receivable').select('*').eq('sale_id', sale.id)
      ]);

      return {
        movements: cashMovements.data || [],
        receivables: receivables.data || []
      };
    },
    enabled: !!sale?.id && open
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleConfirm = async () => {
    if (!sale) return;
    await onConfirm(sale.id, reason);
    setReason('');
  };

  if (!sale) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Confirmar Cancelamento da Venda #{String(sale.sale_number).padStart(4, '0')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="p-3 bg-muted rounded-lg border">
              <p>
                Você está cancelando a venda de{' '}
                <strong className="text-foreground">{formatCurrency(sale.total_amount)}</strong>
                {sale.customer_name && (
                  <> para <strong className="text-foreground">{sale.customer_name}</strong></>
                )}
                .
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-1.5 text-foreground">
                <Info className="h-4 w-4 text-blue-500" />
                Impacto do Cancelamento:
              </h4>
              
              <ScrollArea className="h-[180px] pr-4">
                <div className="space-y-3">
                  {/* Entradas no Caixa */}
                  <div>
                    <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                      <Wallet className="h-3 w-3" /> Entradas de Caixa que serão REMOVIDAS:
                    </p>
                    {isLoadingImpact ? (
                      <p className="text-xs text-muted-foreground italic">Carregando...</p>
                    ) : impact?.movements.length ? (
                      <ul className="space-y-1">
                        {impact.movements.map((m: any) => (
                          <li key={m.id} className="text-xs p-1.5 bg-red-50 dark:bg-red-950/20 rounded flex justify-between border border-red-100 dark:border-red-900">
                            <span>{m.description || 'Entrada de venda'}</span>
                            <span className="font-bold">{formatCurrency(m.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhuma entrada encontrada.</p>
                    )}
                  </div>

                  {/* Parcelas a Receber */}
                  <div>
                    <p className="text-xs font-semibold mb-1 flex items-center gap-1">
                      <Receipt className="h-3 w-3" /> Parcelas que serão CANCELADAS:
                    </p>
                    {isLoadingImpact ? (
                      <p className="text-xs text-muted-foreground italic">Carregando...</p>
                    ) : impact?.receivables.length ? (
                      <ul className="space-y-1">
                        {impact.receivables.map((r: any) => (
                          <li key={r.id} className="text-xs p-1.5 bg-orange-50 dark:bg-orange-950/20 rounded flex justify-between border border-orange-100 dark:border-orange-900">
                            <span>Parc. {r.installment_number}/{r.total_installments} ({r.status})</span>
                            <span className="font-bold">{formatCurrency(r.total_amount)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhuma parcela encontrada.</p>
                    )}
                  </div>

                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-100 dark:border-blue-900">
                    <p className="text-[10px] text-blue-700 dark:text-blue-300">
                      * O estoque dos itens vendidos será restaurado automaticamente.
                    </p>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="cancel-reason" className="text-sm font-bold">Motivo do cancelamento (obrigatório)</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Descreva detalhadamente o motivo para auditoria..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[80px]"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? 'Processando...' : 'Confirmar e Limpar Registros'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
