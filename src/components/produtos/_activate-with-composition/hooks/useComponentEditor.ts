import { useState } from 'react';
import { toast } from 'sonner';
import type { ComponentItem, ItemTemplate } from '../types';

interface UseComponentEditorParams {
  setLocalItems: React.Dispatch<React.SetStateAction<ComponentItem[]>>;
  availableItems: ItemTemplate[] | undefined;
  activeTab: string;
  isAddingItem: boolean;
  setIsAddingItem: (v: boolean) => void;
}

/**
 * Encapsula todo o estado de formulário (add/edit) e as ações de
 * adicionar, editar inline, salvar e remover componentes.
 * Mantém comportamento idêntico ao componente original.
 */
export function useComponentEditor({
  setLocalItems,
  availableItems,
  activeTab,
  isAddingItem,
  setIsAddingItem,
}: UseComponentEditorParams) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state (compartilhado entre Add e Edit)
  const [selectedItemTemplateId, setSelectedItemTemplateId] = useState('');
  const [quantityFormula, setQuantityFormula] = useState('1');
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [piecesFormula, setPiecesFormula] = useState<string | null>(null);
  const [cutAngle, setCutAngle] = useState(90);
  const [widthFormula, setWidthFormula] = useState('');
  const [heightFormula, setHeightFormula] = useState('');
  const [glassName, setGlassName] = useState('');
  const [side, setSide] = useState<string | null>(null);
  const [calculationType, setCalculationType] = useState<'fixed' | 'per_side' | 'per_leaf' | 'per_glass' | 'formula'>('formula');
  const [appliesTo, setAppliesTo] = useState<'product' | 'side' | 'leaf' | 'glass' | 'panel'>('side');

  const resetForm = () => {
    setSelectedItemTemplateId('');
    setQuantityFormula('1');
    setPiecesQuantity(1);
    setPiecesFormula(null);
    setCutAngle(90);
    setWidthFormula('');
    setHeightFormula('');
    setGlassName('');
    setSide(null);
    setCalculationType('formula');
    setAppliesTo('side');
    setSearchTerm('');
  };

  const handleAddItem = () => {
    if (!selectedItemTemplateId) {
      toast.error('Selecione um item');
      return;
    }

    const itemTemplate = availableItems?.find(i => i.id === selectedItemTemplateId);
    if (!itemTemplate) return;

    const newItem: ComponentItem = {
      id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      item_template_id: selectedItemTemplateId,
      quantity_formula: activeTab === 'glass' ? '1' : quantityFormula,
      pieces_quantity: piecesQuantity,
      pieces_formula: piecesFormula,
      cut_angle: cutAngle,
      width_formula: activeTab === 'glass' ? widthFormula : null,
      height_formula: activeTab === 'glass' ? heightFormula : null,
      is_optional: false,
      side: side,
      calculation_type: calculationType,
      applies_to: appliesTo,
      notes: activeTab === 'glass' ? glassName : null,
      isNew: true,
      item_template: {
        id: itemTemplate.id,
        name: itemTemplate.name,
        type: itemTemplate.type,
        unit: itemTemplate.unit,
        image_url: itemTemplate.image_url,
      },
    };

    setLocalItems(prev => [...prev, newItem]);
    setIsAddingItem(false);
    resetForm();
    toast.success('Item adicionado à composição');
  };

  const handleRemoveItem = (itemId: string) => {
    setLocalItems(prev => prev.filter(i => i.id !== itemId));
    toast.success('Item removido');
  };

  const saveCurrentEdit = () => {
    if (!editingItemId) return;
    setLocalItems(prev =>
      prev.map(item => {
        if (item.id !== editingItemId) return item;
        const itemType = item.item_template?.type;
        return {
          ...item,
          quantity_formula: itemType === 'glass' ? item.quantity_formula : quantityFormula,
          pieces_quantity: piecesQuantity,
          pieces_formula: piecesFormula,
          cut_angle: cutAngle,
          width_formula: itemType === 'glass' ? widthFormula : null,
          height_formula: itemType === 'glass' ? heightFormula : null,
          side: side,
          calculation_type: calculationType,
          applies_to: appliesTo,
          notes: itemType === 'glass' ? glassName : item.notes,
        };
      })
    );
  };

  const handleEditItem = (item: ComponentItem) => {
    if (editingItemId && editingItemId !== item.id) {
      saveCurrentEdit();
    }
    setEditingItemId(item.id);
    setQuantityFormula(item.quantity_formula);
    setPiecesQuantity(item.pieces_quantity);
    setPiecesFormula(item.pieces_formula || null);
    setCutAngle(item.cut_angle);
    setWidthFormula(item.width_formula || '');
    setHeightFormula(item.height_formula || '');
    setGlassName(item.notes || '');
    setSide(item.side || null);
    setCalculationType(item.calculation_type || 'formula');
    setAppliesTo(item.applies_to || 'side');
  };

  const handleSaveEdit = () => {
    if (!editingItemId) return;
    saveCurrentEdit();
    setEditingItemId(null);
    resetForm();
    toast.success('Item atualizado');
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    resetForm();
  };

  return {
    // state
    isAddingItem,
    setIsAddingItem,
    editingItemId,
    setEditingItemId,
    searchTerm,
    setSearchTerm,

    // form fields
    selectedItemTemplateId,
    setSelectedItemTemplateId,
    quantityFormula,
    setQuantityFormula,
    piecesQuantity,
    setPiecesQuantity,
    piecesFormula,
    setPiecesFormula,
    cutAngle,
    setCutAngle,
    widthFormula,
    setWidthFormula,
    heightFormula,
    setHeightFormula,
    glassName,
    setGlassName,
    side,
    setSide,
    calculationType,
    setCalculationType,
    appliesTo,
    setAppliesTo,

    // actions
    resetForm,
    handleAddItem,
    handleRemoveItem,
    handleEditItem,
    handleSaveEdit,
    handleCancelEdit,
    saveCurrentEdit,
  };
}
