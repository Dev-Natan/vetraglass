import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, DollarSign } from 'lucide-react';

interface AjustarSaldoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBalance: number;
  onConfirm: (newBalance: number, reason?: string) => Promise<void>;
  isLoading?: boolean;
}

export function AjustarSaldoDialog({
  open,
  onOpenChange,
  currentBalance,
  onConfirm,
  isLoading = false,
}: AjustarSaldoDialogProps) {
  const [newBalance, setNewBalance] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setNewBalance(currentBalance.toString());
      setReason('');
    }
  }, [open, currentBalance]);

  const handleSubmit = async () => {
    const balance = parseFloat(newBalance.replace(',', '.'));
    if (isNaN(balance)) return;
    await onConfirm(balance, reason || undefined);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const parsedNewBalance = parseFloat(newBalance.replace(',', '.')) || 0;
  const difference = parsedNewBalance - currentBalance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Ajustar Saldo da Empresa
          </DialogTitle>
          <DialogDescription>
            Corrija o saldo real da empresa diretamente.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">Atenção</p>
            <p className="text-amber-700 dark:text-amber-300">
              Esta ação <strong>NÃO gera movimentação</strong> no histórico financeiro. 
              Use apenas para correções de valores incorretos.
            </p>
          </div>
        </div>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Saldo atual:</span>
            <span className="font-semibold">{formatCurrency(currentBalance)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newBalance">Novo saldo (R$)</Label>
            <Input
              id="newBalance"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
            />
          </div>

          {newBalance && parsedNewBalance !== currentBalance && (
            <div className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-2">
              <span className="text-muted-foreground">Diferença:</span>
              <span className={`font-semibold ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
              </span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da correção (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Correção do saldo inicial..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !newBalance || parsedNewBalance === currentBalance}
          >
            {isLoading ? 'Salvando...' : 'Confirmar Ajuste'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
