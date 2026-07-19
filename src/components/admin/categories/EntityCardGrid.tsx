import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { SearchInput, PaginationFooter } from "@/components/common/SearchPaginationControls";
import { useSearchPagination } from "@/hooks/useSearchPagination";
import { cn } from "@/lib/utils";


export interface EntityCardItem {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  color?: string;
  description?: string | null;
  detailHref?: string;
  meta?: Array<{ label: string; value: ReactNode }>;
}

interface EntityCardGridProps<T extends EntityCardItem> {
  title: string;
  description: string;
  addLabel: string;
  itemLabelSingular: string;
  itemLabelPlural: string;
  data: T[] | undefined;
  isLoading: boolean;
  getColorClass?: (color: string) => string;
  onOpenDialog: (item?: T) => void;
  onToggleActive: (item: T) => void;
  onDelete: (item: T) => void;
  /** When true, clicking the card body navigates to `detailHref` instead of opening the quick-edit dialog. */
  preferDetailOnCardClick?: boolean;
}


export function EntityCardGrid<T extends EntityCardItem>({
  title,
  description,
  addLabel,
  itemLabelSingular,
  itemLabelPlural,
  data,
  isLoading,
  getColorClass,
  onOpenDialog,
  onToggleActive,
  onDelete,
}: EntityCardGridProps<T>) {
  const sp = useSearchPagination({
    data,
    getSearchableFields: (i: T) => [i.name, i.slug],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          {addLabel}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchInput search={sp.search} onSearchChange={sp.setSearch} />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sp.paginated.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            Nenhum {itemLabelSingular} encontrado
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sp.paginated.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenDialog(item)}
                className={cn(
                  "text-left rounded-lg border bg-card p-4 transition-all",
                  "hover:border-primary/60 hover:shadow-md hover:-translate-y-0.5",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !item.is_active && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.color && getColorClass && (
                      <div className={cn("w-4 h-4 rounded shrink-0", getColorClass(item.color))} />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                      <p className="text-[11px] text-muted-foreground font-mono truncate">
                        {item.slug}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    #{item.sort_order}
                  </Badge>
                </div>

                {item.description && (
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2">
                    {item.description}
                  </p>
                )}

                {item.meta && item.meta.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.meta.map((m, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                        {m.label}: {m.value}
                      </Badge>
                    ))}
                  </div>
                )}

                <div
                  className="mt-4 pt-3 border-t flex items-center justify-between gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={item.is_active}
                      onCheckedChange={() => onToggleActive(item)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Ativar/desativar"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {item.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.detailHref && (
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link to={item.detailHref}>
                          Abrir <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDialog(item);
                      }}
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item);
                      }}
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <PaginationFooter
          currentPage={sp.currentPage}
          totalPages={sp.totalPages}
          filteredCount={sp.filtered.length}
          totalCount={sp.totalCount}
          isSearching={sp.isSearching}
          itemLabelSingular={itemLabelSingular}
          itemLabelPlural={itemLabelPlural}
          onPrevious={sp.goToPreviousPage}
          onNext={sp.goToNextPage}
        />
      </CardContent>
    </Card>
  );
}
