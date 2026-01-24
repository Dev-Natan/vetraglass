import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Scissors, CheckCircle, Clock, Package } from 'lucide-react';
import { useCuttingPlanProgress } from '@/hooks/useCuttingPlanProgress';

interface OSProductionProgressProps {
  ordemServicoId: string;
  compact?: boolean;
}

export function OSProductionProgress({ ordemServicoId, compact = false }: OSProductionProgressProps) {
  const { data: progress, isLoading } = useCuttingPlanProgress(ordemServicoId);

  if (isLoading) {
    return (
      <div className="animate-pulse h-12 bg-muted rounded-lg" />
    );
  }

  if (!progress || progress.totalPlans === 0) {
    return null;
  }

  const statusConfig = {
    pending: {
      label: 'Aguardando',
      color: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-200 dark:border-amber-800',
      icon: Clock,
    },
    in_progress: {
      label: 'Em Produção',
      color: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
      borderColor: 'border-blue-200 dark:border-blue-800',
      icon: Scissors,
    },
    completed: {
      label: 'Fabricação Concluída',
      color: 'bg-green-500',
      textColor: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800',
      icon: CheckCircle,
    },
  };

  const config = statusConfig[progress.status];
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${config.bgColor}`}>
          <Scissors className={`w-3.5 h-3.5 ${config.textColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <Progress value={progress.progressPercent} className="h-2" />
        </div>
        <span className={`text-xs font-medium ${config.textColor}`}>
          {progress.progressPercent}%
        </span>
      </div>
    );
  }

  return (
    <Card className={`${config.bgColor} ${config.borderColor}`}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}/20`}>
              <StatusIcon className={`w-5 h-5 ${config.textColor}`} />
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                Produção
                <Badge variant="outline" className={config.textColor}>
                  {config.label}
                </Badge>
              </h3>
              <p className="text-sm text-muted-foreground">
                {progress.completedItems} de {progress.totalItems} itens cortados
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {progress.totalPlans} produto{progress.totalPlans > 1 ? 's' : ''}
              </span>
            </div>
            <div className="w-32">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progresso</span>
                <span className={`font-bold ${config.textColor}`}>
                  {progress.progressPercent}%
                </span>
              </div>
              <Progress 
                value={progress.progressPercent} 
                className={`h-2 [&>div]:${config.color}`}
              />
            </div>
          </div>
        </div>

        {/* Plan Details - Optional expanded view */}
        {progress.planDetails.length > 1 && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {progress.planDetails.map((plan) => {
                const planPercent = plan.totalItems > 0 
                  ? Math.round((plan.completedItems / plan.totalItems) * 100) 
                  : 0;
                return (
                  <div key={plan.id} className="bg-background/50 rounded-lg p-3">
                    <div className="text-sm font-medium truncate mb-1">
                      {plan.productName}
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={planPercent} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {planPercent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
