import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Settings, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface CompanyCash {
  id: string;
  current_balance: number;
  fixed_fund: number;
  last_movement_at: string | null;
}

interface CaixaEmpresaCardProps {
  companyCash: CompanyCash | null;
  isLoading?: boolean;
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onConfigure?: () => void;
}

export function CaixaEmpresaCard({
  companyCash,
  isLoading = false,
  onDeposit,
  onWithdraw,
  onConfigure,
}: CaixaEmpresaCardProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!companyCash) {
    return (
      <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-5 w-5" />
            Caixa da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O caixa da empresa ainda não foi configurado. Configure o saldo inicial para começar.
          </p>
          <Button size="sm" onClick={onConfigure}>
            <Settings className="mr-2 h-4 w-4" />
            Configurar Caixa
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasEnoughForDailyCash = companyCash.current_balance >= companyCash.fixed_fund;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Caixa da Empresa
          </CardTitle>
          <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            Fundo fixo: {formatCurrency(companyCash.fixed_fund)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Saldo Disponível</p>
          <p className={`text-3xl font-bold ${companyCash.current_balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatCurrency(companyCash.current_balance)}
          </p>
          {!hasEnoughForDailyCash && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Saldo insuficiente para abrir caixa do dia
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onDeposit}>
            <ArrowDownCircle className="mr-2 h-4 w-4 text-green-600" />
            Depósito
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onWithdraw}
            disabled={companyCash.current_balance <= 0}
          >
            <ArrowUpCircle className="mr-2 h-4 w-4 text-red-600" />
            Retirada
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
