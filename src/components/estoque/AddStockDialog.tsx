import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const itemTypeLabels: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  service: 'Serviço',
};

export function AddStockDialog({ open, onOpenChange }: AddStockDialogProps) {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [linhaFilter, setLinhaFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('');
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');
  const [allowFractional, setAllowFractional] = useState(false);

  // Fetch item templates
  const { data: itemTemplates, isLoading: loadingItems } = useQuery({
    queryKey: ['item-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('is_active', true)
        .order('linha')
        .order('type')
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing stock to avoid duplicates
  const { data: existingStock } = useQuery({
    queryKey: ['company-stock-item-ids', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_stock')
        .select('item_template_id')
        .eq('company_id', currentCompany.id);
      
      if (error) throw error;
      return data.map(s => s.item_template_id);
    },
    enabled: !!currentCompany?.id,
  });

  const addStockMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !selectedItemId) {
        throw new Error('Dados incompletos');
      }

      // Insert stock record
      const { error: stockError } = await supabase
        .from('company_stock')
        .insert({
          company_id: currentCompany.id,
          item_template_id: selectedItemId,
          quantity: parseFloat(quantity) || 0,
          min_quantity: parseFloat(minQuantity) || 0,
          location: location || null,
          allow_fractional: allowFractional,
        } as any);

      if (stockError) throw stockError;

      // Insert price record if cost or price is provided
      const costValue = parseFloat(cost) || 0;
      const priceValue = parseFloat(price) || 0;
      
      if (costValue > 0 || priceValue > 0) {
        const { error: priceError } = await supabase
          .from('company_item_prices')
          .upsert({
            company_id: currentCompany.id,
            item_template_id: selectedItemId,
            cost: costValue,
            price: priceValue,
          }, {
            onConflict: 'company_id,item_template_id'
          });

        if (priceError) throw priceError;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Item adicionado ao estoque',
        description: 'O item foi adicionado com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock-item-ids'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setLinhaFilter('');
    setNameFilter('');
    setSelectedItemId('');
    setQuantity('');
    setMinQuantity('');
    setLocation('');
    setCost('');
    setPrice('');
    setAllowFractional(false);
  };

  const handleItemSelect = (itemId: string, itemType: string) => {
    if (selectedItemId === itemId) {
      setSelectedItemId('');
      setAllowFractional(false);
    } else {
      setSelectedItemId(itemId);
      // Perfis têm venda fracionada habilitada por padrão
      setAllowFractional(itemType === 'profile');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) {
      toast({
        title: 'Selecione um item',
        description: 'Você precisa selecionar um item para adicionar ao estoque.',
        variant: 'destructive',
      });
      return;
    }
    addStockMutation.mutate();
  };

  // Filter out items already in stock
  const availableItems = useMemo(() => {
    return itemTemplates?.filter(item => !existingStock?.includes(item.id)) || [];
  }, [itemTemplates, existingStock]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return availableItems.filter(item => {
      const matchesLinha = !linhaFilter || 
        (item.linha || 'Sem Linha').toLowerCase().includes(linhaFilter.toLowerCase());
      const matchesName = !nameFilter || 
        item.name.toLowerCase().includes(nameFilter.toLowerCase());
      return matchesLinha && matchesName;
    });
  }, [availableItems, linhaFilter, nameFilter]);

  // Group items by linha
  const itemsByLinha = useMemo(() => {
    const grouped: Record<string, typeof filteredItems> = {};
    
    filteredItems.forEach(item => {
      const linha = item.linha || 'Sem Linha';
      if (!grouped[linha]) {
        grouped[linha] = [];
      }
      grouped[linha].push(item);
    });

    // Sort keys with "Sem Linha" first
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Sem Linha') return -1;
      if (b === 'Sem Linha') return 1;
      return a.localeCompare(b);
    });

    return { grouped, sortedKeys };
  }, [filteredItems]);

  const selectedItem = itemTemplates?.find((item) => item.id === selectedItemId);

  // Get weight from specifications if available
  const getItemWeight = (item: typeof selectedItem) => {
    if (!item?.specifications) return null;
    const specs = item.specifications as Record<string, unknown>;
    return specs.peso_kg_ml || specs.weight_kg_ml || specs.peso;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Adicionar Item ao Estoque</DialogTitle>
          <DialogDescription>
            Selecione um item visualmente e configure quantidade e preços.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Filters */}
          <div className="px-6 py-4 border-b bg-muted/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Filtrar por Linha</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={linhaFilter}
                    onChange={(e) => setLinhaFilter(e.target.value)}
                    placeholder="Digite para filtrar..."
                    className="pl-9 pr-8"
                  />
                  {linhaFilter && (
                    <button
                      type="button"
                      onClick={() => setLinhaFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Filtrar por Nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    placeholder="Digite para filtrar..."
                    className="pl-9 pr-8"
                  />
                  {nameFilter && (
                    <button
                      type="button"
                      onClick={() => setNameFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Items Grid */}
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ maxHeight: '350px' }}>
            <div className="px-6 py-4 space-y-6">
              {loadingItems ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {availableItems.length === 0 
                      ? 'Todos os itens já estão no estoque.'
                      : 'Nenhum item encontrado com os filtros aplicados.'}
                  </p>
                </div>
              ) : (
                itemsByLinha.sortedKeys.map((linha) => (
                  <div key={linha}>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="h-px flex-1 bg-border" />
                      <span className="px-2">{linha}</span>
                      <span className="h-px flex-1 bg-border" />
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {itemsByLinha.grouped[linha].map((item) => {
                        const isSelected = selectedItemId === item.id;
                        const weight = getItemWeight(item);
                        
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleItemSelect(item.id, item.type)}
                            className={cn(
                              "relative flex flex-col items-center p-3 rounded-lg border-2 transition-all duration-200",
                              "hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                              isSelected 
                                ? "border-primary bg-primary/5 shadow-md" 
                                : "border-border bg-card"
                            )}
                          >
                            {/* Selection indicator */}
                            {isSelected && (
                              <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            )}
                            
                            {/* Image */}
                            <div className="w-20 h-20 rounded-lg border bg-background flex items-center justify-center mb-2 overflow-hidden">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  loading="lazy"
                                  className="max-h-full max-w-full object-contain"
                                />
                              ) : (
                                <Package className="h-8 w-8 text-muted-foreground/50" />
                              )}
                            </div>
                            
                            {/* Name */}
                            <p className="text-xs font-medium text-center line-clamp-2 leading-tight mb-1">
                              {item.name}
                            </p>
                            
                            {/* Weight */}
                            {weight && (
                              <p className="text-[10px] text-muted-foreground">
                                {String(weight)} Kg/ML
                              </p>
                            )}
                            
                            {/* Type badge */}
                            <span className="mt-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {itemTypeLabels[item.type] || item.type}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Selected Item Preview - Compact */}
          {selectedItem && (
            <div className="px-6 py-2 border-t bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded border bg-background flex items-center justify-center overflow-hidden shrink-0">
                  {selectedItem.image_url ? (
                    <img
                      src={selectedItem.image_url}
                      alt={selectedItem.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{selectedItem.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {itemTypeLabels[selectedItem.type] || selectedItem.type}
                    {selectedItem.linha && ` • ${selectedItem.linha}`}
                    {getItemWeight(selectedItem) && ` • ${String(getItemWeight(selectedItem))} Kg/ML`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedItemId('')}
                  className="h-8 w-8 p-0 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Form Fields */}
          <div className="px-6 py-4 border-t space-y-4 bg-muted/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantity" className="text-xs">Quantidade</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="minQuantity" className="text-xs">Qtd. Mínima</Label>
                <Input
                  id="minQuantity"
                  type="number"
                  min="0"
                  step="0.01"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  placeholder="0"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cost" className="text-xs">Custo (R$)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0,00"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-xs">Venda (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="location" className="text-xs">Localização</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Prateleira A1, Galpão 2..."
                  maxLength={100}
                  className="h-9"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-background border h-9">
                <Label htmlFor="allowFractionalAdd" className="text-xs cursor-pointer">
                  Venda Fracionada
                </Label>
                <Switch
                  id="allowFractionalAdd"
                  checked={allowFractional}
                  onCheckedChange={setAllowFractional}
                  className="scale-75"
                />
              </div>
            </div>

            {/* Margin indicator */}
            {parseFloat(cost) > 0 && parseFloat(price) > 0 && (
              <div className="p-2 rounded bg-background border text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Margem:</span>
                <span className={cn(
                  "font-medium",
                  parseFloat(price) >= parseFloat(cost) ? 'text-green-600' : 'text-destructive'
                )}>
                  {(((parseFloat(price) - parseFloat(cost)) / parseFloat(cost)) * 100).toFixed(1)}%
                  {' • '}R$ {(parseFloat(price) - parseFloat(cost)).toFixed(2)} lucro
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t flex justify-end gap-2 bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={addStockMutation.isPending || !selectedItemId}
            >
              {addStockMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
