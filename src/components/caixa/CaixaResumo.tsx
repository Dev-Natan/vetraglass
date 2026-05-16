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
  fixedFund?: number;
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
  fixedFund,
}: CaixaResumoProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Cálculo do saldo em dinheiro físico no caixa
  const saldoDinheiro = openingAmount + totalDinheiro + totalEntradas - totalSaidas;
  
  // Excedente (o que vai para empresa no fechamento)
  const excedente = fixedFund ? Math.max(0, saldoDinheiro - fixedFund) : 0;

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

        {/* Total Vendas */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Total Vendas</p>
                <p className="text-lg font-bold truncate text-primary">
                  {formatCurrency(totalVendas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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

            {fixedFund !== undefined && excedente > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                <div className="flex justify-between">
                  <span>Excedente previsto (fechamento):</span>
                  <span className="text-green-600 font-medium">{formatCurrency(excedente)}</span>
                </div>
              </div>
            )}
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
                {totalEntradas > 0 && (
                  <>
                    <span className="text-muted-foreground">Outras:</span>
                    <span className="text-right">{formatCurrency(totalEntradas)}</span>
                  </>
                )}
                <span className="font-medium">Total:</span>
                <span className="text-right font-medium text-green-600">
                  {formatCurrency(totalDinheiro + totalEntradas)}
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
                <span className="font-medium">Total:</span>
                <span className="text-right font-medium text-red-600">
                  {formatCurrency(totalSaidas)}
                </span>
              </div>
            </div>

            {/* Saldo Líquido */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Resultado do Dia:</span>
                <span className={`font-bold ${(totalDinheiro + totalEntradas - totalSaidas) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(totalDinheiro + totalEntradas - totalSaidas)}
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
              {fixedFund !== undefined && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Fundo fixo</p>
                  <p className="text-sm font-medium">{formatCurrency(fixedFund)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
