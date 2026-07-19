import { EntityCardGrid } from "./EntityCardGrid";
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
}: GlassTypesTabProps) {
  return (
    <EntityCardGrid
      title="Tipos de Vidro e Chaparia"
      description="Vidros, espelhos, acrílicos e outros materiais por m². Clique em um card para editar."
      addLabel="Novo Tipo de Vidro"
      itemLabelSingular="tipo"
      itemLabelPlural="tipos"
      data={glassTypes}
      isLoading={isLoading}
      onOpenDialog={onOpenDialog}
      onToggleActive={onToggleActive}
      onDelete={onDelete}
    />
  );
}
