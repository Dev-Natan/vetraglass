import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, ArrowRight, Package, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinhaCardModernProps {
  linha: string;
  productCount?: number;
  onViewProducts: () => void;
  onDownloadLinha?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  viewMode?: 'grid' | 'list';
  hasActivatedProducts?: boolean;
}

export function LinhaCardModern({ 
  linha, 
  productCount, 
  onViewProducts,
  onDownloadLinha,
  isFavorite = false,
  onToggleFavorite,
  viewMode = 'grid',
  hasActivatedProducts = true
}: LinhaCardModernProps) {
  // Generate a gradient based on the linha name for visual variety
  const getGradientClass = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const gradients = [
      'from-primary/20 to-primary/5',
      'from-blue-500/20 to-blue-500/5',
      'from-emerald-500/20 to-emerald-500/5',
      'from-purple-500/20 to-purple-500/5',
      'from-orange-500/20 to-orange-500/5',
      'from-rose-500/20 to-rose-500/5',
    ];
    return gradients[hash % gradients.length];
  };

  const getIconColor = (name: string) => {
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'text-primary',
      'text-blue-500',
      'text-emerald-500',
      'text-purple-500',
      'text-orange-500',
      'text-rose-500',
    ];
    return colors[hash % colors.length];
  };

  if (viewMode === 'list') {
    return (
      <Card 
        className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/40 cursor-pointer overflow-hidden"
        onClick={onViewProducts}
      >
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn(
            "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0",
            getGradientClass(linha)
          )}>
            <Package className={cn("w-6 h-6", getIconColor(linha))} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground uppercase tracking-wide text-sm truncate">
              {linha}
            </h3>
            {productCount !== undefined && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {productCount} {productCount === 1 ? 'produto' : 'produtos'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                className={cn(
                  "p-2 rounded-lg transition-all duration-200",
                  isFavorite 
                    ? "text-yellow-500 bg-yellow-500/10" 
                    : "text-muted-foreground hover:text-yellow-500 hover:bg-yellow-500/10"
                )}
              >
                <Star className={cn("w-4 h-4", isFavorite && "fill-current")} />
              </button>
            )}
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="group hover:shadow-xl transition-all duration-300 border-border/50 hover:border-primary/40 cursor-pointer overflow-hidden hover:-translate-y-1"
      onClick={onViewProducts}
    >
      {/* Favorite button */}
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "absolute top-3 right-3 z-10 p-2 rounded-full transition-all duration-200 backdrop-blur-sm",
            isFavorite 
              ? "text-yellow-500 bg-yellow-500/20" 
              : "text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-yellow-500 hover:bg-yellow-500/20"
          )}
        >
          <Star className={cn("w-4 h-4", isFavorite && "fill-current")} />
        </button>
      )}

      <CardContent className="p-0">
        {/* Header with gradient */}
        <div className={cn(
          "h-28 bg-gradient-to-br flex items-center justify-center relative overflow-hidden",
          getGradientClass(linha)
        )}>
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
          </div>
          
          {/* Icon */}
          <div className={cn(
            "w-16 h-16 rounded-2xl bg-card/90 backdrop-blur flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300",
          )}>
            <span className={cn("text-3xl font-bold", getIconColor(linha))}>
              {linha.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4 pt-5">
          <div className="text-center mb-4">
            <h3 className="font-semibold text-foreground uppercase tracking-wide text-sm mb-1">
              {linha}
            </h3>
            {productCount !== undefined && (
              <p className="text-xs text-muted-foreground">
                {productCount} {productCount === 1 ? 'produto ativo' : 'produtos ativos'}
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            {hasActivatedProducts && (
              <Button 
                className="w-full gap-2 group/btn"
                size="sm"
              >
                Ver produtos
                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Button>
            )}
            {onDownloadLinha && (
              <Button 
                variant={hasActivatedProducts ? "outline" : "default"}
                className="w-full gap-2"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadLinha();
                }}
              >
                <Download className="w-4 h-4" />
                Baixar produtos
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
