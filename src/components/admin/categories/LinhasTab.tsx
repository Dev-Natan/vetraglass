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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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

export function LinhasTab({
  linhas,
  isLoading,
  getColorClass,
  onOpenDialog,
  onToggleActive,
  onDelete,
  onReorder,
}: LinhasTabProps) {
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenDialog(linha)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(linha)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Linhas de Produtos</CardTitle>
          <CardDescription>Suprema, Gold, Vidro Temperado, etc. Arraste para reordenar.</CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Linha
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
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
              {linhas && linhas.length > 0 && (
                <SortableTableBody
                  items={linhas}
                  renderCells={renderLinhaCells}
                  getIsInactive={(linha) => !linha.is_active}
                  onReorder={onReorder}
                />
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
