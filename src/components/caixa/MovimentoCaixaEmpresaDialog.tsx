import { useState, useEffect } from 'react';
import {
import { parseCurrencyBRL } from '@/utils/currencyMask';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowDownCircle, ArrowUpCircle, Wallet, Settings } from 'lucide-react';

type MovementType = 'entrada' | 'saida';
type EntradaCategory = 'deposito' | 'ajuste_positivo';
type SaidaCategory = 'retirada' | 'transferencia_banco' | 'ajuste_negativo';

interface MovimentoCaixaEmpresaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: MovementType | 'config';
  currentBalance?: number;
  fixedFund?: number;
  isEditMode?: boolean; // true when editing existing config
  onConfirm: (data: {
    type?: MovementType;
    category?: string;
    amount?: number;
    description?: string;
    initialBalance?: number;
    fixedFund?: number;
  }) => Promise<unknown>;
  isLoading?: boolean;
}

const entradaCategories: { value: EntradaCategory; label: string }[] = [
  { value: 'deposito', label: 'Depósito / Aporte de Capital' },
  { value: 'ajuste_positivo', label: 'Ajuste de Inventário' },
];

const saidaCategories: { value: SaidaCategory; label: string }[] = [
  { value: 'retirada', label: 'Retirada de Sócio' },
  { value: 'transferencia_banco', label: 'Transferência Bancária' },
  { value: 'ajuste_negativo', label: 'Ajuste de Inventário' },
];

export function MovimentoCaixaEmpresaDialog({
  open,
  onOpenChange,
  type,
  currentBalance = 0,
  fixedFund = 500,
  isEditMode = false,
  onConfirm,
  isLoading = false,
}: MovimentoCaixaEmpresaDialogProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [newFixedFund, setNewFixedFund] = useState(fixedFund.toString());

  // Sync state when dialog opens or prop changes
  useEffect(() => {
    if (open) {
      setNewFixedFund(fixedFund.toString());
    }
  }, [open, fixedFund]);

  const handleConfirm = async () => {
    if (type === 'config') {
      await onConfirm({
        initialBalance: parseCurrencyBRL(initialBalance),
        fixedFund: (parseCurrencyBRL(newFixedFund) || 500),
      });
    } else {
      const parsedAmount = parseCurrencyBRL(amount);
      if (parsedAmount <= 0) return;
      
      await onConfirm({
        type,
        category,
        amount: parsedAmount,
        description,
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setAmount('');
    setCategory('');
    setDescription('');
    setInitialBalance('');
    setNewFixedFund(fixedFund.toString());
  };

  const handleClose = () => {
    if (!isLoading) {
      resetForm();
      onOpenChange(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const parsedAmount = parseCurrencyBRL(amount);
  const isValidAmount = parsedAmount > 0;
  const hasEnoughBalance = type === 'saida' ? currentBalance >= parsedAmount : true;

  // Config mode
  if (type === 'config') {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {isEditMode ? 'Configurar Caixa da Empresa' : 'Configurar Caixa da Empresa'}
            </DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? 'Configure o saldo e fundo fixo do caixa da empresa.'
                : 'Defina o saldo inicial e o fundo fixo do caixa da empresa.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="initial-balance" className="flex items-center gap-2">
                  💰 Saldo Real da Empresa (R$)
                </Label>
                <Input
                  id="initial-balance"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  disabled={isLoading}
                  className="text-lg"
                />
                <p className="text-xs text-muted-foreground">
                  Informe quanto a empresa possui REALMENTE em caixa físico ou conta bancária no momento.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fixed-fund" className="flex items-center gap-2">
                💵 Fundo Fixo para Abertura de Caixa (R$)
              </Label>
              <Input
                id="fixed-fund"
                type="text"
                inputMode="decimal"
                placeholder="500,00"
                value={newFixedFund}
                onChange={(e) => setNewFixedFund(e.target.value)}
                disabled={isLoading}
                className="text-lg"
              />
              <p className="text-xs text-muted-foreground">
                Valor que será disponibilizado para abertura dos caixas do dia. 
                Este valor é usado como troco inicial e para cobrir pequenas despesas durante as operações.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const categories = type === 'entrada' ? entradaCategories : saidaCategories;
  const Icon = type === 'entrada' ? ArrowDownCircle : ArrowUpCircle;
  const iconColor = type === 'entrada' ? 'text-green-600' : 'text-red-600';
  const title = type === 'entrada' ? 'Entrada no Caixa da Empresa' : 'Saída do Caixa da Empresa';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            {title}
          </DialogTitle>
          <DialogDescription>
            Saldo atual: {formatCurrency(currentBalance)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isLoading}
              className="text-lg"
            />
            {type === 'saida' && isValidAmount && !hasEnoughBalance && (
              <p className="text-xs text-destructive">
                Saldo insuficiente. Disponível: {formatCurrency(currentBalance)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              placeholder="Descreva o motivo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={2}
            />
          </div>

          {isValidAmount && hasEnoughBalance && (
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Novo saldo:</span>
                <span className="font-medium">
                  {formatCurrency(
                    type === 'entrada' 
                      ? currentBalance + parsedAmount 
                      : currentBalance - parsedAmount
                  )}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || !isValidAmount || !category || !description || !hasEnoughBalance}
            variant={type === 'saida' ? 'destructive' : 'default'}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              `Confirmar ${type === 'entrada' ? 'Entrada' : 'Saída'}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
