import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, CheckCircle2, XCircle, AlertTriangle, 
  TrendingUp, TrendingDown, User, Clock, DollarSign 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CashAudit {
  id: string;
  cash_register_id: string;
  operator_id: string;
  operator_name: string;
  total_counted: number;
  expected_amount: number;
  difference: number;
  operator_notes: string | null;
  submitted_at: string;
  counts_submitted: Array<{ payment_method: string; amount: number }>;
}

interface AuditCashClosingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audit: CashAudit | null;
  onApprove: (auditId: string, notes?: string, adjustmentAmount?: number) => Promise<void>;
  onReject: (auditId: string, notes: string) => Promise<void>;
  isLoading?: boolean;
}

export function AuditCashClosingDialog({
  open,
  onOpenChange,
  audit,
  onApprove,
  onReject,
  isLoading = false,
}: AuditCashClosingDialogProps) {
  const [notes, setNotes] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);

  const handleClose = () => {
    if (!isLoading) {
      setNotes('');
      setAdjustmentAmount('');
      setAction(null);
      onOpenChange(false);
    }
  };

  const handleApprove = async () => {
    if (!audit) return;
    setAction('approve');
    const adjustment = adjustmentAmount ? parseFloat(adjustmentAmount.replace(',', '.')) : undefined;
    await onApprove(audit.id, notes || undefined, adjustment);
    handleClose();
  };

  const handleReject = async () => {
    if (!audit || !notes) return;
    setAction('reject');
    await onReject(audit.id, notes);
    handleClose();
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      dinheiro: 'Dinheiro',
      cartao: 'Cartão',
      pix: 'PIX',
      cartao_debito: 'Cartão Débito',
      cartao_credito: 'Cartão Crédito',
    };
    return labels[method] || method;
  };

  if (!audit) return null;

  const hasDifference = audit.difference !== 0;
  const hasAdjustment = adjustmentAmount && parseFloat(adjustmentAmount.replace(',', '.')) !== 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 bg-primary text-primary-foreground">
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-5 w-5 text-white animate-pulse" />
            Auditoria de Fechamento
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/80 text-xs">
            Revise a contagem do operador e tome uma decisão sobre o fechamento.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4">
          {/* Informações do operador */}
          <div className="grid grid-cols-2 gap-4">
            {/* Informações do operador */}
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                Operador
              </div>
              <p className="font-semibold text-sm truncate">{audit.operator_name}</p>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Clock className="h-3 w-3" />
                Submetido em
              </div>
              <p className="text-sm">{format(new Date(audit.submitted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
            </div>

            {/* Contagem por método de pagamento */}
            <div className="rounded-lg border p-3 space-y-2">
              <h4 className="font-semibold text-xs text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                <DollarSign className="h-3 w-3 text-primary" />
                Contagem Detalhada
              </h4>
              <div className="space-y-1 overflow-y-auto max-h-[80px] pr-1 scrollbar-thin">
                {audit.counts_submitted.map((count, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">{getPaymentMethodLabel(count.payment_method)}</span>
                    <span className="font-medium">{formatCurrency(count.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-2 text-center bg-muted/30">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Esperado</p>
              <p className="text-sm font-bold">{formatCurrency(audit.expected_amount)}</p>
            </div>
            <div className="rounded-lg border p-2 text-center bg-primary/5 border-primary/20">
              <p className="text-[10px] uppercase font-bold text-primary mb-1">Contado</p>
              <p className="text-sm font-bold text-primary">{formatCurrency(audit.total_counted)}</p>
            </div>
            <div className={`rounded-lg border p-2 text-center ${
              audit.difference === 0 ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
                : audit.difference > 0 ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
                : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
            }`}>
              <p className={`text-[10px] uppercase font-bold mb-1 ${
                audit.difference === 0 ? 'text-green-600' : audit.difference > 0 ? 'text-blue-600' : 'text-red-600'
              }`}>
                {audit.difference === 0 ? 'Conferido' : audit.difference > 0 ? 'Sobra' : 'Falta'}
              </p>
              <p className={`text-sm font-bold ${
                audit.difference === 0 ? 'text-green-700' : audit.difference > 0 ? 'text-blue-700' : 'text-red-700'
              }`}>
                {audit.difference >= 0 && audit.difference !== 0 ? '+' : ''}{formatCurrency(audit.difference)}
              </p>
            </div>
          </div>

          {/* Observações do operador */}
          {audit.operator_notes && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
              <p className="text-xs text-muted-foreground mb-1">Observação do operador:</p>
              <p className="text-sm">{audit.operator_notes}</p>
            </div>
          )}

          <Separator />

          {/* Campo de ajuste e Observações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {hasDifference && (
              <div className="space-y-2">
                <Label htmlFor="adjustment" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Ajuste de Valor
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="adjustment"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    className="pl-9 h-9 text-sm"
                    value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Ajusta o saldo final do caixa (positivo ou negativo).
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Observações {hasDifference ? '(obrigatório p/ rejeitar)' : '(opcional)'}
              </Label>
              <Textarea
                id="notes"
                placeholder="Motivo da decisão..."
                className="resize-none text-sm h-9 min-h-[36px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isLoading}
                rows={1}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t flex flex-row gap-2 justify-end">
          <Button 
            variant="ghost" 
            onClick={handleClose} 
            disabled={isLoading}
            className="text-xs h-9"
          >
            Sair
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleReject} 
              disabled={isLoading || !notes}
              className="text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-9"
            >
              {isLoading && action === 'reject' ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Rejeitando...</>
              ) : (
                <><XCircle className="mr-1 h-3 w-3" />Rejeitar</>
              )}
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={isLoading}
              className="text-xs h-9 shadow-sm bg-primary hover:bg-primary/90"
            >
              {isLoading && action === 'approve' ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Aprovando...</>
              ) : (
                <><CheckCircle2 className="mr-1 h-3 w-3" />{hasAdjustment ? 'Ajustar e Aprovar' : 'Aprovar'}</>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
