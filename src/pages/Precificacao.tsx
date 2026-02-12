import { useState, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
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
  Calculator, Package, FileDown, TrendingUp, TrendingDown, Minus,
  Layers, Search, DollarSign, Ruler, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  usePricingProducts,
  usePricingComponents,
  useCalculatePricing,
} from '@/hooks/usePricingCalculator';
import { generatePricingReportPdf } from '@/utils/generatePricingReportPdf';
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

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export default function Precificacao() {
  const { currentCompany } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1200);
  const [quantity, setQuantity] = useState(1);
  const [selectedLinha, setSelectedLinha] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({});

  const { data: products, isLoading: loadingProducts } = usePricingProducts();
  const { data: components, isLoading: loadingComponents } = usePricingComponents(selectedProduct || null);
  const summary = useCalculatePricing(components, width, height, quantity, costOverrides);

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

  // Available linhas
  const linhas = useMemo(() => {
    if (!products) return [];
    const set = new Set<string>();
    products.forEach(p => { if (p.linha) set.add(p.linha); });
    return Array.from(set).sort();
  }, [products]);

  // Available categories
  const categories = useMemo(() => {
    if (!products) return [];
    const set = new Set<string>();
    products
      .filter(p => !selectedLinha || p.linha === selectedLinha)
      .forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products, selectedLinha]);

  // Filtered products
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

  // Group components by type
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
      summary,
      companyName: currentCompany?.name || '',
      generatedAt: new Date().toLocaleString('pt-BR'),
    });
    toast.success('Relatório PDF gerado!');
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Precificação
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Calcule preços detalhados por componente dos seus produtos
            </p>
          </div>
          {selectedProduct && summary.components.length > 0 && (
            <Button onClick={handleExportPdf} variant="outline">
              <FileDown className="h-4 w-4 mr-2" />
              Exportar Relatório
            </Button>
          )}
        </div>

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
              {/* Linha filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Linha</Label>
                <Select value={selectedLinha || '__all__'} onValueChange={v => {
                  setSelectedLinha(v === '__all__' ? '' : v);
                  setSelectedCategory('');
                  setSelectedProduct('');
                  setCostOverrides({});
                }}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as linhas</SelectItem>
                    {linhas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Category filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Select value={selectedCategory || '__all__'} onValueChange={v => {
                  setSelectedCategory(v === '__all__' ? '' : v);
                  setSelectedProduct('');
                }}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as categorias</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
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

            {/* Product selector */}
            <div className="space-y-1.5">
              <Label className="text-xs">Produto</Label>
              {loadingProducts ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
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

            {/* Dimensions */}
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
        {selectedProduct && !loadingComponents && summary.components.length > 0 && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Custo Total</span>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(summary.totalComponentCost)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(summary.costPerSqm)}/m²</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Preço Total</span>
                  </div>
                  <p className="text-lg font-bold text-primary">{formatCurrency(summary.totalComponentPrice)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(summary.pricePerSqm)}/m²</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    {summary.marginPercent >= 15 ? (
                      <TrendingUp className="h-4 w-4 text-success" />
                    ) : summary.marginPercent >= 0 ? (
                      <Minus className="h-4 w-4 text-warning" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-xs text-muted-foreground">Margem</span>
                  </div>
                  <p className={cn(
                    "text-lg font-bold",
                    summary.marginPercent >= 30 && "text-success",
                    summary.marginPercent >= 15 && summary.marginPercent < 30 && "text-primary",
                    summary.marginPercent >= 0 && summary.marginPercent < 15 && "text-warning",
                    summary.marginPercent < 0 && "text-destructive",
                  )}>
                    {summary.marginPercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(summary.margin)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Área / Qtd</span>
                  </div>
                  <p className="text-lg font-bold">{summary.areaM2.toFixed(4)} m²</p>
                  <p className="text-xs text-muted-foreground">{quantity} unidade(s)</p>
                </CardContent>
              </Card>
            </div>

            {/* Component Breakdown by Type */}
            {['profile', 'glass', 'accessory', 'service'].map(type => {
              const items = groupedComponents[type];
              if (!items || items.length === 0) return null;

              const typeCost = items.reduce((s, c) => s + c.totalCost, 0);
              const typePrice = items.reduce((s, c) => s + c.totalPrice, 0);
              const costPercent = summary.totalComponentCost > 0
                ? (typeCost / summary.totalComponentCost * 100).toFixed(0)
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
                      <span className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
                        <span>Custo: {formatCurrency(typeCost)} ({costPercent}%)</span>
                        <span className="text-primary font-medium">Preço: {formatCurrency(typePrice)}</span>
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
                            <TableHead className="text-right">Preço/Un</TableHead>
                            <TableHead className="text-right">Custo Total</TableHead>
                            <TableHead className="text-right">Preço Total</TableHead>
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
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(c.unitPrice)}/{c.unit}
                              </TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground">
                                {formatCurrency(c.totalCost)}
                              </TableCell>
                              <TableCell className="text-right font-medium text-primary">
                                {formatCurrency(c.totalPrice)}
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
          </>
        )}

        {/* Empty state */}
        {selectedProduct && !loadingComponents && summary.components.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                Este produto não possui componentes cadastrados.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione componentes na página de edição do produto para calcular preços.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Initial state */}
        {!selectedProduct && (
          <Card>
            <CardContent className="py-12 text-center">
              <Calculator className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground">
                Selecione um produto acima para calcular sua precificação detalhada.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
