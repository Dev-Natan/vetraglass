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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { SortableTableBody } from "@/components/common/SortableTable";
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
  const renderItemTypeCells = (itemType: ItemType) => (
    <>
      <TableCell className="font-medium">{itemType.name}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">
        {itemType.slug}
      </TableCell>
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
        <Switch
          checked={itemType.is_active}
          onCheckedChange={() => onToggleActive(itemType)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenDialog(itemType)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(itemType)}
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
          <CardTitle>Tipos de Itens</CardTitle>
          <CardDescription>Vidro, Perfil, Acessório, Serviço, etc. Arraste para reordenar.</CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tipo
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
                <TableHead>Unidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemTypes && itemTypes.length > 0 && (
                <SortableTableBody
                  items={itemTypes}
                  renderCells={renderItemTypeCells}
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
