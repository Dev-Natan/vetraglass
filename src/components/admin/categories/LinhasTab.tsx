import { EntityCardGrid } from "./EntityCardGrid";
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
}: LinhasTabProps) {
  return (
    <EntityCardGrid
      title="Linhas de Produtos"
      description="Suprema, Gold, Vidro Temperado, etc. Clique em um card para editar."
      addLabel="Nova Linha"
      itemLabelSingular="linha"
      itemLabelPlural="linhas"
      data={linhas}
      isLoading={isLoading}
      getColorClass={getColorClass}
      onOpenDialog={onOpenDialog}
      onToggleActive={onToggleActive}
      onDelete={onDelete}
    />
  );
}
