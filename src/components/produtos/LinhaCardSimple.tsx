import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinhaCardSimpleProps {
  linha: string;
  onViewProducts: () => void;
  onRemove?: () => void;
  isRemovable?: boolean;
}

export function LinhaCardSimple({ 
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
          className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-sm"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Content */}
      <div className="p-4 pt-10 pb-4">
        <h3 className="font-semibold text-foreground uppercase text-sm tracking-wide mb-4 min-h-[40px] line-clamp-2">
          {linha}
        </h3>
        
        <Button 
          onClick={onViewProducts}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white"
          size="sm"
        >
          Ver produtos
        </Button>
      </div>
    </Card>
  );
}
