/**
 * Edit Purchase List Dialog
 * 
 * Allows users to review and edit the purchase list before creating a purchase order.
 * Enforces minimum quantity validation: quantityToPurchase >= (quantityNeeded - quantityAvailable)
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, 
  Package, 
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface PurchaseListItem {
  materialConsumptionId: string;
  itemTemplateId: string | null;
  companyItemId: string | null;
  itemName: string;
  unit: string;
  quantityNeeded: number;
  quantityInStock: number;
  quantityReserved: number;
  quantityAvailable: number;
  quantityToPurchase: number;
  minimumRequired: number;
  selected: boolean;
}

interface EditPurchaseListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemServicoId: string;
  companyId: string;
  onConfirm: (items: PurchaseListItem[]) => void;
}

export function EditPurchaseListDialog({
  open,
  onOpenChange,
  ordemServicoId,
  companyId,
  onConfirm,
}: EditPurchaseListDialogProps) {
  const [items, setItems] = useState<PurchaseListItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch materials and stock data
  const { data: purchaseList, isLoading } = useQuery({
    queryKey: ['purchase-list', ordemServicoId],
    queryFn: async () => {
      // Get all pending materials for this OS
      const { data: materials, error: materialsError } = await supabase
        .from('material_consumption')
        .select('id, item_name, unit, quantity_calculated, item_template_id, company_item_id')
        .eq('ordem_servico_id', ordemServicoId)
        .in('status', ['pending', 'available']);

      if (materialsError) throw materialsError;
      if (!materials || materials.length === 0) return [];

      // Get stock data for all items
      const itemTemplateIds = materials
        .map(m => m.item_template_id)
        .filter((id): id is string => id !== null);

      const companyItemIds = materials
        .map(m => m.company_item_id)
        .filter((id): id is string => id !== null);

      let stockMap: Record<string, { quantity: number }> = {};
      let reservationMap: Record<string, number> = {};

      // Fetch stock by item_template_id
      if (itemTemplateIds.length > 0) {
        const { data: stockData } = await supabase
          .from('company_stock')
          .select('item_template_id, quantity')
          .eq('company_id', companyId)
          .in('item_template_id', itemTemplateIds);

        (stockData || []).forEach(s => {
          if (s.item_template_id) {
            stockMap[`template:${s.item_template_id}`] = { quantity: s.quantity };
          }
        });
      }

      // Fetch stock by company_item_id
      if (companyItemIds.length > 0) {
        const { data: stockData } = await supabase
          .from('company_stock')
          .select('company_item_id, quantity')
          .eq('company_id', companyId)
          .in('company_item_id', companyItemIds);

        (stockData || []).forEach(s => {
          if (s.company_item_id) {
            stockMap[`company:${s.company_item_id}`] = { quantity: s.quantity };
          }
        });
      }

      // Fetch reservations for company items (stock_reservations uses company_item_id)
      if (companyItemIds.length > 0) {
        const { data: reservations } = await supabase
          .from('stock_reservations')
          .select('company_item_id, quantity_reserved')
          .eq('company_id', companyId)
          .in('company_item_id', companyItemIds)
          .eq('status', 'reserved');

        (reservations || []).forEach(r => {
          if (r.company_item_id) {
            const key = `company:${r.company_item_id}`;
            reservationMap[key] = (reservationMap[key] || 0) + r.quantity_reserved;
          }
        });
      }

      // Build purchase list
      const list: PurchaseListItem[] = materials.map(m => {
        const stockKey = m.item_template_id 
          ? `template:${m.item_template_id}` 
          : m.company_item_id 
            ? `company:${m.company_item_id}` 
            : null;

        const stockQty = stockKey ? (stockMap[stockKey]?.quantity || 0) : 0;
        const reservedQty = stockKey ? (reservationMap[stockKey] || 0) : 0;
        const availableQty = Math.max(0, stockQty - reservedQty);
        const minimumRequired = Math.max(0, m.quantity_calculated - availableQty);

        return {
          materialConsumptionId: m.id,
          itemTemplateId: m.item_template_id,
          companyItemId: m.company_item_id,
          itemName: m.item_name,
          unit: m.unit,
          quantityNeeded: m.quantity_calculated,
          quantityInStock: stockQty,
          quantityReserved: reservedQty,
          quantityAvailable: availableQty,
          quantityToPurchase: minimumRequired,
          minimumRequired,
          selected: minimumRequired > 0, // Only select items that need purchasing
        };
      });

      // Only return items that need purchasing
      return list.filter(item => item.minimumRequired > 0);
    },
    enabled: open && !!ordemServicoId && !!companyId,
  });

  // Update local state when data loads
  useEffect(() => {
    if (purchaseList) {
      setItems(purchaseList);
    }
  }, [purchaseList]);

  const handleQuantityChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    
    setItems(prev => prev.map(item => {
      if (item.materialConsumptionId !== id) return item;
      
      // Enforce minimum
      const validValue = Math.max(numValue, item.minimumRequired);
      
      if (numValue < item.minimumRequired) {
        toast.error(`Quantidade mínima: ${item.minimumRequired} ${item.unit}`);
      }
      
      return {
        ...item,
        quantityToPurchase: validValue,
      };
    }));
  };

  const handleToggleItem = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.materialConsumptionId !== id) return item;
      
      // Can't deselect if minimum is required
      if (item.selected && item.minimumRequired > 0) {
        toast.error('Este item é obrigatório para a OS');
        return item;
      }
      
      return {
        ...item,
        selected: !item.selected,
      };
    }));
  };

  const handleConfirm = () => {
    const selectedItems = items.filter(item => item.selected && item.quantityToPurchase > 0);
    
    if (selectedItems.length === 0) {
      toast.error('Selecione pelo menos um item para comprar');
      return;
    }

    // Validate all items meet minimum
    const invalidItems = selectedItems.filter(item => item.quantityToPurchase < item.minimumRequired);
    if (invalidItems.length > 0) {
      toast.error('Alguns itens estão abaixo da quantidade mínima necessária');
      return;
    }

    setIsSubmitting(true);
    onConfirm(selectedItems);
  };

  const formatQuantity = (qty: number, unit: string) => {
    if (unit === 'm' || unit === 'metro' || unit === 'metros') {
      return `${qty.toFixed(2)}m`;
    }
    if (unit === 'm²' || unit === 'm2') {
      return `${qty.toFixed(2)}m²`;
    }
    if (qty % 1 === 0) {
      return `${Math.round(qty)} ${unit}`;
    }
    return `${qty.toFixed(2)} ${unit}`;
  };

  const selectedCount = items.filter(i => i.selected).length;
  const totalItems = items.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Editar Lista de Compra
          </DialogTitle>
          <DialogDescription>
            Revise os materiais necessários antes de gerar o pedido de compra.
            A quantidade mínima é calculada automaticamente com base no estoque disponível.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              Todos os materiais já estão disponíveis no estoque.
            </p>
          </div>
        ) : (
          <>
            {/* Info Banner */}
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
              <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-blue-700 dark:text-blue-300">
                  Você pode aumentar a quantidade para comprar a mais, mas não pode reduzir abaixo do mínimo necessário.
                </span>
              </div>
            </div>

            <ScrollArea className="max-h-[400px] pr-4">
              <div className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-2 pb-2 border-b">
                  <span className="col-span-1"></span>
                  <span className="col-span-4">Material</span>
                  <span className="col-span-2 text-right">Necessário</span>
                  <span className="col-span-2 text-right">Disponível</span>
                  <span className="col-span-3 text-right">Comprar</span>
                </div>

                {/* Items */}
                {items.map((item) => {
                  const isRequired = item.minimumRequired > 0;
                  const isBelowMin = item.quantityToPurchase < item.minimumRequired;
                  
                  return (
                    <div
                      key={item.materialConsumptionId}
                      className={cn(
                        'grid grid-cols-12 gap-2 p-2 rounded-lg border items-center',
                        item.selected 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-muted/30 border-muted opacity-60'
                      )}
                    >
                      <div className="col-span-1 flex justify-center">
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={() => handleToggleItem(item.materialConsumptionId)}
                          disabled={isRequired}
                        />
                      </div>
                      
                      <div className="col-span-4 flex items-center gap-2">
                        <span className="text-sm truncate" title={item.itemName}>
                          {item.itemName}
                        </span>
                        {isRequired && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      
                      <div className="col-span-2 text-right text-sm text-muted-foreground">
                        {formatQuantity(item.quantityNeeded, item.unit)}
                      </div>
                      
                      <div className="col-span-2 text-right">
                        <span className={cn(
                          'text-sm',
                          item.quantityAvailable < item.quantityNeeded 
                            ? 'text-amber-500' 
                            : 'text-green-500'
                        )}>
                          {formatQuantity(item.quantityAvailable, item.unit)}
                        </span>
                      </div>
                      
                      <div className="col-span-3 flex items-center justify-end gap-2">
                        <Input
                          type="number"
                          min={item.minimumRequired}
                          step="0.01"
                          value={item.quantityToPurchase}
                          onChange={(e) => handleQuantityChange(item.materialConsumptionId, e.target.value)}
                          disabled={!item.selected}
                          className={cn(
                            'w-24 h-8 text-right text-sm',
                            isBelowMin && 'border-red-500'
                          )}
                        />
                        <span className="text-xs text-muted-foreground w-8">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Summary */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{selectedCount} de {totalItems} selecionados</span>
                {items.some(i => i.quantityToPurchase > i.minimumRequired) && (
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Comprando a mais que o mínimo
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isLoading || items.length === 0 || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Gerar Pedido ({selectedCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
