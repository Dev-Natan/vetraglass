import { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { FormulaEditor } from './FormulaEditor';
import { GlassFormulaEditor } from './GlassFormulaEditor';

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
  const [activeTab, setActiveTab] = useState('glass');
  const [localItems, setLocalItems] = useState<ComponentItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Form states for adding/editing
  const [selectedItemTemplateId, setSelectedItemTemplateId] = useState('');
  const [quantityFormula, setQuantityFormula] = useState('1');
  const [piecesQuantity, setPiecesQuantity] = useState(1);
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
      return (data || []) as ComponentItem[];
    },
    enabled: open && !!productTemplateId,
  });

  // Initialize local items from global items
  useEffect(() => {
    if (globalItems) {
      setLocalItems(globalItems.map(item => ({ ...item })));
    }
  }, [globalItems]);

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

    // Check if item already exists
    const exists = localItems.some(i => i.item_template_id === selectedItemTemplateId);
    if (exists) {
      toast.error('Este item já está na composição');
      return;
    }

    const newItem: ComponentItem = {
      id: `new-${Date.now()}`,
      item_template_id: selectedItemTemplateId,
      quantity_formula: activeTab === 'glass' ? '1' : quantityFormula,
      pieces_quantity: piecesQuantity,
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

  // Activation mutation
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

      // 2. Insert all items with company_id
      const itemInserts = localItems.map(item => ({
        company_id: currentCompany.id,
        product_template_id: productTemplateId,
        item_template_id: item.item_template_id,
        quantity_formula: item.quantity_formula,
        pieces_quantity: item.pieces_quantity,
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

      // 3. Add items to company stock with zero quantity
      const uniqueItemTemplateIds = [...new Set(localItems.map(i => i.item_template_id))];

      for (const itemTemplateId of uniqueItemTemplateIds) {
        const { data: existing } = await supabase
          .from('company_stock')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', itemTemplateId)
          .single();

        if (!existing) {
          await supabase.from('company_stock').insert({
            company_id: currentCompany.id,
            item_template_id: itemTemplateId,
            quantity: 0,
            min_quantity: 0,
            is_active: true,
          });
        }
      }

      return activatedProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['linha-products'] });
      toast.success('Produto ativado com sucesso!', {
        description: `${localItems.length} componentes configurados`,
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

  const getItemImage = (imageUrl: string | null) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `/profiles/${imageUrl}`;
  };

  const getProductImage = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `/products/${imageUrl}`;
  };

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
                  Configure os componentes do produto
                </DialogDescription>
              </div>
            </div>
            
            {/* Progress Stepper */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              {itemTypeTabs.map((tab, index) => {
                const itemCount = getItemsByType(tab.value).length;
                const isActive = activeTab === tab.value;
                const isPast = itemTypeTabs.findIndex(t => t.value === activeTab) > index;
                const hasItems = itemCount > 0;
                
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all flex-1 justify-center ${
                      isActive 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : hasItems
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
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
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {loadingItems ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
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
                          setIsAddingItem(true);
                          resetForm();
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar {tab.label.slice(0, -1).toLowerCase()}
                      </Button>
                    </div>

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
                                              {item.pieces_quantity}x
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
              {/* Left: Navigation */}
              <div className="flex items-center gap-2">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const currentIndex = itemTypeTabs.findIndex(t => t.value === activeTab);
                    if (currentIndex < itemTypeTabs.length - 1) {
                      setActiveTab(itemTypeTabs[currentIndex + 1].value);
                    }
                  }}
                  disabled={itemTypeTabs.findIndex(t => t.value === activeTab) === itemTypeTabs.length - 1}
                  className="gap-1"
                >
                  <span className="hidden sm:inline">Próximo</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Center: Status */}
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="w-4 h-4" />
                {localItems.length} componentes
              </div>
              
              {/* Right: Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleDialogClose(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={() => activateMutation.mutate()}
                  disabled={activateMutation.isPending || localItems.length === 0}
                  className="bg-green-600 hover:bg-green-700 gap-1"
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
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Item Dialog - Separate from main dialog */}
      <Dialog open={isAddingItem} onOpenChange={setIsAddingItem}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
            <DialogDescription>
              Selecione um item para adicionar à composição do produto
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar item..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Item selection */}
            <div className="flex-1 max-h-[200px] border rounded-lg overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredAvailableItems?.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    Nenhum item encontrado
                  </div>
                ) : (
                  filteredAvailableItems?.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg w-full text-left transition-colors ${
                        selectedItemTemplateId === item.id
                          ? 'bg-primary/10 border border-primary'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => setSelectedItemTemplateId(item.id)}
                    >
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                        {item.image_url ? (
                          <img
                            src={getItemImage(item.image_url)}
                            alt={item.name}
                            className="w-full h-full object-contain p-1"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        {item.linha && (
                          <p className="text-xs text-muted-foreground">{item.linha}</p>
                        )}
                      </div>
                      {selectedItemTemplateId === item.id && (
                        <Check className="w-5 h-5 text-primary shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Form fields based on type */}
            {selectedItemTemplateId && (
              <div className="space-y-4 pt-4 border-t">
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
                      showPiecesQuantity={activeTab === 'profile'}
                      piecesQuantity={piecesQuantity}
                      onPiecesChange={setPiecesQuantity}
                    />
                    {activeTab === 'profile' && (
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
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAddingItem(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddItem} disabled={!selectedItemTemplateId}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
