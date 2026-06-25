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
import type { ProductLinha } from "@/hooks/useProductLinhas";

interface LinhasTabProps {
  linhas: ProductLinha[] | undefined;
  isLoading: boolean;
  getColorClass: (color: string) => string;
  onOpenDialog: (linha?: ProductLinha) => void;
  onToggleActive: (linha: ProductLinha) => void;
  onDelete: (linha: ProductLinha) => void;
  onReorder: (reorderedLinhas: ProductLinha[]) => void;
}

const PAGE_SIZE = 10;

export function LinhasTab({
  linhas,
  isLoading,
  getColorClass,
  onOpenDialog,
  onToggleActive,
  onDelete,
  onReorder,
}: LinhasTabProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!linhas) return [];
    const term = search.trim().toLowerCase();
    if (!term) return linhas;
    return linhas.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        l.slug.toLowerCase().includes(term),
    );
  }, [linhas, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );
  const isSearching = search.trim().length > 0;

  const renderLinhaCells = (linha: ProductLinha) => (
    <>
      <TableCell className="font-medium">{linha.name}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">
        {linha.slug}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${getColorClass(linha.color)}`} />
          <span className="text-sm capitalize">{linha.color}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
        {linha.description || "-"}
      </TableCell>
      <TableCell>
        <Switch
          checked={linha.is_active}
          onCheckedChange={() => onToggleActive(linha)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => onOpenDialog(linha)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(linha)}>
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
          <CardTitle>Linhas de Produtos</CardTitle>
          <CardDescription>
            Suprema, Gold, Vidro Temperado, etc. Arraste para reordenar (desativa durante busca).
          </CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Linha
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
                  <TableHead>Cor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length > 0 && !isSearching ? (
                  <SortableTableBody
                    items={paginated}
                    renderCells={renderLinhaCells}
                    getIsInactive={(linha) => !linha.is_active}
                    onReorder={onReorder}
                  />
                ) : paginated.length > 0 ? (
                  paginated.map((linha) => (
                    <TableRow key={linha.id} className={!linha.is_active ? "opacity-50" : ""}>
                      <TableCell className="text-muted-foreground">{linha.sort_order}</TableCell>
                      {renderLinhaCells(linha)}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma linha encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "linha" : "linhas"}
                {isSearching && linhas ? ` de ${linhas.length}` : ""}
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
