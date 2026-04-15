import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProductsSearchBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  resultsCount: number;
  totalCount: number;
}

export function ProductsSearchBar({
  searchTerm,
  onSearchChange,
  resultsCount,
  totalCount,
}: ProductsSearchBarProps) {
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input 
          placeholder="Buscar linhas de produtos..." 
          className={cn(
            "pl-12 pr-12 h-12 text-base rounded-xl border-border/50 bg-background/50 backdrop-blur",
            "focus:border-primary/50 focus:ring-primary/20 transition-all"
          )}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
            onClick={() => onSearchChange('')}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Search results indicator */}
      {searchTerm && (
        <div className="absolute -bottom-6 left-0 text-xs text-muted-foreground">
          Mostrando {resultsCount} de {totalCount} linhas
        </div>
      )}
    </div>
  );
}
