import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sparkles, Package, Plus, Save, ImageIcon, DollarSign, Tag, Truck, Trash2, GripVertical, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useProductCategories } from '@/hooks/useProductCategories';
import { ImageUploadField } from '@/components/common/ImageUploadField';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface CompositionItem {
  id: string;
  companyItemId: string;
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

export function PrecificacaoCreateProduct() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const { data: productCategories } = useProductCategories();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [linha, setLinha] = useState('');
  const [customLinha, setCustomLinha] = useState('');
  const [showCustomLinha, setShowCustomLinha] = useState(false);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [supplier, setSupplier] = useState('');
  const [tempProductId] = useState(() => crypto.randomUUID());

  // Composition
  const [compositionItems, setCompositionItems] = useState<CompositionItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Fetch company items for composition
  const { data: companyItems = [] } = useQuery({
    queryKey: ['company-items-for-composition', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('company_items')
        .select('id, name, type, unit, cost, sale_price, linha, image_url')
        .eq('company_id', currentCompany.id)
        .eq('is_active', true)
        .order('type')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch existing linhas
  const { data: existingLinhas = [] } = useQuery({
    queryKey: ['existing-linhas', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data: companyLinhas } = await supabase
        .from('company_products')
        .select('linha')
        .eq('company_id', currentCompany.id)
        .not('linha', 'is', null);
      const { data: templateLinhas } = await supabase
        .from('product_templates')
        .select('linha')
        .eq('is_active', true)
        .not('linha', 'is', null);
      const allLinhas = new Set<string>();
      companyLinhas?.forEach(p => p.linha && allLinhas.add(p.linha));
      templateLinhas?.forEach(p => p.linha && allLinhas.add(p.linha));
      return Array.from(allLinhas).sort();
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch existing categories
  const { data: existingCategories = [] } = useQuery({
    queryKey: ['existing-categories', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data } = await supabase
        .from('company_products')
        .select('category')
        .eq('company_id', currentCompany.id)
        .not('category', 'is', null);
      const customCats = new Set<string>();
      const defaultCatSlugs = new Set(productCategories?.map(c => c.slug) || []);
      data?.forEach(p => {
        if (p.category && !defaultCatSlugs.has(p.category)) {
          customCats.add(p.category);
        }
      });
      return Array.from(customCats).sort();
    },
    enabled: !!currentCompany?.id,
  });

  const allCategories = [
    ...(productCategories?.map(c => ({ value: c.slug, label: c.name })) || []),
    ...existingCategories.map(c => ({ value: c, label: c })),
  ];

  const filteredItems = companyItems.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const typeLabels: Record<string, string> = {
    profile: 'Perfil',
    glass: 'Vidro',
    accessory: 'Acessório',
    service: 'Serviço',
    component: 'Componente',
  };

  const addCompositionItem = () => {
    const item = companyItems.find(i => i.id === selectedItemId);
    if (!item) return;

    const newItem: CompositionItem = {
      id: crypto.randomUUID(),
      companyItemId: item.id,
      itemName: item.name,
      itemType: item.type,
      unit: item.unit,
      quantityFormula: '1',
      widthFormula: item.type === 'profile' || item.type === 'glass' ? 'Largura' : '',
      heightFormula: item.type === 'glass' ? 'Altura' : '',
      piecesQuantity: 1,
      cutAngle: null,
      notes: '',
      unitCost: item.cost || 0,
      unitPrice: item.sale_price || 0,
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

  const totalCost = compositionItems.reduce((sum, item) => sum + (item.unitCost * item.piecesQuantity), 0);
  const totalPrice = compositionItems.reduce((sum, item) => sum + (item.unitPrice * item.piecesQuantity), 0);
  const margin = totalCost > 0 ? ((totalPrice - totalCost) / totalCost * 100) : 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      const finalCategory = showCustomCategory ? customCategory.trim() : category;
      const finalLinha = showCustomLinha ? customLinha.trim() : (linha || 'Personalizado');

      // Create the product
      const { data: productId, error } = await supabase.rpc('create_custom_product', {
        _company_id: currentCompany.id,
        _name: name.trim(),
        _category: finalCategory,
        _base_price: totalPrice > 0 ? totalPrice : 0,
        _linha: finalLinha,
        _description: description.trim() || null,
        _image_url: imageUrl,
      });

      if (error) throw error;
      if (!productId) throw new Error('Falha ao criar produto');

      // Update cost
      if (totalCost > 0) {
        await supabase
          .from('company_products')
          .update({ cost_per_sqm: totalCost, price_per_sqm: totalPrice })
          .eq('id', productId);
      }

      // Add composition items
      if (compositionItems.length > 0) {
        const itemsToInsert = compositionItems.map((item, index) => ({
          company_product_id: productId,
          company_item_id: item.companyItemId,
          quantity_formula: item.quantityFormula,
          width_formula: item.widthFormula || null,
          height_formula: item.heightFormula || null,
          pieces_quantity: item.piecesQuantity,
          cut_angle: item.cutAngle,
          notes: item.notes || null,
          sort_order: index + 1,
        }));

        const { error: itemsError } = await supabase
          .from('company_product_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return productId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-products'] });
      toast.success('Produto criado e adicionado à sua grade!');
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar produto: ' + error.message);
    },
  });

  const resetForm = () => {
    setName('');
    setCategory('other');
    setCustomCategory('');
    setShowCustomCategory(false);
    setLinha('');
    setCustomLinha('');
    setShowCustomLinha(false);
    setDescription('');
    setImageUrl(null);
    setSupplier('');
    setCompositionItems([]);
    setSelectedItemId('');
    setFilterType('all');
  };

  const finalCategory = showCustomCategory ? customCategory.trim() : category;
  const finalLinha = showCustomLinha ? customLinha.trim() : (linha || 'Personalizado');
  const canCreate = name.trim().length > 0 && finalCategory.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Informações do Produto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploadField
                label="Imagem do Produto"
                imageUrl={imageUrl}
                onImageChange={setImageUrl}
                bucket="company-product-images"
                path={`${currentCompany?.id}/${tempProductId}`}
                size="md"
              />

              <div className="space-y-2">
                <Label htmlFor="product-name">Nome do Produto *</Label>
                <Input
                  id="product-name"
                  placeholder="Ex: Janela de Correr 2 Folhas"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Categoria
                  </Label>
                  {showCustomCategory ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome da categoria"
                        value={customCategory}
                        onChange={e => setCustomCategory(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => { setShowCustomCategory(false); setCustomCategory(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Select value={category} onValueChange={val => {
                      if (val === '__new__') setShowCustomCategory(true);
                      else setCategory(val);
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allCategories.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                        <SelectItem value="__new__" className="text-primary">
                          <span className="flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Nova categoria
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" /> Linha
                  </Label>
                  {showCustomLinha ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nome da linha"
                        value={customLinha}
                        onChange={e => setCustomLinha(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="button" variant="ghost" size="sm"
                        onClick={() => { setShowCustomLinha(false); setCustomLinha(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Select value={linha} onValueChange={val => {
                      if (val === '__new__') setShowCustomLinha(true);
                      else setLinha(val);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecione ou crie..." /></SelectTrigger>
                      <SelectContent>
                        {existingLinhas.map(l => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                        <SelectItem value="__new__" className="text-primary">
                          <span className="flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Nova linha
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Fornecedor (opcional)
                </Label>
                <Input
                  placeholder="Nome do fornecedor"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-desc">Descrição (opcional)</Label>
                <Textarea
                  id="product-desc"
                  placeholder="Descreva as características do produto..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                />
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
                Adicione vidros, perfis e acessórios que compõem este produto
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add item controls */}
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

                <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um item para adicionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] px-1 py-0">
                            {typeLabels[item.type] || item.type}
                          </Badge>
                          {item.name}
                          {item.cost ? ` — ${formatCurrency(item.cost)}/${item.unit}` : ''}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  onClick={addCompositionItem}
                  disabled={!selectedItemId}
                  size="default"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
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
                        <TableHead className="w-16">Qtd</TableHead>
                        <TableHead className="w-28">Fórmula Larg.</TableHead>
                        <TableHead className="w-28">Fórmula Alt.</TableHead>
                        <TableHead className="w-24 text-right">Custo Un.</TableHead>
                        <TableHead className="w-24 text-right">Preço Un.</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compositionItems.map((item, idx) => (
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
                              type="number"
                              min={1}
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
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unitCost || ''}
                              onChange={e => updateCompositionItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                              className="h-8 w-24 text-xs text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={item.unitPrice || ''}
                              onChange={e => updateCompositionItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="h-8 w-24 text-xs text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
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
                  <p className="text-xs mt-1">Selecione vidros, perfis e acessórios acima para montar seu produto</p>
                </div>
              )}

              {/* Composition Summary */}
              {compositionItems.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Itens na composição:</span>
                    <span className="font-medium">{compositionItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Custo total estimado:</span>
                    <span className="font-medium">{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Preço total estimado:</span>
                    <span className="font-bold text-primary">{formatCurrency(totalPrice)}</span>
                  </div>
                  {totalCost > 0 && totalPrice > 0 && (
                    <div className="flex items-center justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Margem:</span>
                      <span className={`font-bold ${margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-primary' : margin >= 0 ? 'text-yellow-600' : 'text-destructive'}`}>
                        {margin.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Preview & Save */}
        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pré-visualização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  )}
                </div>

                <div>
                  <p className="font-semibold text-sm">{name || 'Nome do produto'}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {showCustomCategory
                        ? (customCategory || 'Categoria')
                        : (allCategories.find(c => c.value === category)?.label || category)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{finalLinha}</Badge>
                  </div>
                </div>

                {compositionItems.length > 0 && (
                  <div className="border-t pt-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Composição ({compositionItems.length} itens)</p>
                    {compositionItems.slice(0, 5).map(item => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="truncate flex-1">{item.itemName}</span>
                        <span className="text-muted-foreground ml-2">x{item.piecesQuantity}</span>
                      </div>
                    ))}
                    {compositionItems.length > 5 && (
                      <p className="text-[10px] text-muted-foreground">+{compositionItems.length - 5} itens...</p>
                    )}
                  </div>
                )}

                <div className="border-t pt-3 space-y-2">
                  {totalCost > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Custo:</span>
                      <span>{formatCurrency(totalCost)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Preço:</span>
                    <span className="font-bold text-primary">
                      {totalPrice > 0 ? formatCurrency(totalPrice) : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Add to product grid button */}
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canCreate || createMutation.isPending}
                className="w-full"
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? 'Adicionando...' : 'Adicionar à Grade de Produtos'}
              </Button>

              {!canCreate && (
                <p className="text-xs text-muted-foreground text-center">
                  Preencha pelo menos o nome e a categoria para criar o produto.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
