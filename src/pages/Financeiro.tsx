import { MainLayout } from '@/components/layout/MainLayout';
import { DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const transactions = [
  { id: '1', description: 'Venda OS-001', type: 'receita', value: 2500.00, date: '2024-01-15', status: 'pago' },
  { id: '2', description: 'Fornecedor Vidros ABC', type: 'despesa', value: 1800.00, date: '2024-01-14', status: 'pago' },
  { id: '3', description: 'Venda OS-002', type: 'receita', value: 1200.00, date: '2024-01-14', status: 'pendente' },
  { id: '4', description: 'Energia Elétrica', type: 'despesa', value: 450.00, date: '2024-01-10', status: 'pago' },
  { id: '5', description: 'Venda OS-003', type: 'receita', value: 3200.00, date: '2024-01-10', status: 'pago' },
];

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
            <p className="text-2xl font-display font-bold text-foreground">R$ 45.230,00</p>
            <p className="text-xs text-muted-foreground mt-1">Atualizado agora</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Receitas (mês)</span>
              <ArrowUpRight className="w-5 h-5 text-action-green" />
            </div>
            <p className="text-2xl font-display font-bold text-action-green">R$ 28.500,00</p>
            <p className="text-xs text-muted-foreground mt-1">+12% vs mês anterior</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Despesas (mês)</span>
              <ArrowDownRight className="w-5 h-5 text-destructive" />
            </div>
            <p className="text-2xl font-display font-bold text-destructive">R$ 12.800,00</p>
            <p className="text-xs text-muted-foreground mt-1">-5% vs mês anterior</p>
          </div>
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">A Receber</span>
              <CreditCard className="w-5 h-5 text-action-blue" />
            </div>
            <p className="text-2xl font-display font-bold text-action-blue">R$ 8.400,00</p>
            <p className="text-xs text-muted-foreground mt-1">5 parcelas pendentes</p>
          </div>
        </div>

        {/* Transactions */}
        <div className="section-card">
          <h2 className="font-display font-semibold text-lg text-foreground mb-4">Últimas Movimentações</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Valor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{transaction.description}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.type === 'receita' 
                          ? 'bg-action-green/20 text-action-green' 
                          : 'bg-destructive/20 text-destructive'
                      }`}>
                        {transaction.type === 'receita' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {transaction.type === 'receita' ? 'Receita' : 'Despesa'}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-medium ${transaction.type === 'receita' ? 'text-action-green' : 'text-destructive'}`}>
                      {transaction.type === 'receita' ? '+' : '-'} R$ {transaction.value.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{transaction.date}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        transaction.status === 'pago' 
                          ? 'bg-action-green/20 text-action-green' 
                          : 'bg-action-orange/20 text-action-orange'
                      }`}>
                        {transaction.status === 'pago' ? 'Pago' : 'Pendente'}
                      </span>
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
