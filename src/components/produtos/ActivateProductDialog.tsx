import { useState, useEffect } from 'react';
import { resolveItemImageUrl } from '@/utils/imageUrl';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Loader2, Package, Boxes, Sparkles, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ActivateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productTemplateId: string;
  productName: string;
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
  item_template: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
  };
}

const typeLabels: Record<string, string> = {
  profile: 'Perfil',
  glass: 'Vidro',
  accessory: 'Acessório',
  service: 'Serviço',
  supply: 'Insumo',
};

const typeColors: Record<string, string> = {
  profile: 'bg-blue-100 text-blue-700',
  glass: 'bg-cyan-100 text-cyan-700',
  accessory: 'bg-amber-100 text-amber-700',
  service: 'bg-purple-100 text-purple-700',
  supply: 'bg-green-100 text-green-700',
};

export function ActivateProductDialog({
  open,
  onOpenChange,
  productTemplateId,
  productName,
  onSuccess,
}: ActivateProductDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [selectedComponents, setSelectedComponents] = useState<Set<string>>(new Set());

  // Fetch product components
  const { data: components, isLoading: loadingComponents } = useQuery({
    queryKey: ['product-template-items', productTemplateId],
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

  // Select all components by default when loaded
  useEffect(() => {
    if (components) {
      const allIds = new Set(components.map(c => c.id));
      setSelectedComponents(allIds);
    }
  }, [components]);

  // Toggle component selection
  const toggleComponent = (componentId: string) => {
    setSelectedComponents(prev => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  };

  // Activation mutation
  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      if (!components) throw new Error('Componentes não carregados');

      // 1. Activate the product template for the company
      const { data: activatedProduct, error: activateError } = await supabase.rpc(
        'activate_product_template_for_company',
        {
          _company_id: currentCompany.id,
          _product_template_id: productTemplateId,
        }
      );

      if (activateError) throw activateError;

      // 2. Ensure the product is set to active in company_products (redundant but safe)
      const { error: updateError } = await supabase
        .from('company_products')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('company_id', currentCompany.id)
        .eq('product_template_id', productTemplateId);

      if (updateError) {
        console.warn('Non-critical update error:', updateError);
      }

      // 2. Get selected components
      const selectedItems = components.filter(c => selectedComponents.has(c.id));

      // 3. Copy selected components to company-specific items
      const componentInserts = selectedItems.map(component => ({
        company_id: currentCompany.id,
        product_template_id: productTemplateId,
        item_template_id: component.item_template_id,
        quantity_formula: component.quantity_formula,
        pieces_quantity: component.pieces_quantity,
        pieces_formula: (component as any).pieces_formula,
        cut_angle: component.cut_angle,
        width_formula: component.width_formula,
        height_formula: component.height_formula,
        is_optional: component.is_optional,
        notes: component.notes,
      }));

      if (componentInserts.length > 0) {
        const { error: insertError } = await supabase
          .from('product_template_items')
          .insert(componentInserts);

        if (insertError) {
          console.error('Error inserting components:', insertError);
          // Continue anyway - the product is activated
        }
      }

      // 4. Add items to company stock with zero quantity
      const uniqueItemTemplateIds = [...new Set(selectedItems.map(c => c.item_template_id))];
      
      for (const itemTemplateId of uniqueItemTemplateIds) {
        // Check if already exists in stock
        const { data: existing } = await supabase
          .from('company_stock')
          .select('id')
          .eq('company_id', currentCompany.id)
          .eq('item_template_id', itemTemplateId)
          .single();

        if (!existing) {
          const itemType = selectedItems.find(c => c.item_template_id === itemTemplateId)?.item_template.type;
          
          // Add to stock with zero quantity
          const { error: stockError } = await supabase
            .from('company_stock')
            .insert({
              company_id: currentCompany.id,
              item_template_id: itemTemplateId,
              quantity: 0,
              min_quantity: 0,
              allow_fractional: itemType === 'profile',
              is_active: true,
            });

          if (stockError) {
            console.error('Error adding to stock:', stockError);
            // Continue anyway
          }
        }
      }

      return activatedProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['linha-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['product-template-items'] });
      toast.success('Produto ativado com sucesso!', {
        description: `${selectedComponents.size} componentes adicionados ao estoque`,
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

  const handleActivate = () => {
    activateMutation.mutate();
  };

  const selectAll = () => {
    if (components) {
      setSelectedComponents(new Set(components.map(c => c.id)));
    }
  };

  const deselectAll = () => {
    setSelectedComponents(new Set());
  };

  const getItemImage = resolveItemImageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Ativar Produto para Venda
          </DialogTitle>
          <DialogDescription>
            Configure os componentes do produto <strong>{productName}</strong> antes de ativar.
            Os itens selecionados serão adicionados ao seu estoque com quantidade zero para você editar depois.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0">
          {loadingComponents ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : components && components.length > 0 ? (
            <div className="space-y-4">
              {/* Selection Controls */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {selectedComponents.size} de {components.length} componentes selecionados
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    Selecionar Todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll}>
                    Limpar
                  </Button>
                </div>
              </div>

              {/* Components List */}
              <ScrollArea className="h-[350px] rounded-lg border">
                <div className="p-3 space-y-2">
                  {components.map((component) => {
                    const isSelected = selectedComponents.has(component.id);
                    const itemType = component.item_template?.type || 'other';
                    const imageUrl = getItemImage(component.item_template?.image_url);

                    return (
                      <div
                        key={component.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/50'
                        }`}
                        onClick={() => toggleComponent(component.id)}
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleComponent(component.id)}
                          className="shrink-0"
                        />

                        {/* Image */}
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={component.item_template?.name}
                              className="w-full h-full object-contain p-1"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-muted-foreground/50" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {component.item_template?.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className={`text-xs ${typeColors[itemType] || ''}`}>
                              {typeLabels[itemType] || itemType}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {component.quantity_formula} × {component.pieces_quantity} {component.item_template?.unit}
                            </span>
                            {component.is_optional && (
                              <Badge variant="outline" className="text-xs">
                                Opcional
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Selection Indicator */}
                        {isSelected && (
                          <Check className="w-5 h-5 text-primary shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              {/* Info Box */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 text-blue-800 text-sm">
                <Boxes className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Itens serão adicionados ao estoque</p>
                  <p className="text-blue-600 mt-0.5">
                    Os componentes selecionados serão adicionados ao seu estoque com preço zerado.
                    Você pode definir os preços depois em <strong>Estoque</strong>.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="font-medium text-muted-foreground">
                Este produto não possui componentes cadastrados
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Você pode ativá-lo mesmo assim e adicionar componentes depois.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleActivate}
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
                Confirmar e Ativar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
