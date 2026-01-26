import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Target, TrendingUp, Settings, Trophy, Flame } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { CACHE_TIMES } from '@/lib/queryConfig';

interface SalesGoal {
  id: string;
  company_id: string;
  month: string;
  goal_amount: number;
  created_at: string;
  updated_at: string;
}

export function SalesGoalCard() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const currentMonth = format(today, 'yyyy-MM');

  // Fetch sales goal for current month
  const { data: salesGoal } = useQuery({
    queryKey: ['sales-goal', currentCompany?.id, currentMonth],
    queryFn: async () => {
      if (!currentCompany?.id) return null;

      const { data, error } = await supabase
        .from('company_sales_goals')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('month', currentMonth)
        .maybeSingle();

      if (error) throw error;
      return data as SalesGoal | null;
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  // Fetch current month sales
  const { data: monthlySales } = useQuery({
    queryKey: ['monthly-sales-total', currentCompany?.id, currentMonth],
    queryFn: async () => {
      if (!currentCompany?.id) return 0;

      const { data, error } = await supabase
        .from('sales')
        .select('total_amount')
        .eq('company_id', currentCompany.id)
        .neq('payment_status', 'cancelled')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (error) throw error;
      return (data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
    },
    enabled: !!currentCompany?.id,
    ...CACHE_TIMES.DYNAMIC,
  });

  // Save goal mutation
  const saveGoalMutation = useMutation({
    mutationFn: async (goalAmount: number) => {
      if (!currentCompany?.id) throw new Error('Empresa não encontrada');

      if (salesGoal) {
        // Update existing goal
        const { error } = await supabase
          .from('company_sales_goals')
          .update({ goal_amount: goalAmount })
          .eq('id', salesGoal.id);
        if (error) throw error;
      } else {
        // Insert new goal
        const { error } = await supabase
          .from('company_sales_goals')
          .insert({
            company_id: currentCompany.id,
            month: currentMonth,
            goal_amount: goalAmount,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Meta salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sales-goal'] });
      setDialogOpen(false);
      setGoalInput('');
    },
    onError: (error: Error) => toast.error(`Erro: ${error.message}`),
  });

  const handleOpenDialog = () => {
    setGoalInput(salesGoal?.goal_amount?.toString() || '');
    setDialogOpen(true);
  };

  const handleSaveGoal = () => {
    const amount = parseFloat(goalInput.replace(/\D/g, '')) / 100;
    if (isNaN(amount) || amount <= 0) {
      toast.error('Digite um valor válido para a meta');
      return;
    }
    saveGoalMutation.mutate(amount);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCurrencyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const numericValue = parseInt(value, 10) || 0;
    const formatted = (numericValue / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    setGoalInput(formatted);
  };

  const goalAmount = salesGoal?.goal_amount || 0;
  const currentSales = monthlySales || 0;
  const progress = goalAmount > 0 ? Math.min((currentSales / goalAmount) * 100, 100) : 0;
  const remaining = Math.max(goalAmount - currentSales, 0);
  const isGoalReached = currentSales >= goalAmount && goalAmount > 0;

  // No goal set yet
  if (!salesGoal) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/30">
        <CardContent className="py-6 text-center">
          <Target className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium mb-1">Defina sua Meta de Vendas</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configure uma meta mensal para acompanhar o progresso
          </p>
          <Button onClick={handleOpenDialog} variant="outline">
            <Target className="mr-2 h-4 w-4" />
            Definir Meta
          </Button>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md" aria-describedby="define-goal-description">
              <DialogHeader>
                <DialogTitle>Definir Meta de Vendas</DialogTitle>
                <p id="define-goal-description" className="text-sm text-muted-foreground">
                  Configure o valor da meta mensal para acompanhar o progresso das vendas.
                </p>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Meta para {format(today, "MMMM 'de' yyyy", { locale: ptBR })}</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={goalInput}
                    onChange={handleCurrencyInput}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveGoal} disabled={saveGoalMutation.isPending}>
                  {saveGoalMutation.isPending ? 'Salvando...' : 'Salvar Meta'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isGoalReached ? 'border-green-500/50 bg-gradient-to-br from-green-50 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/20' : ''}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {isGoalReached ? (
            <>
              <Trophy className="h-4 w-4 text-yellow-500" />
              Meta Atingida!
            </>
          ) : (
            <>
              <Target className="h-4 w-4 text-primary" />
              Meta do Mês
            </>
          )}
        </CardTitle>
        <div className="flex items-center gap-1">
          {progress >= 80 && progress < 100 && (
            <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 gap-1">
              <Flame className="h-3 w-3" />
              Quase lá!
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleOpenDialog}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progress.toFixed(1)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <p className="text-xs text-muted-foreground">Vendido</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(currentSales)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Meta</p>
            <p className="text-lg font-semibold">{formatCurrency(goalAmount)}</p>
          </div>
        </div>

        {!isGoalReached && goalAmount > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t text-sm">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Faltam <span className="font-medium text-foreground">{formatCurrency(remaining)}</span> para atingir a meta
            </span>
          </div>
        )}

        {isGoalReached && (
          <div className="flex items-center gap-2 pt-2 border-t text-sm text-green-600 dark:text-green-400">
            <Trophy className="h-4 w-4" />
            <span>
              Parabéns! Você superou a meta em <span className="font-medium">{formatCurrency(currentSales - goalAmount)}</span>
            </span>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="edit-goal-description">
          <DialogHeader>
            <DialogTitle>Editar Meta de Vendas</DialogTitle>
            <p id="edit-goal-description" className="text-sm text-muted-foreground">
              Ajuste o valor da meta mensal de vendas.
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Meta para {format(today, "MMMM 'de' yyyy", { locale: ptBR })}</Label>
              <Input
                placeholder="R$ 0,00"
                value={goalInput}
                onChange={handleCurrencyInput}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Vendas atuais: {formatCurrency(currentSales)}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveGoal} disabled={saveGoalMutation.isPending}>
              {saveGoalMutation.isPending ? 'Salvando...' : 'Salvar Meta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
