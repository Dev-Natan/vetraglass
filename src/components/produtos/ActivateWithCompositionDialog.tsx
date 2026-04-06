import { useState, useEffect, useMemo, useRef } from 'react';
import { resolveItemImageUrl, resolveProductImageUrl } from '@/utils/imageUrl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Package,
  Sparkles,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  X,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  CircleDot,
  Circle,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { toast } from 'sonner';
import { FormulaEditor } from './FormulaEditor';
import { GlassFormulaEditor } from './GlassFormulaEditor';
import { ProductPricingStep, ProductPricingData } from './ProductPricingStep';
import { useGlassPriceMatrixMutations } from '@/hooks/useGlassPricing';

interface ActivateWithCompositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productTemplateId: string;
  productName: string;
  productImageUrl?: string | null;
  onSuccess?: () => void;
}

interface ComponentItem {
  id: string;
  item_template_id: string;
  quantity_formula: string;
  pieces_quantity: number;
  pieces_formula?: string | null;
  cut_angle: number;
  width_formula: string | null;
  height_formula: string | null;
  is_optional: boolean;
  notes: string | null;
  isNew?: boolean;
  item_template: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
  };
}

interface ItemTemplate {
  id: string;
  name: string;
  type: string;
  unit: string;
  image_url: string | null;
  linha: string | null;
}

const itemTypeTabs = [
  { value: 'glass', label: 'VIDROS', dbType: 'glass' },
  { value: 'profile', label: 'PERFIS', dbType: 'profile' },
  { value: 'accessory', label: 'ACESSÓRIOS', dbType: 'accessory' },
];

const typeColors: Record<string, string> = {
  profile: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  glass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  accessory: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const typeLabels: Record<string, string> = {
  profile: 'Perfil',
  glass: 'Vidro',
  accessory: 'Acessório',
};

export function ActivateWithCompositionDialog({
  open,
  onOpenChange,
  productTemplateId,
  productName,
  productImageUrl,
  onSuccess,
}: ActivateWithCompositionDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const { bulkUpsertMutation } = useGlassPriceMatrixMutations();
  
  // Main wizard step: 'components' or 'pricing'
  const [wizardStep, setWizardStep] = useState<'components' | 'pricing'>('components');
  const [activeTab, setActiveTab] = useState('glass');
  const [localItems, setLocalItems] = useState<ComponentItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pricing state
  const [pricingData, setPricingData] = useState<ProductPricingData>({
    costPerSqm: 0,
    pricePerSqm: 0,
    hasGlass: false,
    glassPrices: [],
  });
  const [autoLoadedGlassCount, setAutoLoadedGlassCount] = useState(0);

  // Form states for adding/editing
  const [selectedItemTemplateId, setSelectedItemTemplateId] = useState('');
  const [quantityFormula, setQuantityFormula] = useState('1');
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [piecesFormula, setPiecesFormula] = useState<string | null>(null);
  const [cutAngle, setCutAngle] = useState(90);
  const [widthFormula, setWidthFormula] = useState('');
  const [heightFormula, setHeightFormula] = useState('');
  const [glassName, setGlassName] = useState('');

  // Fetch global template items
  const { data: globalItems, isLoading: loadingItems } = useQuery({
    queryKey: ['product-template-items-global', productTemplateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_template_items')
        .select(`
          id,
          item_template_id,
          quantity_formula,
          pieces_quantity,
          pieces_formula,
          cut_angle,
          width_formula,
          height_formula,
          is_optional,
          notes,
          item_template:item_templates (
            id,
            name,
            type,
            unit,
            image_url
          )
        `)
        .eq('product_template_id', productTemplateId)
        .is('company_id', null)
        .order('item_template_id');

      if (error) throw error;
      return (data as any) as ComponentItem[];
    },
    enabled: open && !!productTemplateId,
  });

  // Fetch glass formulas for this product from glass_line_formulas
  const { data: glassFormulas } = useQuery({
    queryKey: ['glass-formulas-for-product', productTemplateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glass_line_formulas')
        .select('*')
        .eq('product_template_id', productTemplateId)
        .eq('is_active', true)
        .order('panel_index')
        .order('formula_name');

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!productTemplateId,
  });

  // Fetch a generic glass item template to use for auto-added formulas
  const { data: genericGlassTemplate } = useQuery({
    queryKey: ['generic-glass-template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('type', 'glass')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: open,
  });

  // Initialize local items from global items + auto-add glass formulas
  useEffect(() => {
    if (globalItems) {
      let items = globalItems.map(item => ({ ...item }));
      let autoAddedCount = 0;
      
      // Check if there are glass formulas to add automatically
      if (glassFormulas && glassFormulas.length > 0 && genericGlassTemplate) {
        const existingGlassCount = items.filter(i => i.item_template?.type === 'glass').length;
        
        // Only auto-add if no glass items exist yet
        if (existingGlassCount === 0) {
          const autoGlassItems: ComponentItem[] = glassFormulas.map((formula, idx) => ({
            id: `auto-glass-${idx}-${Date.now()}`,
            item_template_id: genericGlassTemplate.id,
            quantity_formula: '1',
            pieces_quantity: 1,
            cut_angle: 90,
            width_formula: formula.width_formula,
            height_formula: formula.height_formula,
            is_optional: false,
            notes: formula.formula_name,
            isNew: true,
            item_template: {
              id: genericGlassTemplate.id,
              name: genericGlassTemplate.name,
              type: 'glass',
              unit: genericGlassTemplate.unit,
              image_url: genericGlassTemplate.image_url,
            },
          }));
          
          items = [...items, ...autoGlassItems];
          autoAddedCount = autoGlassItems.length;
        }
      }
      
      setLocalItems(items);
      setAutoLoadedGlassCount(autoAddedCount);
    }
  }, [globalItems, glassFormulas, genericGlassTemplate]);

  // Check if product has glass components
  const hasGlassComponents = useMemo(() => {
    return localItems.some(item => item.item_template?.type === 'glass');
  }, [localItems]);

  // Reset wizard step when dialog opens
  useEffect(() => {
    if (open) {
      setWizardStep('components');
      setPricingData({
        costPerSqm: 0,
        pricePerSqm: 0,
        hasGlass: false,
        glassPrices: [],
      });
    }
  }, [open]);

  // Fetch available item templates for adding
  const { data: availableItems } = useQuery({
    queryKey: ['item-templates-for-composition', activeTab],
    queryFn: async () => {
      const currentTab = itemTypeTabs.find(t => t.value === activeTab);
      const dbType = currentTab?.dbType || 'accessory';

      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('type', dbType as "accessory" | "glass" | "profile" | "service")
        .eq('is_active', true)
        .order('linha')
        .order('name');

      if (error) throw error;
      return data as ItemTemplate[];
    },
    enabled: open && isAddingItem,
  });

  // Filter available items by search
  const filteredAvailableItems = useMemo(() => {
    if (!availableItems) return [];
    if (!searchTerm) return availableItems;
    const query = searchTerm.toLowerCase();
    return availableItems.filter(
      item => item.name.toLowerCase().includes(query) || item.linha?.toLowerCase().includes(query)
    );
  }, [availableItems, searchTerm]);

  // Get items by type for display
  const getItemsByType = (type: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === type);
    const dbType = currentTab?.dbType;
    return localItems.filter(item => item.item_template?.type === dbType);
  };

  const resetForm = () => {
    setSelectedItemTemplateId('');
    setQuantityFormula('1');
    setPiecesQuantity(1);
    setPiecesFormula(null);
    setCutAngle(90);
    setWidthFormula('');
    setHeightFormula('');
    setGlassName('');
    setSearchTerm('');
  };

  const handleAddItem = () => {
    if (!selectedItemTemplateId) {
      toast.error('Selecione um item');
      return;
    }

    const itemTemplate = availableItems?.find(i => i.id === selectedItemTemplateId);
    if (!itemTemplate) return;

    // Allow duplicate items with different formulas - no restriction needed
    // Each item can be added multiple times with different configurations

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

  // Save current edit before switching
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
          notes: itemType === 'glass' ? glassName : item.notes,
        };
      })
    );
  };

  const handleEditItem = (item: ComponentItem) => {
    // Save current edit before switching to another item
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
  };

  const handleSaveEdit = () => {
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
          notes: itemType === 'glass' ? glassName : item.notes,
        };
      })
    );

    setEditingItemId(null);
    resetForm();
    toast.success('Item atualizado');
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    resetForm();
  };

  // Activation mutation - now includes pricing
  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      // 1. Activate the product template for the company
      const { data: activatedProduct, error: activateError } = await supabase.rpc(
        'activate_product_template_for_company',
        {
          _company_id: currentCompany.id,
          _product_template_id: productTemplateId,
        }
      );

      if (activateError) throw activateError;

      // 2. Update company product with pricing
      if (activatedProduct) {
        const { error: priceError } = await supabase
          .from('company_products')
          .update({
            cost_per_sqm: pricingData.costPerSqm,
            price_per_sqm: pricingData.pricePerSqm,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activatedProduct);

        if (priceError) {
          console.error('Error updating prices:', priceError);
        }
      }

      // 3. Save glass prices if any
      if (pricingData.hasGlass && pricingData.glassPrices.length > 0) {
        // Get the default glass type (comum)
        const { data: glassTypes } = await supabase
          .from('glass_types')
          .select('id')
          .eq('slug', 'comum')
          .single();

        const glassTypeId = glassTypes?.id;

        if (glassTypeId) {
          const priceEntries = pricingData.glassPrices
            .filter(p => p.price > 0 || p.cost > 0)
            .map(p => ({
              glass_type_id: glassTypeId,
              glass_color_id: p.colorId,
              glass_thickness_id: p.thicknessId,
              cost_per_sqm: p.cost,
              price_per_sqm: p.price,
            }));

          if (priceEntries.length > 0) {
            await bulkUpsertMutation.mutateAsync(priceEntries);
          }
        }
      }

      // 4. Insert all items with company_id
      const itemInserts = localItems.map(item => ({
        company_id: currentCompany.id,
        product_template_id: productTemplateId,
        item_template_id: item.item_template_id,
        quantity_formula: item.quantity_formula,
        pieces_quantity: item.pieces_quantity,
        pieces_formula: item.pieces_formula,
        cut_angle: item.cut_angle,
        width_formula: item.width_formula,
        height_formula: item.height_formula,
        is_optional: item.is_optional,
        notes: item.notes,
      }));

      if (itemInserts.length > 0) {
        const { error: insertError } = await supabase
          .from('product_template_items')
          .insert(itemInserts);

        if (insertError) {
          console.error('Error inserting components:', insertError);
        }
      }

      // REGRA DE OURO: NÃO criar estoque automaticamente
      // O estoque deve ser cadastrado manualmente pelo usuário quando comprar materiais.
      // Isso garante rastreabilidade total: todo item no estoque tem origem conhecida.
      // Os componentes do produto são apenas referências técnicas, não estoque físico.

      return activatedProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['linha-products'] });
      queryClient.invalidateQueries({ queryKey: ['glass-price-matrix'] });
      toast.success('Produto ativado com sucesso!', {
        description: `${localItems.length} componentes e preços configurados`,
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Activation error:', error);
      toast.error('Erro ao ativar produto', {
        description: error.message,
      });
    },
  });

  const getItemImage = resolveItemImageUrl;
  const getProductImage = resolveProductImageUrl;

  // Handle dialog close - save any pending edit
  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen && editingItemId) {
      saveCurrentEdit();
      setEditingItemId(null);
    }
    if (!newOpen) {
      setIsAddingItem(false);
      resetForm();
    }
    onOpenChange(newOpen);
  };

  // Wizard steps config
  const wizardSteps = [
    { id: 'components', label: 'Componentes', icon: Package },
    { id: 'pricing', label: 'Preços', icon: DollarSign },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
          {/* Header with Stepper */}
          <DialogHeader className="p-6 pb-4 border-b shrink-0">
            <div className="flex items-center gap-4 mb-4">
              {/* Product Image */}
              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {productImageUrl ? (
                  <img
                    src={getProductImage(productImageUrl)}
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
            
            {/* Main Wizard Steps */}
            <div className="flex items-center gap-2 mb-3">
              {wizardSteps.map((step, index) => {
                const isActive = wizardStep === step.id;
                const isPast = wizardSteps.findIndex(s => s.id === wizardStep) > index;
                const StepIcon = step.icon;
                
                return (
                  <button
                    key={step.id}
                    onClick={() => {
                      // Only allow going back, not forward (must use Next button)
                      if (isPast) {
                        setWizardStep(step.id as 'components' | 'pricing');
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all flex-1 justify-center ${
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : isPast
                          ? 'bg-success/20 text-success hover:bg-success/30 cursor-pointer'
                          : 'bg-muted text-muted-foreground'
                    }`}
                    disabled={!isPast && !isActive}
                  >
                    {isPast ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <StepIcon className="w-4 h-4 shrink-0" />
                    )}
                    <span className="text-sm font-medium">{step.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Item Type Tabs - only show in components step */}
            {wizardStep === 'components' && (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                {itemTypeTabs.map((tab, index) => {
                  const itemCount = getItemsByType(tab.value).length;
                  const isActive = activeTab === tab.value;
                  const hasItems = itemCount > 0;
                  
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setActiveTab(tab.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all flex-1 justify-center ${
                        isActive 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : hasItems
                            ? 'bg-success/20 text-success hover:bg-success/30'
                            : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {hasItems && !isActive ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : isActive ? (
                        <CircleDot className="w-4 h-4 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 shrink-0" />
                      )}
                      <span className="text-xs font-medium hidden sm:inline">{tab.label}</span>
                      <span className="text-xs font-medium sm:hidden">{tab.label.slice(0, 3)}</span>
                      {itemCount > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive
                          ? 'bg-primary-foreground/20' 
                          : 'bg-current/10'
                      }`}>
                        {itemCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            )}
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {loadingItems ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : wizardStep === 'pricing' ? (
              /* Pricing Step */
              <ScrollArea className="flex-1 p-6">
                <ProductPricingStep
                  productName={productName}
                  hasGlassComponents={hasGlassComponents}
                  initialData={pricingData}
                  onChange={setPricingData}
                />
              </ScrollArea>
            ) : (
              /* Components Step */
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">

                {itemTypeTabs.map(tab => (
                  <TabsContent key={tab.value} value={tab.value} className="flex-1 flex flex-col min-h-0 mt-0 data-[state=inactive]:hidden">
                    {/* Add item button */}
                    <div className="flex justify-between items-center py-3 px-6 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        {getItemsByType(tab.value).length} {tab.label.toLowerCase()} na composição
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          setActiveTab(tab.value);
                          setIsAddingItem(true);
                          resetForm();
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar {tab.label.slice(0, -1).toLowerCase()}
                      </Button>
                    </div>

                    {/* Auto-loaded glass indicator */}
                    {tab.value === 'glass' && autoLoadedGlassCount > 0 && (
                      <div className="mb-3 p-3 bg-success/10 border border-success/30 rounded-lg flex items-center gap-2 mx-6">
                        <Sparkles className="w-4 h-4 text-success shrink-0" />
                        <p className="text-xs text-success">
                          <strong>{autoLoadedGlassCount} vidro(s)</strong> carregado(s) automaticamente das fórmulas configuradas para este produto.
                        </p>
                      </div>
                    )}

                    {/* Items list - proper scrollable container */}
                    <div className="flex-1 overflow-y-auto px-6 pb-4">
                      <div className="space-y-2">
                        {getItemsByType(tab.value).length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhum {tab.label.toLowerCase().slice(0, -1)} adicionado</p>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => setIsAddingItem(true)}
                            >
                              Adicionar primeiro item
                            </Button>
                          </div>
                        ) : (
                          getItemsByType(tab.value).map(item => {
                            const isEditing = editingItemId === item.id;
                            const itemType = item.item_template?.type;

                            if (isEditing) {
                              // Edit mode
                              return (
                                <div key={item.id} className="rounded-lg border-2 border-primary bg-primary/5 overflow-hidden">
                                  {/* Collapsible header - click to close */}
                                  <button 
                                    type="button"
                                    className="flex items-center gap-3 p-3 w-full text-left hover:bg-primary/10 transition-colors"
                                    onClick={handleSaveEdit}
                                  >
                                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                                      {item.item_template?.image_url ? (
                                        <img
                                          src={getItemImage(item.item_template.image_url)}
                                          alt={item.item_template.name}
                                          className="w-full h-full object-contain p-1"
                                        />
                                      ) : (
                                        <Package className="w-5 h-5 text-muted-foreground/50" />
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate">{item.item_template?.name}</p>
                                      <p className="text-xs text-primary">Clique para fechar e salvar</p>
                                    </div>
                                    <ChevronUp className="w-5 h-5 text-primary shrink-0" />
                                  </button>

                                  {/* Edit form */}
                                  <div className="p-4 pt-2 space-y-4 border-t border-primary/20">

                                  {/* Editor based on type */}
                                  {itemType === 'glass' ? (
                                    <div className="space-y-3">
                                      {/* Quantidade de peças */}
                                      <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                          <Package className="w-4 h-4" />
                                          Quantidade de peças
                                        </Label>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => setPiecesQuantity(Math.max(1, piecesQuantity - 1))}
                                            disabled={piecesQuantity <= 1}
                                          >
                                            <span className="text-lg font-medium">-</span>
                                          </Button>
                                          <Input
                                            type="number"
                                            min={1}
                                            value={piecesQuantity}
                                            onChange={e => setPiecesQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-20 text-center font-medium"
                                          />
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                            onClick={() => setPiecesQuantity(piecesQuantity + 1)}
                                          >
                                            <span className="text-lg font-medium">+</span>
                                          </Button>
                                          <span className="text-sm text-muted-foreground">
                                            {piecesQuantity === 1 ? 'peça' : 'peças'}
                                          </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Quantas unidades deste vidro compõem o produto
                                        </p>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <Label className="text-sm">Nome do vidro (opcional)</Label>
                                        <Input
                                          value={glassName}
                                          onChange={e => setGlassName(e.target.value)}
                                          placeholder="Ex: Vidro Fixo Superior"
                                        />
                                      </div>
                                      <GlassFormulaEditor
                                        widthFormula={widthFormula}
                                        heightFormula={heightFormula}
                                        onWidthFormulaChange={setWidthFormula}
                                        onHeightFormulaChange={setHeightFormula}
                                        showPiecesQuantity={true}
                                        piecesQuantity={piecesQuantity}
                                        onPiecesChange={setPiecesQuantity}
                                        piecesFormula={piecesFormula}
                                        onPiecesFormulaChange={setPiecesFormula}
                                      />
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      <FormulaEditor
                                        value={quantityFormula}
                                        onChange={setQuantityFormula}
                                        showPiecesQuantity={itemType === 'profile'}
                                        piecesQuantity={piecesQuantity}
                                        onPiecesChange={setPiecesQuantity}
                                        piecesFormula={piecesFormula}
                                        onPiecesFormulaChange={setPiecesFormula}
                                      />
                                      {itemType === 'profile' && (
                                        <div className="space-y-2">
                                          <Label>Ângulo de corte</Label>
                                          <Select value={cutAngle.toString()} onValueChange={v => setCutAngle(Number(v))}>
                                            <SelectTrigger className="w-32">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="45">45°</SelectItem>
                                              <SelectItem value="90">90°</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                    <div className="flex justify-end gap-2 pt-2 border-t border-border/50 mt-4">
                                      <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                        Descartar alterações
                                      </Button>
                                      <Button size="sm" onClick={handleSaveEdit} className="gap-1">
                                        <Check className="w-4 h-4" />
                                        Salvar e fechar
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            // Display mode - clickable to edit
                            return (
                              <button
                                type="button"
                                key={item.id}
                                className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors group w-full text-left"
                                onClick={() => handleEditItem(item)}
                              >
                                <div className="w-12 h-12 rounded bg-muted flex items-center justify-center shrink-0">
                                  {item.item_template?.image_url ? (
                                    <img
                                      src={getItemImage(item.item_template.image_url)}
                                      alt={item.item_template.name}
                                      className="w-full h-full object-contain p-1"
                                    />
                                  ) : (
                                    <Package className="w-6 h-6 text-muted-foreground/50" />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  {item.notes && itemType === 'glass' && (
                                    <p className="font-semibold text-sm truncate">{item.notes}</p>
                                  )}
                                  <p className={`text-sm truncate ${item.notes && itemType === 'glass' ? 'text-muted-foreground' : 'font-medium'}`}>
                                    {item.item_template?.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge variant="secondary" className={`text-xs ${typeColors[itemType] || ''}`}>
                                      {typeLabels[itemType] || itemType}
                                    </Badge>
                                    {itemType === 'glass' ? (
                                      <>
                                        <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                          {item.pieces_formula ? item.pieces_formula : (item.pieces_quantity || 1)}x
                                        </span>
                                        {item.width_formula && (
                                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                            L: {item.width_formula}
                                          </span>
                                        )}
                                        {item.height_formula && (
                                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                            A: {item.height_formula}
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-xs text-muted-foreground">
                                          {item.quantity_formula}
                                        </span>
                                        {itemType === 'profile' && (
                                          <>
                                            <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                              {item.pieces_formula ? item.pieces_formula : (item.pieces_quantity || 1)}x
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded bg-muted">
                                              {item.cut_angle}°
                                            </span>
                                          </>
                                        )}
                                      </>
                                    )}
                                    {item.isNew && (
                                      <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                                        Novo
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <div
                                    role="button"
                                    tabIndex={0}
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveItem(item.id);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.stopPropagation();
                                        handleRemoveItem(item.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </div>
                                  <Edit2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </div>

          {/* Footer with Navigation */}
          <DialogFooter className="p-4 border-t shrink-0">
            <div className="flex items-center justify-between w-full gap-2">
              {/* Left: Back button */}
              <div className="flex items-center gap-2">
                {wizardStep === 'pricing' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setWizardStep('components')}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Voltar</span>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const currentIndex = itemTypeTabs.findIndex(t => t.value === activeTab);
                      if (currentIndex > 0) {
                        setActiveTab(itemTypeTabs[currentIndex - 1].value);
                      }
                    }}
                    disabled={itemTypeTabs.findIndex(t => t.value === activeTab) === 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Anterior</span>
                  </Button>
                )}
              </div>

              {/* Center: Status */}
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                {wizardStep === 'components' ? (
                  <>
                    <Package className="w-4 h-4" />
                    {localItems.length} componentes
                  </>
                ) : (
                  <>
                    <DollarSign className="w-4 h-4" />
                    {pricingData.pricePerSqm > 0 ? `R$ ${pricingData.pricePerSqm.toFixed(2)}/m²` : 'Defina o preço'}
                  </>
                )}
              </div>
              
              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDialogClose(false)}>
                  Cancelar
                </Button>
                
                {wizardStep === 'components' ? (
                  /* Next button - go to pricing */
                  <Button
                    size="sm"
                    onClick={() => {
                      // Update hasGlass in pricingData based on components
                      setPricingData(prev => ({
                        ...prev,
                        hasGlass: hasGlassComponents,
                      }));
                      setWizardStep('pricing');
                    }}
                    disabled={localItems.length === 0}
                    className="gap-1"
                  >
                    <span className="hidden sm:inline">Próximo: Preços</span>
                    <span className="sm:hidden">Próximo</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                ) : (
                  /* Activate button */
                  <Button
                    size="sm"
                    onClick={() => activateMutation.mutate()}
                    disabled={activateMutation.isPending || localItems.length === 0}
                    className="bg-success hover:bg-success/90 gap-1"
                  >
                    {activateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="hidden sm:inline">Ativando...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span className="hidden sm:inline">Ativar Produto</span>
                        <span className="sm:hidden">Ativar</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog - Enhanced with better navigation */}
      <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header with category tabs */}
          <div className="p-4 pb-0 space-y-4 shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Adicionar Item
              </DialogTitle>
              <DialogDescription>
                Selecione a categoria e o item para adicionar
              </DialogDescription>
            </DialogHeader>
            
            {/* Category Navigation Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {itemTypeTabs.map((tab) => {
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.value);
                      setSelectedItemTemplateId('');
                      setSearchTerm('');
                    }}
                    className={`flex-1 px-3 py-2.5 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background'
                    }`}
                  >
                    {tab.value === 'glass' && '🪟'}
                    {tab.value === 'profile' && '📐'}
                    {tab.value === 'accessory' && '🔩'}
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.slice(0, 3)}</span>
                  </button>
                );
              })}
            </div>
            
            {/* Search with clear button */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={`Buscar ${itemTypeTabs.find(t => t.value === activeTab)?.label.toLowerCase() || 'item'}...`}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-2 space-y-4">
            {/* Item selection list */}
            <div className="border rounded-lg bg-muted/30">
              {filteredAvailableItems?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Package className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum item encontrado</p>
                  {searchTerm && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setSearchTerm('')}
                      className="mt-1"
                    >
                      Limpar busca
                    </Button>
                  )}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {/* Group items by linha */}
                  {(() => {
                    const groupedItems = filteredAvailableItems?.reduce((acc, item) => {
                      const linha = item.linha || 'Sem Linha';
                      if (!acc[linha]) acc[linha] = [];
                      acc[linha].push(item);
                      return acc;
                    }, {} as Record<string, typeof filteredAvailableItems>);

                    return Object.entries(groupedItems || {}).map(([linha, items]) => (
                      <div key={linha}>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5 sticky top-0 bg-muted/80 backdrop-blur-sm">
                          {linha}
                        </div>
                        {items?.map(item => (
                          <button
                            type="button"
                            key={item.id}
                            className={`flex items-center gap-3 p-2 rounded-lg w-full text-left transition-all ${
                              selectedItemTemplateId === item.id
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'hover:bg-background border border-transparent hover:border-border'
                            }`}
                            onClick={() => {
                              setSelectedItemTemplateId(item.id);
                              // Scroll to form after selection
                              setTimeout(() => {
                                formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 100);
                            }}
                          >
                            <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${
                              selectedItemTemplateId === item.id ? 'bg-primary-foreground/20' : 'bg-muted'
                            }`}>
                              {item.image_url ? (
                                <img
                                  src={getItemImage(item.image_url)}
                                  alt={item.name}
                                  className="w-full h-full object-contain p-1"
                                />
                              ) : (
                                <Package className="w-5 h-5 opacity-50" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.name}</p>
                            </div>
                            {selectedItemTemplateId === item.id && (
                              <CheckCircle2 className="w-5 h-5 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>

            {/* Selected item indicator */}
            {selectedItemTemplateId && (
              <div className="p-2 bg-primary/10 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium truncate">
                  {filteredAvailableItems?.find(i => i.id === selectedItemTemplateId)?.name}
                </span>
              </div>
            )}

            {/* Form fields based on type */}
            {selectedItemTemplateId ? (
              <div ref={formRef} className="space-y-4 pt-4 border-t">
                {/* Quantidade de peças - para todos os tipos */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Quantidade de peças
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setPiecesQuantity(Math.max(1, piecesQuantity - 1))}
                      disabled={piecesQuantity <= 1}
                    >
                      <span className="text-lg font-medium">-</span>
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      value={piecesQuantity}
                      onChange={e => setPiecesQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center font-medium"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setPiecesQuantity(piecesQuantity + 1)}
                    >
                      <span className="text-lg font-medium">+</span>
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {piecesQuantity === 1 ? 'peça' : 'peças'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quantas unidades deste item compõem o produto
                  </p>
                </div>

                {activeTab === 'glass' ? (
                  <>
                    <div className="space-y-2">
                      <Label>Nome do vidro (opcional)</Label>
                      <Input
                        value={glassName}
                        onChange={e => setGlassName(e.target.value)}
                        placeholder="Ex: Vidro Fixo Superior"
                      />
                    </div>
                    <GlassFormulaEditor
                      widthFormula={widthFormula}
                      heightFormula={heightFormula}
                      onWidthFormulaChange={setWidthFormula}
                      onHeightFormulaChange={setHeightFormula}
                    />
                  </>
                ) : (
                  <>
                    <FormulaEditor
                      value={quantityFormula}
                      onChange={setQuantityFormula}
                    />
                    {activeTab === 'profile' && (
                      <div className="space-y-2">
                        <Label>Ângulo de corte</Label>
                        <div className="flex gap-2">
                          {[45, 90].map((angle) => (
                            <Button
                              key={angle}
                              type="button"
                              variant={cutAngle === angle ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCutAngle(angle)}
                              className="flex-1"
                            >
                              {angle}°
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground text-center py-4">
                  👆 Selecione um item acima para configurar
                </p>
              </div>
            )}
          </div>

          {/* Footer with navigation */}
          <div className="p-4 border-t bg-muted/30 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {itemTypeTabs.map((tab, index) => {
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setActiveTab(tab.value)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      isActive ? 'bg-primary w-4' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                    aria-label={tab.label}
                  />
                );
              })}
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddingItem(false)}>
                Cancelar
              </Button>
              <Button 
                size="sm" 
                onClick={handleAddItem} 
                disabled={!selectedItemTemplateId}
                className="gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
