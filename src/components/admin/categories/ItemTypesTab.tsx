import { EntityCardGrid } from "./EntityCardGrid";
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
}: ItemTypesTabProps) {
  const items = (itemTypes ?? []).map((t) => ({
    ...t,
    detailHref: `/admin/categories/${t.slug}`,
    meta: [{ label: "Unidade", value: t.unit_default }],
  }));

  return (
    <EntityCardGrid
      title="Tipos de Itens"
      description="Vidro, Perfil, Acessório, Serviço, etc. Clique em um card para abrir a edição completa."
      addLabel="Novo Tipo"
      itemLabelSingular="tipo"
      itemLabelPlural="tipos"
      data={items}
      isLoading={isLoading}
      getColorClass={getColorClass}
      onOpenDialog={(item) => onOpenDialog(item as ItemType | undefined)}
      onToggleActive={(item) => onToggleActive(item as ItemType)}
      onDelete={(item) => onDelete(item as ItemType)}
      preferDetailOnCardClick
    />
  );
}

