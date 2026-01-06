import { MainLayout } from '@/components/layout/MainLayout';
import { ShoppingCart, Plus, DollarSign, CreditCard, Banknote, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CaixaVendas() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-primary" />
              Caixa & Vendas
            </h1>
            <p className="text-muted-foreground">PDV e controle de caixa</p>
          </div>
          <div className="flex gap-2">
            <Button variant="destructive" className="gap-2">
              Fechar Caixa
            </Button>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Venda
            </Button>
          </div>
        </div>

        {/* Cash Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Abertura</span>
              <DollarSign className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-2xl font-display font-bold text-foreground">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">Caixa não aberto</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Dinheiro</span>
              <Banknote className="w-5 h-5 text-action-green" />
            </div>
            <p className="text-2xl font-display font-bold text-action-green">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">0 vendas</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Cartão/PIX</span>
              <CreditCard className="w-5 h-5 text-action-blue" />
            </div>
            <p className="text-2xl font-display font-bold text-action-blue">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">0 vendas</p>
          </div>
          <div className="section-card bg-primary/10 border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-foreground font-medium">Total Vendas</span>
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-display font-bold text-primary">R$ 0,00</p>
            <p className="text-xs text-muted-foreground mt-1">0 vendas hoje</p>
          </div>
        </div>

        {/* Today Sales */}
        <div className="section-card">
          <h2 className="font-display font-semibold text-lg text-foreground mb-4">Vendas de Hoje</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-foreground mb-1">Nenhuma venda hoje</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Abra o caixa e registre suas vendas.
            </p>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Registrar Venda
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
