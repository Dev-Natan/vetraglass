import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Settings, 
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MovimentoCaixaEmpresaDialog } from '@/components/caixa/MovimentoCaixaEmpresaDialog';
import { CaixaAdiantamentosCard } from '@/components/caixa/CaixaAdiantamentosCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export function CaixaEmpresaTab() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [dialogType, setDialogType] = useState<'entrada' | 'saida' | 'config' | null>(null);

  // Fetch company cash
  const { data: companyCash, isLoading: loadingCash } = useQuery({
    queryKey: ['company-cash', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('company_cash')
        .select('*')
        .eq('company_id', currentCompany.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch company cash movements
  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ['company-cash-movements', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_cash_movements')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Configure company cash
  const configMutation = useMutation({
    mutationFn: async ({ initialBalance, fixedFund }: { initialBalance: number; fixedFund: number }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      const { data, error } = await supabase.rpc('initialize_company_cash', {
        _company_id: currentCompany.id,
        _initial_balance: initialBalance,
        _fixed_fund: fixedFund,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Caixa da empresa configurado!');
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      setDialogType(null);
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  // Register movement
  const movementMutation = useMutation({
    mutationFn: async ({ type, category, amount, description }: { type: string; category: string; amount: number; description: string }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      const { data, error } = await supabase.rpc('register_company_cash_movement', {
        _company_id: currentCompany.id,
        _type: type,
        _category: category,
        _amount: amount,
        _description: description,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Movimentação registrada!');
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash-movements'] });
      setDialogType(null);
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      abertura_caixa: 'Abertura de Caixa',
      fechamento_caixa: 'Fechamento de Caixa',
      reforco_caixa: 'Reforço de Caixa',
      recolhimento: 'Recolhimento',
      deposito: 'Depósito',
      retirada: 'Retirada',
      ajuste: 'Ajuste',
      compensacao: 'Compensação',
      outro: 'Outro',
    };
    return labels[category] || category;
  };

  if (loadingCash) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!companyCash) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Caixa da Empresa não configurado</h3>
          <p className="text-muted-foreground mb-4">
            Configure o caixa da empresa para começar a controlar o fluxo financeiro.
          </p>
          <Button onClick={() => setDialogType('config')}>
            <Settings className="mr-2 h-4 w-4" />
            Configurar Caixa
          </Button>

          <MovimentoCaixaEmpresaDialog
            open={dialogType !== null}
            onOpenChange={(open) => !open && setDialogType(null)}
            type={dialogType || 'config'}
            currentBalance={0}
            fixedFund={500}
            onConfirm={async (data) => {
              if (data.initialBalance !== undefined) {
                await configMutation.mutateAsync({ initialBalance: data.initialBalance, fixedFund: data.fixedFund || 500 });
              }
            }}
            isLoading={configMutation.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  const isBalanceLow = companyCash.current_balance < companyCash.fixed_fund;

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Saldo Atual */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${companyCash.current_balance < 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(companyCash.current_balance)}
            </div>
            {isBalanceLow && (
              <div className="flex items-center gap-1 mt-2 text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Abaixo do fundo fixo</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fundo Fixo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fundo Fixo</CardTitle>
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(companyCash.fixed_fund)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor reservado para operações diárias
            </p>
          </CardContent>
        </Card>

        {/* Ações */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => setDialogType('entrada')}
            >
              <ArrowDownCircle className="h-4 w-4 text-green-600" />
              Depósito
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2"
              onClick={() => setDialogType('saida')}
              disabled={companyCash.current_balance <= 0}
            >
              <ArrowUpCircle className="h-4 w-4 text-red-600" />
              Retirada
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Adiantamentos Pendentes */}
      <CaixaAdiantamentosCard />

      {/* Histórico de Movimentações */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Movimentações
          </CardTitle>
          <Badge variant="secondary">{movements.length} registros</Badge>
        </CardHeader>
        <CardContent>
          {loadingMovements ? (
            <div className="h-32 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma movimentação registrada
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Saldo Após</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {movement.type === 'entrada' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Entrada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Saída
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getCategoryLabel(movement.category)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{movement.description}</TableCell>
                      <TableCell className={`text-right font-medium ${movement.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                        {movement.type === 'entrada' ? '+' : '-'}{formatCurrency(movement.amount)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(movement.balance_after)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <MovimentoCaixaEmpresaDialog
        open={dialogType !== null}
        onOpenChange={(open) => !open && setDialogType(null)}
        type={dialogType || 'config'}
        currentBalance={companyCash.current_balance}
        fixedFund={companyCash.fixed_fund}
        onConfirm={async (data) => {
          if (data.initialBalance !== undefined) {
            await configMutation.mutateAsync({ initialBalance: data.initialBalance, fixedFund: data.fixedFund || 500 });
          } else if (data.type && data.category && data.amount && data.description) {
            await movementMutation.mutateAsync({ type: data.type, category: data.category, amount: data.amount, description: data.description });
          }
        }}
        isLoading={configMutation.isPending || movementMutation.isPending}
      />
    </div>
  );
}
