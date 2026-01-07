import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Loader2, Package } from 'lucide-react';

interface EditItemPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTemplateId: string | null;
  itemName: string;
  itemImageUrl?: string | null;
  itemUnit?: string;
}

export function EditItemPriceDialog({
  open,
  onOpenChange,
  itemTemplateId,
  itemName,
  itemImageUrl,
  itemUnit = 'un',
}: EditItemPriceDialogProps) {
  const { currentCompany } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cost, setCost] = useState('');
  const [price, setPrice] = useState('');

  // Fetch existing price
  const { data: existingPrice, isLoading: loadingPrice } = useQuery({
    queryKey: ['company-item-price', currentCompany?.id, itemTemplateId],
    queryFn: async () => {
      if (!currentCompany?.id || !itemTemplateId) return null;

      const { data, error } = await supabase
        .from('company_item_prices')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('item_template_id', itemTemplateId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && !!itemTemplateId && open,
  });

  // Update form when data loads
  useEffect(() => {
    if (existingPrice) {
      setCost(existingPrice.cost?.toString() ?? '');
      setPrice(existingPrice.price?.toString() ?? '');
    } else {
      setCost('');
      setPrice('');
    }
  }, [existingPrice]);

  const savePriceMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id || !itemTemplateId) {
        throw new Error('Dados incompletos');
      }

      const priceData = {
        company_id: currentCompany.id,
        item_template_id: itemTemplateId,
        cost: parseFloat(cost) || 0,
        price: parseFloat(price) || 0,
      };

      if (existingPrice) {
        // Update existing
        const { error } = await supabase
          .from('company_item_prices')
          .update({
            cost: priceData.cost,
            price: priceData.price,
          })
          .eq('id', existingPrice.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('company_item_prices')
          .insert(priceData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Preços salvos',
        description: 'Os preços foram atualizados com sucesso.',
      });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-price'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    savePriceMutation.mutate();
  };

  // Calculate margin
  const costValue = parseFloat(cost) || 0;
  const priceValue = parseFloat(price) || 0;
  const margin = costValue > 0 ? ((priceValue - costValue) / costValue) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Preços</DialogTitle>
          <DialogDescription>
            Defina os preços de custo e venda para este item.
          </DialogDescription>
        </DialogHeader>

        {/* Item Info */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          {itemImageUrl ? (
            <div className="h-12 w-12 rounded-md border bg-background p-1 flex items-center justify-center shrink-0">
              <img
                src={itemImageUrl}
                alt={itemName}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-md border bg-background flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium">{itemName}</p>
            <p className="text-xs text-muted-foreground">
              Barra padrão: 6000mm | Unidade: {itemUnit}
            </p>
          </div>
        </div>

        {loadingPrice ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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
                <p className="text-xs text-muted-foreground">
                  Custo por barra (6m)
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Venda por barra (6m)
                </p>
              </div>
            </div>

            {/* Margin indicator */}
            {costValue > 0 && priceValue > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Margem de lucro:</span>
                  <span className={`font-semibold ${margin >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    {margin.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">Lucro por barra:</span>
                  <span className={`font-semibold ${priceValue - costValue >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                    R$ {(priceValue - costValue).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={savePriceMutation.isPending}>
                {savePriceMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Salvar Preços
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
