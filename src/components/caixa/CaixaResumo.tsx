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

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Resumo Diário</h2>
        <Button variant="outline" size="sm" onClick={handlePrintDailyReport} className="gap-2 print:hidden">
          <Printer className="h-4 w-4" />
          Imprimir Relatório
        </Button>
      </div>
      
      {/* Cards de Resumo Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Abertura */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <DollarSign className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Abertura</p>
                <p className="text-lg font-bold truncate text-slate-600 dark:text-slate-400">
                  {formatCurrency(openingAmount)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendas Dinheiro */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Vendas Dinheiro</p>
                <p className="text-lg font-bold truncate text-green-600 dark:text-green-400">
                  {formatCurrency(totalDinheiro)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendas Cartão/PIX */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Cartão/PIX</p>
                <p className="text-lg font-bold truncate text-blue-600 dark:text-blue-400">
                  {formatCurrency(totalCartao + totalPix)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Total do Caixa (Abertura + Vendas + Entradas - Saídas) */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Saldo Total do Caixa</p>
                <p className="text-lg font-bold truncate text-primary">
                  {formatCurrency(openingAmount + totalVendas + totalEntradas - totalSaidas)}
                </p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  Abertura + Vendas + Entradas − Saídas
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Faixa: Abertura e Total consolidado */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Valor de Abertura</span>
              <p className="font-semibold sm:mt-1">{formatCurrency(openingAmount)}</p>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Movimentação Líquida</span>
              <p className={`font-semibold sm:mt-1 ${(totalVendas + totalEntradas - totalSaidas) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {(totalVendas + totalEntradas - totalSaidas) >= 0 ? '+' : ''}
                {formatCurrency(totalVendas + totalEntradas - totalSaidas)}
              </p>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-muted-foreground">Total Consolidado</span>
              <p className="font-bold text-primary sm:mt-1">
                {formatCurrency(openingAmount + totalVendas + totalEntradas - totalSaidas)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards Secundários - Saldo e Movimentações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Saldo em Dinheiro (Caixa Físico) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Saldo em Dinheiro (Caixa Físico)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Abertura:</span>
              <span className="text-right">{formatCurrency(openingAmount)}</span>
              
              <span className="text-muted-foreground">+ Vendas dinheiro:</span>
              <span className="text-right text-green-600">+{formatCurrency(totalDinheiro)}</span>
              
              {totalEntradas > 0 && (
                <>
                  <span className="text-muted-foreground">+ Outras entradas:</span>
                  <span className="text-right text-green-600">+{formatCurrency(totalEntradas)}</span>
                </>
              )}
              
              {totalSaidas > 0 && (
                <>
                  <span className="text-muted-foreground">- Saídas:</span>
                  <span className="text-right text-red-600">-{formatCurrency(totalSaidas)}</span>
                </>
              )}
            </div>
            
            <Separator />
            
            <div className="flex justify-between items-center">
              <span className="font-medium">Saldo Atual:</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(saldoDinheiro)}</span>
            </div>

          </CardContent>
        </Card>

        {/* Movimentações do Dia */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Movimentações do Dia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Entradas */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <TrendingUp className="h-4 w-4" />
                Entradas
              </div>
              <div className="grid grid-cols-2 gap-1 text-sm pl-6">
                <span className="text-muted-foreground">Vendas dinheiro:</span>
                <span className="text-right">{formatCurrency(totalDinheiro)}</span>
                <span className="text-muted-foreground">Vendas cartão:</span>
                <span className="text-right">{formatCurrency(totalCartao)}</span>
                <span className="text-muted-foreground">Vendas PIX:</span>
                <span className="text-right">{formatCurrency(totalPix)}</span>
                {totalEntradas > 0 && (
                  <>
                    <span className="text-muted-foreground">Outras:</span>
                    <span className="text-right">{formatCurrency(totalEntradas)}</span>
                  </>
                )}
                <span className="font-medium pt-1 border-t">Total:</span>
                <span className="text-right font-medium text-green-600 pt-1 border-t">
                  {formatCurrency(totalDinheiro + totalCartao + totalPix + totalEntradas)}
                </span>
              </div>
            </div>

            <Separator />

            {/* Saídas */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                <TrendingDown className="h-4 w-4" />
                Saídas
              </div>
              <div className="grid grid-cols-2 gap-1 text-sm pl-6">
                {totalSaidas > 0 ? (
                  <>
                    <span className="text-muted-foreground">Sangrias/Despesas:</span>
                    <span className="text-right">{formatCurrency(totalSaidas)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground italic">Nenhuma saída</span>
                    <span className="text-right">-</span>
                  </>
                )}
                <span className="font-medium pt-1 border-t">Total:</span>
                <span className="text-right font-medium text-red-600 pt-1 border-t">
                  {formatCurrency(totalSaidas)}
                </span>
              </div>
            </div>

            {/* Saldo Líquido */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Resultado do Dia:</span>
                <span className={`font-bold ${(totalVendas + totalEntradas - totalSaidas) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalVendas + totalEntradas - totalSaidas)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card do Caixa da Empresa (se disponível) */}
      {hasCompanyCash && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Caixa da Empresa</p>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(companyCashBalance || 0)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
