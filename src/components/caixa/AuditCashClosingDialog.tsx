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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Auditoria de Fechamento
          </DialogTitle>
          <DialogDescription>
            Revise a contagem do operador e aprove ou rejeite o fechamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informações do operador */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                Operador
              </span>
              <span className="font-medium">{audit.operator_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Submetido em
              </span>
              <span>{format(new Date(audit.submitted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>
          </div>

          {/* Contagem por método de pagamento */}
          <div className="rounded-lg border p-3 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Contagem Informada
            </h4>
            <div className="grid grid-cols-2 gap-1 text-sm pl-4">
              {audit.counts_submitted.map((count, idx) => (
                <div key={idx} className="contents">
                  <span className="text-muted-foreground">{getPaymentMethodLabel(count.payment_method)}:</span>
                  <span className="text-right font-medium">{formatCurrency(count.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Contado</p>
              <p className="text-lg font-bold text-primary">{formatCurrency(audit.total_counted)}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Esperado</p>
              <p className="text-lg font-bold">{formatCurrency(audit.expected_amount)}</p>
            </div>
          </div>

          {/* Diferença */}
          <div className={`rounded-lg border p-3 ${
            audit.difference === 0 ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
              : audit.difference > 0 ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
              : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium text-sm">
                {audit.difference === 0 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 dark:text-green-400">Caixa conferido</span>
                  </>
                ) : audit.difference > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-blue-700 dark:text-blue-400">Sobra</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span className="text-red-700 dark:text-red-400">Falta</span>
                  </>
                )}
              </span>
              <Badge variant={audit.difference === 0 ? 'default' : audit.difference > 0 ? 'secondary' : 'destructive'}>
                {audit.difference >= 0 ? '+' : ''}{formatCurrency(audit.difference)}
              </Badge>
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

          {/* Campo de ajuste (opcional) */}
          {hasDifference && (
            <div className="space-y-2">
              <Label htmlFor="adjustment">Ajuste de Valor (opcional)</Label>
              <Input
                id="adjustment"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Informe um valor para ajustar a contagem (positivo ou negativo).
              </p>
            </div>
          )}

          {/* Observações do auditor */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Observações do Auditor {hasDifference ? '(obrigatório para rejeição)' : '(opcional)'}
            </Label>
            <Textarea
              id="notes"
              placeholder="Justificativa ou observações..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleReject} 
            disabled={isLoading || !notes}
          >
            {isLoading && action === 'reject' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rejeitando...</>
            ) : (
              <><XCircle className="mr-2 h-4 w-4" />Rejeitar</>
            )}
          </Button>
          <Button 
            onClick={handleApprove} 
            disabled={isLoading}
          >
            {isLoading && action === 'approve' ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aprovando...</>
            ) : (
              <><CheckCircle2 className="mr-2 h-4 w-4" />{hasAdjustment ? 'Ajustar e Aprovar' : 'Aprovar'}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
