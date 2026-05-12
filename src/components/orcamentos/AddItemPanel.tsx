import { useState, useMemo } from 'react';
import { resolveItemImageUrl } from '@/utils/imageUrl';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Package, Check, ArrowLeft, Hash, DollarSign, Layers, Plus, Ruler, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useItemTypes } from '@/hooks/useItemTypes';
import { useProductLinhas } from '@/hooks/useProductLinhas';
import { toast } from 'sonner';

interface UnifiedItem {
  id: string;
  name: string;
  type: string;
  unit: string;
  cost: number | null;
  sale_price: number | null;
  image_url: string | null;
  linha: string | null;
  is_custom: boolean;
  stock_quantity: number;
  source: 'company' | 'template';
  item_template_id?: string | null;
}

interface AddItemPanelProps {
  onAdd: (item: {
    company_item_id: string;
    name: string;
    unit: string;
    unit_price: number;
    quantity: number;
    total_price: number;
    width?: number;
    height?: number;
    image_url?: string | null;
    linha?: string | null;
    type?: string;
    notes?: string;
  }) => void;
  onCancel: () => void;
}

export function AddItemPanel({ onAdd, onCancel }: AddItemPanelProps) {
  const { currentCompany } = useAuth();
  const { data: itemTypes } = useItemTypes();
  const { data: productLinhas } = useProductLinhas();
  
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [notes, setNotes] = useState<string>('');

  // Fetch company items with stock data
  const { data: companyItems, isLoading: loadingCompanyItems } = useQuery({
    queryKey: ['company-items-for-quote', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_items')
        .select(`
          id,
          name,
          type,
          unit,
          cost,
          sale_price,
          image_url,
          linha,
          is_custom,
          item_template_id,
          company_stock (quantity)
        `)
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id
  });

  // Fetch ALL active item templates (global catalog)
  const { data: itemTemplates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['item-templates-for-quote'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('id, name, type, unit, default_price, image_url, linha, description')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });

  // Merge company items + unlinked templates into unified list
  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];
    const linkedTemplateIds = new Set<string>();

    // Add company items first
    (companyItems || []).forEach(ci => {
      if (ci.item_template_id) linkedTemplateIds.add(ci.item_template_id);
      items.push({
        id: ci.id,
        name: ci.name,
        type: ci.type,
        unit: ci.unit,
        cost: ci.cost,
        sale_price: ci.sale_price,
        image_url: ci.image_url,
        linha: ci.linha,
        is_custom: ci.is_custom,
        stock_quantity: (ci.company_stock as any)?.[0]?.quantity || 0,
        source: 'company',
        item_template_id: ci.item_template_id,
      });
    });

    // Add templates NOT yet linked to this company
    (itemTemplates || []).forEach(tmpl => {
      if (!linkedTemplateIds.has(tmpl.id)) {
        items.push({
          id: `tmpl_${tmpl.id}`,
          name: tmpl.name,
          type: tmpl.type,
          unit: tmpl.unit,
          cost: null,
          sale_price: tmpl.default_price,
          image_url: tmpl.image_url,
          linha: tmpl.linha,
          is_custom: false,
          stock_quantity: 0,
          source: 'template',
          item_template_id: tmpl.id,
        });
      }
    });

    return items;
  }, [companyItems, itemTemplates]);

  const isLoading = loadingCompanyItems || loadingTemplates;

  // Get unique linhas from all items
  const linhas = useMemo(() => {
    const linhaSet = new Set<string>();
    unifiedItems.forEach(item => {
      if (item.linha) linhaSet.add(item.linha);
    });
    return Array.from(linhaSet).sort();
  }, [unifiedItems]);

  // Get types for selected linha
  const types = useMemo(() => {
    if (!selectedLinha) return [];
    const typeSet = new Set<string>();
    unifiedItems
      .filter(item => item.linha === selectedLinha)
      .forEach(item => {
        if (item.type) typeSet.add(item.type);
      });
    return Array.from(typeSet).sort();
  }, [unifiedItems, selectedLinha]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!selectedLinha) return [];
    
    let items = unifiedItems;
    
    items = items.filter(item => item.linha === selectedLinha);
    
    if (selectedType) {
      items = items.filter(item => item.type === selectedType);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(query)
      );
    }
    
    return items;
  }, [unifiedItems, selectedLinha, selectedType, searchQuery]);

  const selectedItem = filteredItems?.find(item => item.id === selectedItemId);
  
  const unitPrice = customPrice !== null ? customPrice : (selectedItem?.sale_price || 0);
  const isM2 = selectedItem?.unit === 'm2';
  const area = isM2 && width > 0 && height > 0 ? (width / 1000) * (height / 1000) : 1;
  const totalPrice = unitPrice * area * quantity;

  const getTypeLabel = (type: string) => {
    const found = itemTypes?.find(t => t.slug === type);
    return found?.name || type;
  };

  const getItemImage = resolveItemImageUrl;

  const handleLinhaChange = (value: string) => {
    setSelectedLinha(value);
    setSelectedType('');
    setSelectedItemId('');
  };

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setSelectedItemId('');
  };

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    setCustomPrice(null);
  };

  // Auto-create company_item from template if needed, then add
  const handleAdd = async () => {
    if (!selectedItem || !currentCompany?.id) return;

    // If it's already a company item, add directly
    if (selectedItem.source === 'company') {
      onAdd({
        company_item_id: selectedItem.id,
        name: (width > 0 && height > 0) ? `${selectedItem.name} [Medida: ${width}x${height}mm]` : selectedItem.name,
        unit: selectedItem.unit,
        unit_price: unitPrice,
        quantity,
        width: isM2 ? width : undefined,
        height: isM2 ? height : undefined,
        total_price: totalPrice,
        image_url: selectedItem.image_url,
        linha: selectedItem.linha,
        type: selectedItem.type,
        notes: notes.trim() || undefined,
      });
      return;
    }

    // It's a template item — auto-create company_item
    setIsCreatingItem(true);
    try {
      const templateId = selectedItem.item_template_id!;
      
      // Get full template data
      const { data: tmpl, error: tmplError } = await supabase
        .from('item_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (tmplError || !tmpl) throw new Error('Item template não encontrado');

      // Create company_item
      const { data: newItem, error: insertError } = await supabase
        .from('company_items')
        .insert({
          company_id: currentCompany.id,
          item_template_id: templateId,
          name: tmpl.name,
          description: tmpl.description,
          type: tmpl.type,
          unit: tmpl.unit,
          cost: tmpl.default_cost || 0,
          sale_price: tmpl.default_price || 0,
          specifications: tmpl.specifications,
          image_url: tmpl.image_url,
          linha: tmpl.linha,
          is_custom: false,
          is_active: true,
          bar_length_mm: tmpl.bar_length_mm,
          weight_kg: tmpl.weight_per_bar,
          weight_per_meter: tmpl.weight_per_meter,
          cost_per_bar: tmpl.type === 'profile' ? tmpl.default_cost : null,
          sale_price_per_bar: tmpl.type === 'profile' ? tmpl.default_price : null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Also create stock entry
      await supabase
        .from('company_stock')
        .insert({
          company_id: currentCompany.id,
          item_template_id: templateId,
          company_item_id: newItem.id,
          quantity: 0,
          min_quantity: 0,
          is_active: true,
          allow_fractional: tmpl.type === 'profile',
        });

      onAdd({
        company_item_id: newItem.id,
        name: (width > 0 && height > 0) ? `${selectedItem.name} [Medida: ${width}x${height}mm]` : selectedItem.name,
        unit: selectedItem.unit,
        unit_price: unitPrice,
        quantity,
        width: isM2 ? width : undefined,
        height: isM2 ? height : undefined,
        total_price: totalPrice,
        image_url: selectedItem.image_url,
        linha: selectedItem.linha,
        type: selectedItem.type,
        notes: notes.trim() || undefined,
      });

      toast.success('Item adicionado ao catálogo da empresa automaticamente');
    } catch (err: any) {
      console.error('Error creating company item:', err);
      toast.error('Erro ao adicionar item: ' + (err.message || 'Tente novamente'));
    } finally {
      setIsCreatingItem(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const canAdd = selectedItemId && quantity > 0 && unitPrice >= 0 && !isCreatingItem;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header - Filters */}
      <div className="shrink-0 space-y-4 pb-4 border-b mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linha</label>
            <Select value={selectedLinha} onValueChange={handleLinhaChange}>
              <SelectTrigger className="bg-background h-10">
                <SelectValue placeholder="Selecione a linha..." />
              </SelectTrigger>
              <SelectContent className="bg-popover border shadow-lg z-50">
                {linhas.map((linha) => (
                  <SelectItem key={linha} value={linha}>
                    {linha}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar itens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-background h-10"
              />
            </div>
          </div>
        </div>

        {/* Type Filter Chips */}
        {selectedLinha && types.length > 0 && (
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-1">
              <Badge
                variant={selectedType === '' ? 'default' : 'outline'}
                className="cursor-pointer shrink-0 h-8 px-4"
                onClick={() => setSelectedType('')}
              >
                Todos
              </Badge>
              {types.map((type) => (
                <Badge
                  key={type}
                  variant={selectedType === type ? 'default' : 'outline'}
                  className="cursor-pointer shrink-0 h-8 px-4"
                  onClick={() => handleTypeChange(type)}
                >
                  {getTypeLabel(type)}
                </Badge>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Scrollable - Items List */}
      <div className="flex-1 min-h-0 mb-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
          Selecione um item {selectedLinha ? `(${filteredItems.length})` : ''}
        </label>
        <ScrollArea className="h-[240px] rounded-xl border bg-muted/20 p-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : !selectedLinha ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Layers className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">Selecione uma linha</p>
              <p className="text-xs mt-1 text-center max-w-[200px]">
                Escolha a linha do item no filtro acima
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">Nenhum item encontrado</p>
              <p className="text-xs mt-1">Tente ajustar os filtros</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => {
                const isSelected = selectedItemId === item.id;
                const imageUrl = getItemImage(item.image_url);
                const isFromTemplate = item.source === 'template';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleItemSelect(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border-2 bg-card transition-all text-left",
                      "hover:shadow-md hover:border-primary/50",
                      isSelected ? "border-primary ring-2 ring-primary/20" : "border-border",
                      isFromTemplate && "border-dashed"
                    )}
                  >
                    {/* Image */}
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.name} className="w-full h-full object-contain" />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{item.name}</span>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Badge variant="outline" className="text-[10px] h-5">
                          {getTypeLabel(item.type)}
                        </Badge>
                        <span>•</span>
                        <span>{item.unit}</span>
                        {isFromTemplate ? (
                          <>
                            <span>•</span>
                            <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                              <Plus className="w-3 h-3" />
                              Catálogo
                            </Badge>
                          </>
                        ) : (
                          <>
                            <span>•</span>
                            <span className={cn(item.stock_quantity <= 0 && "text-destructive")}>
                              Estoque: {item.stock_quantity}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="text-right shrink-0">
                      <span className="text-sm font-semibold text-primary">
                        {formatCurrency(item.sale_price || 0)}
                      </span>
                      <p className="text-[10px] text-muted-foreground">/{item.unit}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Bottom - Quantity & Price */}
      <div className="shrink-0 space-y-4 pt-4 border-t">
        {selectedItem && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {getItemImage(selectedItem.image_url) ? (
                <img 
                  src={getItemImage(selectedItem.image_url)!} 
                  alt={selectedItem.name} 
                  className="w-full h-full object-contain" 
                />
              ) : (
                <Package className="w-5 h-5 text-muted-foreground/30" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{selectedItem.name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedItem.linha} • {selectedItem.unit}
                {selectedItem.source === 'template' && ' • Será adicionado ao catálogo'}
              </p>
            </div>
          </div>
        )}

        {selectedItem && (selectedItem.type === 'profile' || selectedItem.type === 'glass') && (
          <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border border-dashed animate-in fade-in slide-in-from-top-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                <Ruler className="w-3 h-3" /> Largura (mm)
              </label>
              <Input
                type="number"
                min="0"
                value={width || ''}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="h-10"
                placeholder="Ex: 1000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase flex items-center gap-1">
                <Ruler className="w-3 h-3 rotate-90" /> Altura (mm)
              </label>
              <Input
                type="number"
                min="0"
                value={height || ''}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="h-10"
                placeholder="Ex: 1000"
              />
            </div>
          </div>
        )}

        {isM2 && (
          <div className="bg-muted/30 p-2 rounded-lg border border-dashed text-[10px] text-muted-foreground text-center">
            Item vendido por m². Área calculada: <span className="font-bold">{(area).toFixed(2)} m²</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Hash className="w-3 h-3" /> Quantidade
            </label>
            <Input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 1)}
              className="h-12 text-lg font-medium"
              disabled={!selectedItemId}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Preço {isM2 ? 'por m²' : 'Unitário'}
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={customPrice !== null ? customPrice : (selectedItem?.sale_price || 0)}
              onChange={(e) => setCustomPrice(Number(e.target.value))}
              className="h-12 text-lg font-medium"
              disabled={!selectedItemId}
            />
          </div>
        </div>

        {/* Observações */}
        {selectedItem && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              Observações
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais sobre este item..."
              rows={3}
              className="bg-background resize-none"
            />
          </div>
        )}

        {/* Sticky total bar + Actions */}
        <div className="overflow-hidden rounded-xl border shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-primary/95 to-primary text-primary-foreground">
            <div className="flex items-center gap-2 text-sm font-medium">
              {isM2 ? (
                <>
                  <span>{area.toFixed(2)} m²</span>
                  <span className="opacity-70">×</span>
                </>
              ) : null}
              <span>{quantity} {selectedItem?.unit || 'un'}</span>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider opacity-80">Total</p>
              <p className="text-xl font-bold leading-tight">{formatCurrency(totalPrice)}</p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 bg-card px-4 py-3 border-t">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAdd}
              disabled={!canAdd}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
            >
              {isCreatingItem ? (
                <span className="animate-pulse">Adicionando...</span>
              ) : (
                'Adicionar ao orçamento'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
