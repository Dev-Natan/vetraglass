import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { resolveProductImageUrl } from '@/utils/imageUrl';
import { ProductPricingStep, type ProductPricingData } from './ProductPricingStep';

import type { ActivateWithCompositionDialogProps, WizardStep } from './_activate-with-composition/types';
import { useActivationData } from './_activate-with-composition/hooks/useActivationData';
import { useComponentEditor } from './_activate-with-composition/hooks/useComponentEditor';
import { useActivationSubmit } from './_activate-with-composition/hooks/useActivationSubmit';
import { WizardStepper } from './_activate-with-composition/parts/WizardStepper';
import { ItemTypeTabs } from './_activate-with-composition/parts/ItemTypeTabs';
import { ComponentsStep } from './_activate-with-composition/parts/ComponentsStep';
import { AddItemDialog } from './_activate-with-composition/parts/AddItemDialog';
import { WizardFooter } from './_activate-with-composition/parts/WizardFooter';

export function ActivateWithCompositionDialog({
  open,
  onOpenChange,
  productTemplateId,
  productName,
  productImageUrl,
  onSuccess,
}: ActivateWithCompositionDialogProps) {
  const { currentCompany } = useAuth();

  // Wizard / aba
  const [wizardStep, setWizardStep] = useState<WizardStep>('components');
  const [activeTab, setActiveTab] = useState('glass');
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Pricing
  const [pricingData, setPricingData] = useState<ProductPricingData>({
    costPerSqm: 0,
    pricePerSqm: 0,
    hasGlass: false,
    glassPrices: [],
  });

  // Dados (queries + estado de itens locais)
  const { localItems, setLocalItems, autoLoadedGlassCount, loadingItems, availableItems } =
    useActivationData({
      open,
      productTemplateId,
      activeTab,
      isAddingItem,
    });

  // Editor de componentes (form + add/edit/remove)
  const editor = useComponentEditor({
    setLocalItems,
    availableItems,
    activeTab,
    isAddingItem,
    setIsAddingItem,
  });

  const filteredAvailableItems = useMemo(() => {
    if (!availableItems) return [];
    if (!editor.searchTerm) return availableItems;
    const q = editor.searchTerm.toLowerCase();
    return availableItems.filter(
      i => i.name.toLowerCase().includes(q) || i.linha?.toLowerCase().includes(q)
    );
  }, [availableItems, editor.searchTerm]);

  const hasGlassComponents = useMemo(
    () => localItems.some(i => i.item_template?.type === 'glass'),
    [localItems]
  );

  // Reset wizard ao abrir
  useEffect(() => {
    if (open) {
      setWizardStep('components');
      setPricingData({ costPerSqm: 0, pricePerSqm: 0, hasGlass: false, glassPrices: [] });
    }
  }, [open]);

  const activateMutation = useActivationSubmit({
    companyId: currentCompany?.id,
    productTemplateId,
    localItems,
    pricingData,
    onDone: () => onOpenChange(false),
    onSuccess,
  });

  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen && editor.editingItemId) {
      editor.saveCurrentEdit();
      editor.setEditingItemId(null);
    }
    if (!newOpen) {
      editor.setIsAddingItem(false);
      editor.resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {productImageUrl ? (
                  <img
                    src={resolveProductImageUrl(productImageUrl)}
                    alt={productName}
                    className="w-full h-full object-contain p-1"
                  />
                ) : (
                  <Package className="w-7 h-7 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Ativar: {productName}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-sm">
                  {wizardStep === 'components'
                    ? 'Configure os componentes do produto'
                    : 'Defina os preços do produto'}
                </DialogDescription>
              </div>
            </div>

            <WizardStepper current={wizardStep} onChange={setWizardStep} />

            {wizardStep === 'components' && (
              <ItemTypeTabs activeTab={activeTab} onChange={setActiveTab} localItems={localItems} />
            )}
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {loadingItems ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : wizardStep === 'pricing' ? (
              <ScrollArea className="flex-1 p-6">
                <ProductPricingStep
                  productName={productName}
                  hasGlassComponents={hasGlassComponents}
                  initialData={pricingData}
                  onChange={setPricingData}
                />
              </ScrollArea>
            ) : (
              <ComponentsStep
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
                localItems={localItems}
                autoLoadedGlassCount={autoLoadedGlassCount}
                editingItemId={editor.editingItemId}
                onAddClick={() => {
                  editor.setIsAddingItem(true);
                  editor.resetForm();
                }}
                onEdit={editor.handleEditItem}
                onRemove={editor.handleRemoveItem}
                onSaveEdit={editor.handleSaveEdit}
                onCancelEdit={editor.handleCancelEdit}
                quantityFormula={editor.quantityFormula}
                setQuantityFormula={editor.setQuantityFormula}
                piecesQuantity={editor.piecesQuantity}
                setPiecesQuantity={editor.setPiecesQuantity}
                piecesFormula={editor.piecesFormula}
                setPiecesFormula={editor.setPiecesFormula}
                cutAngle={editor.cutAngle}
                setCutAngle={editor.setCutAngle}
                widthFormula={editor.widthFormula}
                setWidthFormula={editor.setWidthFormula}
                heightFormula={editor.heightFormula}
                setHeightFormula={editor.setHeightFormula}
                glassName={editor.glassName}
                setGlassName={editor.setGlassName}
                side={editor.side}
                setSide={editor.setSide}
              />
            )}
          </div>

          <WizardFooter
            wizardStep={wizardStep}
            setWizardStep={setWizardStep}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            totalItems={localItems.length}
            pricePerSqm={pricingData.pricePerSqm}
            isPending={activateMutation.isPending}
            onCancel={() => handleDialogClose(false)}
            onActivate={() => activateMutation.mutate()}
            onGoToPricing={() => {
              setPricingData(prev => ({ ...prev, hasGlass: hasGlassComponents }));
              setWizardStep('pricing');
            }}
          />
        </DialogContent>
      </Dialog>

      <AddItemDialog
        open={editor.isAddingItem}
        onOpenChange={editor.setIsAddingItem}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchTerm={editor.searchTerm}
        setSearchTerm={editor.setSearchTerm}
        filteredAvailableItems={filteredAvailableItems}
        selectedItemTemplateId={editor.selectedItemTemplateId}
        setSelectedItemTemplateId={editor.setSelectedItemTemplateId}
        piecesQuantity={editor.piecesQuantity}
        setPiecesQuantity={editor.setPiecesQuantity}
        quantityFormula={editor.quantityFormula}
        setQuantityFormula={editor.setQuantityFormula}
        cutAngle={editor.cutAngle}
        setCutAngle={editor.setCutAngle}
        widthFormula={editor.widthFormula}
        setWidthFormula={editor.setWidthFormula}
        heightFormula={editor.heightFormula}
        setHeightFormula={editor.setHeightFormula}
        glassName={editor.glassName}
        setGlassName={editor.setGlassName}
        side={editor.side}
        setSide={editor.setSide}
        onAdd={editor.handleAddItem}
      />
    </>
  );
}
