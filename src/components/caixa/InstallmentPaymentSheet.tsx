import { parseCurrencyBRL } from '@/utils/currencyMask';
import { useState, useMemo } from 'react';
import { addDays, addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, CreditCard, Smartphone, Banknote, Calculator } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type PaymentType = 'full' | 'partial' | 'installment';
export type PaymentMethod = 'dinheiro' | 'cartao' | 'pix' | 'boleto' | 'transferencia';

export interface InstallmentData {
  number: number;
  dueDate: Date;
  amount: number;
}

export interface PaymentConfig {
  type: PaymentType;
  method: PaymentMethod;
  paidAmount: number;
  installmentsCount: number;
  installments: InstallmentData[];
  firstDueDate: Date;
}

interface InstallmentPaymentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  onConfirm: (config: PaymentConfig) => void;
  /** Valor de entrada já recebida (depósitos de orçamento) — preenchido automaticamente e não editável */
  quoteDepositAmount?: number;
}

const paymentMethodConfig = {
  dinheiro: { label: 'Dinheiro', icon: DollarSign },
  cartao: { label: 'Cartão', icon: CreditCard },
  pix: { label: 'PIX', icon: Smartphone },
  boleto: { label: 'Boleto', icon: Banknote },
  transferencia: { label: 'Transferência', icon: Banknote },
};

export function InstallmentPaymentSheet({
  open,
  onOpenChange,
  totalAmount,
  onConfirm,
  quoteDepositAmount = 0,
}: InstallmentPaymentSheetProps) {
  const hasQuoteDeposit = quoteDepositAmount > 0;
  const effectiveTotal = hasQuoteDeposit ? Math.max(0, totalAmount - quoteDepositAmount) : totalAmount;
  
  const [paymentType, setPaymentType] = useState<PaymentType>('full');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('dinheiro');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [installmentsCount, setInstallmentsCount] = useState(2);
  const [firstDueDays, setFirstDueDays] = useState(30);

  const paidAmount = useMemo(() => {
    if (paymentType === 'full') return effectiveTotal;
    return parseCurrencyBRL(paidAmountStr);
  }, [paymentType, paidAmountStr, effectiveTotal]);

  const remainingAmount = effectiveTotal - paidAmount;

  // Generate installments preview
  const installments = useMemo((): InstallmentData[] => {
    if (paymentType === 'full') return [];
    
    const count = paymentType === 'partial' ? 1 : installmentsCount;
    const baseAmount = Math.floor((remainingAmount / count) * 100) / 100;
    const remainder = remainingAmount - (baseAmount * count);
    
    const firstDueDate = addDays(new Date(), firstDueDays);
    
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      dueDate: addMonths(firstDueDate, i),
      amount: i === 0 ? baseAmount + remainder : baseAmount,
    }));
  }, [paymentType, remainingAmount, installmentsCount, firstDueDays]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleConfirm = () => {
    onConfirm({
      type: paymentType,
      method: paymentMethod,
      paidAmount,
      installmentsCount: paymentType === 'full' ? 1 : installmentsCount,
      installments,
      firstDueDate: installments[0]?.dueDate || new Date(),
    });
    onOpenChange(false);
  };

  const isValid = useMemo(() => {
    if (paymentType === 'full') return true;
    if (paidAmount < 0) return false;
    if (paidAmount >= effectiveTotal) return false;
    if (remainingAmount <= 0) return false;
    return true;
  }, [paymentType, paidAmount, effectiveTotal, remainingAmount]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Configurar Pagamento
          </SheetTitle>
          <SheetDescription>
            Valor total: <strong className="text-foreground">{formatCurrency(totalAmount)}</strong>
            {hasQuoteDeposit && (
              <>
                <br />
                <span className="text-amber-600">Entrada já recebida: {formatCurrency(quoteDepositAmount)}</span>
                <br />
                <span className="font-semibold">Restante a cobrar: <strong className="text-foreground">{formatCurrency(effectiveTotal)}</strong></span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 pr-4 mt-6">
          <div className="space-y-6">
            {/* Payment Type */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Tipo de Pagamento</Label>
              <RadioGroup
                value={paymentType}
                onValueChange={(v) => {
                  setPaymentType(v as PaymentType);
                  if (v === 'full') {
                    setPaidAmountStr('');
                  }
                }}
                className="grid grid-cols-3 gap-2"
              >
                <Label
                  htmlFor="type-full"
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    paymentType === 'full' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="full" id="type-full" className="sr-only" />
                  <span className="text-sm font-medium">À Vista</span>
                  <span className="text-xs text-muted-foreground mt-1">100% agora</span>
                </Label>

                <Label
                  htmlFor="type-partial"
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    paymentType === 'partial' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="partial" id="type-partial" className="sr-only" />
                  <span className="text-sm font-medium">Entrada</span>
                  <span className="text-xs text-muted-foreground mt-1">+ saldo depois</span>
                </Label>

                <Label
                  htmlFor="type-installment"
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    paymentType === 'installment' ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                  }`}
                >
                  <RadioGroupItem value="installment" id="type-installment" className="sr-only" />
                  <span className="text-sm font-medium">Parcelado</span>
                  <span className="text-xs text-muted-foreground mt-1">Várias parcelas</span>
                </Label>
              </RadioGroup>
            </div>

            {/* Payment Method */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Forma de Pagamento</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                className="grid grid-cols-3 gap-2"
              >
                {Object.entries(paymentMethodConfig).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <Label
                      key={key}
                      htmlFor={`method-${key}`}
                      className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        paymentMethod === key ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value={key} id={`method-${key}`} className="sr-only" />
                      <Icon className="w-4 h-4" />
                      <span className="text-sm">{config.label}</span>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Entry Amount (for partial/installment) */}
            {paymentType !== 'full' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Valor da Entrada</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={paidAmountStr}
                    onChange={(e) => setPaidAmountStr(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {paidAmount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Saldo restante: <strong className="text-foreground">{formatCurrency(remainingAmount)}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Installments Count (for installment type) */}
            {paymentType === 'installment' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Número de Parcelas</Label>
                <Select
                  value={String(installmentsCount)}
                  onValueChange={(v) => setInstallmentsCount(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}x de {formatCurrency(remainingAmount / n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* First Due Date */}
            {paymentType !== 'full' && remainingAmount > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Primeiro Vencimento</Label>
                <Select
                  value={String(firstDueDays)}
                  onValueChange={(v) => setFirstDueDays(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 dias - {format(addDays(new Date(), 7), 'dd/MM/yyyy', { locale: ptBR })}</SelectItem>
                    <SelectItem value="15">15 dias - {format(addDays(new Date(), 15), 'dd/MM/yyyy', { locale: ptBR })}</SelectItem>
                    <SelectItem value="30">30 dias - {format(addDays(new Date(), 30), 'dd/MM/yyyy', { locale: ptBR })}</SelectItem>
                    <SelectItem value="45">45 dias - {format(addDays(new Date(), 45), 'dd/MM/yyyy', { locale: ptBR })}</SelectItem>
                    <SelectItem value="60">60 dias - {format(addDays(new Date(), 60), 'dd/MM/yyyy', { locale: ptBR })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Installments Preview */}
            {installments.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Parcelas a Receber
                </Label>
                <div className="space-y-2 rounded-lg border p-3 bg-muted/20">
                  {installments.map((inst) => (
                    <div key={inst.number} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Parcela {inst.number}/{installments.length} - {format(inst.dueDate, 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <span className="font-medium">{formatCurrency(inst.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary */}
            <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor do Orçamento</span>
                <span className="font-medium">{formatCurrency(totalAmount)}</span>
              </div>
              {hasQuoteDeposit && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Entrada já recebida</span>
                  <span className="font-medium text-amber-600">-{formatCurrency(quoteDepositAmount)}</span>
                </div>
              )}
              {hasQuoteDeposit && (
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground font-medium">Restante a cobrar</span>
                  <span className="font-bold">{formatCurrency(effectiveTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagamento agora</span>
                <span className="font-medium text-green-600">{formatCurrency(paidAmount)}</span>
              </div>
              {remainingAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">A Receber</span>
                  <span className="font-medium text-orange-600">{formatCurrency(remainingAmount)}</span>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            Confirmar Pagamento
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
