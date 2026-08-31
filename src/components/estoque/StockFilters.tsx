import { memo } from 'react';
import { Download, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type StockStatus = 'all' | 'in-stock' | 'zero' | 'low' | 'negative';
export type StockSortBy = 'name' | 'quantity' | 'value';

export interface ItemTypeOption { slug: string; name: string }

interface StockFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  statusFilter: StockStatus;
  onStatusChange: (value: StockStatus) => void;
  sortBy: StockSortBy;
  onSortChange: (value: StockSortBy) => void;
  onExport: () => void;
  isExporting?: boolean;
  linhas?: string[];
  linhaFilter?: string;
  onLinhaChange?: (value: string) => void;
  itemTypes?: ItemTypeOption[];
}

const statusOptions: Array<{ value: StockStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'in-stock', label: 'Em estoque' },
  { value: 'zero', label: 'Sem estoque' },
  { value: 'low', label: 'Reposição' },
  { value: 'negative', label: 'Negativo' },
];

export const StockFilters = memo(function StockFilters({
  searchTerm, onSearchChange, categoryFilter, onCategoryChange,
  statusFilter, onStatusChange, sortBy, onSortChange, onExport,
  isExporting = false, linhas = [], linhaFilter = 'all', onLinhaChange, itemTypes = [],
}: StockFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, código, categoria, linha, variante ou cor"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full lg:w-[170px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {itemTypes.map((type) => <SelectItem key={type.slug} value={type.slug}>{type.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {linhas.length > 0 && onLinhaChange && (
          <Select value={linhaFilter} onValueChange={onLinhaChange}>
            <SelectTrigger className="w-full lg:w-[170px]"><SelectValue placeholder="Linha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as linhas</SelectItem>
              {linhas.map((line) => <SelectItem key={line} value={line}>{line}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={sortBy} onValueChange={(value) => onSortChange(value as StockSortBy)}>
          <SelectTrigger className="w-full lg:w-[150px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Nome</SelectItem>
            <SelectItem value="quantity">Quantidade</SelectItem>
            <SelectItem value="value">Valor</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={onExport} disabled={isExporting}>
          <Download className="mr-2 h-4 w-4" /> Exportar
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar por status">
        {statusOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={statusFilter === option.value ? 'default' : 'outline'}
            className="h-8 shrink-0 rounded-full"
            onClick={() => onStatusChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
});
