import { Package, LayoutGrid, List, Star, SortAsc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProductsHeaderProps {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  showFavoritesOnly: boolean;
  onToggleFavorites: () => void;
  totalCount: number;
  sortOrder: 'asc' | 'desc';
  onSortChange: () => void;
}

export function ProductsHeader({
  viewMode,
  onViewModeChange,
  showFavoritesOnly,
  onToggleFavorites,
  totalCount,
  sortOrder,
  onSortChange,
}: ProductsHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Title section */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Package className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            Catálogo de Produtos
          </h1>
          <p className="text-muted-foreground mt-1">
            Selecione uma linha para explorar os produtos disponíveis
          </p>
        </div>
        
        {/* Stats badge */}
        <div className="flex items-center gap-2">
          <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium text-primary">
              {totalCount} {totalCount === 1 ? 'linha' : 'linhas'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View toggle */}
        <div className="flex items-center bg-muted/50 rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 gap-2",
              viewMode === 'grid' && "bg-background shadow-sm"
            )}
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">Grade</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 px-3 gap-2",
              viewMode === 'list' && "bg-background shadow-sm"
            )}
            onClick={() => onViewModeChange('list')}
          >
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">Lista</span>
          </Button>
        </div>

        {/* Favorites filter */}
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          className={cn(
            "h-8 gap-2",
            showFavoritesOnly && "bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500"
          )}
          onClick={onToggleFavorites}
        >
          <Star className={cn("w-4 h-4", showFavoritesOnly && "fill-current")} />
          <span className="hidden sm:inline">Favoritos</span>
        </Button>

        {/* Sort */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2"
          onClick={onSortChange}
        >
          <SortAsc className={cn(
            "w-4 h-4 transition-transform",
            sortOrder === 'desc' && "rotate-180"
          )} />
          <span className="hidden sm:inline">{sortOrder === 'asc' ? 'A-Z' : 'Z-A'}</span>
        </Button>
      </div>
    </div>
  );
}
