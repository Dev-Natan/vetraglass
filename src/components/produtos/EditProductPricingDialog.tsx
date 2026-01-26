import { useState, useEffect } from 'react';
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
import { Loader2, DollarSign, Package } from 'lucide-react';
import { toast } from 'sonner';
import { ProductPricingStep, ProductPricingData } from './ProductPricingStep';
import { useGlassPriceMatrixMutations } from '@/hooks/useGlassPricing';

interface EditProductPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyProductId: string;
  productName: string;
  productImageUrl?: string | null;
  onSuccess?: () => void;
}

export function EditProductPricingDialog({
  open,
  onOpenChange,
  companyProductId,
  productName,
  productImageUrl,
  onSuccess,
}: EditProductPricingDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const { bulkUpsertMutation } = useGlassPriceMatrixMutations();
  const [pricingData, setPricingData] = useState<ProductPricingData | null>(null);

  // Fetch current product data
  const { data: companyProduct, isLoading: loadingProduct } = useQuery({
    queryKey: ['company-product-pricing', companyProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_products')
        .select('*')
        .eq('id', companyProductId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!companyProductId,
  });

  // Fetch product composition to check for glass
  const { data: productComponents } = useQuery({
    queryKey: ['product-components-for-pricing', companyProductId],
    queryFn: async () => {
      // First try company_product_items
      const { data: companyItems, error: companyError } = await supabase
        .from('company_product_items')
        .select(`
          id,
          item_template:item_templates (
            id,
            type
          )
        `)
        .eq('company_product_id', companyProductId);

      if (companyError) throw companyError;
      
      if (companyItems && companyItems.length > 0) {
        return companyItems;
      }
      
      // If no company items, try product_template_items via product_template_id
      if (companyProduct?.product_template_id) {
        const { data: templateItems, error: templateError } = await supabase
          .from('product_template_items')
          .select(`
            id,
            item_template:item_templates (
              id,
              type
            )
          `)
          .eq('product_template_id', companyProduct.product_template_id)
          .is('company_id', null);

        if (templateError) throw templateError;
        return templateItems || [];
      }

      return [];
    },
    enabled: open && !!companyProductId && !!companyProduct,
  });

  // Check if product has glass components
  const hasGlassComponents = (productComponents || []).some(
    (c: any) => c.item_template?.type === 'glass'
  );

  // Initialize pricing data from current product
  useEffect(() => {
    if (companyProduct && open) {
      setPricingData({
        costPerSqm: Number(companyProduct.cost_per_sqm) || 0,
        pricePerSqm: Number(companyProduct.price_per_sqm) || 0,
        hasGlass: hasGlassComponents,
        glassPrices: [],
      });
    }
  }, [companyProduct, hasGlassComponents, open]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: ProductPricingData) => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      // Update company product with prices
      const { error: productError } = await supabase
        .from('company_products')
        .update({
          cost_per_sqm: data.costPerSqm,
          price_per_sqm: data.pricePerSqm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyProductId);

      if (productError) throw productError;

      // Save glass prices if any
      if (data.hasGlass && data.glassPrices.length > 0) {
        // Get the default glass type (comum)
        const { data: glassTypes } = await supabase
          .from('glass_types')
          .select('id')
          .eq('slug', 'comum')
          .single();

        const glassTypeId = glassTypes?.id;

        if (glassTypeId) {
          const priceEntries = data.glassPrices
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

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['company-product-pricing'] });
      toast.success('Preços atualizados com sucesso!');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast.error('Erro ao salvar preços', {
        description: error.message,
      });
    },
  });

  const handleSave = () => {
    if (!pricingData) return;
    saveMutation.mutate(pricingData);
  };

  const getProductImage = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `/products/${imageUrl}`;
  };

  const isLoading = loadingProduct;
  const isSaving = saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {productImageUrl ? (
                <img
                  src={getProductImage(productImageUrl)}
                  alt={productName}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Package className="w-6 h-6 text-muted-foreground/50" />
              )}
            </div>
            <div>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Editar Preços
              </DialogTitle>
              <DialogDescription>{productName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : pricingData ? (
          <ProductPricingStep
            productName={productName}
            hasGlassComponents={hasGlassComponents}
            initialData={pricingData}
            onChange={setPricingData}
          />
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !pricingData}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              'Salvar Preços'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
