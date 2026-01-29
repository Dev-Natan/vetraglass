import { memo } from 'react';
import { AlertOctagon, ArrowRight, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { BlockedOS } from '@/hooks/useDashboardData';

interface ProductionBlockedAlertProps {
  data?: BlockedOS[];
}

export const ProductionBlockedAlert = memo(function ProductionBlockedAlert({ data: blockedOrders }: ProductionBlockedAlertProps) {
  if (!blockedOrders || blockedOrders.length === 0) {
    return null;
  }

  return (
    <Card className="border-red-500/50 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <AlertOctagon className="h-5 w-5" />
          Produção Travada
          <Badge variant="destructive" className="ml-auto">
            {blockedOrders.length} OS
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-3">
          Produção parada até resolver compras pendentes.
        </p>
        
        <div className="space-y-2">
          {blockedOrders.slice(0, 3).map((os) => (
            <Link
              key={os.id}
              to={`/ordens-servico/${os.id}`}
              className="flex items-center justify-between p-3 rounded-lg bg-white/80 dark:bg-background/50 border border-red-200 dark:border-red-800 hover:bg-white dark:hover:bg-background transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
                  <Package className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    OS #{String(os.os_number).padStart(4, '0')}
                  </p>
                  <p className="text-xs text-muted-foreground">{os.customer_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                  {os.pendingMaterials} material{os.pendingMaterials > 1 ? 'is' : ''}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>

        {blockedOrders.length > 3 && (
          <Button variant="link" asChild className="w-full text-red-600 dark:text-red-400">
            <Link to="/pedidos-compra">
              Ver todos os {blockedOrders.length} pedidos pendentes
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
});
