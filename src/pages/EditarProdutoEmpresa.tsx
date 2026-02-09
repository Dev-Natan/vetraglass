import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Upload, MoreHorizontal, Plus, ChevronRight, Home, Package, CheckCircle2, Circle, CircleDot, RotateCcw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { processFileWithWhiteBackground } from '@/utils/imageBackgroundProcessor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormulaEditor } from '@/components/produtos/FormulaEditor';
import { GlassFormulaEditor } from '@/components/produtos/GlassFormulaEditor';

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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

type CompanyProduct = {
  id: string;
  company_id: string;
  product_template_id: string | null;
  commercial_name: string;
  description: string | null;
  base_price: number | null;
  price_per_sqm: number | null;
  is_active: boolean;
  is_custom: boolean | null;
  linha: string | null;
  image_url: string | null;
  product_template?: {
    id: string;
    name: string;
    image_url: string | null;
    linha: string | null;
  } | null;
};

type CompanyProductItem = {
  id: string;
  company_product_id: string;
  item_template_id: string | null;
  company_item_id: string | null;
  quantity_formula: string;
  width_formula: string | null;
  height_formula: string | null;
  is_optional: boolean | null;
  notes: string | null;
  sort_order: number | null;
  cut_angle: number | null;
  pieces_quantity: number | null;
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
};

type ItemTemplate = {
  id: string;
  name: string;
  type: string;
  unit: string;
  image_url: string | null;
  linha: string | null;
};

// Helper para detectar se a fórmula usa Altura ou Largura
const getFormulaType = (formula: string): 'Altura' | 'Largura' | null => {
  const lower = formula.toLowerCase();
  if (lower.includes('altura')) return 'Altura';
  if (lower.includes('largura')) return 'Largura';
  return null;
};

const itemTypeTabs = [
  { value: 'glass', label: 'VIDROS', dbType: 'glass' },
  { value: 'profile', label: 'PERFIS DE ALUMÍNIO', dbType: 'profile' },
  { value: 'rubber', label: 'BORRACHAS E OUTROS', dbType: 'accessory' },
  { value: 'accessory', label: 'ACESSÓRIOS E FERRAGENS', dbType: 'accessory' },
];

export default function EditarProdutoEmpresa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany, user } = useAuth();
  const { isAdmin } = usePermissions();
  
  const [activeTab, setActiveTab] = useState('glass');
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<CompanyProductItem | null>(null);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState('');
  const [quantityFormula, setQuantityFormula] = useState('1');
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [cutAngle, setCutAngle] = useState(90);
  const [widthFormula, setWidthFormula] = useState('');
  const [heightFormula, setHeightFormula] = useState('');
  const [glassName, setGlassName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    commercial_name: '',
    description: '',
  });

  // Fetch company product
  const { data: product, isLoading: productLoading } = useQuery({
    queryKey: ['company-product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_products')
        .select(`
          *,
          product_template:product_templates(id, name, image_url, linha)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as CompanyProduct | null;
    },
    enabled: !!id,
  });

  // Fetch product items
  const { data: productItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['company-product-items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_product_items')
        .select(`
          *,
          item_template:item_templates(id, name, type, unit, image_url, linha),
          company_item:company_items(id, name, type, unit, image_url)
        `)
        .eq('company_product_id', id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as CompanyProductItem[];
    },
    enabled: !!id,
  });

  // Fetch available item templates for adding
  const { data: availableItems } = useQuery({
    queryKey: ['item-templates-by-type', activeTab, product?.linha],
    queryFn: async () => {
      const currentTab = itemTypeTabs.find(t => t.value === activeTab);
      const dbType = currentTab?.dbType || 'accessory';
      
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('type', dbType as "accessory" | "glass" | "profile" | "service")
        .eq('is_active', true)
        .order('linha')
        .order('name');
      if (error) throw error;
      
      // Sort items: product linha first, then others
      const items = data as ItemTemplate[];
      const productLinha = product?.linha || product?.product_template?.linha;
      
      if (productLinha) {
        return items.sort((a, b) => {
          const aMatchesLinha = a.linha === productLinha;
          const bMatchesLinha = b.linha === productLinha;
          
          if (aMatchesLinha && !bMatchesLinha) return -1;
          if (!aMatchesLinha && bMatchesLinha) return 1;
          
          if (a.linha !== b.linha) {
            return (a.linha || 'ZZZ').localeCompare(b.linha || 'ZZZ');
          }
          return a.name.localeCompare(b.name);
        });
      }
      
      return items;
    },
  });

  // Update form when product loads
  useEffect(() => {
    if (product) {
      setFormData({
        commercial_name: product.commercial_name || '',
        description: product.description || '',
      });
    }
  }, [product]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !currentCompany?.id) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Apenas arquivos PNG, JPEG ou JPG são permitidos');
      return;
    }

    setIsUploading(true);
    try {
      // Process image to have white background
      const processedFile = await processFileWithWhiteBackground(file);
      const fileName = `${currentCompany.id}/${id}.png`;

      const { error: uploadError } = await supabase.storage
        .from('company-product-images')
        .upload(fileName, processedFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from('company_products')
        .update({ image_url: fileName })
        .eq('id', id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['company-product', id] });
      toast.success('Imagem atualizada!');
    } catch (error: any) {
      toast.error('Erro ao enviar imagem: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('company_products')
        .update({
          commercial_name: formData.commercial_name,
          description: formData.description,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-product', id] });
      toast.success('Produto salvo!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  // Add item mutation
  const addItemMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      
      // 1. Ensure company_item exists for the item_template
      const { data: existingCompanyItem } = await supabase
        .from('company_items')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('item_template_id', selectedItemToAdd)
        .maybeSingle();

      let companyItemId = existingCompanyItem?.id || null;

      // If no company_item exists, create one from the template
      if (!companyItemId) {
        const { data: itemTemplate } = await supabase
          .from('item_templates')
          .select('name, description, type, unit, specifications, image_url, linha, default_price')
          .eq('id', selectedItemToAdd)
          .single();

        if (itemTemplate) {
          const { data: newCompanyItem, error: createError } = await supabase
            .from('company_items')
            .insert({
              company_id: currentCompany.id,
              item_template_id: selectedItemToAdd,
              name: itemTemplate.name,
              description: itemTemplate.description,
              type: itemTemplate.type,
              unit: itemTemplate.unit,
              specifications: itemTemplate.specifications,
              image_url: itemTemplate.image_url,
              linha: itemTemplate.linha,
              cost: 0,
              sale_price: itemTemplate.default_price || 0,
              is_custom: false,
              is_active: true,
            })
            .select('id')
            .single();

          if (createError) throw createError;
          companyItemId = newCompanyItem?.id || null;
        }
      }

      const insertData = {
        company_product_id: id,
        item_template_id: selectedItemToAdd,
        company_item_id: companyItemId,
        quantity_formula: quantityFormula,
        pieces_quantity: piecesQuantity,
        is_optional: false,
        cut_angle: cutAngle,
        width_formula: activeTab === 'glass' ? (widthFormula || null) : null,
        height_formula: activeTab === 'glass' ? (heightFormula || null) : null,
        notes: activeTab === 'glass' ? (glassName || null) : null,
        sort_order: (productItems?.length || 0) + 1,
      };

      const { error } = await supabase
        .from('company_product_items')
        .insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
      toast.success('Item adicionado!');
      setIsAddItemDialogOpen(false);
      resetItemForm();
    },
    onError: (error) => {
      toast.error('Erro ao adicionar: ' + error.message);
    },
  });

  // Remove item mutation
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('company_product_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
      toast.success('Item removido!');
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) throw new Error('Nenhum item selecionado');
      
      const itemType = editingItem.item_template?.type || editingItem.company_item?.type;
      const updateData: Record<string, any> = {};
      
      if (itemType === 'glass') {
        updateData.width_formula = widthFormula || null;
        updateData.height_formula = heightFormula || null;
        updateData.notes = glassName || null;
      } else {
        updateData.quantity_formula = quantityFormula;
        updateData.pieces_quantity = piecesQuantity;
        updateData.cut_angle = cutAngle;
      }
      
      const { error } = await supabase
        .from('company_product_items')
        .update(updateData)
        .eq('id', editingItem.id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
      toast.success('Item atualizado!');
      setIsEditItemDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  // Reset product mutation (admin only)
  const resetProductMutation = useMutation({
    mutationFn: async () => {
      if (!id || !user?.id) throw new Error('Dados inválidos');
      
      const { data, error } = await supabase.rpc('reset_company_product_to_template', {
        p_company_product_id: id,
        p_user_id: user.id,
      });
      
      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; items_deleted?: number; items_created?: number };
      if (!result.success) {
        throw new Error(result.error || 'Erro desconhecido ao resetar produto');
      }
      
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['company-product', id] });
      queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
      toast.success(`Produto resetado! ${result.items_created} itens restaurados do template.`);
      setIsResetDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Erro ao resetar: ' + error.message);
    },
  });

  const resetItemForm = () => {
    setSelectedItemToAdd('');
    setQuantityFormula('1');
    setPiecesQuantity(1);
    setCutAngle(90);
    setWidthFormula('');
    setHeightFormula('');
    setGlassName('');
    setItemSearchQuery('');
  };

  const filteredAvailableItems = useMemo(() => {
    if (!availableItems) return [];
    if (!itemSearchQuery) return availableItems;
    const q = itemSearchQuery.toLowerCase();
    return availableItems.filter(
      item => item.name.toLowerCase().includes(q) || item.linha?.toLowerCase().includes(q)
    );
  }, [availableItems, itemSearchQuery]);

  const handleEditItem = (item: CompanyProductItem) => {
    setEditingItem(item);
    const itemType = item.item_template?.type || item.company_item?.type;
    
    if (itemType === 'glass') {
      setWidthFormula(item.width_formula || '');
      setHeightFormula(item.height_formula || '');
      setGlassName(item.notes || '');
    } else {
      setQuantityFormula(item.quantity_formula || '1');
      setPiecesQuantity(item.pieces_quantity || 1);
      setCutAngle(item.cut_angle || 90);
    }
    
    setIsEditItemDialogOpen(true);
  };

  const getItemsByType = (tabValue: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === tabValue);
    const dbType = currentTab?.dbType;
    return productItems?.filter((item) => {
      const type = item.item_template?.type || item.company_item?.type;
      return type === dbType;
    }) || [];
  };

  const getStorageUrl = (path: string | null, bucket: string = 'item-templates') => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    if (path.startsWith('/')) return path;
    return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  };

  const getProductImageUrl = () => {
    if (product?.image_url) {
      return getStorageUrl(product.image_url, 'company-product-images');
    }
    if (product?.product_template?.image_url) {
      return getStorageUrl(product.product_template.image_url, 'product-templates');
    }
    return null;
  };

  const canReset = isAdmin && product?.product_template_id;

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
      <div className="space-y-6 animate-fade-in pb-24">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Início</span>
          </button>
          <ChevronRight className="w-4 h-4" />
          <button 
            onClick={() => navigate('/produtos')}
            className="hover:text-foreground transition-colors"
          >
            Produtos
          </button>
          {(product?.linha || product?.product_template?.linha) && (
            <>
              <ChevronRight className="w-4 h-4" />
              <button 
                onClick={() => navigate(`/produtos/linha/${product.linha || product.product_template?.linha}`)}
                className="hover:text-foreground transition-colors"
              >
                {product.linha || product.product_template?.linha}
              </button>
            </>
          )}
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium truncate max-w-[150px]">
            {product?.commercial_name}
          </span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display font-bold text-xl text-foreground">
                Editar Produto
              </h1>
              <p className="text-sm text-muted-foreground">
                Configure os componentes e informações do produto
              </p>
            </div>
          </div>
          
          {/* Quick status */}
          <div className="hidden md:flex items-center gap-4">
            {itemTypeTabs.map((tab) => {
              const count = getItemsByType(tab.value).length;
              return (
                <div 
                  key={tab.value}
                  className={`flex items-center gap-1.5 text-xs ${
                    count > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                  }`}
                >
                  {count > 0 ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Circle className="w-4 h-4" />
                  )}
                  <span>{tab.label.split(' ')[0]}</span>
                  <span className="font-medium">({count})</span>
                </div>
              );
            })}
          </div>
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
              {getProductImageUrl() ? (
                <img 
                  src={getProductImageUrl()!} 
                  alt={product.commercial_name}
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
                  value={formData.commercial_name}
                  onChange={(e) => setFormData({ ...formData, commercial_name: e.target.value })}
                  placeholder="Nome comercial do produto"
                />
              </div>
              {product.product_template_id && (
                <div className="space-y-2">
                  <Label>Template base:</Label>
                  <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground h-10 flex items-center">
                    {product.product_template?.name}
                  </div>
                </div>
              )}
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Composição do Produto</h2>
            <p className="text-sm text-muted-foreground">
              {productItems?.length || 0} itens configurados
            </p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="bg-muted/50 rounded-xl p-1.5">
              <TabsList className="w-full h-auto bg-transparent gap-1">
                {itemTypeTabs.map((tab) => {
                  const itemCount = getItemsByType(tab.value).length;
                  const isActive = activeTab === tab.value;
                  const hasItems = itemCount > 0;
                  
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={`flex-1 py-3 text-xs sm:text-sm font-medium rounded-lg transition-all data-[state=active]:shadow-sm ${
                        hasItems && !isActive
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
                          : 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {hasItems ? (
                          <CheckCircle2 className={`w-4 h-4 ${isActive ? '' : 'text-green-600 dark:text-green-400'}`} />
                        ) : isActive ? (
                          <CircleDot className="w-4 h-4" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive 
                            ? 'bg-primary-foreground/20' 
                            : hasItems 
                              ? 'bg-green-600/20 text-green-700 dark:bg-green-400/20 dark:text-green-300'
                              : 'bg-muted'
                        }`}>
                          {itemCount}
                        </span>
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {itemTypeTabs.map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="mt-4">
                <div className="flex justify-between items-center gap-2 mb-4">
                  <p className="text-sm text-muted-foreground">
                    {getItemsByType(tab.value).length === 0 
                      ? `Adicione ${tab.label.toLowerCase()} à composição`
                      : `${getItemsByType(tab.value).length} ${tab.label.toLowerCase()} configurados`
                    }
                  </p>
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
                  {getItemsByType(tab.value).map((item) => {
                    const itemData = item.item_template || item.company_item;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleEditItem(item)}
                        className="bg-card border rounded-lg p-4 relative group hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditItem(item);
                              }}
                            >
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeItemMutation.mutate(item.id);
                              }}
                            >
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        {/* Item image */}
                        <div className="aspect-square rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                          {itemData?.image_url ? (
                            <img
                              src={getStorageUrl(itemData.image_url)}
                              alt={itemData?.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="text-3xl text-muted-foreground/30 bg-muted w-full h-full flex items-center justify-center">📦</div>
                          )}
                        </div>

                        {/* Item info */}
                        {tab.value === 'glass' && item.notes && (
                          <h4 className="font-bold text-sm text-foreground truncate text-center mb-1">
                            {item.notes}
                          </h4>
                        )}
                        <h4 className={`font-medium text-xs truncate text-center ${tab.value === 'glass' && item.notes ? 'text-muted-foreground' : 'text-primary'}`}>
                          {itemData?.name}
                        </h4>
                        
                        {/* Glass formulas display */}
                        {tab.value === 'glass' && (item.width_formula || item.height_formula) && (
                          <div className="mt-2 space-y-1">
                            {item.width_formula && (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  L: {item.width_formula}
                                </span>
                              </div>
                            )}
                            {item.height_formula && (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  A: {item.height_formula}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Formula type indicator for non-glass items */}
                        {tab.value !== 'glass' && getFormulaType(item.quantity_formula) && (
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
                        
                        {tab.value !== 'glass' && (
                          <p className="text-xs text-muted-foreground text-center mt-1">
                            {item.quantity_formula}
                          </p>
                        )}

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
                    );
                  })}

                  {getItemsByType(tab.value).length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      Nenhum item vinculado. Clique em "Adicionar item" para vincular.
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
            <DialogDescription>
              Selecione um item e configure sua fórmula
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item:</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por nome ou linha..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[220px] rounded-lg border bg-muted/20 p-2">
                <div className="space-y-1">
                  {filteredAvailableItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Nenhum item encontrado</p>
                  ) : (
                    filteredAvailableItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemToAdd(item.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                          selectedItemToAdd === item.id
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-muted"
                        )}
                      >
                        <div className="w-8 h-8 rounded border bg-background flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {item.image_url ? (
                            <img src={getStorageUrl(item.image_url)} alt={item.name} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-xs text-muted-foreground/50">📦</span>
                          )}
                        </div>
                        <span className="text-sm truncate flex-1">{item.name}</span>
                        {item.type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
                            {item.type === 'profile' ? 'Perfil' : item.type === 'glass' ? 'Vidro' : item.type === 'accessory' ? 'Acessório' : item.type}
                          </span>
                        )}
                        {item.linha && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex-shrink-0">
                            {item.linha}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {activeTab === 'glass' ? (
              <GlassFormulaEditor
                widthFormula={widthFormula}
                heightFormula={heightFormula}
                onWidthFormulaChange={setWidthFormula}
                onHeightFormulaChange={setHeightFormula}
              />
            ) : (
              <FormulaEditor
                value={quantityFormula}
                onChange={setQuantityFormula}
                showPiecesQuantity={true}
                piecesQuantity={piecesQuantity}
                onPiecesChange={setPiecesQuantity}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => addItemMutation.mutate()} 
              disabled={!selectedItemToAdd || addItemMutation.isPending}
            >
              {addItemMutation.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Item</DialogTitle>
            <DialogDescription>
              {editingItem?.item_template?.name || editingItem?.company_item?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(editingItem?.item_template?.type === 'glass' || editingItem?.company_item?.type === 'glass') ? (
              <GlassFormulaEditor
                widthFormula={widthFormula}
                heightFormula={heightFormula}
                onWidthFormulaChange={setWidthFormula}
                onHeightFormulaChange={setHeightFormula}
              />
            ) : (
              <FormulaEditor
                value={quantityFormula}
                onChange={setQuantityFormula}
                showPiecesQuantity={true}
                piecesQuantity={piecesQuantity}
                onPiecesChange={setPiecesQuantity}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => updateItemMutation.mutate()} 
              disabled={updateItemMutation.isPending}
            >
              {updateItemMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-sync Product Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary">
              <RotateCcw className="w-5 h-5" />
              Re-sincronizar Componentes do Template
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta ação irá <strong>restaurar todos os componentes (perfis, vidros, acessórios)</strong> 
                a partir do template original, garantindo que a composição fique completa.
              </p>
              <p className="text-destructive font-medium">
                Componentes personalizados serão substituídos pelos do template!
              </p>
              <p className="text-sm text-muted-foreground">
                Use quando a composição estiver incompleta ou inconsistente.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-primary hover:bg-primary/90"
              onClick={() => resetProductMutation.mutate()}
              disabled={resetProductMutation.isPending}
            >
              {resetProductMutation.isPending ? 'Sincronizando...' : 'Confirmar Re-sincronização'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky bottom save bar */}
      <div className="fixed bottom-0 left-0 lg:left-60 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={() => {
            const linha = product?.linha || product?.product_template?.linha;
            if (linha) {
              navigate(`/produtos/linha/${linha}`);
            } else {
              navigate('/produtos');
            }
          }} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="flex gap-2">
            {canReset && (
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2 hidden sm:inline-flex"
                onClick={() => setIsResetDialogOpen(true)}
              >
                <RotateCcw className="w-4 h-4" />
                Re-sincronizar
              </Button>
            )}
            <Button onClick={() => saveProductMutation.mutate()} disabled={saveProductMutation.isPending}>
              {saveProductMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </div>
      </div>

    </MainLayout>
  );
}
