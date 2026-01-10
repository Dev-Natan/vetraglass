import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, CreditCard, Smartphone, TrendingUp } from 'lucide-react';

interface CaixaResumoProps {
  openingAmount: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  totalVendas: number;
}

export function CaixaResumo({
  openingAmount,
  totalDinheiro,
  totalCartao,
  totalPix,
  totalVendas,
}: CaixaResumoProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const cards = [
    {
      title: 'Abertura',
      value: openingAmount,
      icon: DollarSign,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-800',
    },
    {
      title: 'Dinheiro',
      value: totalDinheiro,
      icon: DollarSign,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900',
    },
    {
      title: 'Cartão/PIX',
      value: totalCartao + totalPix,
      icon: CreditCard,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    {
      title: 'Total Vendas',
      value: totalVendas,
      icon: TrendingUp,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
                <p className={`text-lg font-bold truncate ${card.color}`}>
                  {formatCurrency(card.value)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
