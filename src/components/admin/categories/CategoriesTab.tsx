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
  const renderCategoryCells = (category: ProductCategory) => (
    <>
      <TableCell className="font-medium">{category.name}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">
        {category.slug}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${getColorClass(category.color)}`} />
          <span className="text-sm capitalize">{category.color}</span>
        </div>
      </TableCell>
      <TableCell>
        <Switch
          checked={category.is_active}
          onCheckedChange={() => onToggleActive(category)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenDialog(category)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(category)}
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
          <CardTitle>Categorias de Produtos</CardTitle>
          <CardDescription>Janela, Porta, Box, Espelho, etc. Arraste para reordenar.</CardDescription>
        </div>
        <Button onClick={() => onOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Categoria
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories && categories.length > 0 && (
                <SortableTableBody
                  items={categories}
                  renderCells={renderCategoryCells}
                  getIsInactive={(cat) => !cat.is_active}
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
