import { Scissors, Layers, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CuttingSummaryCardsProps {
  totalProfilePieces: number;
  distinctProfiles: number;
  totalAccessories: number;
}

const cards = [
  {
    key: 'pieces',
    label: 'Peças a Cortar',
    icon: Scissors,
    accent: 'text-primary bg-primary/10',
    getValue: (p: CuttingSummaryCardsProps) => p.totalProfilePieces,
  },
  {
    key: 'variety',
    label: 'Variedade de Perfis',
    icon: Layers,
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    getValue: (p: CuttingSummaryCardsProps) => p.distinctProfiles,
  },
  {
    key: 'accessories',
    label: 'Vidros / Acessórios',
    icon: Package,
    accent: 'text-purple-600 dark:text-purple-400 bg-purple-500/10',
    getValue: (p: CuttingSummaryCardsProps) => p.totalAccessories,
  },
];

export function CuttingSummaryCards(props: CuttingSummaryCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-3 no-print">
      {cards.map(({ key, label, icon: Icon, accent, getValue }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-lg border bg-card p-3"
        >
          <div className={cn('flex items-center justify-center w-10 h-10 rounded-md', accent)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
              {label}
            </div>
            <div className="text-xl font-bold leading-tight text-foreground tabular-nums">
              {getValue(props)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
