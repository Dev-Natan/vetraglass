/**
 * OS Consumption Status Component
 * 
 * Displays the calculated material consumption for an OS with status indicators.
 * Shows materials grouped by type with pending/available/consumed states.
 * When OS is completed, shows the difference report (planned vs consumed).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Layers,
  Ruler,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { OSMaterialDifferenceReport } from './OSMaterialDifferenceReport';

interface MaterialConsumption {
  id: string;
  item_name: string;
  item_type: string;
  unit: string;
  quantity_calculated: number;
  status: 'pending' | 'available' | 'consumed' | 'cancelled';
  formula_used: string | null;
  input_width: number | null;
  input_height: number | null;
}

interface OSConsumptionStatusProps {
  ordemServicoId: string;
  osStatus?: string;
  className?: string;
}

const statusConfig = {
  pending: {
    label: 'Aguardando',
    icon: Clock,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  available: {
    label: 'Liberado',
    icon: Package,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  consumed: {
    label: 'Consumido',
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  cancelled: {
    label: 'Cancelado',
    icon: XCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
  },
};

const typeConfig: Record<string, { label: string; icon: typeof Package }> = {
  profile: { label: 'Perfis', icon: Ruler },
  glass: { label: 'Vidros', icon: Layers },
  accessory: { label: 'Acessórios', icon: Package },
  hardware: { label: 'Ferragens', icon: Package },
  seal: { label: 'Vedações', icon: Package },
  other: { label: 'Outros', icon: Package },
};

export function OSConsumptionStatus({ ordemServicoId, osStatus, className }: OSConsumptionStatusProps) {
  const { data: consumption, isLoading } = useQuery({
    queryKey: ['material-consumption', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_consumption')
        .select('*')
        .eq('ordem_servico_id', ordemServicoId)
        .neq('status', 'cancelled')
        .order('item_type')
        .order('item_name');

      if (error) throw error;
      return data as MaterialConsumption[];
    },
    enabled: !!ordemServicoId,
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!consumption || consumption.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-5 h-5 text-muted-foreground" />
            Consumo de Materiais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="text-sm">Nenhum material calculado para esta OS</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If OS is completed, show the difference report
  const isCompleted = osStatus === 'completed';
  const hasConsumedItems = consumption.some(c => c.status === 'consumed');

  // Group by item_type
  const groupedByType = consumption.reduce((acc, item) => {
    const type = item.item_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, MaterialConsumption[]>);

  // Calculate overall status
  const totalItems = consumption.length;
  const consumedItems = consumption.filter(c => c.status === 'consumed').length;
  const availableItems = consumption.filter(c => c.status === 'available').length;
  const pendingItems = consumption.filter(c => c.status === 'pending').length;

  let overallStatus: 'pending' | 'available' | 'consumed' = 'pending';
  if (consumedItems === totalItems) {
    overallStatus = 'consumed';
  } else if (availableItems > 0 || consumedItems > 0) {
    overallStatus = 'available';
  }

  const overallConfig = statusConfig[overallStatus];
  const OverallIcon = overallConfig.icon;

  const formatQuantity = (qty: number, unit: string) => {
    if (unit === 'm' || unit === 'metro' || unit === 'metros') {
      return `${qty.toFixed(2)}m`;
    }
    if (unit === 'm²' || unit === 'm2') {
      return `${qty.toFixed(2)}m²`;
    }
    return `${qty} ${unit}`;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="w-5 h-5 text-primary" />
            Consumo de Materiais
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn('gap-1', overallConfig.color, overallConfig.borderColor)}
          >
            <OverallIcon className="w-3 h-3" />
            {pendingItems > 0 && `${pendingItems} aguardando`}
            {availableItems > 0 && pendingItems === 0 && `${availableItems} liberados`}
            {consumedItems === totalItems && 'Tudo consumido'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(groupedByType).map(([type, items]) => {
            const typeInfo = typeConfig[type] || typeConfig.other;
            const TypeIcon = typeInfo.icon;

            return (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TypeIcon className="w-4 h-4" />
                  {typeInfo.label}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {items.length}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {items.map((item) => {
                    const itemStatus = statusConfig[item.status];
                    const StatusIcon = itemStatus.icon;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'flex items-center justify-between p-2 rounded-lg border',
                          itemStatus.bgColor,
                          itemStatus.borderColor
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <StatusIcon className={cn('w-4 h-4', itemStatus.color)} />
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {item.item_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">
                            {formatQuantity(item.quantity_calculated, item.unit)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Footer */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <span>Total de itens: {totalItems}</span>
          <div className="flex gap-3">
            {pendingItems > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-500" />
                {pendingItems}
              </span>
            )}
            {availableItems > 0 && (
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3 text-blue-500" />
                {availableItems}
              </span>
            )}
            {consumedItems > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {consumedItems}
              </span>
            )}
          </div>
        </div>

        {/* Difference Report for completed OS */}
        {isCompleted && hasConsumedItems && (
          <div className="mt-4 pt-4 border-t">
            <OSMaterialDifferenceReport ordemServicoId={ordemServicoId} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
