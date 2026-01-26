import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DollarSign, Percent, Package, Sparkles, AlertCircle } from 'lucide-react';
import { GlassPricingMatrix, GlassPriceEntry } from './GlassPricingMatrix';
import { cn } from '@/lib/utils';

export interface ProductPricingData {
  costPerSqm: number;
  pricePerSqm: number;
  hasGlass: boolean;
  glassPrices: GlassPriceEntry[];
}

interface ProductPricingStepProps {
  productName: string;
  hasGlassComponents: boolean;
  initialData?: Partial<ProductPricingData>;
  onChange: (data: ProductPricingData) => void;
}

export function ProductPricingStep({
  productName,
  hasGlassComponents,
  initialData,
  onChange,
}: ProductPricingStepProps) {
  const [costPerSqm, setCostPerSqm] = useState(initialData?.costPerSqm || 0);
  const [pricePerSqm, setPricePerSqm] = useState(initialData?.pricePerSqm || 0);
  const [hasGlass, setHasGlass] = useState(initialData?.hasGlass ?? hasGlassComponents);
  const [glassPrices, setGlassPrices] = useState<GlassPriceEntry[]>(initialData?.glassPrices || []);

  // Calculate margin
  const margin = useMemo(() => {
    if (costPerSqm <= 0 || pricePerSqm <= 0) return 0;
    return ((pricePerSqm - costPerSqm) / costPerSqm) * 100;
  }, [costPerSqm, pricePerSqm]);

  const marginStatus = useMemo(() => {
    if (margin < 0) return 'negative';
    if (margin < 15) return 'low';
    if (margin < 30) return 'medium';
    return 'high';
  }, [margin]);

  // Emit changes
  useEffect(() => {
    onChange({
      costPerSqm,
      pricePerSqm,
      hasGlass,
      glassPrices,
    });
  }, [costPerSqm, pricePerSqm, hasGlass, glassPrices]);

  return (
    <div className="space-y-6">
      {/* Product Base Price */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Preço do Produto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Cost */}
            <div className="space-y-2">
              <Label htmlFor="cost" className="text-sm">
                Custo por m²
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPerSqm || ''}
                  onChange={e => setCostPerSqm(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Sale Price */}
            <div className="space-y-2">
              <Label htmlFor="price" className="text-sm">
                Venda por m²
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricePerSqm || ''}
                  onChange={e => setPricePerSqm(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="pl-10"
                />
              </div>
            </div>

            {/* Margin Display */}
            <div className="space-y-2">
              <Label className="text-sm">Margem de lucro</Label>
              <div className={cn(
                "h-10 rounded-md border flex items-center justify-center gap-2 font-medium",
                marginStatus === 'negative' && "bg-destructive/10 border-destructive text-destructive",
                marginStatus === 'low' && "bg-warning/10 border-warning text-warning",
                marginStatus === 'medium' && "bg-blue-500/10 border-blue-500 text-blue-600",
                marginStatus === 'high' && "bg-success/10 border-success text-success",
              )}>
                <Percent className="w-4 h-4" />
                <span>{margin.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Margin warning */}
          {marginStatus === 'negative' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>A margem de lucro está negativa. O preço de venda é menor que o custo.</span>
            </div>
          )}
          {marginStatus === 'low' && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Margem de lucro baixa. Considere ajustar o preço de venda.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Glass Pricing Section */}
      {hasGlassComponents && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                Preços de Vidro
              </span>
              <Badge variant="secondary" className="text-xs bg-cyan-100 text-cyan-700">
                {glassPrices.filter(p => p.price > 0).length} configurados
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Este produto contém vidros na composição. Configure os preços por cor e espessura.
            </p>
            <GlassPricingMatrix
              prices={glassPrices}
              onPricesChange={setGlassPrices}
            />
          </CardContent>
        </Card>
      )}

      {/* Optional Glass for products without glass components */}
      {!hasGlassComponents && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="has-glass"
                checked={hasGlass}
                onCheckedChange={(checked) => setHasGlass(checked === true)}
              />
              <Label htmlFor="has-glass" className="text-sm font-normal cursor-pointer">
                Este produto pode incluir vidros (configurar preços de vidro)
              </Label>
            </div>
            
            {hasGlass && (
              <div className="mt-4 pt-4 border-t">
                <GlassPricingMatrix
                  prices={glassPrices}
                  onPricesChange={setGlassPrices}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
