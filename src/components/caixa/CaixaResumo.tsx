import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CreditCard, TrendingUp, TrendingDown, Wallet, ArrowUpDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface CaixaResumoProps {
  openingAmount: number;
  totalDinheiro: number;
  totalCartao: number;
  totalPix: number;
  totalVendas: number;
  // Novas props para movimentações
  totalEntradas?: number;
  totalSaidas?: number;
  // Caixa da empresa
  companyCashBalance?: number;
}

export function CaixaResumo({
  openingAmount,
  totalDinheiro,
  totalCartao,
  totalPix,
  totalVendas,
  totalEntradas = 0,
  totalSaidas = 0,
  companyCashBalance,
}: CaixaResumoProps) {
  const formatCurrency = (value: number | null | undefined) => {
    return (value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Saldo consolidado do dia: Abertura + TODAS entradas (dinheiro+pix+cartão+outras) - saídas
  const saldoDinheiro = openingAmount + totalDinheiro + totalCartao + totalPix + totalEntradas - totalSaidas;

  const hasCompanyCash = companyCashBalance !== undefined;

  const handlePrintDailyReport = () => {
    window.print();
  };

  const totalEntradasDia = totalDinheiro + totalCartao + totalPix + totalEntradas;
  const movimentacoesDia = totalEntradasDia - totalSaidas;
  const saldoTotal = openingAmount + movimentacoesDia;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Resumo Diário</h2>
        <Button variant="outline" size="sm" onClick={handlePrintDailyReport} className="gap-2 print:hidden">
          <Printer className="h-4 w-4" />
          Imprimir Relatório
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Abertura */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Abertura</p>
                <p className="text-2xl font-bold text-primary truncate">
                  {formatCurrency(openingAmount)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Valor informado na abertura</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Movimentações do Dia */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <ArrowUpDown className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Movimentações do Dia</p>
                <p className={`text-2xl font-bold truncate ${movimentacoesDia >= 0 ? 'text-primary' : 'text-red-600'}`}>
                  {movimentacoesDia >= 0 ? '+' : ''}{formatCurrency(movimentacoesDia)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Entradas {formatCurrency(totalEntradasDia)} − Saídas {formatCurrency(totalSaidas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Total Atualizado */}
        <Card className="border-primary/40 bg-primary/10">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Saldo Total Atualizado</p>
                <p className="text-2xl font-bold text-primary truncate">
                  {formatCurrency(saldoTotal)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Abertura + Movimentações</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
