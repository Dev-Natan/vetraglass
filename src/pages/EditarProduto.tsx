import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Upload, MoreHorizontal, Plus, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ProductTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  linha: string | null;
  image_url: string | null;
  is_active: boolean;
  min_width: number | null;
  max_width: number | null;
  min_height: number | null;
  max_height: number | null;
  base_price: number | null;
};

type ProductTemplateItem = {
  id: string;
  product_template_id: string;
  item_template_id: string;
  quantity_formula: string;
  pieces_quantity: number;
  is_optional: boolean;
  notes: string | null;
  cut_angle: number;
  item_template: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    linha: string | null;
  };
};

// Helper para detectar se a fórmula usa Altura ou Largura
const getFormulaType = (formula: string): 'Altura' | 'Largura' | null => {
  const lower = formula.toLowerCase();
  if (lower.includes('altura')) return 'Altura';
  if (lower.includes('largura')) return 'Largura';
  return null;
};

type ItemTemplate = {
  id: string;
  name: string;
  type: string;
  unit: string;
  image_url: string | null;
  linha: string | null;
};

// Map from database types to display types
const itemTypeMapping: Record<string, string> = {
  glass: 'glass',
  profile: 'profile',
  rubber: 'accessory',  // rubber items are stored as 'accessory' in DB
  accessory: 'accessory',
};

const itemTypeTabs = [
  { value: 'glass', label: 'VIDROS', dbType: 'glass' },
  { value: 'profile', label: 'PERFIS DE ALUMÍNIO', dbType: 'profile' },
  { value: 'rubber', label: 'BORRACHAS E OUTROS', dbType: 'accessory' },
  { value: 'accessory', label: 'ACESSÓRIOS E FERRAGENS', dbType: 'accessory' },
];

export default function EditarProduto() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('glass');
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState('');
  const [quantityFormula, setQuantityFormula] = useState('1');
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: 'm2',
    is_ready_product: false,
    has_glass: true,
    gap_type: 'normal',
    base_price: '',
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    // Validar tipo de arquivo
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Apenas arquivos PNG, JPEG ou JPG são permitidos');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}.${fileExt}`;

      // Upload para o bucket product-templates
      const { error: uploadError } = await supabase.storage
        .from('product-templates')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Atualizar o registro com a nova URL
      const { error: updateError } = await supabase
        .from('product_templates')
        .update({ image_url: fileName })
        .eq('id', id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['product-template', id] });
      toast.success('Imagem atualizada!');
    } catch (error: any) {
      toast.error('Erro ao enviar imagem: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Fetch product template
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['product-template', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as ProductTemplate | null;
    },
    enabled: !!id,
  });

  // Fetch product items
  const { data: productItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['product-template-items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_template_items')
        .select(`
          *,
          item_template:item_templates(id, name, type, unit, image_url, linha)
        `)
        .eq('product_template_id', id);
      if (error) throw error;
      return data as ProductTemplateItem[];
    },
    enabled: !!id,
  });

  // Fetch available item templates for adding
  const { data: availableItems } = useQuery({
    queryKey: ['item-templates-by-type', activeTab],
    queryFn: async () => {
      const currentTab = itemTypeTabs.find(t => t.value === activeTab);
      const dbType = currentTab?.dbType || 'accessory';
      
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('type', dbType as "accessory" | "glass" | "profile" | "service")
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as ItemTemplate[];
    },
  });

  // Update form when product loads
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        unit: 'm2',
        is_ready_product: false,
        has_glass: true,
        gap_type: 'normal',
        base_price: product.base_price?.toString() || '',
      });
    }
  }, [product]);

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('product_templates')
        .update({
          name: formData.name,
          description: formData.description,
          base_price: formData.base_price ? parseFloat(formData.base_price) : 0,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template', id] });
      toast.success('Produto salvo!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('product_template_items')
        .insert({
          product_template_id: id,
          item_template_id: selectedItemToAdd,
          quantity_formula: quantityFormula,
          pieces_quantity: piecesQuantity,
          is_optional: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template-items', id] });
      toast.success('Item adicionado!');
      setIsAddItemDialogOpen(false);
      setSelectedItemToAdd('');
      setQuantityFormula('1');
      setPiecesQuantity(1);
    },
    onError: (error) => {
      toast.error('Erro ao adicionar: ' + error.message);
    },
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('product_template_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template-items', id] });
      toast.success('Item removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  const getItemsByType = (tabValue: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === tabValue);
    const dbType = currentTab?.dbType;
    return productItems?.filter((item) => item.item_template?.type === dbType) || [];
  };

  const getStorageUrl = (path: string | null, bucket: 'item-templates' | 'product-templates' = 'item-templates') => {
    if (!path) return null;
    // Se começa com http, já é URL completa
    if (path.startsWith('http')) return path;
    // Se começa com /, é arquivo local na pasta public
    if (path.startsWith('/')) return path;
    // Caso contrário, é do storage do Supabase
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  };

  if (productLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </MainLayout>
    );
  }

  if (!product) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Produto não encontrado</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in pb-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display font-bold text-xl text-foreground">
            Editar Produto
          </h1>
        </div>

        {/* Product Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Image */}
          <div className="flex flex-col items-center gap-3">
            <label className="w-full aspect-square max-w-[250px] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/30 relative group cursor-pointer hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isUploading}
              />
              {product.image_url ? (
                <img 
                  src={getStorageUrl(product.image_url, 'product-templates')} 
                  alt={product.name}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-6xl text-muted-foreground/30">🪟</div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <Button variant="secondary" size="sm" className="gap-2 pointer-events-none" disabled={isUploading}>
                  <Upload className="w-4 h-4" />
                  {isUploading ? 'Enviando...' : 'Alterar foto'}
                </Button>
              </div>
            </label>
            <p className="text-xs text-muted-foreground text-center">
              Arquivos permitidos: PNG, JPEG ou JPG<br />
              Obs: Essa imagem será usada na folha de orçamento
            </p>
          </div>

          {/* Product Form */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do produto:</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do produto"
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade de venda:</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="m2">m²</SelectItem>
                    <SelectItem value="ml">Metro linear</SelectItem>
                    <SelectItem value="un">Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Preço Base (R$/m²):</Label>
                <Input
                  type="number"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  placeholder="0,00"
                  min={0}
                  step={0.01}
                />
              </div>
              <div className="space-y-2">
                <Label>Possui vidro?</Label>
                <Select
                  value={formData.has_glass ? 'yes' : 'no'}
                  onValueChange={(value) => setFormData({ ...formData, has_glass: value === 'yes' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="yes">Sim</SelectItem>
                    <SelectItem value="no">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descritivo do produto: (opcional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do produto"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Items Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full h-auto flex-wrap bg-primary rounded-lg p-0 overflow-hidden">
            {itemTypeTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex-1 py-3 text-xs sm:text-sm font-medium text-primary-foreground/70 data-[state=active]:text-primary-foreground data-[state=active]:bg-primary-foreground/20 rounded-none border-0"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {itemTypeTabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              {/* Actions bar */}
              <div className="flex justify-end gap-2 mb-4">
                <Button 
                  size="sm" 
                  className="gap-2"
                  onClick={() => setIsAddItemDialogOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Adicionar item
                </Button>
              </div>

              {/* Items grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {getItemsByType(tab.value).map((item) => (
                  <div
                    key={item.id}
                    className="bg-card border rounded-lg p-4 relative group hover:shadow-md transition-shadow"
                  >
                    {/* Menu button */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                        <DropdownMenuItem
                          className="text-destructive cursor-pointer"
                          onClick={() => removeItemMutation.mutate(item.id)}
                        >
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Item image */}
                    <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {item.item_template?.image_url ? (
                        <img
                          src={getStorageUrl(item.item_template.image_url)}
                          alt={item.item_template.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="text-3xl text-muted-foreground/30">📦</div>
                      )}
                    </div>

                    {/* Item info */}
                    <h4 className="font-medium text-xs text-primary truncate text-center">
                      {item.item_template?.name}
                    </h4>
                    
                    {/* Formula type indicator */}
                    {getFormulaType(item.quantity_formula) && (
                      <div className="flex justify-center mt-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          getFormulaType(item.quantity_formula) === 'Altura' 
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        }`}>
                          {getFormulaType(item.quantity_formula)}
                        </span>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {item.quantity_formula}
                    </p>

                    {/* Pieces quantity and Angle indicators (for profiles) */}
                    {tab.value === 'profile' && (
                      <div className="flex justify-center gap-2 mt-3">
                        <span className="text-xs font-medium text-foreground bg-primary/10 px-2 py-1 rounded">
                          {item.pieces_quantity || 1}x peças
                        </span>
                        <span className="text-xs font-medium text-foreground bg-muted px-2 py-1 rounded">
                          {item.cut_angle || 90}°
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {getItemsByType(tab.value).length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">
                    Nenhum item vinculado. Clique em "Adicionar item" para vincular.
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Bottom actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="destructive" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline">Resetar produto</Button>
            <Button onClick={() => saveProductMutation.mutate()}>
              {saveProductMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>

        {/* Add Item Dialog */}
        <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Item - {itemTypeTabs.find(t => t.value === activeTab)?.label}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Selecione o item:</Label>
                <Select value={selectedItemToAdd} onValueChange={setSelectedItemToAdd}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um item" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                    {availableItems?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} {item.linha && `(${item.linha})`}
                      </SelectItem>
                    ))}
                    {!availableItems?.length && (
                      <div className="p-2 text-sm text-muted-foreground">
                        Nenhum item disponível
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fórmula de comprimento:</Label>
                <Input
                  value={quantityFormula}
                  onChange={(e) => setQuantityFormula(e.target.value)}
                  placeholder="Ex: Altura - 20"
                />
                <p className="text-xs text-muted-foreground">
                  Use variáveis: Altura, Largura
                </p>
              </div>
              {activeTab === 'profile' && (
                <div className="space-y-2">
                  <Label>Quantidade de peças por produto:</Label>
                  <Input
                    type="number"
                    value={piecesQuantity}
                    onChange={(e) => setPiecesQuantity(Number(e.target.value))}
                    min={1}
                    max={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ex: Montantes = 2 peças, Travessas = 2 peças
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => addItemMutation.mutate()}
                  disabled={!selectedItemToAdd || addItemMutation.isPending}
                >
                  Adicionar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
