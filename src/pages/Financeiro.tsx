import { MainLayout } from '@/components/layout/MainLayout';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Financeiro() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <DollarSign className="w-7 h-7 text-primary" />
              Financeiro
            </h1>
            <p className="text-muted-foreground">Contas a pagar e receber</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <TrendingDown className="w-4 h-4" />
              Nova Despesa
            </Button>
            <Button className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Nova Receita
            </Button>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Saldo Atual</span>
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-display font-bold text-foreground">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">Atualizado agora</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Receitas (mês)</span>
              <ArrowUpRight className="w-5 h-5 text-action-green" />
            </div>
            <p className="text-2xl font-display font-bold text-action-green">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Despesas (mês)</span>
              <ArrowDownRight className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-2xl font-display font-bold text-destructive">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">Este mês</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">A Receber</span>
              <CreditCard className="w-5 h-5 text-action-blue" />
            </div>
            <p className="text-2xl font-display font-bold text-action-blue">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">Nenhuma pendência</p>
          </div>
        </div>

        {/* Transactions */}
        <div className="section-card">
          <h2 className="font-display font-semibold text-lg text-foreground mb-4">Últimas Movimentações</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">Nenhuma movimentação</h3>
            <p className="text-sm text-muted-foreground">
              Registre receitas e despesas para acompanhar suas finanças.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
