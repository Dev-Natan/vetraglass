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
  Search,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-4">
            {/* Product Image */}
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {productImageUrl ? (
                <img
                  src={getProductImage(productImageUrl)}
                  alt={productName}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Package className="w-8 h-8 text-muted-foreground/50" />
              )}
            </div>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-primary" />
                Ativar: {productName}
              </DialogTitle>
              <DialogDescription className="mt-1">
                Configure os componentes do produto antes de ativar para venda
              </DialogDescription>
            </div>
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
              <div className="px-6 pt-4">
                <TabsList className="grid w-full grid-cols-3">
                  {itemTypeTabs.map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value} className="text-sm">
                      {tab.label}
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {getItemsByType(tab.value).length}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {itemTypeTabs.map(tab => (
                <TabsContent key={tab.value} value={tab.value} className="flex-1 flex flex-col min-h-0 mt-0 px-6">
                  {/* Add item button */}
                  <div className="flex justify-between items-center py-3">
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

                  {/* Items list */}
                  <ScrollArea className="flex-1 -mx-6 px-6">
                    <div className="space-y-2 pb-4">
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
                                <div 
                                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/10 transition-colors"
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
                                </div>

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
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-3 rounded-lg border hover:border-primary/50 transition-colors group cursor-pointer"
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveItem(item.id);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                                <Edit2 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-4 border-t gap-2 sm:gap-0">
          <div className="flex-1 text-sm text-muted-foreground">
            {localItems.length} componentes configurados
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => activateMutation.mutate()}
            disabled={activateMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {activateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ativando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Ativar Produto
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Add Item Dialog */}
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
              <ScrollArea className="flex-1 max-h-[200px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {filteredAvailableItems?.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      Nenhum item encontrado
                    </div>
                  ) : (
                    filteredAvailableItems?.map(item => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedItemTemplateId === item.id
                            ? 'bg-primary/10 border border-primary'
                            : 'hover:bg-muted'
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
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

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
      </DialogContent>
    </Dialog>
  );
}
