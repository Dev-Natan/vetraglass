import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Package } from 'lucide-react';

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
  
  const [selectedLinha, setSelectedLinha] = useState('');
  const [selectedType, setSelectedType] = useState('');
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
    setSelectedLinha('');
    setSelectedType('');
    setSelectedItemId('');
    setQuantity('');
    setMinQuantity('');
    setLocation('');
    setCost('');
    setPrice('');
    setAllowFractional(false);
  };

  const handleLinhaChange = (linha: string) => {
    setSelectedLinha(linha);
    setSelectedType('');
    setSelectedItemId('');
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setSelectedItemId('');
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
  const availableItems = itemTemplates?.filter(
    item => !existingStock?.includes(item.id)
  );

  // Get unique linhas from available items
  const availableLinhas = [...new Set(availableItems?.map(item => item.linha || 'Sem Linha') || [])].sort();

  // Filter items by selected linha
  const itemsByLinha = selectedLinha
    ? availableItems?.filter(item => (item.linha || 'Sem Linha') === selectedLinha)
    : [];

  // Get unique types from items in selected linha
  const availableTypes = [...new Set(itemsByLinha?.map(item => item.type) || [])];

  // Filter items by selected type
  const filteredItems = selectedType
    ? itemsByLinha?.filter(item => item.type === selectedType)
    : [];

  const selectedItem = itemTemplates?.find((item) => item.id === selectedItemId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Item ao Estoque</DialogTitle>
          <DialogDescription>
            Configure o item, quantidade e preços em um só lugar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linha">Linha *</Label>
            <Select value={selectedLinha} onValueChange={handleLinhaChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a linha..." />
              </SelectTrigger>
              <SelectContent>
                {availableLinhas.map(linha => (
                  <SelectItem key={linha} value={linha}>
                    {linha}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo *</Label>
            <Select 
              value={selectedType} 
              onValueChange={handleTypeChange}
              disabled={!selectedLinha}
            >
              <SelectTrigger>
                <SelectValue placeholder={selectedLinha ? "Selecione o tipo..." : "Selecione a linha primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {itemTypeLabels[type] || type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item">Item *</Label>
            <Select 
              value={selectedItemId} 
              onValueChange={setSelectedItemId}
              disabled={!selectedType}
            >
              <SelectTrigger>
                {selectedItem ? (
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedItem.image_url ? (
                      <div className="h-6 w-6 rounded border bg-background p-0.5 flex items-center justify-center shrink-0">
                        <img
                          src={selectedItem.image_url}
                          alt={selectedItem.name}
                          loading="lazy"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="h-6 w-6 rounded border bg-background flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="truncate">{selectedItem.name}</span>
                  </div>
                ) : (
                  <SelectValue placeholder={selectedType ? "Selecione um item..." : "Selecione o tipo primeiro"} />
                )}
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {loadingItems ? (
                  <SelectItem value="__loading" disabled>
                    Carregando...
                  </SelectItem>
                ) : filteredItems && filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2 min-w-0">
                        {item.image_url ? (
                          <div className="h-7 w-7 rounded border bg-background p-0.5 flex items-center justify-center shrink-0">
                            <img
                              src={item.image_url}
                              alt={item.name}
                              loading="lazy"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-7 w-7 rounded border bg-background flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="truncate">{item.name}</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__empty" disabled>
                    {selectedType
                      ? 'Todos os itens deste tipo já estão no estoque.'
                      : 'Selecione o tipo primeiro.'}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minQuantity">Quantidade Mínima</Label>
              <Input
                id="minQuantity"
                type="number"
                min="0"
                step="0.01"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Localização (opcional)</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Prateleira A1, Galpão 2..."
              maxLength={100}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div className="space-y-0.5">
              <Label htmlFor="allowFractionalAdd" className="cursor-pointer">Venda Fracionada</Label>
              <p className="text-xs text-muted-foreground">
                Permitir vender quantidades fracionadas
              </p>
            </div>
            <Switch
              id="allowFractionalAdd"
              checked={allowFractional}
              onCheckedChange={setAllowFractional}
            />
          </div>

          {/* Separator for pricing */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Preços (opcional)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">Preço de Custo (R$)</Label>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">Por barra (6m)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Preço de Venda (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground">Por barra (6m)</p>
              </div>
            </div>

            {/* Margin indicator */}
            {parseFloat(cost) > 0 && parseFloat(price) > 0 && (
              <div className="mt-3 p-2 rounded bg-muted/50 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">Margem:</span>
                <span className={`font-medium ${parseFloat(price) >= parseFloat(cost) ? 'text-green-600' : 'text-destructive'}`}>
                  {(((parseFloat(price) - parseFloat(cost)) / parseFloat(cost)) * 100).toFixed(1)}%
                  {' • '}R$ {(parseFloat(price) - parseFloat(cost)).toFixed(2)} lucro
                </span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={addStockMutation.isPending}>
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
