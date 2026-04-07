import { useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { calculatePricing, DEFAULT_PRICING_POLICY, type CompositionItemInput, type PricingInput } from '@/utils/pricingEngine';
import { toast } from 'sonner';
import { useState } from 'react';

interface ProductCompositionPricingProps {
  productId: string;
  productItems: Array<{
    id: string;
    item_template_id: string | null;
    company_item_id: string | null;
    quantity_formula: string;
    width_formula: string | null;
    height_formula: string | null;
    pieces_quantity: number | null;
    cut_angle: number | null;
    item_template?: {
      id: string;
      name: string;
      type: string;
      unit: string;
      image_url: string | null;
      linha: string | null;
    } | null;
    company_item?: {
      id: string;
      name: string;
      type: string;
      unit: string;
      image_url: string | null;
    } | null;
  }>;
  currentCostPerSqm?: number | null;
  currentPricePerSqm?: number | null;
  currentMargin?: number | null;
}

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export function ProductCompositionPricing({
  productId,
  productItems,
  currentCostPerSqm,
  currentPricePerSqm,
  currentMargin,
}: ProductCompositionPricingProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [marginPercent, setMarginPercent] = useState(currentMargin ?? 30);
  const [refWidth, setRefWidth] = useState(1000);
  const [refHeight, setRefHeight] = useState(1000);

  useEffect(() => {
    if (currentMargin != null) setMarginPercent(currentMargin);
  }, [currentMargin]);

  // Fetch all company_items for this product's composition
  const companyItemIds = useMemo(() => {
    return productItems
      .map(pi => pi.company_item_id)
      .filter(Boolean) as string[];
  }, [productItems]);

  const templateIds = useMemo(() => {
    return productItems
      .map(pi => pi.item_template_id)
      .filter(Boolean) as string[];
  }, [productItems]);

  const { data: companyItems } = useQuery({
    queryKey: ['composition-company-items', currentCompany?.id, companyItemIds, templateIds],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      // Fetch by company_item_id
      let items: any[] = [];
      if (companyItemIds.length > 0) {
        const { data } = await supabase
          .from('company_items')
          .select('id, item_template_id, name, type, unit, cost, sale_price, cost_per_bar, cost_per_kg, cost_per_meter, sale_price_per_bar, sale_price_per_kg, sale_price_per_meter, bar_length_mm, weight_kg, weight_per_meter, sale_margin_percent')
          .in('id', companyItemIds);
        if (data) items = [...items, ...data];
      }

      // Also fetch by template_id for items without company_item
      if (templateIds.length > 0) {
        const existingTemplateIds = items.map(i => i.item_template_id).filter(Boolean);
        const missingTemplateIds = templateIds.filter(tid => !existingTemplateIds.includes(tid));
        
        if (missingTemplateIds.length > 0) {
          const { data } = await supabase
            .from('company_items')
            .select('id, item_template_id, name, type, unit, cost, sale_price, cost_per_bar, cost_per_kg, cost_per_meter, sale_price_per_bar, sale_price_per_kg, sale_price_per_meter, bar_length_mm, weight_kg, weight_per_meter, sale_margin_percent')
            .eq('company_id', currentCompany.id)
            .in('item_template_id', missingTemplateIds);
          if (data) items = [...items, ...data];
        }
      }

      return items;
    },
    enabled: !!currentCompany?.id && productItems.length > 0,
  });

  // Also fetch item_templates for weight data fallback
  const { data: itemTemplates } = useQuery({
    queryKey: ['composition-templates-weight', templateIds],
    queryFn: async () => {
      if (templateIds.length === 0) return [];
      const { data } = await supabase
        .from('item_templates')
        .select('id, bar_length_mm, weight_per_bar, weight_per_meter')
        .in('id', templateIds);
      return data || [];
    },
    enabled: templateIds.length > 0,
  });

  // Build pricing inputs and calculate
  const pricingResult = useMemo(() => {
    if (!companyItems || companyItems.length === 0) return null;

    const compositionInputs: CompositionItemInput[] = productItems.map(pi => {
      const ci = companyItems.find(
        c => c.id === pi.company_item_id || c.item_template_id === pi.item_template_id
      );
      const tpl = itemTemplates?.find(t => t.id === pi.item_template_id);
      const itemType = (pi.item_template?.type || pi.company_item?.type || 'accessory') as CompositionItemInput['itemType'];

      return {
        id: pi.id,
        itemName: pi.item_template?.name || pi.company_item?.name || 'Item',
        itemType,
        unit: pi.item_template?.unit || pi.company_item?.unit || 'un',
        imageUrl: pi.item_template?.image_url || pi.company_item?.image_url,
        widthFormula: pi.width_formula,
        heightFormula: pi.quantity_formula, // profiles use quantity_formula as dimension
        quantityFormula: pi.quantity_formula,
        piecesQuantity: pi.pieces_quantity || 1,
        piecesFormula: (pi as any).pieces_formula,
        cutAngle: pi.cut_angle,
        lossPercent: 0,
        barLengthMm: ci?.bar_length_mm || tpl?.bar_length_mm || 6000,
        weightPerMeter: ci?.weight_per_meter || tpl?.weight_per_meter || 0,
        costPerBar: ci?.cost_per_bar || 0,
        costPerKg: ci?.cost_per_kg || 0,
        costPerMeter: ci?.cost_per_meter || 0,
        costPerUnit: ci?.cost || 0,
      };
    });

    const input: PricingInput = {
      vaoLargura: refWidth,
      vaoAltura: refHeight,
      quantity: 1,
    };

    try {
      return calculatePricing(compositionInputs, input, DEFAULT_PRICING_POLICY, marginPercent);
    } catch (e) {
      console.error('Pricing calculation error:', e);
      return null;
    }
  }, [companyItems, itemTemplates, productItems, marginPercent, refWidth, refHeight]);

  // Count items without pricing
  const itemsWithoutPrice = useMemo(() => {
    if (!companyItems) return productItems.length;
    return productItems.filter(pi => {
      const ci = companyItems.find(
        c => c.id === pi.company_item_id || c.item_template_id === pi.item_template_id
      );
      if (!ci) return true;
      const type = pi.item_template?.type || pi.company_item?.type;
      if (type === 'profile') return !ci.cost_per_bar && !ci.cost_per_kg && !ci.cost_per_meter;
      if (type === 'glass') return !ci.cost_per_meter;
      return !ci.cost && !ci.cost_per_bar;
    }).length;
  }, [companyItems, productItems]);

  // Save pricing mutation
  const savePricingMutation = useMutation({
    mutationFn: async () => {
      if (!pricingResult) throw new Error('Sem cálculo disponível');
      const { error } = await supabase
        .from('company_products')
        .update({
          cost_per_sqm: pricingResult.costPerSqm,
          price_per_sqm: pricingResult.pricePerSqm,
          margin_percent: marginPercent,
        })
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-product', productId] });
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      toast.success('Preço do produto atualizado!');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  if (productItems.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" />
          Precificação por Composição
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reference dimensions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Largura ref. (mm)</Label>
            <Input
              type="number"
              value={refWidth}
              onChange={(e) => setRefWidth(Number(e.target.value) || 1000)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Altura ref. (mm)</Label>
            <Input
              type="number"
              value={refHeight}
              onChange={(e) => setRefHeight(Number(e.target.value) || 1000)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Margem (%)</Label>
            <Input
              type="number"
              value={marginPercent}
              onChange={(e) => setMarginPercent(Number(e.target.value) || 0)}
              className="h-8 text-sm"
              min={0}
              step={1}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Área (m²)</Label>
            <div className="h-8 flex items-center text-sm font-medium">
              {((refWidth * refHeight) / 1_000_000).toFixed(4)} m²
            </div>
          </div>
        </div>

        {/* Warning */}
        {itemsWithoutPrice > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{itemsWithoutPrice} item(ns) sem preço definido no estoque</span>
          </div>
        )}

        {/* Results */}
        {pricingResult && (
          <div className="space-y-3">
            {/* Cost by type */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(pricingResult.costByType).map(([type, cost]) => (
                <div key={type} className="rounded-lg bg-muted/50 p-2.5">
                  <div className="text-[10px] text-muted-foreground uppercase">
                    {type === 'profile' ? 'Perfis' : type === 'glass' ? 'Vidros' : type === 'accessory' ? 'Acessórios' : type}
                  </div>
                  <div className="text-sm font-semibold">{formatBRL(cost)}</div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="text-[10px] text-muted-foreground">Custo Total</div>
                <div className="text-sm font-bold">{formatBRL(pricingResult.totalCost)}</div>
              </div>
              <div className="rounded-lg bg-muted/50 p-2.5">
                <div className="text-[10px] text-muted-foreground">Custo/m²</div>
                <div className="text-sm font-bold">{formatBRL(pricingResult.costPerSqm)}</div>
              </div>
              <div className="rounded-lg bg-primary/10 p-2.5">
                <div className="text-[10px] text-primary font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Preço/m²
                </div>
                <div className="text-sm font-bold text-primary">{formatBRL(pricingResult.pricePerSqm)}</div>
              </div>
              <div className="rounded-lg bg-primary/10 p-2.5">
                <div className="text-[10px] text-primary font-medium">Preço Final</div>
                <div className="text-sm font-bold text-primary">{formatBRL(pricingResult.finalPrice)}</div>
              </div>
            </div>

            {/* Item details */}
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-1">
                Detalhes por item ({pricingResult.items.length})
              </summary>
              <div className="mt-2 space-y-1">
                {pricingResult.items.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1 border-b border-muted/50">
                    <div>
                      <span className="font-medium">{item.itemName}</span>
                      <span className="text-muted-foreground ml-2">{item.displayMeasure}</span>
                    </div>
                    <span className="font-medium">{formatBRL(item.totalCost)}</span>
                  </div>
                ))}
              </div>
            </details>

            {/* Save button */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                {currentPricePerSqm ? (
                  <span>Preço atual: {formatBRL(currentPricePerSqm)}/m²</span>
                ) : (
                  <span>Nenhum preço salvo</span>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (confirm('Isso irá sobrescrever o preço de venda atual do produto. Deseja continuar?')) {
                    savePricingMutation.mutate();
                  }
                }}
                disabled={savePricingMutation.isPending}
                className="gap-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${savePricingMutation.isPending ? 'animate-spin' : ''}`} />
                {savePricingMutation.isPending ? 'Salvando...' : 'Atualizar Preço'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
