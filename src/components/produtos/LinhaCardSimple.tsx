import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LinhaCardSimpleProps {
  linha: string;
  label?: string;
  onViewProducts: () => void;
  onRemove?: () => void;
  isRemovable?: boolean;
  categories?: string[];
  categoryLabels?: Record<string, string>;
}

export const LinhaCardSimple = memo(function LinhaCardSimple({ 
  linha, 
  label,
  onViewProducts,
  onRemove,
  isRemovable = true,
  categories = [],
  categoryLabels = {},
}: LinhaCardSimpleProps) {
  return (
    <Card className="relative bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors">
      {isRemovable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center text-destructive-foreground transition-colors"
        >
          <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      )}

      <div className="p-3 pt-8 sm:p-4 sm:pt-9 min-h-[140px] flex flex-col justify-between gap-4">
        <h3 className="font-semibold text-foreground uppercase text-xs sm:text-sm tracking-wide leading-tight line-clamp-2">
          {label || linha}
        </h3>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {categories.slice(0, 2).map(catSlug => (
              <span key={catSlug} className="text-[9px] sm:text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground whitespace-nowrap">
                {categoryLabels[catSlug] || catSlug}
              </span>
            ))}
            {categories.length > 2 && (
              <span className="text-[9px] sm:text-[10px] bg-muted px-1.5 py-0.5 rounded-sm text-muted-foreground">
                +{categories.length - 2}
              </span>
            )}
          </div>
        )}

        <Button onClick={onViewProducts} className="w-full h-8 sm:h-9 text-xs sm:text-sm" size="sm">
          Ver produtos
        </Button>
      </div>
    </Card>
  );
});
