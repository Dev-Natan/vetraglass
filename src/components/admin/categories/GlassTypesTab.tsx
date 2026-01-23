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
import type { GlassType } from "@/hooks/useGlassTypes";

interface GlassTypesTabProps {
  glassTypes: GlassType[] | undefined;
  isLoading: boolean;
  onOpenDialog: (glassType?: GlassType) => void;
  onToggleActive: (glassType: GlassType) => void;
  onDelete: (glassType: GlassType) => void;
  onReorder: (reorderedGlassTypes: GlassType[]) => void;
}

export function GlassTypesTab({
  glassTypes,
  isLoading,
  onOpenDialog,
  onToggleActive,
  onDelete,
  onReorder,
}: GlassTypesTabProps) {
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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenDialog(glassType)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(glassType)}
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
          <CardTitle>Tipos de Vidro</CardTitle>
          <CardDescription>Vidro Comum, Temperado, Laminado, etc. Arraste para reordenar.</CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tipo de Vidro
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
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {glassTypes && glassTypes.length > 0 && (
                <SortableTableBody
                  items={glassTypes}
                  renderCells={renderGlassTypeCells}
                  getIsInactive={(type) => !type.is_active}
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
