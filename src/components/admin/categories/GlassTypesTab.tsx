import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { SortableTableBody } from "@/components/common/SortableTable";
import type { GlassType } from "@/hooks/useGlassTypes";

interface GlassTypesTabProps {
  glassTypes: GlassType[] | undefined;
  isLoading: boolean;
  onOpenDialog: (glassType?: GlassType) => void;
  onToggleActive: (glassType: GlassType) => void;
  onDelete: (glassType: GlassType) => void;
  onReorder: (reorderedGlassTypes: GlassType[]) => void;
}

const PAGE_SIZE = 10;

export function GlassTypesTab({
  glassTypes,
  isLoading,
  onOpenDialog,
  onToggleActive,
  onDelete,
  onReorder,
}: GlassTypesTabProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!glassTypes) return [];
    const term = search.trim().toLowerCase();
    if (!term) return glassTypes;
    return glassTypes.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        g.slug.toLowerCase().includes(term),
    );
  }, [glassTypes, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );
  const isSearching = search.trim().length > 0;

  const renderGlassTypeCells = (glassType: GlassType) => (
    <>
      <TableCell className="font-medium">{glassType.name}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">
        {glassType.slug}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
        {glassType.description || "-"}
      </TableCell>
      <TableCell>
        <Switch
          checked={glassType.is_active}
          onCheckedChange={() => onToggleActive(glassType)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => onOpenDialog(glassType)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(glassType)}>
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
          <CardTitle>Tipos de Vidro e Chaparia</CardTitle>
          <CardDescription>
            Vidros, espelhos, acrílicos e outros materiais por m². Arraste para reordenar (desativa durante busca).
          </CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tipo de Vidro
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou slug..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

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
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length > 0 && !isSearching ? (
                  <SortableTableBody
                    items={paginated}
                    renderCells={renderGlassTypeCells}
                    getIsInactive={(type) => !type.is_active}
                    onReorder={onReorder}
                  />
                ) : paginated.length > 0 ? (
                  paginated.map((type) => (
                    <TableRow key={type.id} className={!type.is_active ? "opacity-50" : ""}>
                      <TableCell className="text-muted-foreground">{type.sort_order}</TableCell>
                      {renderGlassTypeCells(type)}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum tipo de vidro encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "tipo" : "tipos"}
                {isSearching && glassTypes ? ` de ${glassTypes.length}` : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
