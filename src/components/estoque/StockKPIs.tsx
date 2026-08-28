import { memo } from 'react';
import { Package, DollarSign, AlertTriangle, PackageX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StockKPIsProps {
  totalItems: number;
  totalValue: number;
  unknownValuationCount: number;
  lowStockCount: number;
  zeroStockCount: number;
}

export const StockKPIs = memo(function StockKPIs({
  totalItems,
  totalValue,
  unknownValuationCount,
  lowStockCount,
  zeroStockCount,
}: StockKPIsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalItems}</p>
              <p className="text-xs text-muted-foreground">Itens Ativos</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {unknownValuationCount > 0 ? '—' : formatCurrency(totalValue)}
              </p>
              <p className="text-xs text-muted-foreground">
                {unknownValuationCount > 0 ? 'Custo físico não disponível' : 'Valor em Estoque'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${lowStockCount > 0 ? 'bg-amber-500/10' : 'bg-muted'}`}>
              <AlertTriangle className={`w-5 h-5 ${lowStockCount > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-amber-600' : ''}`}>{lowStockCount}</p>
              <p className="text-xs text-muted-foreground">Estoque Baixo</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${zeroStockCount > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
              <PackageX className={`w-5 h-5 ${zeroStockCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${zeroStockCount > 0 ? 'text-destructive' : ''}`}>{zeroStockCount}</p>
              <p className="text-xs text-muted-foreground">Sem Estoque</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
