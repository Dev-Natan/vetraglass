import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'accent' | 'success' | 'warning';
  className?: string;
}

const variantStyles = {
  default: 'from-primary/10 to-primary/5 border-primary/20',
  accent: 'from-accent/10 to-accent/5 border-accent/20',
  success: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20',
  warning: 'from-amber-500/10 to-amber-500/5 border-amber-500/20',
};

const iconStyles = {
  default: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-500',
};

export function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  variant = 'default',
  className 
}: MetricCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl bg-gradient-to-br border p-6 hover-lift glass-card",
      variantStyles[variant],
      className
    )}>
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-gradient-to-br from-card/50 to-transparent blur-2xl" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            iconStyles[variant]
          )}>
            <Icon className="w-6 h-6" />
          </div>
          {trend && (
            <span className={cn(
              "text-sm font-medium px-2 py-1 rounded-full",
              trend.isPositive 
                ? "bg-emerald-500/10 text-emerald-600" 
                : "bg-destructive/10 text-destructive"
            )}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          )}
        </div>
        
        <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
        <p className="text-3xl font-display font-bold text-foreground">{value}</p>
      </div>
    </div>
  );
}
