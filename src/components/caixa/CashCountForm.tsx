import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Banknote, CreditCard, Smartphone, HelpCircle } from 'lucide-react';

interface CashCount {
  payment_method: string;
  amount: number;
}

interface CashCountFormProps {
  expectedCash: number;
  expectedCardDebit?: number;
  expectedCardCredit?: number;
  expectedPix?: number;
  onChange: (counts: CashCount[], total: number) => void;
}

const PAYMENT_METHODS = [
  { key: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-green-600' },
  { key: 'pix', label: 'PIX', icon: Smartphone, color: 'text-purple-600' },
  { key: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard, color: 'text-blue-600' },
  { key: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard, color: 'text-orange-600' },
  { key: 'outros', label: 'Outros', icon: HelpCircle, color: 'text-gray-600' },
];

export function CashCountForm({
  expectedCash,
  expectedCardDebit = 0,
  expectedCardCredit = 0,
  expectedPix = 0,
  onChange,
}: CashCountFormProps) {
  const [values, setValues] = useState<Record<string, string>>({
    dinheiro: '',
    pix: '',
    cartao_debito: '',
    cartao_credito: '',
    outros: '',
  });

  const expectedValues = useMemo(() => ({
    dinheiro: expectedCash,
    pix: expectedPix,
    cartao_debito: expectedCardDebit,
    cartao_credito: expectedCardCredit,
    outros: 0,
  }), [expectedCash, expectedPix, expectedCardDebit, expectedCardCredit]);

  useEffect(() => {
    const counts: CashCount[] = [];
    let total = 0;

    Object.entries(values).forEach(([method, valueStr]) => {
      const amount = parseFloat(valueStr.replace(',', '.')) || 0;
      counts.push({ payment_method: method, amount });
      total += amount;
    });

    onChange(counts, total);
  }, [values, onChange]);

  const handleChange = (method: string, value: string) => {
    setValues(prev => ({ ...prev, [method]: value }));
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getVariance = (method: string) => {
    const expected = expectedValues[method as keyof typeof expectedValues] || 0;
    const actual = parseFloat(values[method]?.replace(',', '.') || '0') || 0;
    return actual - expected;
  };

  const totalExpected = Object.values(expectedValues).reduce((sum, v) => sum + v, 0);
  const totalActual = Object.values(values).reduce((sum, v) => {
    return sum + (parseFloat(v.replace(',', '.')) || 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Banknote className="h-4 w-4" />
          Contagem de Caixa
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Informe o valor contado para cada forma de pagamento
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {PAYMENT_METHODS.map(({ key, label, icon: Icon, color }) => {
          const expected = expectedValues[key as keyof typeof expectedValues] || 0;
          const actual = parseFloat(values[key]?.replace(',', '.') || '0') || 0;
          const variance = actual - expected;
          const hasValue = values[key] !== '';

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={`count-${key}`} className="text-sm flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${color}`} />
                  {label}
                </Label>
                <span className="text-xs text-muted-foreground">
                  Esperado: {formatCurrency(expected)}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <Input
                  id={`count-${key}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={values[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="flex-1"
                />
                {hasValue && (
                  <Badge
                    variant={variance === 0 ? 'secondary' : variance > 0 ? 'default' : 'destructive'}
                    className="min-w-[80px] justify-center"
                  >
                    {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}

        <Separator className="my-3" />

        <div className="flex justify-between items-center font-medium">
          <span className="text-sm">Total Esperado:</span>
          <span className="text-primary">{formatCurrency(totalExpected)}</span>
        </div>
        <div className="flex justify-between items-center font-medium">
          <span className="text-sm">Total Contado:</span>
          <span className={totalActual === totalExpected ? 'text-green-600' : totalActual > totalExpected ? 'text-blue-600' : 'text-red-600'}>
            {formatCurrency(totalActual)}
          </span>
        </div>
        {totalActual !== 0 && (
          <div className={`flex justify-between items-center text-sm ${
            totalActual - totalExpected === 0 ? 'text-green-600' : 
            totalActual - totalExpected > 0 ? 'text-blue-600' : 'text-red-600'
          }`}>
            <span>Diferença:</span>
            <span className="font-medium">
              {totalActual - totalExpected >= 0 ? '+' : ''}{formatCurrency(totalActual - totalExpected)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
