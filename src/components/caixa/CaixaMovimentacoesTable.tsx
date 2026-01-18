import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowUpDown, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CashMovement {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  created_at: string;
  payment_method?: string | null;
}

interface CaixaMovimentacoesTableProps {
  movements: CashMovement[];
}

export function CaixaMovimentacoesTable({ movements }: CaixaMovimentacoesTableProps) {
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      venda: 'Venda',
      sangria: 'Sangria',
      reforco: 'Reforço',
      despesa: 'Despesa',
      recebimento: 'Recebimento',
      ajuste: 'Ajuste',
      recolhimento: 'Recolhimento',
      abertura_caixa: 'Abertura',
      fechamento_caixa: 'Fechamento',
      deposito: 'Depósito',
      retirada: 'Retirada',
    };
    return labels[category] || category;
  };

  const getCategoryBadgeVariant = (category: string, type: string) => {
    if (type === 'entrada') {
      return 'default';
    }
    if (category === 'sangria' || category === 'despesa') {
      return 'destructive';
    }
    return 'secondary';
  };

  if (movements.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Movimentações do Caixa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma movimentação registrada neste caixa.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalEntradas = movements
    .filter((m) => m.type === 'entrada')
    .reduce((sum, m) => sum + m.amount, 0);
  
  const totalSaidas = movements
    .filter((m) => m.type === 'saida')
    .reduce((sum, m) => sum + m.amount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4" />
          Movimentações do Caixa
          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-600">
              <TrendingUp className="h-3 w-3" />
              {formatCurrency(totalEntradas)}
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <TrendingDown className="h-3 w-3" />
              {formatCurrency(totalSaidas)}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(movement.created_at), 'HH:mm', { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getCategoryBadgeVariant(movement.category, movement.type)}
                      className="text-xs"
                    >
                      {movement.type === 'entrada' ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {getCategoryLabel(movement.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {movement.description}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      movement.type === 'entrada' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {movement.type === 'entrada' ? '+' : '-'}
                    {formatCurrency(movement.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
