import { MainLayout } from '@/components/layout/MainLayout';
import { ShoppingCart, Plus, DollarSign, CreditCard, Banknote, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';

const todaySales = [
  { id: '1', client: 'João Silva', items: 3, total: 850.00, payment: 'Cartão', time: '14:30' },
  { id: '2', client: 'Maria Santos', items: 1, total: 220.00, payment: 'Dinheiro', time: '13:45' },
  { id: '3', client: 'Pedro Costa', items: 2, total: 1500.00, payment: 'PIX', time: '11:20' },
  { id: '4', client: 'Ana Oliveira', items: 5, total: 2300.00, payment: 'Cartão', time: '10:15' },
];

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
            <p className="text-2xl font-display font-bold text-foreground">R$ 500,00</p>
            <p className="text-xs text-muted-foreground mt-1">08:00 - Hoje</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Dinheiro</span>
              <Banknote className="w-5 h-5 text-action-green" />
            </div>
            <p className="text-2xl font-display font-bold text-action-green">R$ 1.220,00</p>
            <p className="text-xs text-muted-foreground mt-1">4 vendas</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Cartão/PIX</span>
              <CreditCard className="w-5 h-5 text-action-blue" />
            </div>
            <p className="text-2xl font-display font-bold text-action-blue">R$ 3.650,00</p>
            <p className="text-xs text-muted-foreground mt-1">8 vendas</p>
          </div>
          <div className="section-card bg-primary/10 border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-foreground font-medium">Total Vendas</span>
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <p className="text-2xl font-display font-bold text-primary">R$ 4.870,00</p>
            <p className="text-xs text-muted-foreground mt-1">12 vendas hoje</p>
          </div>
        </div>

        {/* Today Sales */}
        <div className="section-card">
          <h2 className="font-display font-semibold text-lg text-foreground mb-4">Vendas de Hoje</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Hora</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Itens</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Pagamento</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {todaySales.map((sale) => (
                  <tr key={sale.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 text-muted-foreground">{sale.time}</td>
                    <td className="py-3 px-4 font-medium text-foreground">{sale.client}</td>
                    <td className="py-3 px-4 text-muted-foreground">{sale.items} itens</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        {sale.payment}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-action-green">R$ {sale.total.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm">Ver</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
