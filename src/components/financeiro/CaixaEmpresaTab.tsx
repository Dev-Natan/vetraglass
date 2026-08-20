import { useState, useMemo, useEffect } from 'react';
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
  ArrowDownCircle,
  ArrowUpCircle,
  History,
  Wallet,
  Lock,
  Unlock,
  DollarSign,
  CreditCard,
  Smartphone
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MovimentoCaixaEmpresaDialog } from '@/components/caixa/MovimentoCaixaEmpresaDialog';
import { CaixaAdiantamentosCard } from '@/components/caixa/CaixaAdiantamentosCard';
import { FecharCaixaDialog } from '@/components/caixa/FecharCaixaDialog';
import { MonthSelector } from '@/components/common/MonthSelector';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CaixaEmpresaTabProps {
  selectedMonth?: Date;
  onMonthChange?: (date: Date) => void;
}

export function CaixaEmpresaTab({ selectedMonth: externalMonth, onMonthChange }: CaixaEmpresaTabProps) {
  const { currentCompany, user } = useAuth();
  const queryClient = useQueryClient();
  
  // Use internal state if no external control
  const [internalMonth, setInternalMonth] = useState(new Date());
  const selectedMonth = externalMonth ?? internalMonth;
  const handleMonthChange = onMonthChange ?? setInternalMonth;
  
  const dateRange = { start: startOfMonth(selectedMonth), end: endOfMonth(selectedMonth) };
  
  const [dialogType, setDialogType] = useState<'entrada' | 'saida' | 'config' | null>(null);
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false);

  // Fetch company cash (Cofre Central — não é caixa operacional)
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

  // Fetch open cash register — único por empresa, sem filtro por usuário.
  // "Caixa e Venda" e "Financeiro" devem consumir o MESMO cash_register.id.
  const { data: openCashRegister, isLoading: loadingCashRegister } = useQuery({
    queryKey: ['cash-register-open', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('cash_registers')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('status', 'open')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch today sales (for cash register)
  const { data: todaySales = [] } = useQuery({
    queryKey: ['sales-today', openCashRegister?.id],
    queryFn: async () => {
      if (!openCashRegister?.id) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('cash_register_id', openCashRegister.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!openCashRegister?.id,
  });

  // Fetch cash movements (for daily cash)
  const { data: dailyCashMovements = [] } = useQuery({
    queryKey: ['cash-movements', openCashRegister?.id],
    queryFn: async () => {
      if (!openCashRegister?.id) return [];
      const { data, error } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('cash_register_id', openCashRegister.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!openCashRegister?.id,
  });

  // Fetch company cash movements (histórico do Cofre Central)
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

  // Cash summary for closing dialog
  const cashSummary = useMemo(() => {
    const openingAmount = openCashRegister?.opening_amount || 0;
    const activeSales = todaySales.filter((s) => s.payment_status !== 'cancelled');
    const totalDinheiro = activeSales.filter((s) => s.payment_method === 'dinheiro').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalCartao = activeSales.filter((s) => s.payment_method === 'cartao').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalPix = activeSales.filter((s) => s.payment_method === 'pix').reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalVendas = totalDinheiro + totalCartao + totalPix;
    
    const totalEntradas = dailyCashMovements.filter(m => m.type === 'entrada').reduce((sum, m) => sum + (m.amount || 0), 0);
    const totalSaidas = dailyCashMovements.filter(m => m.type === 'saida').reduce((sum, m) => sum + (m.amount || 0), 0);
    
    const expectedAmount = openingAmount + totalDinheiro + totalEntradas - totalSaidas;

    return { openingAmount, totalDinheiro, totalCartao, totalPix, totalVendas, expectedAmount, totalEntradas, totalSaidas };
  }, [openCashRegister, todaySales, dailyCashMovements]);

  // Configure company cash (create or update)
  const configMutation = useMutation({
    mutationFn: async ({ initialBalance, fixedFund }: { initialBalance: number; fixedFund: number }) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');
      
      // Check if company_cash already exists
      if (companyCash) {
        // Update existing record
        const { error } = await supabase
          .from('company_cash')
          .update({ 
            fixed_fund: fixedFund,
            updated_at: new Date().toISOString()
          })
          .eq('company_id', currentCompany.id);
        if (error) throw error;
        return { updated: true };
      } else {
        // Create new record using RPC
        const { data, error } = await supabase.rpc('initialize_company_cash', {
          _company_id: currentCompany.id,
          _initial_balance: initialBalance,
          _fixed_fund: fixedFund,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast.success('Configuração salva!');
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      setDialogType(null);
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  // Register movement (no Cofre Central — não é operacional)
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

  // Close cash register (direct, no audit/manager approval)
  const closeCashMutation = useMutation({
    mutationFn: async ({ counts, notes }: { counts: { payment_method: string; amount: number }[]; notes: string }) => {
      if (!openCashRegister?.id || !user?.id || !currentCompany?.id) throw new Error('Dados inválidos');

      const { data, error } = await supabase.rpc('close_cash_register_direct', {
        _cash_register_id: openCashRegister.id,
        _counts: counts,
        _notes: notes || null,
      });
      if (error) throw error;
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao fechar caixa');
      }
      return result;
    },
    onSuccess: () => {
      toast.success('Caixa fechado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['pending-advances'] });
      setFecharCaixaOpen(false);
    },
    onError: (error: Error) => toast.error(`Erro ao fechar caixa: ${error.message}`),
  });

  /**
   * Saldo da gaveta em tempo real:
   * abertura + entradas - saídas registradas no caixa aberto.
   * As vendas digitais/dinheiro já geram registro em cash_movements,
   * portanto usamos apenas as movimentações como fonte única de verdade.
   */
  const drawerBalance = useMemo(() => {
    if (!openCashRegister) return 0;
    const opening = Number(openCashRegister.opening_amount || 0);
    const entradas = dailyCashMovements
      .filter((m) => m.type === 'entrada')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const saidas = dailyCashMovements
      .filter((m) => m.type === 'saida')
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    return opening + entradas - saidas;
  }, [openCashRegister, dailyCashMovements]);

  const totalRealBalance = (Number(companyCash?.current_balance) || 0) + drawerBalance;

  // Atualização em tempo real do saldo (gaveta + empresa)
  useEffect(() => {
    if (!currentCompany?.id) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-open'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash'] });
      queryClient.invalidateQueries({ queryKey: ['company-cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['sales-today'] });
    };

    const channel = supabase
      .channel(`caixa-empresa-${currentCompany.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements', filter: `company_id=eq.${currentCompany.id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_registers', filter: `company_id=eq.${currentCompany.id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_cash', filter: `company_id=eq.${currentCompany.id}` }, invalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_cash_movements', filter: `company_id=eq.${currentCompany.id}` }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCompany?.id, queryClient]);

  const formatCurrency = (value: number | null | undefined) => {
    return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

  if (loadingCash || loadingCashRegister) {
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
            isEditMode={false}
            onConfirm={async (data) => {
              if (data.fixedFund !== undefined) {
                await configMutation.mutateAsync({ initialBalance: data.initialBalance || 0, fixedFund: data.fixedFund });
              }
            }}
            isLoading={configMutation.isPending}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card do Caixa do Dia */}
      <Card className={openCashRegister ? 'border-green-500/50 bg-green-50/30 dark:bg-green-950/10' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            {openCashRegister ? (
              <>
                <Unlock className="h-5 w-5 text-green-600" />
                Caixa do Dia Aberto
              </>
            ) : (
              <>
                <Lock className="h-5 w-5 text-muted-foreground" />
                Caixa do Dia Fechado
              </>
            )}
          </CardTitle>
          {openCashRegister && (
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400">
              Aberto desde {format(new Date(openCashRegister.opened_at), "HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {openCashRegister ? (
            <div className="space-y-4">
              {/* Resumo do caixa aberto */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Abertura</p>
                  <p className="text-lg font-semibold">{formatCurrency(cashSummary.openingAmount)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Dinheiro
                  </p>
                  <p className="text-lg font-semibold text-green-600">{formatCurrency(cashSummary.totalDinheiro)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" /> Cartão
                  </p>
                  <p className="text-lg font-semibold">{formatCurrency(cashSummary.totalCartao)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> PIX
                  </p>
                  <p className="text-lg font-semibold">{formatCurrency(cashSummary.totalPix)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Esperado (Dinheiro)</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(cashSummary.expectedAmount)}</p>
                </div>
                <Button variant="destructive" onClick={() => setFecharCaixaOpen(true)}>
                  <Lock className="mr-2 h-4 w-4" />
                  Fechar Caixa
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nenhum caixa aberto no momento</p>
                <p className="text-xs text-muted-foreground">A abertura do caixa é feita pelo operador no módulo Caixa e Vendas</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards de resumo da empresa */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Saldo Real da Empresa */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">💰 Saldo Real da Empresa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalRealBalance < 0 ? 'text-destructive' : 'text-green-600'}`}>
              {formatCurrency(totalRealBalance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor que a empresa possui em caixa/banco (não inclui contas a receber)
            </p>
            {openCashRegister && (
              <div className="mt-3 space-y-1 rounded-md border bg-muted/30 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Saldo em conta/empresa</span>
                  <span className="font-medium">{formatCurrency(companyCash.current_balance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Na gaveta (caixa aberto)</span>
                  <span className="font-medium">{formatCurrency(drawerBalance)}</span>
                </div>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Atualizado em tempo real conforme as movimentações do caixa
                </p>
              </div>
            )}
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

      {/* Dialogs */}
      <MovimentoCaixaEmpresaDialog
        open={dialogType !== null}
        onOpenChange={(open) => !open && setDialogType(null)}
        type={dialogType || 'config'}
        currentBalance={companyCash.current_balance}
        fixedFund={companyCash.fixed_fund}
        isEditMode={dialogType === 'config'}
        onConfirm={async (data) => {
          if (data.fixedFund !== undefined && dialogType === 'config') {
            await configMutation.mutateAsync({ initialBalance: data.initialBalance || 0, fixedFund: data.fixedFund });
          } else if (data.type && data.category && data.amount && data.description) {
            await movementMutation.mutateAsync({ type: data.type, category: data.category, amount: data.amount, description: data.description });
          }
        }}
        isLoading={configMutation.isPending || movementMutation.isPending}
      />

      <FecharCaixaDialog
        open={fecharCaixaOpen}
        onOpenChange={setFecharCaixaOpen}
        onConfirm={(counts, notes) => closeCashMutation.mutateAsync({ counts, notes })}
        summary={cashSummary}
        companyCash={companyCash}
        cashRegisterId={openCashRegister?.id}
        isLoading={closeCashMutation.isPending}
      />
    </div>
  );
}
