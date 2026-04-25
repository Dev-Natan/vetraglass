import { useMemo, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calculator, TrendingUp, AlertTriangle, RefreshCw, Link2, Save, Loader2 } from 'lucide-react';
import { calculatePricing, DEFAULT_PRICING_POLICY, type CompositionItemInput, type PricingInput } from '@/utils/pricingEngine';
import { recalculatePricesForProductsWithItem } from '@/utils/productPriceUpdater';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatBRLInput, parseBRLInput } from '@/utils/currencyMask';

interface ProductCompositionPricingProps {
  productId: string;
  onSuccess?: (cost: number, price: number) => void;
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

type PriceEdits = Record<string, {
  cost_per_bar?: string;
  cost_per_kg?: string;
  cost_per_meter?: string;
  cost?: string;
}>;

export function ProductCompositionPricing({
  productId,
  onSuccess,
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
  const [priceEdits, setPriceEdits] = useState<PriceEdits>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (currentMargin != null) setMarginPercent(currentMargin);
  }, [currentMargin]);

  const companyItemIds = useMemo(() => {
    return productItems.map(pi => pi.company_item_id).filter(Boolean) as string[];
  }, [productItems]);

  const templateIds = useMemo(() => {
    return productItems.map(pi => pi.item_template_id).filter(Boolean) as string[];
  }, [productItems]);

  const { data: companyItems } = useQuery({
    queryKey: ['composition-company-items', currentCompany?.id, companyItemIds, templateIds],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      let items: any[] = [];
      if (companyItemIds.length > 0) {
        const { data } = await supabase
          .from('company_items')
          .select('id, item_template_id, name, type, unit, cost, sale_price, cost_per_bar, cost_per_kg, cost_per_meter, sale_price_per_bar, sale_price_per_kg, sale_price_per_meter, bar_length_mm, weight_kg, weight_per_meter, sale_margin_percent')
          .in('id', companyItemIds);
        if (data) items = [...items, ...data];
      }
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

  // Quantos produtos compartilham cada company_item (para mostrar aviso de compartilhamento)
  const { data: sharedUsage } = useQuery({
    queryKey: ['company-item-usage', currentCompany?.id, companyItemIds],
    queryFn: async () => {
      if (!currentCompany?.id || companyItemIds.length === 0) return {};
      const { data } = await supabase
        .from('company_product_items')
        .select('company_item_id, company_product_id')
        .in('company_item_id', companyItemIds);
      const counts: Record<string, Set<string>> = {};
      (data || []).forEach((row: any) => {
        if (!row.company_item_id) return;
        if (!counts[row.company_item_id]) counts[row.company_item_id] = new Set();
        counts[row.company_item_id].add(row.company_product_id);
      });
      const result: Record<string, number> = {};
      Object.entries(counts).forEach(([k, set]) => { result[k] = set.size; });
      return result;
    },
    enabled: !!currentCompany?.id && companyItemIds.length > 0,
  });

  // Resolve company_item correspondente a cada productItem
  const itemMap = useMemo(() => {
    const map = new Map<string, any>();
    productItems.forEach(pi => {
      const ci = companyItems?.find(
        c => c.id === pi.company_item_id || c.item_template_id === pi.item_template_id
      );
      if (ci) map.set(pi.id, ci);
    });
    return map;
  }, [productItems, companyItems]);

  // Aplica edits sobre os company_items para cálculo em tempo real
  const effectiveCompanyItems = useMemo(() => {
    if (!companyItems) return [];
    return companyItems.map(ci => {
      const edit = priceEdits[ci.id];
      if (!edit) return ci;
      return {
        ...ci,
        cost_per_bar: edit.cost_per_bar !== undefined ? parseFloat(edit.cost_per_bar) || 0 : ci.cost_per_bar,
        cost_per_kg: edit.cost_per_kg !== undefined ? parseFloat(edit.cost_per_kg) || 0 : ci.cost_per_kg,
        cost_per_meter: edit.cost_per_meter !== undefined ? parseFloat(edit.cost_per_meter) || 0 : ci.cost_per_meter,
        cost: edit.cost !== undefined ? parseFloat(edit.cost) || 0 : ci.cost,
      };
    });
  }, [companyItems, priceEdits]);

  const pricingResult = useMemo(() => {
    if (!effectiveCompanyItems || effectiveCompanyItems.length === 0) return null;
    const compositionInputs: CompositionItemInput[] = productItems.map(pi => {
      const ci = effectiveCompanyItems.find(
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
        heightFormula: pi.quantity_formula,
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
    const input: PricingInput = { vaoLargura: refWidth, vaoAltura: refHeight, quantity: 1 };
    try {
      return calculatePricing(compositionInputs, input, DEFAULT_PRICING_POLICY, marginPercent);
    } catch (e) {
      console.error('Pricing calc error', e);
      return null;
    }
  }, [effectiveCompanyItems, itemTemplates, productItems, marginPercent, refWidth, refHeight]);

  const itemsWithoutPrice = useMemo(() => {
    if (!effectiveCompanyItems) return productItems.length;
    return productItems.filter(pi => {
      const ci = effectiveCompanyItems.find(
        c => c.id === pi.company_item_id || c.item_template_id === pi.item_template_id
      );
      if (!ci) return true;
      const type = pi.item_template?.type || pi.company_item?.type;
      if (type === 'profile') return !ci.cost_per_bar && !ci.cost_per_kg && !ci.cost_per_meter;
      if (type === 'glass') return !ci.cost_per_meter;
      return !ci.cost && !ci.cost_per_bar;
    }).length;
  }, [effectiveCompanyItems, productItems]);

  // Mutation para salvar preço de UM item (sincroniza com todos os produtos)
  const saveItemPriceMutation = useMutation({
    mutationFn: async ({ companyItemId, payload }: { companyItemId: string; payload: Record<string, number> }) => {
      const { error } = await supabase
        .from('company_items')
        .update(payload)
        .eq('id', companyItemId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      // Limpa edição local desse item
      setPriceEdits(prev => {
        const next = { ...prev };
        delete next[vars.companyItemId];
        return next;
      });
      // Invalida tudo que depende de preços de itens
      queryClient.invalidateQueries({ queryKey: ['composition-company-items'] });
      queryClient.invalidateQueries({ queryKey: ['company-items'] });
      queryClient.invalidateQueries({ queryKey: ['company-stock'] });
      queryClient.invalidateQueries({ queryKey: ['company-item-prices'] });
      queryClient.invalidateQueries({ queryKey: ['composition-for-pricing'] });
      queryClient.invalidateQueries({ queryKey: ['fallback-company-items'] });
      toast.success('Preço atualizado em todos os produtos que usam este item');
    },
    onError: (e: any) => toast.error('Erro ao salvar: ' + e.message),
    onSettled: () => setSavingItemId(null),
  });

  const handleSaveItemPrice = (companyItemId: string, itemType: string) => {
    const edit = priceEdits[companyItemId];
    if (!edit) return;
    const payload: Record<string, number> = {};
    if (itemType === 'profile') {
      if (edit.cost_per_bar !== undefined) payload.cost_per_bar = parseFloat(edit.cost_per_bar) || 0;
      if (edit.cost_per_kg !== undefined) payload.cost_per_kg = parseFloat(edit.cost_per_kg) || 0;
      if (edit.cost_per_meter !== undefined) payload.cost_per_meter = parseFloat(edit.cost_per_meter) || 0;
    } else if (itemType === 'glass') {
      if (edit.cost_per_meter !== undefined) payload.cost_per_meter = parseFloat(edit.cost_per_meter) || 0;
    } else {
      if (edit.cost !== undefined) payload.cost = parseFloat(edit.cost) || 0;
    }
    if (Object.keys(payload).length === 0) return;
    setSavingItemId(companyItemId);
    saveItemPriceMutation.mutate({ companyItemId, payload });
  };

  const updateEdit = (companyItemId: string, field: keyof PriceEdits[string], value: string) => {
    // Aplica máscara BRL: extrai apenas dígitos e armazena como número (string)
    const numeric = parseBRLInput(value);
    setPriceEdits(prev => ({
      ...prev,
      [companyItemId]: { ...prev[companyItemId], [field]: numeric > 0 ? numeric.toString() : '' },
    }));
  };

  const getEditValue = (companyItemId: string, field: keyof PriceEdits[string], fallback: number | null | undefined): string => {
    const edit = priceEdits[companyItemId]?.[field];
    if (edit !== undefined) {
      const n = parseFloat(edit);
      return n > 0 ? formatBRLInput(n) : '';
    }
    return fallback != null && fallback !== 0 ? formatBRLInput(Number(fallback)) : '';
  };

  const hasUnsavedEdits = (companyItemId: string) => {
    return !!priceEdits[companyItemId] && Object.keys(priceEdits[companyItemId]).length > 0;
  };

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
      if (onSuccess && pricingResult) {
        onSuccess(pricingResult.costPerSqm, pricingResult.pricePerSqm);
      }
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Largura ref. (mm)</Label>
            <Input type="number" value={refWidth} onChange={(e) => setRefWidth(Number(e.target.value) || 1000)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Altura ref. (mm)</Label>
            <Input type="number" value={refHeight} onChange={(e) => setRefHeight(Number(e.target.value) || 1000)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Margem (%)</Label>
            <Input type="number" value={marginPercent} onChange={(e) => setMarginPercent(Number(e.target.value) || 0)} className="h-8 text-sm" min={0} step={1} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Área (m²)</Label>
            <div className="h-8 flex items-center text-sm font-medium">
              {((refWidth * refHeight) / 1_000_000).toFixed(4)} m²
            </div>
          </div>
        </div>

        {itemsWithoutPrice > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>{itemsWithoutPrice} item(ns) sem preço definido. Edite abaixo.</span>
          </div>
        )}

        {/* Editor de preços por item */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-medium">Preços dos Insumos (compartilhados entre produtos)</span>
            <span className="text-[10px] text-muted-foreground">Editar aqui atualiza todos os produtos que usam o mesmo item</span>
          </div>
          <div className="divide-y">
            {productItems.map(pi => {
              const ci = itemMap.get(pi.id);
              const itemType = pi.item_template?.type || pi.company_item?.type || 'accessory';
              const itemName = pi.item_template?.name || pi.company_item?.name || 'Item';
              const sharedCount = ci ? (sharedUsage?.[ci.id] || 0) : 0;
              const calcItem = pricingResult?.items.find(it => it.id === pi.id);
              const unsaved = ci ? hasUnsavedEdits(ci.id) : false;
              const isSaving = ci?.id === savingItemId;

              if (!ci) {
                return (
                  <div key={pi.id} className="px-3 py-2 text-xs text-destructive">
                    {itemName} — Item não encontrado no estoque. Adicione-o no estoque primeiro.
                  </div>
                );
              }

              return (
                <div key={pi.id} className="px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[9px] uppercase">{itemType === 'profile' ? 'Perfil' : itemType === 'glass' ? 'Vidro' : 'Acess.'}</Badge>
                      <span className="text-sm font-medium truncate">{itemName}</span>
                      {sharedCount > 1 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="gap-1 text-[10px]">
                                <Link2 className="h-3 w-3" />
                                {sharedCount} produtos
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Este item é usado em {sharedCount} produtos. Editar o preço aqui afeta todos.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {calcItem && (
                        <span className="text-xs text-muted-foreground">{formatBRL(calcItem.totalCost)}</span>
                      )}
                      <Button
                        size="sm"
                        variant={unsaved ? 'default' : 'outline'}
                        disabled={!unsaved || isSaving}
                        onClick={() => handleSaveItemPrice(ci.id, itemType)}
                        className="h-7 px-2 gap-1"
                      >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Salvar
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {itemType === 'profile' && (
                      <>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Custo/Barra</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">R$</span>
                            <Input
                              type="text" inputMode="numeric"
                              value={getEditValue(ci.id, 'cost_per_bar', ci.cost_per_bar)}
                              onChange={(e) => updateEdit(ci.id, 'cost_per_bar', e.target.value)}
                              placeholder="0,00"
                              className="h-7 text-xs pl-7"
                            />
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Custo/Kg</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">R$</span>
                            <Input
                              type="text" inputMode="numeric"
                              value={getEditValue(ci.id, 'cost_per_kg', ci.cost_per_kg)}
                              onChange={(e) => updateEdit(ci.id, 'cost_per_kg', e.target.value)}
                              placeholder="0,00"
                              className="h-7 text-xs pl-7"
                            />
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <Label className="text-[10px] text-muted-foreground">Custo/Metro</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">R$</span>
                            <Input
                              type="text" inputMode="numeric"
                              value={getEditValue(ci.id, 'cost_per_meter', ci.cost_per_meter)}
                              onChange={(e) => updateEdit(ci.id, 'cost_per_meter', e.target.value)}
                              placeholder="0,00"
                              className="h-7 text-xs pl-7"
                            />
                          </div>
                        </div>
                      </>
                    )}
                    {itemType === 'glass' && (
                      <div className="space-y-0.5 col-span-full sm:col-span-1">
                        <Label className="text-[10px] text-muted-foreground">Custo/m²</Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">R$</span>
                          <Input
                            type="text" inputMode="numeric"
                            value={getEditValue(ci.id, 'cost_per_meter', ci.cost_per_meter)}
                            onChange={(e) => updateEdit(ci.id, 'cost_per_meter', e.target.value)}
                            placeholder="0,00"
                            className="h-7 text-xs pl-7"
                          />
                        </div>
                      </div>
                    )}
                    {itemType !== 'profile' && itemType !== 'glass' && (
                      <div className="space-y-0.5 col-span-full sm:col-span-1">
                        <Label className="text-[10px] text-muted-foreground">Custo Unitário</Label>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">R$</span>
                          <Input
                            type="text" inputMode="numeric"
                            value={getEditValue(ci.id, 'cost', ci.cost)}
                            onChange={(e) => updateEdit(ci.id, 'cost', e.target.value)}
                            placeholder="0,00"
                            className="h-7 text-xs pl-7"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {pricingResult && (
          <div className="space-y-3">
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
                {savePricingMutation.isPending ? 'Salvando...' : 'Atualizar Preço do Produto'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
