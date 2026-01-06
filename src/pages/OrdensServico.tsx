import { MainLayout } from '@/components/layout/MainLayout';
import { ClipboardList, Plus, Search, Filter, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const mockOrders = [
  { id: 'OS-001', client: 'João Silva', description: 'Box para banheiro 1,20x1,90m', status: 'em_andamento', date: '2024-01-15', deadline: '2024-01-20' },
  { id: 'OS-002', client: 'Maria Santos', description: 'Espelho decorativo sala', status: 'pendente', date: '2024-01-14', deadline: '2024-01-18' },
  { id: 'OS-003', client: 'Pedro Costa', description: 'Porta de vidro temperado', status: 'concluida', date: '2024-01-10', deadline: '2024-01-15' },
  { id: 'OS-004', client: 'Ana Oliveira', description: 'Fechamento de varanda', status: 'em_andamento', date: '2024-01-12', deadline: '2024-01-22' },
];

const statusConfig = {
  pendente: { label: 'Pendente', icon: AlertCircle, className: 'bg-action-orange/20 text-action-orange' },
  em_andamento: { label: 'Em Andamento', icon: Clock, className: 'bg-action-blue/20 text-action-blue' },
  concluida: { label: 'Concluída', icon: CheckCircle, className: 'bg-action-green/20 text-action-green' },
};

export default function OrdensServico() {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl text-foreground flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />
              Ordens de Serviço
            </h1>
            <p className="text-muted-foreground">Acompanhe suas ordens de serviço</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova OS
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-orange/20 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-action-orange" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">8</p>
              <p className="text-sm text-muted-foreground">Pendentes</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-blue/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-action-blue" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">12</p>
              <p className="text-sm text-muted-foreground">Em Andamento</p>
            </div>
          </div>
          <div className="section-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-action-green/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-action-green" />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">45</p>
              <p className="text-sm text-muted-foreground">Concluídas (mês)</p>
            </div>
          </div>
        </div>

        <div className="section-card">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar OS..." className="pl-10" />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">OS</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Prazo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {mockOrders.map((order) => {
                  const status = statusConfig[order.status as keyof typeof statusConfig];
                  const StatusIcon = status.icon;
                  return (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-primary">{order.id}</td>
                      <td className="py-3 px-4 font-medium text-foreground">{order.client}</td>
                      <td className="py-3 px-4 text-muted-foreground">{order.description}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{order.deadline}</td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="sm">Ver</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
