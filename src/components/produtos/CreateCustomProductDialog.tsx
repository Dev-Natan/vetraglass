import { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Sparkles, Package, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useProductCategories } from '@/hooks/useProductCategories';
import { useProductLinhas, useProductLinhaLabels } from '@/hooks/useProductLinhas';
import { ImageUploadField } from '@/components/common/ImageUploadField';

interface CreateCustomProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLinha?: string;
}

export function CreateCustomProductDialog({ open, onOpenChange, defaultLinha }: CreateCustomProductDialogProps) {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  
  // Use dynamic categories and linhas from database
  const { data: productCategories } = useProductCategories();
  const { data: productLinhas } = useProductLinhas();
  
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [linha, setLinha] = useState('');
  const [customLinha, setCustomLinha] = useState('');
  const [showCustomLinha, setShowCustomLinha] = useState(false);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [tempProductId] = useState(() => crypto.randomUUID());

  // No longer fetching existing linhas as we want to use the pre-defined ones
  const { labels: productLinhaLabels } = useProductLinhaLabels();

  // Fetch existing categories from company products
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
    enabled: !!currentCompany?.id && open,
  });

  // Combined categories (from database + custom)
  const allCategories = [
    ...(productCategories?.map(c => ({ value: c.slug, label: c.name })) || []),
    ...existingCategories.map(c => ({ value: c, label: c })),
  ];

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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-products'] });
      queryClient.invalidateQueries({ queryKey: ['custom-products'] });
      toast.success('Produto personalizado criado com sucesso!');
      resetForm();
      onOpenChange(false);
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
    setLinha(defaultLinha || '');
    setCustomLinha('');
    setShowCustomLinha(false);
    setBasePrice(0);
    setDescription('');
    setImageUrl(null);
  };

  // Set default linha when dialog opens
  useEffect(() => {
    if (open && defaultLinha) {
      setLinha(defaultLinha);
    }
  }, [open, defaultLinha]);

  const finalCategory = showCustomCategory ? customCategory.trim() : category;
  const finalLinha = showCustomLinha ? customLinha.trim() : (linha || 'Personalizado');
  const canCreate = name.trim().length > 0 && finalCategory.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Criar Produto Personalizado
          </DialogTitle>
          <DialogDescription>
            Crie um produto exclusivo para sua empresa que não está na biblioteca de templates.
          </DialogDescription>
        </DialogHeader>

        {/* Warning Alert */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-700">Atenção</p>
            <p className="text-amber-600/80 text-xs mt-1">
              Produtos personalizados não utilizam fórmulas automáticas de cálculo de materiais. 
              Você precisará gerenciar a composição manualmente.
            </p>
          </div>
        </div>

        <div className="space-y-4 py-2">
          {/* Image Upload */}
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
            <Label htmlFor="name">Nome do Produto *</Label>
            <Input
              id="name"
              placeholder="Ex: Porta de Correr Especial"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category & Linha Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              {showCustomCategory ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da categoria"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setShowCustomCategory(false);
                      setCustomCategory('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select value={category} onValueChange={(val) => {
                  if (val === '__new__') {
                    setShowCustomCategory(true);
                  } else {
                    setCategory(val);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-primary">
                      <span className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Nova categoria
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Linha</Label>
              {showCustomLinha ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da linha"
                    value={customLinha}
                    onChange={(e) => setCustomLinha(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setShowCustomLinha(false);
                      setCustomLinha('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Select value={linha} onValueChange={(val) => {
                  if (val === '__new__') {
                    setShowCustomLinha(true);
                  } else {
                    setLinha(val);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a linha..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productLinhas?.map((l) => (
                      <SelectItem key={l.id} value={l.name}>
                        {l.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__" className="text-primary">
                      <span className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Nova linha
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Base Price */}
          <div className="space-y-2">
            <Label htmlFor="basePrice">Preço Base (R$/m²)</Label>
            <Input
              id="basePrice"
              type="number"
              min="0"
              step="0.01"
              placeholder="0,00"
              value={basePrice || ''}
              onChange={(e) => setBasePrice(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Este é o preço por metro quadrado que será usado nos orçamentos.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Descreva as características do produto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Preview Card */}
        {name && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <Package className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {showCustomCategory ? customCategory || 'Categoria' : (allCategories.find(c => c.value === category)?.label || category)}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {finalLinha || 'Personalizado'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Personalizado
                </Badge>
              </div>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              R$ {basePrice.toFixed(2)}/m²
            </span>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={() => createMutation.mutate()} 
            disabled={!canCreate || createMutation.isPending}
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Produto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
