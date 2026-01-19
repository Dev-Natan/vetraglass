import { usePermissionProfile } from '@/hooks/usePermissionProfile';
import { cn } from '@/lib/utils';
import { EyeOff } from 'lucide-react';

interface PriceDisplayProps {
  value: number;
  className?: string;
  isCost?: boolean;
  showCurrency?: boolean;
  compact?: boolean;
}

/**
 * Component that displays prices/costs respecting user permissions.
 * Users with hide_prices or hide_costs will see "••••" instead of values.
 */
export function PriceDisplay({ 
  value, 
  className, 
  isCost = false,
  showCurrency = true,
  compact = false 
}: PriceDisplayProps) {
  const { canSeePrices, canSeeCosts, isLoading } = usePermissionProfile();

  const canSee = isCost ? canSeeCosts() : canSeePrices();

  if (isLoading) {
    return <span className={cn("animate-pulse bg-muted rounded", className)}>••••</span>;
  }

  if (!canSee) {
    return (
      <span 
        className={cn(
          "inline-flex items-center gap-1 text-muted-foreground",
          compact ? "text-xs" : "",
          className
        )}
        title="Você não tem permissão para ver este valor"
      >
        <EyeOff className={cn(compact ? "w-3 h-3" : "w-4 h-4")} />
        <span>••••</span>
      </span>
    );
  }

  const formatted = new Intl.NumberFormat('pt-BR', {
    style: showCurrency ? 'currency' : 'decimal',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return <span className={className}>{formatted}</span>;
}

/**
 * Utility hook for conditional price display in tables/lists
 */
export function usePriceVisibility() {
  const { canSeePrices, canSeeCosts } = usePermissionProfile();

  const formatPrice = (value: number, showCurrency = true): string => {
    if (!canSeePrices()) return '••••';
    return new Intl.NumberFormat('pt-BR', {
      style: showCurrency ? 'currency' : 'decimal',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatCost = (value: number, showCurrency = true): string => {
    if (!canSeeCosts()) return '••••';
    return new Intl.NumberFormat('pt-BR', {
      style: showCurrency ? 'currency' : 'decimal',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return {
    canSeePrices: canSeePrices(),
    canSeeCosts: canSeeCosts(),
    formatPrice,
    formatCost,
  };
}
