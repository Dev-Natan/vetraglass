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
    <Card className="relative bg-card border border-border/60 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Remove button */}
      {isRemovable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-destructive hover:bg-destructive/90 flex items-center justify-center text-destructive-foreground transition-colors shadow-sm"
        >
          <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </button>
      )}

      {/* Content */}
      <div className="p-2.5 pt-8 pb-2.5 sm:p-4 sm:pt-10 sm:pb-4">
        <h3 className="font-semibold text-foreground uppercase text-xs sm:text-sm tracking-wide mb-2.5 sm:mb-4 min-h-[32px] sm:min-h-[40px] line-clamp-2 leading-tight">
          {linha}
        </h3>
        
        <Button 
          onClick={onViewProducts}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm h-8 sm:h-9"
          size="sm"
        >
          Ver produtos
        </Button>
      </div>
    </Card>
  );
});
