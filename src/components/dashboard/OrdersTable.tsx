import { Order } from '@/types';
import { cn } from '@/lib/utils';
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const statusConfig = {
  pending: {
    label: 'Pendente',
    className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  in_progress: {
    label: 'Em Andamento',
    className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  completed: {
    label: 'Concluído',
    className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  cancelled: {
    label: 'Cancelado',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

interface OrdersTableProps {
  orders: Order[];
}

export function OrdersTable({ orders }: OrdersTableProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 font-medium text-muted-foreground text-sm">Nº</th>
              <th className="text-left p-4 font-medium text-muted-foreground text-sm">Cliente</th>
              <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden md:table-cell">Descrição</th>
              <th className="text-left p-4 font-medium text-muted-foreground text-sm">Status</th>
              <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden sm:table-cell">Valor</th>
              <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden lg:table-cell">Data</th>
              <th className="text-right p-4 font-medium text-muted-foreground text-sm">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, index) => {
              const status = statusConfig[order.status];
              return (
                <tr 
                  key={order.id} 
                  className={cn(
                    "border-b border-border/50 hover:bg-muted/30 transition-colors",
                    index % 2 === 0 && "bg-muted/10"
                  )}
                >
                  <td className="p-4">
                    <span className="font-mono font-medium text-foreground">#{order.number}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-medium text-foreground">{order.client}</span>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="text-muted-foreground text-sm line-clamp-1">{order.description}</span>
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      "inline-flex px-3 py-1 rounded-full text-xs font-medium border",
                      status.className
                    )}>
                      {status.label}
                    </span>
                  </td>
                  <td className="p-4 hidden sm:table-cell">
                    <span className="font-medium text-foreground">{formatCurrency(order.total)}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span className="text-muted-foreground text-sm">{formatDate(order.createdAt)}</span>
                  </td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem className="gap-2">
                          <Eye className="w-4 h-4" /> Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2">
                          <Edit className="w-4 h-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 text-destructive">
                          <Trash2 className="w-4 h-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
