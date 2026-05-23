import { Package, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { itemTypeTabs } from '../constants';
import type { ComponentItem } from '../types';
import { ComponentRow } from './ComponentRow';

interface ComponentsStepProps {
  activeTab: string;
  onActiveTabChange: (v: string) => void;
  localItems: ComponentItem[];
  autoLoadedGlassCount: number;
  editingItemId: string | null;
  onAddClick: () => void;
  // ComponentRow callbacks
  onEdit: (item: ComponentItem) => void;
  onRemove: (id: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  // form state passed through
  quantityFormula: string;
  setQuantityFormula: (v: string) => void;
  piecesQuantity: number;
  setPiecesQuantity: (n: number) => void;
  piecesFormula: string | null;
  setPiecesFormula: (v: string | null) => void;
  cutAngle: number;
  setCutAngle: (n: number) => void;
  widthFormula: string;
  setWidthFormula: (v: string) => void;
  heightFormula: string;
  setHeightFormula: (v: string) => void;
  glassName: string;
  setGlassName: (v: string) => void;
  side: string | null;
  setSide: (v: string | null) => void;
  calculationType: 'fixed' | 'per_side' | 'per_leaf' | 'per_glass' | 'formula';
  setCalculationType: (v: 'fixed' | 'per_side' | 'per_leaf' | 'per_glass' | 'formula') => void;
  appliesTo: 'product' | 'side' | 'leaf' | 'glass' | 'panel';
  setAppliesTo: (v: 'product' | 'side' | 'leaf' | 'glass' | 'panel') => void;
}

export function ComponentsStep(props: ComponentsStepProps) {
  const {
    activeTab,
    onActiveTabChange,
    localItems,
    autoLoadedGlassCount,
    editingItemId,
    onAddClick,
  } = props;

  const getItemsByType = (type: string) => {
    const tab = itemTypeTabs.find(t => t.value === type);
    return localItems.filter(i => i.item_template?.type === tab?.dbType);
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      className="flex-1 flex flex-col min-h-0"
    >
      {itemTypeTabs.map(tab => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden"
        >
          <div className="flex justify-between items-center py-3 px-6 shrink-0">
            <span className="text-sm text-muted-foreground">
              {getItemsByType(tab.value).length} {tab.label.toLowerCase()} na composição
            </span>
            <Button size="sm" variant="outline" className="gap-2" onClick={onAddClick}>
              <Plus className="w-4 h-4" />
              Adicionar {tab.label.slice(0, -1).toLowerCase()}
            </Button>
          </div>

          {tab.value === 'glass' && autoLoadedGlassCount > 0 && (
            <div className="mb-3 p-3 bg-success/10 border border-success/30 rounded-lg flex items-center gap-2 mx-6">
              <Sparkles className="w-4 h-4 text-success shrink-0" />
              <p className="text-xs text-success">
                <strong>{autoLoadedGlassCount} vidro(s)</strong> carregado(s) automaticamente das
                fórmulas configuradas para este produto.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 pb-4">
            <div className="space-y-2">
              {getItemsByType(tab.value).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Nenhum {tab.label.toLowerCase().slice(0, -1)} adicionado
                  </p>
                  <Button variant="link" size="sm" onClick={onAddClick}>
                    Adicionar primeiro item
                  </Button>
                </div>
              ) : (
                getItemsByType(tab.value).map(item => (
                  <ComponentRow
                    key={item.id}
                    item={item}
                    isEditing={editingItemId === item.id}
                    onEdit={props.onEdit}
                    onRemove={props.onRemove}
                    onSaveEdit={props.onSaveEdit}
                    onCancelEdit={props.onCancelEdit}
                    quantityFormula={props.quantityFormula}
                    setQuantityFormula={props.setQuantityFormula}
                    piecesQuantity={props.piecesQuantity}
                    setPiecesQuantity={props.setPiecesQuantity}
                    piecesFormula={props.piecesFormula}
                    setPiecesFormula={props.setPiecesFormula}
                    cutAngle={props.cutAngle}
                    setCutAngle={props.setCutAngle}
                    widthFormula={props.widthFormula}
                    setWidthFormula={props.setWidthFormula}
                    heightFormula={props.heightFormula}
                    setHeightFormula={props.setHeightFormula}
                    glassName={props.glassName}
                    setGlassName={props.setGlassName}
                    side={props.side}
                    setSide={props.setSide}
                    calculationType={props.calculationType}
                    setCalculationType={props.setCalculationType}
                    appliesTo={props.appliesTo}
                    setAppliesTo={props.setAppliesTo}
                  />
                ))
              )}
            </div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
