import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LinhaCardProps {
  linha: string;
  productCount?: number;
  onViewProducts: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
}

export function LinhaCard({ linha, productCount, onViewProducts, onDelete, isAdmin = false }: LinhaCardProps) {
  return (
    <Card className="relative group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/30">
      {isAdmin && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      
      <CardContent className="p-6 flex flex-col items-center gap-4">
        <div className="w-full h-24 bg-muted/50 rounded-lg flex items-center justify-center">
          <span className="text-4xl font-bold text-muted-foreground/30">
            {linha.charAt(0).toUpperCase()}
          </span>
        </div>
        
        <div className="text-center">
          <h3 className="font-semibold text-foreground uppercase tracking-wide text-sm">
            {linha}
          </h3>
          {productCount !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              {productCount} {productCount === 1 ? 'produto' : 'produtos'}
            </p>
          )}
        </div>
        
        <Button 
          onClick={onViewProducts}
          className="w-full"
          size="sm"
        >
          Ver produtos
        </Button>
      </CardContent>
    </Card>
  );
}
