import { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SortableTableBody } from "@/components/common/SortableTable";
import { SearchInput, PaginationFooter } from "@/components/common/SearchPaginationControls";
import { useSearchPagination } from "@/hooks/useSearchPagination";
import type { ProductCategory } from "@/hooks/useProductCategories";

interface CategoriesTabProps {
  categories: ProductCategory[] | undefined;
  isLoading: boolean;
  getColorClass: (color: string) => string;
  onOpenDialog: (category?: ProductCategory) => void;
  onToggleActive: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
  onReorder: (reorderedCategories: ProductCategory[]) => void;
}

export function CategoriesTab({
  categories,
  isLoading,
  getColorClass,
  onOpenDialog,
  onToggleActive,
  onDelete,
  onReorder,
}: CategoriesTabProps) {
  const getSearchableFields = useCallback(
    (c: ProductCategory) => [c.name, c.slug],
    [],
  );
  const sp = useSearchPagination({ data: categories, getSearchableFields });

  const renderCategoryCells = (category: ProductCategory) => (
    <>
      <TableCell className="font-medium">
        <Link
          to={`/admin/categories/${category.slug}`}
          className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
        >
          {category.name}
          <ArrowRight className="h-3.5 w-3.5 opacity-60" />
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">{category.slug}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${getColorClass(category.color)}`} />
          <span className="text-sm capitalize">{category.color}</span>
        </div>
      </TableCell>
      <TableCell>
        <Switch checked={category.is_active} onCheckedChange={() => onToggleActive(category)} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => onOpenDialog(category)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(category)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Categorias de Produtos</CardTitle>
          <CardDescription>
            Janela, Porta, Box, Espelho, etc. Arraste para reordenar (desativa durante busca).
          </CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <SearchInput search={sp.search} onSearchChange={sp.setSearch} />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Ordem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sp.paginated.length > 0 && !sp.isSearching ? (
                  <SortableTableBody
                    items={sp.paginated}
                    renderCells={renderCategoryCells}
                    getIsInactive={(cat) => !cat.is_active}
                    onReorder={onReorder}
                  />
                ) : sp.paginated.length > 0 ? (
                  sp.paginated.map((cat) => (
                    <TableRow key={cat.id} className={!cat.is_active ? "opacity-50" : ""}>
                      <TableCell className="text-muted-foreground">{cat.sort_order}</TableCell>
                      {renderCategoryCells(cat)}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma categoria encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <PaginationFooter
              currentPage={sp.currentPage}
              totalPages={sp.totalPages}
              filteredCount={sp.filtered.length}
              totalCount={sp.totalCount}
              isSearching={sp.isSearching}
              itemLabelSingular="categoria"
              itemLabelPlural="categorias"
              onPrevious={sp.goToPreviousPage}
              onNext={sp.goToNextPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
