import { Badge } from '@/components/ui/badge';
import { Scissors, CheckCircle, Clock } from 'lucide-react';
import { useCuttingPlanProgress } from '@/hooks/useCuttingPlanProgress';

interface OSProductionBadgeProps {
  ordemServicoId: string;
  showPercent?: boolean;
}

export function OSProductionBadge({ ordemServicoId, showPercent = true }: OSProductionBadgeProps) {
  const { data: progress, isLoading } = useCuttingPlanProgress(ordemServicoId);

  if (isLoading || !progress || progress.totalPlans === 0) {
    return null;
  }

  const statusConfig = {
    pending: {
      label: 'Aguardando',
      variant: 'secondary' as const,
      icon: Clock,
    },
    in_progress: {
      label: 'Produzindo',
      variant: 'default' as const,
      icon: Scissors,
    },
    completed: {
      label: 'Fabricado',
      variant: 'outline' as const,
      icon: CheckCircle,
    },
  };

  const config = statusConfig[progress.status];
  const StatusIcon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1 text-xs">
      <StatusIcon className="w-3 h-3" />
      {config.label}
      {showPercent && progress.status !== 'completed' && progress.progressPercent > 0 && (
        <span className="ml-1">({progress.progressPercent}%)</span>
      )}
    </Badge>
  );
}
