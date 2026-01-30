/**
 * OS Material Difference Report Component
 * 
 * Shows the comparison between planned (quantity_calculated) vs consumed quantities
 * for completed service orders, enabling visibility into waste or efficiency.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MaterialDifference {
  id: string;
  item_name: string;
  unit: string;
  quantity_calculated: number;
  quantity_consumed: number;
  difference: number;
  percentDifference: number;
}

interface OSMaterialDifferenceReportProps {
  ordemServicoId: string;
  className?: string;
}

export function OSMaterialDifferenceReport({ ordemServicoId, className }: OSMaterialDifferenceReportProps) {
  const { data: materials, isLoading } = useQuery({
    queryKey: ['material-difference', ordemServicoId],
    queryFn: async () => {
      // Get material consumption with consumed status
      const { data: consumption, error: consumptionError } = await supabase
        .from('material_consumption')
        .select('id, item_name, unit, quantity_calculated, stock_movement_id')
        .eq('ordem_servico_id', ordemServicoId)
        .eq('status', 'consumed');

      if (consumptionError) throw consumptionError;
      if (!consumption || consumption.length === 0) return [];

      // Get stock movements to find actual consumed quantities
      const movementIds = consumption
        .map(c => c.stock_movement_id)
        .filter((id): id is string => id !== null);

      let movements: Record<string, number> = {};
      
      if (movementIds.length > 0) {
        const { data: movementData, error: movementError } = await supabase
          .from('stock_movements')
          .select('id, quantity')
          .in('id', movementIds);

        if (movementError) throw movementError;
        
        movements = (movementData || []).reduce((acc, m) => {
          acc[m.id] = m.quantity;
          return acc;
        }, {} as Record<string, number>);
      }

      // Calculate differences
      const result: MaterialDifference[] = consumption.map(item => {
        const consumed = item.stock_movement_id ? (movements[item.stock_movement_id] || item.quantity_calculated) : item.quantity_calculated;
        const diff = consumed - item.quantity_calculated;
        const percentDiff = item.quantity_calculated > 0 
          ? ((diff / item.quantity_calculated) * 100) 
          : 0;

        return {
          id: item.id,
          item_name: item.item_name,
          unit: item.unit,
          quantity_calculated: item.quantity_calculated,
          quantity_consumed: consumed,
          difference: diff,
          percentDifference: percentDiff,
        };
      });

      return result;
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
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!materials || materials.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-muted-foreground" />
            Relatório de Diferenças
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span className="text-sm">Nenhum material consumido para análise</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Summary stats
  const totalPlanned = materials.reduce((sum, m) => sum + m.quantity_calculated, 0);
  const totalConsumed = materials.reduce((sum, m) => sum + m.quantity_consumed, 0);
  const overused = materials.filter(m => m.difference > 0.01);
  const underused = materials.filter(m => m.difference < -0.01);
  const exact = materials.filter(m => Math.abs(m.difference) <= 0.01);

  const formatQuantity = (qty: number, unit: string) => {
    if (unit === 'm' || unit === 'metro' || unit === 'metros') {
      return `${qty.toFixed(2)}m`;
    }
    if (unit === 'm²' || unit === 'm2') {
      return `${qty.toFixed(2)}m²`;
    }
    if (qty % 1 === 0) {
      return `${qty} ${unit}`;
    }
    return `${qty.toFixed(2)} ${unit}`;
  };

  const formatDifference = (diff: number, unit: string) => {
    const prefix = diff > 0 ? '+' : '';
    return `${prefix}${formatQuantity(diff, unit)}`;
  };

  const getDifferenceStatus = (diff: number) => {
    if (Math.abs(diff) <= 0.01) return 'exact';
    if (diff > 0) return 'over';
    return 'under';
  };

  const statusConfig = {
    exact: {
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/30',
      label: 'Exato',
    },
    over: {
      icon: TrendingUp,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      label: 'Sobra',
    },
    under: {
      icon: TrendingDown,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      label: 'Economia',
    },
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-primary" />
            Relatório de Diferenças
          </CardTitle>
          <div className="flex gap-2">
            {exact.length > 0 && (
              <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30">
                <CheckCircle2 className="w-3 h-3" />
                {exact.length} exatos
              </Badge>
            )}
            {overused.length > 0 && (
              <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500/30">
                <TrendingUp className="w-3 h-3" />
                {overused.length} sobras
              </Badge>
            )}
            {underused.length > 0 && (
              <Badge variant="outline" className="gap-1 text-blue-500 border-blue-500/30">
                <TrendingDown className="w-3 h-3" />
                {underused.length} economias
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Header Row */}
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2 pb-1 border-b">
            <span>Material</span>
            <span className="text-right">Planejado</span>
            <span className="text-right">Consumido</span>
            <span className="text-right">Diferença</span>
          </div>

          {/* Material Rows */}
          {materials.map((item) => {
            const status = getDifferenceStatus(item.difference);
            const config = statusConfig[status];
            const StatusIcon = config.icon;

            return (
              <div
                key={item.id}
                className={cn(
                  'grid grid-cols-4 gap-2 p-2 rounded-lg border text-sm',
                  config.bgColor,
                  config.borderColor
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <StatusIcon className={cn('w-4 h-4 shrink-0', config.color)} />
                  <span className="truncate" title={item.item_name}>
                    {item.item_name}
                  </span>
                </div>
                <span className="text-right font-mono text-muted-foreground">
                  {formatQuantity(item.quantity_calculated, item.unit)}
                </span>
                <span className="text-right font-mono">
                  {formatQuantity(item.quantity_consumed, item.unit)}
                </span>
                <span className={cn('text-right font-mono font-medium', config.color)}>
                  {status === 'exact' ? (
                    <span className="flex items-center justify-end gap-1">
                      <Minus className="w-3 h-3" />
                      0
                    </span>
                  ) : (
                    formatDifference(item.difference, item.unit)
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Summary Footer */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {materials.length} materiais analisados
            </span>
            <div className="flex items-center gap-4">
              {overused.length > 0 && (
                <span className="flex items-center gap-1 text-amber-500">
                  <AlertTriangle className="w-4 h-4" />
                  {overused.length} com sobra
                </span>
              )}
              {underused.length > 0 && (
                <span className="flex items-center gap-1 text-blue-500">
                  <TrendingDown className="w-4 h-4" />
                  {underused.length} com economia
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
