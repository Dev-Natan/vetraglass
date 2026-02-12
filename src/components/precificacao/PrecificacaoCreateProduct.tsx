import { useState, useEffect } from 'react';
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
import { Sparkles, Package, Plus, Save, ImageIcon, DollarSign, Tag, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useProductCategories } from '@/hooks/useProductCategories';
import { ImageUploadField } from '@/components/common/ImageUploadField';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

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
  const [basePrice, setBasePrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [supplier, setSupplier] = useState('');
  const [tempProductId] = useState(() => crypto.randomUUID());

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

  const margin = basePrice > 0 && costPrice > 0 
    ? ((basePrice - costPrice) / costPrice * 100) 
    : 0;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      const finalCategory = showCustomCategory ? customCategory.trim() : category;
      const finalLinha = showCustomLinha ? customLinha.trim() : (linha || 'Personalizado');

      const { data, error } = await supabase.rpc('create_custom_product', {
        _company_id: currentCompany.id,
        _name: name.trim(),
        _category: finalCategory,
        _base_price: basePrice,
        _linha: finalLinha,
        _description: description.trim() || null,
        _image_url: imageUrl,
      });

      if (error) throw error;

      // Update cost_per_sqm if cost was provided
      if (costPrice > 0 && data) {
        await supabase
          .from('company_products')
          .update({ cost_per_sqm: costPrice })
          .eq('id', data);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      queryClient.invalidateQueries({ queryKey: ['pricing-products'] });
      queryClient.invalidateQueries({ queryKey: ['precificacao-linhas-products'] });
      toast.success('Produto criado com sucesso!');
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
    setBasePrice(0);
    setCostPrice(0);
    setDescription('');
    setImageUrl(null);
    setSupplier('');
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
              {/* Image */}
              <ImageUploadField
                label="Imagem do Produto"
                imageUrl={imageUrl}
                onImageChange={setImageUrl}
                bucket="company-product-images"
                path={`${currentCompany?.id}/${tempProductId}`}
                size="md"
              />

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="product-name">Nome do Produto *</Label>
                <Input
                  id="product-name"
                  placeholder="Ex: Janela de Correr 2 Folhas"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              {/* Category & Linha */}
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowCustomCategory(false); setCustomCategory(''); }}
                      >
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowCustomLinha(false); setCustomLinha(''); }}
                      >
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

              {/* Supplier */}
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

              {/* Description */}
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

          {/* Pricing */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Precificação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost-price" className="text-sm font-medium">
                    Custo (R$/m²)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      id="cost-price"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0,00"
                      value={costPrice || ''}
                      onChange={e => setCostPrice(parseFloat(e.target.value) || 0)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Valor de custo por metro quadrado (perfis + vidro + acessórios)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sale-price" className="text-sm font-medium">
                    Preço de Venda (R$/m²)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      id="sale-price"
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0,00"
                      value={basePrice || ''}
                      onChange={e => setBasePrice(parseFloat(e.target.value) || 0)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Preço de venda por metro quadrado para o cliente
                  </p>
                </div>
              </div>

              {/* Margin indicator */}
              {costPrice > 0 && basePrice > 0 && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Margem de lucro:</span>
                    <span className={`text-sm font-bold ${margin >= 30 ? 'text-success' : margin >= 15 ? 'text-primary' : margin >= 0 ? 'text-warning' : 'text-destructive'}`}>
                      {margin.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">Lucro por m²:</span>
                    <span className="text-xs font-medium">
                      {formatCurrency(basePrice - costPrice)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Preview */}
        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pré-visualização</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product Preview */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="w-full aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  )}
                </div>

                <div>
                  <p className="font-semibold text-sm">
                    {name || 'Nome do produto'}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {showCustomCategory 
                        ? (customCategory || 'Categoria')
                        : (allCategories.find(c => c.value === category)?.label || category)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {finalLinha}
                    </Badge>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-2">
                  {costPrice > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Custo:</span>
                      <span>{formatCurrency(costPrice)}/m²</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Preço:</span>
                    <span className="font-bold text-primary">
                      {basePrice > 0 ? `${formatCurrency(basePrice)}/m²` : '-'}
                    </span>
                  </div>
                  {supplier && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fornecedor:</span>
                      <span className="text-xs">{supplier}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Create button */}
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!canCreate || createMutation.isPending}
                className="w-full"
                size="lg"
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending ? 'Criando...' : 'Criar Produto'}
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
