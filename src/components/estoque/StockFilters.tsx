import { memo } from 'react';
import { Search, LayoutGrid, List, Download, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type StockStatus = 'all' | 'low' | 'zero' | 'normal';
export type StockSortBy = 'name' | 'quantity' | 'value';
export type ViewMode = 'list' | 'grid';

interface StockFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  statusFilter: StockStatus;
  onStatusChange: (value: StockStatus) => void;
  sortBy: StockSortBy;
  onSortChange: (value: StockSortBy) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onExport: () => void;
  isExporting?: boolean;
  linhas?: string[];
  linhaFilter?: string;
  onLinhaChange?: (value: string) => void;
}

export const StockFilters = memo(function StockFilters({
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onExport,
  isExporting = false,
  linhas = [],
  linhaFilter = 'all',
  onLinhaChange,
}: StockFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="flex flex-1 flex-col sm:flex-row gap-2 w-full sm:w-auto">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Category Filter */}
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="profile">Perfis</SelectItem>
            <SelectItem value="glass">Vidros</SelectItem>
            <SelectItem value="sheet">Chaparias</SelectItem>
            <SelectItem value="accessory">Acessórios</SelectItem>
            <SelectItem value="service">Serviços</SelectItem>
          </SelectContent>
        </Select>

        {/* Linha Filter (if available) */}
        {linhas.length > 0 && onLinhaChange && (
          <Select value={linhaFilter} onValueChange={onLinhaChange}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Linha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas linhas</SelectItem>
              {linhas.map((linha) => (
                <SelectItem key={linha} value={linha}>{linha}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Advanced Filters Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={statusFilter === 'all'}
              onCheckedChange={() => onStatusChange('all')}
            >
              Todos
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusFilter === 'low'}
              onCheckedChange={() => onStatusChange('low')}
            >
              Estoque baixo
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusFilter === 'zero'}
              onCheckedChange={() => onStatusChange('zero')}
            >
              Sem estoque
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={statusFilter === 'normal'}
              onCheckedChange={() => onStatusChange('normal')}
            >
              Estoque normal
            </DropdownMenuCheckboxItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={sortBy === 'name'}
              onCheckedChange={() => onSortChange('name')}
            >
              Nome
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sortBy === 'quantity'}
              onCheckedChange={() => onSortChange('quantity')}
            >
              Quantidade
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={sortBy === 'value'}
              onCheckedChange={() => onSortChange('value')}
            >
              Valor
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex gap-2">
        {/* View Mode Toggle */}
        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-r-none"
            onClick={() => onViewModeChange('list')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-l-none"
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>

        {/* Export Button */}
        <Button
          variant="outline"
          className="gap-2"
          onClick={onExport}
          disabled={isExporting}
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
      </div>
    </div>
  );
});
