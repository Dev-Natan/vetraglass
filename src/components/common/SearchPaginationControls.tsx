import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface SearchPaginationControlsProps {
  search: string;
  onSearchChange: (value: string) => void;
  currentPage: number;
  totalPages: number;
  filteredCount: number;
  totalCount: number;
  isSearching: boolean;
  itemLabelSingular: string;
  itemLabelPlural: string;
  onPrevious: () => void;
  onNext: () => void;
  placeholder?: string;
}

export function SearchInput({
  search,
  onSearchChange,
  placeholder = "Buscar por nome ou slug...",
}: Pick<SearchPaginationControlsProps, "search" | "onSearchChange" | "placeholder">) {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}

export function PaginationFooter({
  currentPage,
  totalPages,
  filteredCount,
  totalCount,
  isSearching,
  itemLabelSingular,
  itemLabelPlural,
  onPrevious,
  onNext,
}: Omit<SearchPaginationControlsProps, "search" | "onSearchChange" | "placeholder">) {
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-sm text-muted-foreground">
        {filteredCount} {filteredCount === 1 ? itemLabelSingular : itemLabelPlural}
        {isSearching ? ` de ${totalCount}` : ""}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={currentPage <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm tabular-nums">
          {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
