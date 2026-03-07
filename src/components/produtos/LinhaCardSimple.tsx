import { memo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LinhaCardSimpleProps {
  linha: string;
  onViewProducts: () => void;
  onRemove?: () => void;
  isRemovable?: boolean;
}

export const LinhaCardSimple = memo(function LinhaCardSimple({ 
  linha, 
  onViewProducts,
  onRemove,
  isRemovable = true
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
          {linha}
        </h3>

        <Button onClick={onViewProducts} className="w-full h-8 sm:h-9 text-xs sm:text-sm" size="sm">
          Ver produtos
        </Button>
      </div>
    </Card>
  );
});
