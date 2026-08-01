import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Wallet, Plus, Trash2, PiggyBank, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { parseCurrencyBRL } from '@/utils/currencyMask';

interface Allocation {
  id: string;
  company_id: string;
  name: string;
  percentage: number;
  color: string;
  sort_order: number;
}

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

const formatCurrency = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function InvestimentosTab() {
  const { currentCompany } = useAuth();
  const qc = useQueryClient();
  const companyId = currentCompany?.id;

  const [newName, setNewName] = useState('');
  const [newPct, setNewPct] = useState('');

  const cashQuery = useQuery({
    queryKey: ['company-cash', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_cash')
        .select('current_balance')
        .eq('company_id', companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Contas bancárias ativas
  const banksQuery = useQuery({
    queryKey: ['bank-accounts-balance', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('id, current_balance, active')
        .eq('company_id', companyId!)
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Caixa operacional aberto (gaveta): abertura + entradas - saídas
  const drawerQuery = useQuery({
    queryKey: ['operational-drawer-balance', companyId],
    queryFn: async () => {
      const { data: reg, error: regErr } = await supabase
        .from('cash_registers')
        .select('id, opening_amount')
        .eq('company_id', companyId!)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (regErr) throw regErr;
      if (!reg) return { registerId: null as string | null, balance: 0 };

      const { data: movs, error: movErr } = await supabase
        .from('cash_movements')
        .select('type, amount')
        .eq('cash_register_id', reg.id);
      if (movErr) throw movErr;

      const net = (movs || []).reduce((sum, m) => {
        const amount = Number(m.amount) || 0;
        return m.type === 'entrada' ? sum + amount : sum - amount;
      }, Number(reg.opening_amount) || 0);

      return { registerId: reg.id, balance: net };
    },
    enabled: !!companyId,
  });


  const allocQuery = useQuery({
    queryKey: ['investment-allocations', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('investment_allocations')
        .select('*')
        .eq('company_id', companyId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Allocation[];
    },
    enabled: !!companyId,
  });

  // Realtime: caixa da empresa, bancos, caixa operacional e alocações
  useEffect(() => {
    if (!companyId) return;
    const refreshBalances = () => {
      qc.invalidateQueries({ queryKey: ['company-cash', companyId] });
      qc.invalidateQueries({ queryKey: ['bank-accounts-balance', companyId] });
      qc.invalidateQueries({ queryKey: ['operational-drawer-balance', companyId] });
    };
    const channel = supabase
      .channel(`invest-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_cash', filter: `company_id=eq.${companyId}` }, refreshBalances)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_cash_movements', filter: `company_id=eq.${companyId}` }, refreshBalances)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts', filter: `company_id=eq.${companyId}` }, refreshBalances)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_registers', filter: `company_id=eq.${companyId}` }, refreshBalances)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements', filter: `company_id=eq.${companyId}` }, refreshBalances)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investment_allocations', filter: `company_id=eq.${companyId}` }, () => {
        qc.invalidateQueries({ queryKey: ['investment-allocations', companyId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, qc]);

  const companyCash = Number(cashQuery.data?.current_balance) || 0;
  const banksTotal = useMemo(
    () => (banksQuery.data || []).reduce((s, b) => s + (Number(b.current_balance) || 0), 0),
    [banksQuery.data],
  );
  const drawerBalance = Number(drawerQuery.data?.balance) || 0;
  const balance = companyCash + banksTotal + drawerBalance;

  const allocations = allocQuery.data || [];
  const totalPct = useMemo(() => allocations.reduce((s, a) => s + Number(a.percentage || 0), 0), [allocations]);
  const remainingPct = Math.max(0, 100 - totalPct);
  const allocatedValue = (balance * totalPct) / 100;

  const unallocatedValue = balance - allocatedValue;

  const addMutation = useMutation({
    mutationFn: async () => {
      const pct = parseCurrencyBRL(newPct);
      if (!newName.trim()) throw new Error('Informe o nome do destino');
      if (!pct || pct <= 0) throw new Error('Percentual inválido');
      if (totalPct + pct > 100.0001) throw new Error(`Soma excede 100% (disponível: ${remainingPct.toFixed(2)}%)`);
      const color = PALETTE[allocations.length % PALETTE.length];
      const { error } = await supabase.from('investment_allocations').insert({
        company_id: companyId!,
        name: newName.trim(),
        percentage: pct,
        color,
        sort_order: allocations.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Destino adicionado');
      setNewName(''); setNewPct('');
      qc.invalidateQueries({ queryKey: ['investment-allocations', companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Allocation> }) => {
      const { error } = await supabase.from('investment_allocations').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investment-allocations', companyId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('investment_allocations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Destino removido');
      qc.invalidateQueries({ queryKey: ['investment-allocations', companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handlePctChange = (a: Allocation, value: string) => {
    const pct = parseCurrencyBRL(value);
    const otherSum = totalPct - Number(a.percentage);
    if (otherSum + pct > 100.0001) {
      toast.error(`Soma excederia 100% (máx ${(100 - otherSum).toFixed(2)}%)`);
      return;
    }
    updateMutation.mutate({ id: a.id, patch: { percentage: pct } });
  };

  return (
    <div className="space-y-6">
      {/* Saldo Real */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Saldo Real da Empresa</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(balance)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Atualiza automaticamente conforme o caixa</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Alocado</p>
              <p className="text-xl font-semibold">{totalPct.toFixed(2)}%</p>
              <p className="text-xs text-muted-foreground mt-1">Livre: {remainingPct.toFixed(2)}%</p>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={Math.min(100, totalPct)} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Adicionar destino */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo Destino de Investimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,140px,auto] gap-3">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input
                placeholder="Ex: Marketing, Reserva de Emergência"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Percentual (%)</Label>
              <Input
                placeholder="Ex: 30"
                value={newPct}
                onChange={(e) => setNewPct(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || remainingPct <= 0}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
          {remainingPct <= 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-3">
              <AlertTriangle className="h-3 w-3" /> 100% já alocado — ajuste os percentuais existentes para adicionar novos destinos.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Lista de destinos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="h-4 w-4" /> Destinos Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhum destino cadastrado. Adicione o primeiro acima.
            </div>
          ) : (
            <div className="space-y-3">
              {allocations.map((a) => {
                const value = (balance * Number(a.percentage)) / 100;
                return (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                  >
                    <div
                      className="w-3 h-10 rounded-full flex-shrink-0"
                      style={{ backgroundColor: a.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <Input
                        value={a.name}
                        onChange={(e) => updateMutation.mutate({ id: a.id, patch: { name: e.target.value } })}
                        className="border-0 shadow-none px-0 h-7 font-medium focus-visible:ring-0"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span className="text-lg font-bold text-green-600">{formatCurrency(value)}</span>
                      </div>
                    </div>
                    <div className="w-28">
                      <Label className="text-[10px] text-muted-foreground">Percentual</Label>
                      <div className="relative">
                        <Input
                          defaultValue={String(a.percentage).replace('.', ',')}
                          onBlur={(e) => handlePctChange(a, e.target.value)}
                          className="pr-6 text-right"
                          inputMode="decimal"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(a.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              {/* Resumo */}
              <div className="mt-4 p-3 rounded-lg bg-muted/50 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Total Alocado</p>
                  <p className="font-bold">{formatCurrency(allocatedValue)}</p>
                  <p className="text-[10px] text-muted-foreground">{totalPct.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Não Alocado</p>
                  <p className="font-bold text-muted-foreground">{formatCurrency(unallocatedValue)}</p>
                  <p className="text-[10px] text-muted-foreground">{remainingPct.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo Total</p>
                  <p className="font-bold text-primary">{formatCurrency(balance)}</p>
                  <Badge variant="outline" className="text-[10px] mt-0.5">Tempo real</Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
