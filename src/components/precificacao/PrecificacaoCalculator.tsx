import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Package, FileDown, TrendingUp, TrendingDown, Minus,
  Layers, Search, DollarSign, Ruler, BarChart3, Plus, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  usePricingProducts,
  usePricingComponents,
  useCalculatePricing,
} from '@/hooks/usePricingCalculator';
import { useProductCategories } from '@/hooks/useProductCategories';
import { generatePricingReportPdf } from '@/utils/generatePricingReportPdf';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';
import { toast } from 'sonner';

const categoryLabels: Record<string, string> = {
  window: 'Janela', door: 'Porta', facade: 'Fachada',
  shower: 'Box', mirror: 'Espelho', partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo', other: 'Outros',
};

const typeLabels: Record<string, string> = {
  profile: 'Perfis de Alumínio',
  glass: 'Vidros',
  accessory: 'Acessórios',
  service: 'Serviços',
};

const typeIcons: Record<string, string> = {
  profile: '🔩',
  glass: '🪟',
  accessory: '⚙️',
  service: '🔧',
};

const shortTypeLabels: Record<string, string> = {
  profile: 'Perfil',
  glass: 'Vidro',
  accessory: 'Acessório',
  service: 'Serviço',
  component: 'Componente',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface ManualItem {
  id: string;
  templateItemId: string;
  itemName: string;
  itemType: string;
  unit: string;
  widthFormula: string;
  heightFormula: string;
  piecesQuantity: number;
  unitCost: number;
}

export function PrecificacaoCalculator() {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1200);
  const [quantity, setQuantity] = useState(1);
  const [selectedLinha, setSelectedLinha] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});
  const [marginPercent, setMarginPercent] = useState(30);
  // Manual items added by user
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [addItemId, setAddItemId] = useState('');
  const [addItemFilter, setAddItemFilter] = useState('all');
  const [addItemSearch, setAddItemSearch] = useState('');

  const { data: products, isLoading: loadingProducts } = usePricingProducts();
  const { data: components, isLoading: loadingComponents } = usePricingComponents(selectedProduct || null);
  const summary = useCalculatePricing(components, width, height, quantity, costOverrides);
  const { data: productCategories } = useProductCategories();

  // Fetch item_templates for manual adding
  const { data: itemTemplates = [] } = useQuery({
    queryKey: ['item-templates-for-calculator'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('id, name, type, unit, default_price, linha')
        .eq('is_active', true)
        .order('type')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch ALL linhas from templates
  const { data: allSystemLinhas = [] } = useQuery({
    queryKey: ['all-template-linhas'],
    queryFn: async () => {
      const set = new Set<string>();
      const { data: tpl } = await supabase
        .from('product_templates')
        .select('linha')
        .eq('is_active', true)
        .not('linha', 'is', null);
      tpl?.forEach(p => p.linha && set.add(p.linha));
      return Array.from(set).sort();
    },
  });

  const handleCostChange = (componentId: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setCostOverrides(prev => ({ ...prev, [componentId]: num }));
  };

  const resetCostOverride = (componentId: string) => {
    setCostOverrides(prev => {
      const next = { ...prev };
      delete next[componentId];
      return next;
    });
  };

  // Filtered item templates for the add dropdown
  const filteredTemplateItems = useMemo(() => {
    return itemTemplates.filter(item => {
      if (addItemFilter !== 'all' && item.type !== addItemFilter) return false;
      if (addItemSearch) {
        if (!item.name.toLowerCase().includes(addItemSearch.toLowerCase())) return false;
      }
      return true;
    });
  }, [itemTemplates, addItemFilter, addItemSearch]);

  const addManualItem = () => {
    const item = itemTemplates.find(i => i.id === addItemId);
    if (!item) return;
    setManualItems(prev => [...prev, {
      id: crypto.randomUUID(),
      templateItemId: item.id,
      itemName: item.name,
      itemType: item.type,
      unit: item.unit,
      widthFormula: item.type === 'profile' || item.type === 'glass' ? 'Largura' : '',
      heightFormula: item.type === 'glass' ? 'Altura' : '',
      piecesQuantity: 1,
      unitCost: item.default_price || 0,
    }]);
    setAddItemId('');
  };

  const updateManualItem = (id: string, field: keyof ManualItem, value: any) => {
    setManualItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeManualItem = (id: string) => {
    setManualItems(prev => prev.filter(i => i.id !== id));
  };

  // Calculate manual items pricing
  const calculatedManualItems = useMemo(() => {
    return manualItems.map(comp => {
      const piecesQty = comp.piecesQuantity || 1;
      const calculatedQuantity = piecesQty * quantity;

      if (comp.itemType === 'glass') {
        const calcW = evaluateFormula(comp.widthFormula || 'Largura', width, height);
        const calcH = evaluateFormula(comp.heightFormula || 'Altura', width, height);
        const glassAreaM2 = (calcW * calcH) / 1_000_000;
        return {
          ...comp,
          calculatedQuantity,
          calculatedLength: glassAreaM2,
          displayMeasure: `${glassAreaM2.toFixed(4)} m²`,
          totalCost: comp.unitCost * glassAreaM2 * calculatedQuantity,
        };
      } else if (comp.itemType === 'profile') {
        const length = comp.heightFormula
          ? evaluateFormula(comp.heightFormula, width, height)
          : comp.widthFormula
            ? evaluateFormula(comp.widthFormula, width, height)
            : width;
        const lengthM = length / 1000;
        const costPerMeter = comp.unitCost / 6;
        return {
          ...comp,
          calculatedQuantity,
          calculatedLength: length,
          displayMeasure: `${length} mm`,
          totalCost: costPerMeter * lengthM * calculatedQuantity,
        };
      } else {
        return {
          ...comp,
          calculatedQuantity,
          calculatedLength: 0,
          displayMeasure: '-',
          totalCost: comp.unitCost * calculatedQuantity,
        };
      }
    });
  }, [manualItems, width, height, quantity]);

  const manualTotalCost = calculatedManualItems.reduce((s, c) => s + c.totalCost, 0);

  // Combined totals (template components + manual items)
  const combinedTotalCost = summary.totalComponentCost + manualTotalCost;
  const combinedTotalPrice = combinedTotalCost * (1 + marginPercent / 100);
  const combinedMargin = combinedTotalPrice - combinedTotalCost;
  const areaM2 = (width * height) / 1_000_000;
  const combinedCostPerSqm = areaM2 > 0 ? combinedTotalCost / (areaM2 * quantity) : 0;
  const combinedPricePerSqm = areaM2 > 0 ? combinedTotalPrice / (areaM2 * quantity) : 0;

  // All categories from system
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    productCategories?.forEach(c => set.add(c.slug));
    products?.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [productCategories, products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      if (selectedLinha && p.linha !== selectedLinha) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.commercial_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [products, selectedLinha, selectedCategory, searchQuery]);

  const groupedComponents = useMemo(() => {
    const groups: Record<string, typeof summary.components> = {};
    summary.components.forEach(c => {
      if (!groups[c.itemType]) groups[c.itemType] = [];
      groups[c.itemType].push(c);
    });
    return groups;
  }, [summary.components]);

  const selectedProductData = products?.find(p => p.id === selectedProduct);

  const handleExportPdf = () => {
    if (!selectedProductData) return;
    generatePricingReportPdf({
      productName: selectedProductData.commercial_name,
      linha: selectedProductData.linha,
      category: selectedProductData.category,
      width,
      height,
      quantity,
      summary: {
        ...summary,
        totalComponentCost: combinedTotalCost,
        totalComponentPrice: combinedTotalPrice,
        costPerSqm: combinedCostPerSqm,
        pricePerSqm: combinedPricePerSqm,
        margin: combinedMargin,
        marginPercent: marginPercent,
      },
      companyName: 'Precificação',
      generatedAt: new Date().toLocaleString('pt-BR'),
    });
    toast.success('Relatório PDF gerado!');
  };

  const hasAnyComponents = summary.components.length > 0 || manualItems.length > 0;

  return (
    <div className="space-y-6">
      {/* Export button */}
      {selectedProduct && hasAnyComponents && (
        <div className="flex justify-end">
          <Button onClick={handleExportPdf} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      )}

      {/* Filters & Product Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Seleção de Produto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Linha</Label>
              <Select value={selectedLinha || '__all__'} onValueChange={v => {
                setSelectedLinha(v === '__all__' ? '' : v);
                setSelectedCategory('');
                setSelectedProduct('');
                setCostOverrides({});
                setManualItems([]);
              }}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as linhas</SelectItem>
                  {allSystemLinhas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={selectedCategory || '__all__'} onValueChange={v => {
                setSelectedCategory(v === '__all__' ? '' : v);
                setSelectedProduct('');
              }}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as categorias</SelectItem>
                  {allCategories.map(c => (
                    <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs">Buscar produto</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Produto</Label>
            {loadingProducts ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedProduct} onValueChange={v => {
                setSelectedProduct(v);
                setManualItems([]);
                setCostOverrides({});
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto para precificar" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        {p.commercial_name}
                        {p.linha && (
                          <span className="text-xs text-muted-foreground">({p.linha})</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum produto encontrado
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedProduct && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Ruler className="h-3 w-3" /> Largura (mm)
                </Label>
                <Input
                  type="number" min={100} step={10}
                  value={width}
                  onChange={e => setWidth(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Ruler className="h-3 w-3" /> Altura (mm)
                </Label>
                <Input
                  type="number" min={100} step={10}
                  value={height}
                  onChange={e => setHeight(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number" min={1}
                  value={quantity}
                  onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Margem de Lucro (%)
                </Label>
                <Input
                  type="number" min={0} step={1}
                  value={marginPercent}
                  onChange={e => setMarginPercent(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading state */}
      {selectedProduct && loadingComponents && (
        <Card>
          <CardContent className="py-8">
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {selectedProduct && !loadingComponents && hasAnyComponents && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Custo Total</span>
                </div>
                <p className="text-lg font-bold">{formatCurrency(combinedTotalCost)}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(combinedCostPerSqm)}/m²</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Preço de Venda</span>
                </div>
                <p className="text-lg font-bold text-primary">{formatCurrency(combinedTotalPrice)}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(combinedPricePerSqm)}/m²</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <span className="text-xs text-muted-foreground">Lucro</span>
                </div>
                <p className="text-lg font-bold text-success">{formatCurrency(combinedMargin)}</p>
                <p className="text-xs text-muted-foreground">Margem: {marginPercent.toFixed(1)}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Área / Qtd</span>
                </div>
                <p className="text-lg font-bold">{areaM2.toFixed(4)} m²</p>
                <p className="text-xs text-muted-foreground">{quantity} unidade(s)</p>
              </CardContent>
            </Card>
          </div>

          {/* Template Component Breakdown */}
          {summary.components.length > 0 && ['profile', 'glass', 'accessory', 'service'].map(type => {
            const items = groupedComponents[type];
            if (!items || items.length === 0) return null;

            const typeCost = items.reduce((s, c) => s + c.totalCost, 0);
            const costPercent = combinedTotalCost > 0
              ? (typeCost / combinedTotalCost * 100).toFixed(0)
              : '0';

            return (
              <Card key={type}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>{typeIcons[type]}</span>
                      {typeLabels[type] || type}
                      <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Custo: {formatCurrency(typeCost)} ({costPercent}%)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Componente</TableHead>
                          <TableHead className="text-center">Medida</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-right">Custo/Un</TableHead>
                          <TableHead className="text-right">Custo Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map(c => {
                          const isEditable = c.itemType === 'profile' || c.itemType === 'glass';
                          const hasOverride = costOverrides[c.id] !== undefined;
                          return (
                            <TableRow key={c.id} className={hasOverride ? 'bg-accent/30' : ''}>
                              <TableCell className="font-medium">
                                {c.itemName}
                                {c.notes && <span className="text-xs text-muted-foreground ml-1">({c.notes})</span>}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {c.itemType === 'glass'
                                  ? `${c.calculatedLength.toFixed(4)} m²`
                                  : c.itemType === 'profile'
                                    ? `${c.calculatedLength} mm`
                                    : '-'}
                              </TableCell>
                              <TableCell className="text-center">{c.calculatedQuantity}</TableCell>
                              <TableCell className="text-right text-sm">
                                {isEditable ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="text-xs text-muted-foreground">R$</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={costOverrides[c.id] !== undefined ? costOverrides[c.id] : (c.unitCost || '')}
                                      onChange={e => handleCostChange(c.id, e.target.value)}
                                      className={cn(
                                        "w-24 h-7 text-right text-xs",
                                        hasOverride && "border-primary ring-1 ring-primary/20"
                                      )}
                                    />
                                    {hasOverride && (
                                      <button
                                        onClick={() => resetCostOverride(c.id)}
                                        className="text-xs text-muted-foreground hover:text-destructive"
                                        title="Restaurar valor original"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">{formatCurrency(c.unitCost)}/{c.unit}</span>
                                )}
                                {c.itemType === 'profile' && (
                                  <span className="text-[9px] text-muted-foreground block text-right mt-0.5">
                                    {formatCurrency((costOverrides[c.id] !== undefined ? costOverrides[c.id] : c.unitCost) / 6)}/m
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(c.totalCost)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Manual Items Section */}
          {manualItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Itens Adicionados Manualmente
                    <Badge variant="secondary" className="text-xs">{manualItems.length}</Badge>
                  </span>
                   <span className="text-xs font-normal text-muted-foreground">
                     Custo: {formatCurrency(manualTotalCost)}
                   </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-20">Tipo</TableHead>
                        <TableHead className="w-16">Peças</TableHead>
                        <TableHead className="w-28">Fórmula Larg.</TableHead>
                        <TableHead className="w-28">Fórmula Alt.</TableHead>
                        <TableHead className="w-24 text-right">Custo</TableHead>
                        <TableHead className="text-center">Medida</TableHead>
                        <TableHead className="text-right">Custo Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedManualItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{item.itemName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {shortTypeLabels[item.itemType] || item.itemType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min={1}
                              value={item.piecesQuantity}
                              onChange={e => updateManualItem(item.id, 'piecesQuantity', parseInt(e.target.value) || 1)}
                              className="h-7 w-16 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.widthFormula}
                              onChange={e => updateManualItem(item.id, 'widthFormula', e.target.value)}
                              placeholder="Largura"
                              className="h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.heightFormula}
                              onChange={e => updateManualItem(item.id, 'heightFormula', e.target.value)}
                              placeholder="Altura"
                              className="h-7 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min={0} step={0.01}
                              value={item.unitCost || ''}
                              onChange={e => updateManualItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="h-7 w-24 text-xs text-right"
                            />
                            <span className="text-[9px] text-muted-foreground block text-right">
                              {item.itemType === 'profile' ? '/barra 6m' : item.itemType === 'glass' ? '/m²' : '/un'}
                            </span>
                            {item.itemType === 'profile' && item.unitCost > 0 && (
                              <span className="text-[9px] text-primary block text-right">
                                = {formatCurrency(item.unitCost / 6)}/m
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {item.displayMeasure}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {formatCurrency(item.totalCost)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeManualItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Items Section - always visible when product is selected */}
      {selectedProduct && !loadingComponents && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Adicionar Itens ao Produto
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Adicione perfis, vidros e acessórios livremente para compor ou complementar a precificação
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={addItemFilter} onValueChange={setAddItemFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="profile">Perfis</SelectItem>
                  <SelectItem value="glass">Vidros</SelectItem>
                  <SelectItem value="accessory">Acessórios</SelectItem>
                  <SelectItem value="service">Serviços</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item..."
                  value={addItemSearch}
                  onChange={e => setAddItemSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={addItemId} onValueChange={setAddItemId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um item para adicionar..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredTemplateItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      <span className="flex items-center gap-2">
                        <span>{typeIcons[item.type] || '📦'}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {shortTypeLabels[item.type] || item.type}
                        </Badge>
                        {item.name}
                        {item.default_price ? ` — ${formatCurrency(item.default_price)}/${item.unit}` : ''}
                      </span>
                    </SelectItem>
                  ))}
                  {filteredTemplateItems.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum item encontrado
                    </div>
                  )}
                </SelectContent>
              </Select>

              <Button onClick={addManualItem} disabled={!addItemId}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state - no product selected */}
      {!selectedProduct && (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">
              Selecione um produto acima para calcular sua precificação detalhada.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
