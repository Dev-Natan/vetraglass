import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Package, Plus, Trash2, GripVertical, Layers, Ruler,
  DollarSign, TrendingUp, TrendingDown, Minus, BarChart3, Search, Eye,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProductCategories } from '@/hooks/useProductCategories';
import { evaluateFormula } from '@/utils/safeFormulaEvaluator';
import { cn } from '@/lib/utils';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface CompositionItem {
  id: string;
  templateItemId: string;
  itemName: string;
  itemType: string;
  unit: string;
  quantityFormula: string;
  widthFormula: string;
  heightFormula: string;
  piecesQuantity: number;
  cutAngle: number | null;
  notes: string;
  unitCost: number;
  unitPrice: number;
}

const typeLabels: Record<string, string> = {
  profile: 'Perfil',
  glass: 'Vidro',
  accessory: 'Acessório',
  service: 'Serviço',
  component: 'Componente',
};

const typeIcons: Record<string, string> = {
  profile: '🔩',
  glass: '🪟',
  accessory: '⚙️',
  service: '🔧',
  component: '🧩',
};

const categoryLabels: Record<string, string> = {
  window: 'Janela', door: 'Porta', facade: 'Fachada',
  shower: 'Box', mirror: 'Espelho', partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo', other: 'Outros',
};

export function PrecificacaoCreateProduct() {
  const { data: productCategories } = useProductCategories();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('window');
  const [linha, setLinha] = useState('');
  const [searchItem, setSearchItem] = useState('');

  // Dimensions for real-time calculation
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(1200);
  const [quantity, setQuantity] = useState(1);
  const [marginPercent, setMarginPercent] = useState(30);

  // Composition
  const [compositionItems, setCompositionItems] = useState<CompositionItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Fetch item_templates (global, no auth needed)
  const { data: itemTemplates = [] } = useQuery({
    queryKey: ['item-templates-for-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('id, name, type, unit, default_price, linha, image_url, description')
        .eq('is_active', true)
        .order('type')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch linhas from templates
  const { data: existingLinhas = [] } = useQuery({
    queryKey: ['template-linhas-for-create'],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_templates')
        .select('linha')
        .eq('is_active', true)
        .not('linha', 'is', null);
      const set = new Set<string>();
      data?.forEach(p => p.linha && set.add(p.linha));
      return Array.from(set).sort();
    },
  });

  const filteredItems = useMemo(() => {
    return itemTemplates.filter(item => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (searchItem) {
        const q = searchItem.toLowerCase();
        if (!item.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [itemTemplates, filterType, searchItem]);

  const addCompositionItem = () => {
    const item = itemTemplates.find(i => i.id === selectedItemId);
    if (!item) return;

    const newItem: CompositionItem = {
      id: crypto.randomUUID(),
      templateItemId: item.id,
      itemName: item.name,
      itemType: item.type,
      unit: item.unit,
      quantityFormula: '1',
      widthFormula: item.type === 'profile' || item.type === 'glass' ? 'Largura' : '',
      heightFormula: item.type === 'glass' ? 'Altura' : '',
      piecesQuantity: 1,
      cutAngle: null,
      notes: '',
      unitCost: item.default_price || 0,
      unitPrice: 0, // calculated from margin
    };

    setCompositionItems(prev => [...prev, newItem]);
    setSelectedItemId('');
  };

  const updateCompositionItem = (id: string, field: keyof CompositionItem, value: any) => {
    setCompositionItems(prev =>
      prev.map(item => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const removeCompositionItem = (id: string) => {
    setCompositionItems(prev => prev.filter(item => item.id !== id));
  };

  // Real-time pricing calculation based on dimensions
  const calculatedComponents = useMemo(() => {
    return compositionItems.map(comp => {
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
          totalPrice: comp.unitPrice * glassAreaM2 * calculatedQuantity,
        };
      } else if (comp.itemType === 'profile') {
        const length = comp.heightFormula
          ? evaluateFormula(comp.heightFormula, width, height)
          : comp.widthFormula
            ? evaluateFormula(comp.widthFormula, width, height)
            : evaluateFormula(comp.quantityFormula, width, height);
        const lengthM = length / 1000;
        // Profile prices are per 6m bar — convert to price per meter
        const costPerMeter = comp.unitCost / 6;
        const pricePerMeter = comp.unitPrice / 6;
        return {
          ...comp,
          calculatedQuantity,
          calculatedLength: length,
          displayMeasure: `${length} mm (${lengthM.toFixed(3)} m)`,
          totalCost: costPerMeter * lengthM * calculatedQuantity,
          totalPrice: pricePerMeter * lengthM * calculatedQuantity,
        };
      } else {
        return {
          ...comp,
          calculatedQuantity,
          calculatedLength: 0,
          displayMeasure: '-',
          totalCost: comp.unitCost * calculatedQuantity,
          totalPrice: comp.unitPrice * calculatedQuantity,
        };
      }
    });
  }, [compositionItems, width, height, quantity]);

  const areaM2 = (width * height) / 1_000_000;
  const totalCost = calculatedComponents.reduce((s, c) => s + c.totalCost, 0);
  const totalPrice = totalCost * (1 + marginPercent / 100);
  const margin = totalPrice - totalCost;
  const costPerSqm = areaM2 > 0 ? totalCost / (areaM2 * quantity) : 0;
  const pricePerSqm = areaM2 > 0 ? totalPrice / (areaM2 * quantity) : 0;

  const groupedComponents = useMemo(() => {
    const groups: Record<string, typeof calculatedComponents> = {};
    calculatedComponents.forEach(c => {
      if (!groups[c.itemType]) groups[c.itemType] = [];
      groups[c.itemType].push(c);
    });
    return groups;
  }, [calculatedComponents]);

  const allCategories = productCategories?.map(c => ({ value: c.slug, label: c.name })) || [];

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Simulador Interativo de Precificação</p>
              <p className="text-xs text-muted-foreground mt-1">
                Monte a composição do seu produto adicionando perfis, vidros e acessórios. 
                Configure as dimensões e veja o preço calculado em tempo real. 
                Edite custos e preços unitários para simular diferentes cenários.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Info + Dimensions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Configuração do Produto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Produto</Label>
                  <Input
                    placeholder="Ex: Janela de Correr 2 Folhas"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {allCategories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Linha</Label>
                  <Select value={linha || '__none__'} onValueChange={v => setLinha(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                      {existingLinhas.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dimensions - always visible */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t">
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
            </CardContent>
          </Card>

          {/* Composition Section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Composição do Produto
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Adicione itens do catálogo para montar a composição e simular o preço
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add item controls */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-full sm:w-[140px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="profile">Perfis</SelectItem>
                      <SelectItem value="glass">Vidros</SelectItem>
                      <SelectItem value="accessory">Acessórios</SelectItem>
                      <SelectItem value="component">Componentes</SelectItem>
                      <SelectItem value="service">Serviços</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar item..."
                      value={searchItem}
                      onChange={e => setSearchItem(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione um item para adicionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredItems.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="flex items-center gap-2">
                            <span>{typeIcons[item.type] || '📦'}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {typeLabels[item.type] || item.type}
                            </Badge>
                            {item.name}
                            {item.default_price ? ` — ${formatCurrency(item.default_price)}/${item.unit}` : ''}
                          </span>
                        </SelectItem>
                      ))}
                      {filteredItems.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Nenhum item encontrado
                        </div>
                      )}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={addCompositionItem}
                    disabled={!selectedItemId}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* Composition Table */}
              {compositionItems.length > 0 ? (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="w-20">Tipo</TableHead>
                        <TableHead className="w-16">Peças</TableHead>
                        <TableHead className="w-28">Fórmula Larg.</TableHead>
                        <TableHead className="w-28">Fórmula Alt.</TableHead>
                        <TableHead className="w-24 text-right">Custo/Un</TableHead>
                        <TableHead className="text-center">Medida</TableHead>
                        <TableHead className="text-right">Custo Total</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculatedComponents.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            <GripVertical className="h-3.5 w-3.5" />
                          </TableCell>
                          <TableCell className="font-medium text-sm">{item.itemName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
                              {typeLabels[item.itemType] || item.itemType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min={1}
                              value={item.piecesQuantity}
                              onChange={e => updateCompositionItem(item.id, 'piecesQuantity', parseInt(e.target.value) || 1)}
                              className="h-8 w-16 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.widthFormula}
                              onChange={e => updateCompositionItem(item.id, 'widthFormula', e.target.value)}
                              placeholder="Largura"
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={item.heightFormula}
                              onChange={e => updateCompositionItem(item.id, 'heightFormula', e.target.value)}
                              placeholder="Altura"
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number" min={0} step={0.01}
                              value={item.unitCost || ''}
                              onChange={e => updateCompositionItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="h-8 w-24 text-xs text-right"
                              placeholder="0,00"
                            />
                            <span className="text-[9px] text-muted-foreground block text-right mt-0.5">
                              {item.itemType === 'profile' ? '/barra 6m' : item.itemType === 'glass' ? '/m²' : '/un'}
                            </span>
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
                              onClick={() => removeCompositionItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum item adicionado à composição</p>
                  <p className="text-xs mt-1">Selecione perfis, vidros e acessórios acima para montar seu produto e ver o preço calculado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Live Preview */}
        <div className="space-y-4">
          {/* KPI Cards */}
          {compositionItems.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Custo Total</span>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(totalCost)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(costPerSqm)}/m²</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Preço de Venda</span>
                  </div>
                  <p className="text-lg font-bold text-primary">{formatCurrency(totalPrice)}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(pricePerSqm)}/m²</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="text-xs text-muted-foreground">Lucro</span>
                  </div>
                  <p className="text-lg font-bold text-success">{formatCurrency(margin)}</p>
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
                  <p className="text-xs text-muted-foreground">{quantity} un</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Product Preview Card */}
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                Pré-visualização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm">{name || 'Nome do produto'}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {categoryLabels[category] || category}
                    </Badge>
                    {linha && <Badge variant="outline" className="text-[10px]">{linha}</Badge>}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground border-t pt-2">
                  <span>{width} × {height} mm</span>
                  <span className="mx-2">•</span>
                  <span>{areaM2.toFixed(4)} m²</span>
                  <span className="mx-2">•</span>
                  <span>{quantity} un</span>
                </div>

                {compositionItems.length > 0 && (
                  <div className="border-t pt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Composição ({compositionItems.length} itens)
                    </p>
                    {Object.entries(groupedComponents).map(([type, items]) => (
                      <div key={type} className="mt-1">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          {typeIcons[type]} {typeLabels[type] || type}
                        </p>
                        {items.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs pl-3">
                            <span className="truncate flex-1">{item.itemName}</span>
                            <span className="font-medium ml-2">{formatCurrency(item.totalCost)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  {totalCost > 0 && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Custo Total:</span>
                        <span>{formatCurrency(totalCost)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Margem:</span>
                        <span className="font-medium">{marginPercent.toFixed(1)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm border-t pt-2">
                        <span className="text-muted-foreground font-medium">Preço de Venda:</span>
                        <span className="font-bold text-primary">{formatCurrency(totalPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Lucro:</span>
                        <span className="text-success font-medium">{formatCurrency(margin)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Altere dimensões, quantidades e preços para simular diferentes cenários em tempo real.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
