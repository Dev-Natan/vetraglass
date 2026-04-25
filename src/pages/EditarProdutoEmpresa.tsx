import { useState, useEffect, useMemo } from 'react';
import { resolveImageUrl, resolveProductImageUrl } from '@/utils/imageUrl';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Upload, MoreHorizontal, Plus, ChevronRight, Home, Package, CheckCircle2, Circle, CircleDot, RotateCcw, Search, DollarSign, Calculator, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { processFileWithWhiteBackground } from '@/utils/imageBackgroundProcessor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormulaEditor } from '@/components/produtos/FormulaEditor';
import { GlassFormulaEditor } from '@/components/produtos/GlassFormulaEditor';
import { ProductConfigPanel, ProductConfigData } from '@/components/produtos/ProductConfigPanel';
import { ProductCompositionPricing } from '@/components/produtos/ProductCompositionPricing';
import { CompositionSections } from '@/components/produtos/CompositionSections';
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { recalculateProductPrice } from '@/utils/productPriceUpdater';

type CompanyProduct = {
  id: string;
  company_id: string;
  product_template_id: string | null;
  commercial_name: string;
  description: string | null;
  base_price: number | null;
  price_per_sqm: number | null;
  cost_per_sqm: number | null;
  margin_percent: number | null;
  pricing_type: string | null;
  is_active: boolean;
  is_custom: boolean | null;
  composition_finished: boolean | null;
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

type DefaultFormula = {
  formula: string;
  position: string;
};

type ItemTemplate = {
  id: string;
  name: string;
  type: string;
  unit: string;
  image_url: string | null;
  linha: string | null;
  default_formulas: DefaultFormula[] | null;
};

const itemTypeTabs = [
  { value: 'profile', label: 'PERFIS DE ALUMÍNIO', dbType: 'profile' },
  { value: 'accessory', label: 'COMPONENTES', dbType: 'accessory' },
  { value: 'glass', label: 'VIDROS', dbType: 'glass' },
];

export default function EditarProdutoEmpresa() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCompany, user } = useAuth();
  const { isAdmin } = usePermissions();
  
  const [activeTab, setActiveTab] = useState('profile');
  const [addItemSection, setAddItemSection] = useState<'profile' | 'accessory' | 'glass' | 'contramarco'>('profile');
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  
  const [editingItem, setEditingItem] = useState<CompanyProductItem | null>(null);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState('');
  const [quantityFormula, setQuantityFormula] = useState('1');
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [cutAngle, setCutAngle] = useState(90);
  const [piecesFormula, setPiecesFormula] = useState<string | null>(null);
  const [widthFormula, setWidthFormula] = useState('');
  const [heightFormula, setHeightFormula] = useState('');
  const [glassName, setGlassName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [pricingType, setPricingType] = useState<string>('fixed');
  const [costPerSqm, setCostPerSqm] = useState<number>(0);
  const [pricePerSqm, setPricePerSqm] = useState<number>(0);

  const [formData, setFormData] = useState({
    commercial_name: '',
    description: '',
    composition_finished: false,
  });

  const [configData, setConfigData] = useState<ProductConfigData>({
    acabamento: '',
    cor_componentes: '',
    reforco: '',
    contramarco: '',
    corte_contramarco: '',
    arremate: '',
  });

  // Fetch company product (with fallback: if id is actually a product_template_id, redirect)
  const { data: product, isLoading: productLoading, error: productError } = useQuery({
    queryKey: ['company-product', id, currentCompany?.id],
    queryFn: async () => {
      // 1) Try as company_products.id
      const { data, error } = await supabase
        .from('company_products')
        .select(`
          *,
          product_template:product_templates(id, name, image_url, linha)
        `)
        .eq('id', id!)
        .maybeSingle();
      
      if (error) throw error;
      if (data) return data as any;

      // 2) Fallback: maybe `id` is a product_template_id for this company
      if (currentCompany?.id) {
        const { data: byTemplate, error: tplError } = await supabase
          .from('company_products')
          .select(`
            *,
            product_template:product_templates(id, name, image_url, linha)
          `)
          .eq('product_template_id', id!)
          .eq('company_id', currentCompany.id)
          .maybeSingle();
        
        if (tplError) throw tplError;
        if (byTemplate) {
          // Redirect to canonical URL using company_products.id
          navigate(`/produtos/empresa/editar/${(byTemplate as any).id}`, { replace: true });
          return byTemplate as any;
        }
      }

      return null;
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
    queryKey: ['item-templates-by-type', addItemSection, product?.linha],
    queryFn: async () => {
      const dbType = addItemSection === 'contramarco' ? 'profile' : addItemSection;
      
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('type', dbType as "accessory" | "glass" | "profile" | "service")
        .eq('is_active', true)
        .order('linha')
        .order('name');
      if (error) throw error;
      
      const items = data as unknown as ItemTemplate[];
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
        composition_finished: (product as any).composition_finished || false,
      });
      setConfigData({
        acabamento: (product as any).acabamento || '',
        cor_componentes: (product as any).cor_componentes || '',
        reforco: (product as any).reforco || '',
        contramarco: (product as any).contramarco || '',
        corte_contramarco: (product as any).corte_contramarco || '',
        arremate: (product as any).arremate || '',
      });
      setPricingType(product.pricing_type === 'composition' ? 'composition' : 'fixed');
      setCostPerSqm(product.cost_per_sqm || 0);
      setPricePerSqm(product.price_per_sqm || 0);
    }
  }, [product]);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !currentCompany?.id) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPEG, JPG ou WebP.');
      return;
    }

    setIsUploading(true);
    try {
      const processedFile = await processFileWithWhiteBackground(file);
      const fileName = `${currentCompany.id}/${id}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('company-product-images')
        .upload(fileName, processedFile, { 
          upsert: true,
          contentType: 'image/png',
          cacheControl: '0'
        });

      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('company-product-images')
        .getPublicUrl(fileName);

      const timestamp = Date.now();
      const urlWithBuster = `${urlData.publicUrl}?t=${timestamp}`;

      const { error: updateError } = await supabase
        .from('company_products')
        .update({ image_url: urlWithBuster })
        .eq('id', id);

      if (updateError) throw updateError;
      
      queryClient.invalidateQueries({ queryKey: ['company-product', id] });
      toast.success('Imagem atualizada com sucesso!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar imagem: ' + error.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
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
          // Temporarily disabled due to missing DB column
          // composition_finished: formData.composition_finished,
          acabamento: configData.acabamento || null,
          cor_componentes: configData.cor_componentes || null,
          reforco: configData.reforco || null,
          contramarco: configData.contramarco || null,
          corte_contramarco: configData.corte_contramarco || null,
          arremate: configData.arremate || null,
          pricing_type: pricingType,
          cost_per_sqm: costPerSqm,
          price_per_sqm: pricePerSqm,
        } as any)
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
      const { data: existingCompanyItem } = await supabase
        .from('company_items')
        .select('id')
        .eq('company_id', currentCompany.id)
        .eq('item_template_id', selectedItemToAdd)
        .maybeSingle();

      let companyItemId = existingCompanyItem?.id || null;
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

      const isContramarco = addItemSection === 'contramarco';
      const insertData = {
        company_product_id: id,
        item_template_id: selectedItemToAdd,
        company_item_id: companyItemId,
        quantity_formula: quantityFormula,
        pieces_quantity: piecesQuantity,
        pieces_formula: piecesFormula,
        is_optional: isContramarco ? true : false,
        cut_angle: cutAngle,
        width_formula: addItemSection === 'glass' ? (widthFormula || null) : null,
        height_formula: addItemSection === 'glass' ? (heightFormula || null) : null,
        notes: addItemSection === 'glass' ? (glassName || null) : null,
        sort_order: (productItems?.length || 0) + 1,
        section: isContramarco ? 'contramarco' : null,
      };

      const { error } = await supabase
        .from('company_product_items')
        .insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
      if (id) recalculateProductPrice(id);
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
      if (id) recalculateProductPrice(id);
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
        updateData.quantity_formula = quantityFormula || '1';
        updateData.pieces_quantity = piecesQuantity;
        updateData.pieces_formula = piecesFormula || null;
      } else {
        updateData.quantity_formula = quantityFormula;
        updateData.pieces_quantity = piecesQuantity;
        updateData.pieces_formula = piecesFormula || null;
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
      if (!result.success) throw new Error(result.error || 'Erro desconhecido ao resetar produto');
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
    setPiecesFormula(null);
    setCutAngle(90);
    setWidthFormula('');
    setHeightFormula('');
    setGlassName('');
    setItemSearchQuery('');
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemToAdd(itemId);
    const item = availableItems?.find(i => i.id === itemId);
    if (item?.default_formulas && item.default_formulas.length > 0) {
      const firstFormula = item.default_formulas[0];
      if (addItemSection === 'glass') {
        const wf = item.default_formulas.find(f => f.position === 'Largura');
        const hf = item.default_formulas.find(f => f.position === 'Altura');
        if (wf) setWidthFormula(wf.formula);
        if (hf) setHeightFormula(hf.formula);
      } else {
        setQuantityFormula(firstFormula.formula);
      }
    }
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
      setQuantityFormula(item.quantity_formula || '1');
      setPiecesQuantity(item.pieces_quantity || 1);
      setPiecesFormula((item as any).pieces_formula || null);
    } else {
      setQuantityFormula(item.quantity_formula || '1');
      setPiecesQuantity(item.pieces_quantity || 1);
      setPiecesFormula((item as any).pieces_formula || null);
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

  const getStorageUrl = (path: string | null, bucket: string = 'item-templates') => resolveImageUrl(path, bucket as any);

  const getProductImageUrl = () => {
    if (product?.image_url) return resolveProductImageUrl(product.image_url);
    if (product?.product_template?.image_url) return resolveImageUrl(product.product_template.image_url, 'product-templates');
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
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-muted-foreground">Produto não encontrado (ID: {id})</div>
          {productError && <div className="text-destructive text-sm">Erro: {productError.message}</div>}
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in pb-24">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <button onClick={() => navigate('/')} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Início</span>
          </button>
          <ChevronRight className="w-4 h-4" />
          <button onClick={() => navigate('/produtos')} className="hover:text-foreground transition-colors">Produtos</button>
          {(product?.linha || product?.product_template?.linha) && (
            <>
              <ChevronRight className="w-4 h-4" />
              <button onClick={() => navigate(`/produtos/linha/${product.linha || product.product_template?.linha}`)} className="hover:text-foreground transition-colors">
                {product.linha || product.product_template?.linha}
              </button>
            </>
          )}
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium truncate max-w-[150px]">{product?.commercial_name}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-xl text-foreground">Editar Produto</h1>
            <p className="text-sm text-muted-foreground">Configure os componentes e informações do produto</p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            {itemTypeTabs.map((tab) => {
              const count = getItemsByType(tab.value).length;
              return (
                <div key={tab.value} className={cn("flex items-center gap-1.5 text-xs", count > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                  {count > 0 ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  <span>{tab.label.split(' ')[0]}</span>
                  <span className="font-medium">({count})</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Product Info Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="flex flex-col items-center gap-3">
            <label className="w-full aspect-square max-w-[250px] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/30 relative group cursor-pointer hover:border-primary/50 transition-colors">
              <input type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
              {getProductImageUrl() ? <img src={getProductImageUrl()!} alt={product.commercial_name} className="w-full h-full object-contain rounded-lg" /> : <div className="text-6xl text-muted-foreground/30">🪟</div>}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <Button variant="secondary" size="sm" className="gap-2 pointer-events-none" disabled={isUploading}>
                  <Upload className="w-4 h-4" /> {isUploading ? 'Enviando...' : 'Alterar foto'}
                </Button>
              </div>
            </label>
            <p className="text-xs text-muted-foreground text-center">Arquivos: PNG, JPEG ou JPG<br />Usada na folha de orçamento</p>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do produto:</Label>
                <div className="flex items-center gap-3">
                  <Input value={formData.commercial_name} onChange={(e) => setFormData({ ...formData, commercial_name: e.target.value })} placeholder="Nome comercial" />
                  <div className="flex items-center gap-2 border rounded-md px-3 h-10 bg-muted/20 shrink-0">
                    <Checkbox 
                      id="composition-finished" 
                      checked={formData.composition_finished} 
                      onCheckedChange={(checked) => setFormData({ ...formData, composition_finished: checked === true })}
                    />
                    <Label htmlFor="composition-finished" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                      Concluído
                    </Label>
                  </div>
                </div>
              </div>
              {product.product_template_id && (
                <div className="space-y-2">
                  <Label>Template base:</Label>
                  <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm text-muted-foreground h-10 flex items-center">{product.product_template?.name}</div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Descritivo do produto: (opcional)</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição" rows={3} />
            </div>
          </div>
        </div>

        {/* Product Config Panel */}
        <ProductConfigPanel config={configData} onChange={setConfigData} minWidth={(product as any).min_width} maxWidth={(product as any).max_width} minHeight={(product as any).min_height} maxHeight={(product as any).max_height} />

        {/* Pricing Selection */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" />
              Forma de Precificação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Escolha como o preço será definido:</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="w-4 h-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p><strong>Preços Fixos:</strong> Você define manualmente o custo e o preço por m².<br/><strong>Por Composição:</strong> O sistema calcula o preço automaticamente baseado nos materiais abaixo.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <RadioGroup value={pricingType} onValueChange={setPricingType} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={cn("flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-all", pricingType === 'fixed' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50')}>
                  <RadioGroupItem value="fixed" className="sr-only" />
                  <DollarSign className={cn("w-6 h-6", pricingType === 'fixed' ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-semibold">Preços Fixos</span>
                  <span className="text-xs text-muted-foreground text-center">Controle manual de custo e venda por m²</span>
                </label>
                <label className={cn("flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-all", pricingType === 'composition' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50')}>
                  <RadioGroupItem value="composition" className="sr-only" />
                  <Calculator className={cn("w-6 h-6", pricingType === 'composition' ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-semibold">Por Composição</span>
                  <span className="text-xs text-muted-foreground text-center">Cálculo dinâmico baseado nos materiais utilizados</span>
                </label>
              </RadioGroup>
            </div>

            {pricingType === 'fixed' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                <div className="space-y-2">
                  <Label>Custo Referencial / m² (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={costPerSqm || 0} 
                    onChange={(e) => setCostPerSqm(Number(e.target.value) || 0)} 
                  />
                  <p className="text-[10px] text-muted-foreground">O custo definido manualmente aqui será o usado no orçamento</p>
                </div>
                <div className="space-y-2">
                  <Label>Preço de Venda / m² (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={pricePerSqm || 0} 
                    onChange={(e) => setPricePerSqm(Number(e.target.value) || 0)} 
                    className="font-bold text-primary" 
                  />
                  <p className="text-[10px] text-muted-foreground">O preço de venda por m² usado no orçamento</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Composition Sections */}
        <CompositionSections
          items={productItems || []}
          onAddItem={(section) => { setAddItemSection(section); setIsAddItemDialogOpen(true); }}
          onEditItem={handleEditItem}
          onRemoveItem={(itemId) => removeItemMutation.mutate(itemId)}
        />

        {/* Composition-Based Pricing (Visible if composition selected) */}
        {pricingType === 'composition' && (
          <ProductCompositionPricing
            productId={id!}
            onSuccess={(cost, price) => {
              setCostPerSqm(cost);
              setPricePerSqm(price);
            }}
            productItems={productItems || []}
            currentCostPerSqm={product.cost_per_sqm}
            currentPricePerSqm={product.price_per_sqm}
            currentMargin={product.margin_percent}
          />
        )}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar {addItemSection === 'profile' ? 'Perfil' : addItemSection === 'glass' ? 'Vidro' : addItemSection === 'contramarco' ? 'Contramarco' : 'Componente'}</DialogTitle>
            <DialogDescription>Selecione um item e configure sua fórmula</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Item:</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Pesquisar..." value={itemSearchQuery} onChange={(e) => setItemSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <ScrollArea className="h-[220px] rounded-lg border bg-muted/20 p-2">
                <div className="space-y-1">
                  {filteredAvailableItems.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Vazio</p> : filteredAvailableItems.map((item) => (
                    <button key={item.id} type="button" onClick={() => handleSelectItem(item.id)} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors", selectedItemToAdd === item.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted")}>
                      <div className="w-8 h-8 rounded border bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {item.image_url ? <img src={getStorageUrl(item.image_url)} alt={item.name} className="w-full h-full object-contain" /> : <span className="text-xs text-muted-foreground/50">📦</span>}
                      </div>
                      <span className="text-sm truncate flex-1">{item.name}</span>
                      {item.linha && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium flex-shrink-0">{item.linha}</span>}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {addItemSection === 'glass' ? <GlassFormulaEditor widthFormula={widthFormula} heightFormula={heightFormula} onWidthFormulaChange={setWidthFormula} onHeightFormulaChange={setHeightFormula} showPiecesQuantity={true} piecesQuantity={piecesQuantity} onPiecesChange={setPiecesQuantity} piecesFormula={piecesFormula} onPiecesFormulaChange={setPiecesFormula} /> : <FormulaEditor value={quantityFormula} onChange={setQuantityFormula} showPiecesQuantity={true} piecesQuantity={piecesQuantity} onPiecesChange={setPiecesQuantity} piecesFormula={piecesFormula} onPiecesFormulaChange={setPiecesFormula} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addItemMutation.mutate()} disabled={!selectedItemToAdd || addItemMutation.isPending}>{addItemMutation.isPending ? 'Adicionando...' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Item</DialogTitle><DialogDescription>{editingItem?.item_template?.name || editingItem?.company_item?.name}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {(editingItem?.item_template?.type === 'glass' || editingItem?.company_item?.type === 'glass') ? <GlassFormulaEditor widthFormula={widthFormula} heightFormula={heightFormula} onWidthFormulaChange={setWidthFormula} onHeightFormulaChange={setHeightFormula} showPiecesQuantity={true} piecesQuantity={piecesQuantity} onPiecesChange={setPiecesQuantity} piecesFormula={piecesFormula} onPiecesFormulaChange={setPiecesFormula} /> : <FormulaEditor value={quantityFormula} onChange={setQuantityFormula} showPiecesQuantity={true} piecesQuantity={piecesQuantity} onPiecesChange={setPiecesQuantity} piecesFormula={piecesFormula} onPiecesFormulaChange={setPiecesFormula} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateItemMutation.mutate()} disabled={updateItemMutation.isPending}>{updateItemMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-sync Product Dialog */}
      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-primary"><RotateCcw className="w-5 h-5" /> Re-sincronizar Template</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Restaura os componentes do template original.</p>
              <p className="text-destructive font-medium">Componentes personalizados serão substituídos!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-primary hover:bg-primary/90" onClick={() => resetProductMutation.mutate()} disabled={resetProductMutation.isPending}>{resetProductMutation.isPending ? 'Sincronizando...' : 'Confirmar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky bottom save bar */}
      <div className="fixed bottom-0 left-0 lg:left-60 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Button variant="outline" onClick={() => {
            const linha = product?.linha || product?.product_template?.linha;
            if (linha) navigate(`/produtos/linha/${linha}`); else navigate('/produtos');
          }} className="gap-2"><ArrowLeft className="w-4 h-4" /> Voltar</Button>
          <div className="flex gap-2">
            {canReset && <Button variant="outline" size="sm" className="gap-2 hidden sm:inline-flex" onClick={() => setIsResetDialogOpen(true)}><RotateCcw className="w-4 h-4" /> Re-sincronizar</Button>}
            <Button onClick={() => saveProductMutation.mutate()} disabled={saveProductMutation.isPending}>{saveProductMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}</Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
