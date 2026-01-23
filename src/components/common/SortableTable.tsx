import { ReactNode, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SortableItem {
  id: string;
  sort_order: number;
}

interface SortableTableRowProps<T extends SortableItem> {
  item: T;
  renderCells: (item: T) => ReactNode;
  isInactive?: boolean;
}

function SortableTableRow<T extends SortableItem>({
  item,
  renderCells,
  isInactive,
}: SortableTableRowProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        isInactive && "opacity-50",
        isDragging && "bg-accent shadow-lg z-50 relative"
      )}
    >
      <TableCell className="w-12">
        <button
          className="flex items-center gap-2 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
          <span className="text-muted-foreground text-sm">{item.sort_order}</span>
        </button>
      </TableCell>
      {renderCells(item)}
    </TableRow>
  );
}

interface SortableTableBodyProps<T extends SortableItem> {
  items: T[];
  renderCells: (item: T) => ReactNode;
  getIsInactive?: (item: T) => boolean;
  onReorder: (items: T[]) => void;
}

export function SortableTableBody<T extends SortableItem>({
  items,
  renderCells,
  getIsInactive,
  onReorder,
}: SortableTableBodyProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const reorderedItems = arrayMove(items, oldIndex, newIndex).map(
        (item, index) => ({
          ...item,
          sort_order: index + 1,
        })
      );

      onReorder(reorderedItems);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableTableRow
            key={item.id}
            item={item}
            renderCells={renderCells}
            isInactive={getIsInactive?.(item)}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
