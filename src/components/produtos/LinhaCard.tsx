import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinhaCardProps {
  linha: string;
  productCount?: number;
  onViewProducts: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
  isActive?: boolean;
  onToggleActive?: (next: boolean) => void;
}

export function LinhaCard({
  linha,
  productCount,
  onViewProducts,
  onDelete,
  isAdmin = false,
  isActive,
  onToggleActive,
}: LinhaCardProps) {
  const showToggle = isAdmin && typeof isActive === 'boolean' && !!onToggleActive;
  const inactive = isActive === false;

  return (
    <Card
      className={cn(
        'relative group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/30',
        inactive && 'opacity-60 grayscale'
      )}
    >
      {isAdmin && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
          aria-label="Excluir linha"
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
          {showToggle && (
            <Badge variant={inactive ? 'secondary' : 'default'} className="mt-2">
              {inactive ? 'Inativa' : 'Ativa'}
            </Badge>
          )}
        </div>

        {showToggle && (
          <div
            className="flex items-center justify-between w-full px-2 py-1 rounded-md bg-muted/30"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-xs text-muted-foreground">
              {inactive ? 'Oculta para empresas' : 'Visível para empresas'}
            </span>
            <Switch
              checked={!!isActive}
              onCheckedChange={(checked) => onToggleActive?.(checked)}
              aria-label="Ativar ou desativar linha"
            />
          </div>
        )}

        <Button onClick={onViewProducts} className="w-full" size="sm">
          Ver produtos
        </Button>
      </CardContent>
    </Card>
  );
}
