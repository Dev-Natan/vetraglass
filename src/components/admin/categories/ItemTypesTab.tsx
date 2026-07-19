import { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import type { ItemType } from "@/hooks/useItemTypes";

interface ItemTypesTabProps {
  itemTypes: ItemType[] | undefined;
  isLoading: boolean;
  getColorClass: (color: string) => string;
  onOpenDialog: (itemType?: ItemType) => void;
  onToggleActive: (itemType: ItemType) => void;
  onDelete: (itemType: ItemType) => void;
  onReorder: (reorderedItemTypes: ItemType[]) => void;
}

export function ItemTypesTab({
  itemTypes,
  isLoading,
  getColorClass,
  onOpenDialog,
  onToggleActive,
  onDelete,
  onReorder,
}: ItemTypesTabProps) {
  const getSearchableFields = useCallback(
    (t: ItemType) => [t.name, t.slug],
    [],
  );
  const sp = useSearchPagination({ data: itemTypes, getSearchableFields });

  const renderItemTypeCells = (itemType: ItemType) => (
    <>
      <TableCell className="font-medium">
        <Link
          to={`/admin/categories/${itemType.slug}`}
          className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
        >
          {itemType.name}
          <ArrowRight className="h-3.5 w-3.5 opacity-60" />
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">{itemType.slug}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${getColorClass(itemType.color)}`} />
          <span className="text-sm capitalize">{itemType.color}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{itemType.unit_default}</Badge>
      </TableCell>
      <TableCell>
        <Switch checked={itemType.is_active} onCheckedChange={() => onToggleActive(itemType)} />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => onOpenDialog(itemType)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(itemType)}>
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
          <CardTitle>Tipos de Itens</CardTitle>
          <CardDescription>
            Vidro, Perfil, Acessório, Serviço, etc. Arraste para reordenar (desativa durante busca).
          </CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tipo
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
                  <TableHead>Unidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sp.paginated.length > 0 && !sp.isSearching ? (
                  <SortableTableBody
                    items={sp.paginated}
                    renderCells={renderItemTypeCells}
                    getIsInactive={(type) => !type.is_active}
                    onReorder={onReorder}
                  />
                ) : sp.paginated.length > 0 ? (
                  sp.paginated.map((type) => (
                    <TableRow key={type.id} className={!type.is_active ? "opacity-50" : ""}>
                      <TableCell className="text-muted-foreground">{type.sort_order}</TableCell>
                      {renderItemTypeCells(type)}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum tipo encontrado
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
              itemLabelSingular="tipo"
              itemLabelPlural="tipos"
              onPrevious={sp.goToPreviousPage}
              onNext={sp.goToNextPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
