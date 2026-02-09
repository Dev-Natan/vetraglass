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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign, Package, GlassWater, Info } from 'lucide-react';
import { toast } from 'sonner';
import { ProductGlassPricesSection } from './ProductGlassPricesSection';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const [costPerSqm, setCostPerSqm] = useState<string>('');
  const [pricePerSqm, setPricePerSqm] = useState<string>('');
  const [usesGlass, setUsesGlass] = useState(true);

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

  // Initialize pricing data from current product
  useEffect(() => {
    if (companyProduct && open) {
      setCostPerSqm(String(companyProduct.cost_per_sqm || ''));
      setPricePerSqm(String(companyProduct.price_per_sqm || ''));
      setUsesGlass(companyProduct.uses_glass ?? true);
    }
  }, [companyProduct, open]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');

      const { error: productError } = await supabase
        .from('company_products')
        .update({
          cost_per_sqm: parseFloat(costPerSqm) || 0,
          price_per_sqm: parseFloat(pricePerSqm) || 0,
          uses_glass: usesGlass,
          updated_at: new Date().toISOString(),
        })
        .eq('id', companyProductId);

      if (productError) throw productError;

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
    saveMutation.mutate();
  };

  const getProductImage = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    if (imageUrl.startsWith('/')) return imageUrl;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
    const bucket = uuidPattern.test(imageUrl) ? 'company-product-images' : 'product-templates';
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${imageUrl}`;
  };

  const margin = (() => {
    const price = parseFloat(pricePerSqm) || 0;
    const cost = parseFloat(costPerSqm) || 0;
    if (cost <= 0) return 0;
    return ((price - cost) / cost) * 100;
  })();

  const isLoading = loadingProduct;
  const isSaving = saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
        ) : (
          <div className="space-y-6">
            {/* Preço Base do Produto */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Package className="w-4 h-4" />
                Preço Base do Produto (Perfis e Componentes)
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Custo/m² (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={costPerSqm}
                    onChange={(e) => setCostPerSqm(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço/m² (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={pricePerSqm}
                    onChange={(e) => setPricePerSqm(e.target.value)}
                  />
                </div>
              </div>

              {(parseFloat(pricePerSqm) > 0 || parseFloat(costPerSqm) > 0) && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">Margem base:</span>
                  <Badge
                    variant={margin >= 30 ? 'default' : margin >= 15 ? 'secondary' : 'destructive'}
                  >
                    {margin.toFixed(1)}%
                  </Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Toggle para usar vidro */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GlassWater className="w-4 h-4 text-primary" />
                <Label htmlFor="uses-glass">Este produto utiliza vidro</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Ative para configurar preços por tipo de vidro</p>
                      <p>O preço do vidro define o preço final do produto</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch
                id="uses-glass"
                checked={usesGlass}
                onCheckedChange={setUsesGlass}
              />
            </div>

            {/* Seção de Preços de Vidro */}
            {usesGlass && companyProductId && (
              <ProductGlassPricesSection
                companyProductId={companyProductId}
                productName={productName}
                usesGlass={usesGlass}
              />
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
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
