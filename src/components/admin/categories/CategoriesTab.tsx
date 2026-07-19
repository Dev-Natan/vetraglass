import { EntityCardGrid } from "./EntityCardGrid";
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
}: CategoriesTabProps) {
  const items = (categories ?? []).map((c) => ({
    ...c,
    detailHref: `/admin/categories/${c.slug}`,
  }));

  return (
    <EntityCardGrid
      title="Categorias de Produtos"
      description="Janela, Porta, Box, Espelho, etc. Clique em um card para editar."
      addLabel="Nova Categoria"
      itemLabelSingular="categoria"
      itemLabelPlural="categorias"
      data={items}
      isLoading={isLoading}
      getColorClass={getColorClass}
      onOpenDialog={(item) => onOpenDialog(item as ProductCategory | undefined)}
      onToggleActive={(item) => onToggleActive(item as ProductCategory)}
      onDelete={(item) => onDelete(item as ProductCategory)}
    />
  );
}
