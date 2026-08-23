import { useState, useEffect, useMemo } from 'react';
import { resolveImageUrl } from '@/utils/imageUrl';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Upload, MoreHorizontal, Plus, ChevronRight, Home, Package, CheckCircle2, Circle, CircleDot, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { processFileWithWhiteBackground } from '@/utils/imageBackgroundProcessor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormulaEditor } from '@/components/produtos/FormulaEditor';
import { GlassFormulaEditor } from '@/components/produtos/GlassFormulaEditor';
import { FiscalFieldsCard, FiscalFieldsData } from '@/components/produtos/FiscalFieldsCard';
import { CopyCompositionDialog } from '@/components/produtos/CopyCompositionDialog';

import { validateFormula } from '@/utils/safeFormulaEvaluator';
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
import { useAuth } from '@/contexts/AuthContext';

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
  has_multiple_sides: boolean | null;
};

type ProductTemplateItem = {
  id: string;
  product_template_id: string;
  item_template_id: string;
  quantity_formula: string;
  pieces_quantity: number;
  is_optional: boolean;
  notes: string | null;
  side: string | null;
  cut_angle: number;
  width_formula: string | null;
  height_formula: string | null;
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
  const { currentCompany, isSaasAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('glass');
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [isCopyCompositionOpen, setIsCopyCompositionOpen] = useState(false);

  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductTemplateItem | null>(null);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState('');
  const [quantityFormula, setQuantityFormula] = useState('1');
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [cutAngle, setCutAngle] = useState(90);
  const [widthFormula, setWidthFormula] = useState('');
  const [heightFormula, setHeightFormula] = useState('');
  const [piecesFormula, setPiecesFormula] = useState<string | null>(null);
  const [glassName, setGlassName] = useState('');
  const [side, setSide] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [linhaFilter, setLinhaFilter] = useState<string>('__all__');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    unit: 'm2',
    is_ready_product: false,
    has_glass: true,
    gap_type: 'normal',
    base_price: '',
    has_multiple_sides: false,
  });

  const [fiscalData, setFiscalData] = useState<FiscalFieldsData>({
    ncm: '',
    cfop_venda: '5102',
    cfop_venda_interestadual: '6102',
    cest: '',
    origem: '0',
    codigo_servico: '',
    aliquota_iss: '0',
  });

  // Check if fiscal mode is enabled for the company
  const { data: companyConfig } = useQuery({
    queryKey: ['company-fiscal-mode', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('modo_fiscal_ativo')
        .eq('id', currentCompany.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id,
  });

  const modoFiscalAtivo = companyConfig?.modo_fiscal_ativo ?? false;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato inválido. Use PNG, JPEG, JPG ou WebP.');
      return;
    }

    setIsUploading(true);
    try {
      const processedFile = await processFileWithWhiteBackground(file);
      const fileName = `${id}.png`;

      // Upload para o bucket product-templates
      const { error: uploadError } = await supabase.storage
        .from('product-templates')
        .upload(fileName, processedFile, { 
          upsert: true,
          contentType: 'image/png',
          cacheControl: '0'
        });

      if (uploadError) throw uploadError;

      // Get public URL with timestamp for cache busting
      const { data: urlData } = supabase.storage
        .from('product-templates')
        .getPublicUrl(fileName);

      const timestamp = Date.now();
      const urlWithBuster = `${urlData.publicUrl}?t=${timestamp}`;

      // Atualizar o registro com a nova URL
      const { error: updateError } = await supabase
        .from('product_templates')
        .update({ image_url: urlWithBuster })
        .eq('id', id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['product-template', id] });
      toast.success('Imagem atualizada com sucesso!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar imagem: ' + error.message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
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
  // For SaaS admins: show global items (company_id IS NULL)
  // For company users: show only their company items (items they configured when activating)
  const { data: productItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['product-template-items', id, currentCompany?.id, isSaasAdmin],
    queryFn: async () => {
      let query = supabase
        .from('product_template_items')
        .select(`
          *,
          item_template:item_templates(id, name, type, unit, image_url, linha)
        `)
        .eq('product_template_id', id);
      
      if (isSaasAdmin) {
        // SaaS admins see global items only
        query = query.is('company_id', null);
      } else if (currentCompany?.id) {
        // Company users see only their own items (configured during activation)
        query = query.eq('company_id', currentCompany.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as (ProductTemplateItem & { company_id?: string | null })[];
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
      const productLinha = product?.linha;
      
      if (productLinha) {
        return items.sort((a, b) => {
          const aMatchesLinha = a.linha === productLinha;
          const bMatchesLinha = b.linha === productLinha;
          
          if (aMatchesLinha && !bMatchesLinha) return -1;
          if (!aMatchesLinha && bMatchesLinha) return 1;
          
          // Secondary sort by linha name, then by item name
          if (a.linha !== b.linha) {
            return (a.linha || 'ZZZ').localeCompare(b.linha || 'ZZZ');
          }
          return a.name.localeCompare(b.name);
        });
      }
      
      return items;
    },
  });

  // Linhas únicas disponíveis nos itens (para o filtro)
  const availableLinhas = useMemo(() => {
    if (!availableItems) return [] as string[];
    const set = new Set<string>();
    availableItems.forEach((i: any) => { if (i.linha) set.add(i.linha); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [availableItems]);

  // Detecta a linha do produto: campo explícito ou pelo nome
  const detectLinhaFromProduct = (): string | null => {
    const explicit = (product as any)?.linha;
    if (explicit) return explicit;
    const name = ((product as any)?.name || '').toLowerCase();
    if (!name || !availableLinhas.length) return null;
    return availableLinhas.find(l => name.includes(l.toLowerCase())) || null;
  };

  // Auto-preenche o filtro ao abrir o diálogo / trocar de aba
  useEffect(() => {
    if (!isAddItemDialogOpen) return;
    const detected = detectLinhaFromProduct();
    setLinhaFilter(detected && availableLinhas.includes(detected) ? detected : '__all__');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddItemDialogOpen, activeTab, availableLinhas.length, (product as any)?.id]);

  const filteredAvailableItems = useMemo(() => {
    if (!availableItems) return [] as any[];
    if (!linhaFilter || linhaFilter === '__all__') return availableItems;
    return availableItems.filter((i: any) => i.linha === linhaFilter);
  }, [availableItems, linhaFilter]);

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
        has_multiple_sides: (product as any).has_multiple_sides || false,
      });
      // Load fiscal data
      setFiscalData({
        ncm: (product as any).ncm || '',
        cfop_venda: (product as any).cfop_venda || '5102',
        cfop_venda_interestadual: (product as any).cfop_venda_interestadual || '6102',
        cest: (product as any).cest || '',
        origem: (product as any).origem || '0',
        codigo_servico: (product as any).codigo_servico || '',
        aliquota_iss: (product as any).aliquota_iss?.toString() || '0',
      });
    }
  }, [product]);

  // Save product mutation
  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const updateData: Record<string, any> = {
        name: formData.name,
        description: formData.description,
        base_price: formData.base_price ? parseFloat(formData.base_price) : 0,
        has_multiple_sides: formData.has_multiple_sides,
      };

      // Include fiscal data if fiscal mode is enabled
      if (modoFiscalAtivo) {
        updateData.ncm = fiscalData.ncm || null;
        updateData.cfop_venda = fiscalData.cfop_venda || '5102';
        updateData.cfop_venda_interestadual = fiscalData.cfop_venda_interestadual || '6102';
        updateData.cest = fiscalData.cest || null;
        updateData.origem = fiscalData.origem || '0';
        updateData.codigo_servico = fiscalData.codigo_servico || null;
        updateData.aliquota_iss = fiscalData.aliquota_iss ? parseFloat(fiscalData.aliquota_iss) : 0;
      }

      const { error } = await supabase
        .from('product_templates')
        .update(updateData as never)
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
      // SaaS admins add global items (company_id = null)
      // Company users add company-specific items
      const insertData: {
        product_template_id: string | undefined;
        item_template_id: string;
        quantity_formula: string;
        pieces_quantity: number;
        pieces_formula?: string | null;
        is_optional: boolean;
        company_id?: string;
        width_formula?: string | null;
        height_formula?: string | null;
        notes?: string | null;
        side?: string | null;
      } = {
        product_template_id: id,
        item_template_id: selectedItemToAdd,
        quantity_formula: quantityFormula,
        pieces_quantity: piecesQuantity,
        pieces_formula: piecesFormula,
        is_optional: false,
        width_formula: activeTab === 'glass' ? (widthFormula || null) : null,
        height_formula: activeTab === 'glass' ? (heightFormula || null) : null,
        notes: activeTab === 'glass' ? (glassName || null) : null,
        side: side || null,
      };

      // If not SaaS admin, must include company_id
      if (!isSaasAdmin && currentCompany) {
        insertData.company_id = currentCompany.id;
      }

      const { error } = await supabase
        .from('product_template_items')
        .insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template-items', id] });
      toast.success('Item adicionado!');
      setIsAddItemDialogOpen(false);
      setSelectedItemToAdd('');
      setSide(null);
      setQuantityFormula('1');
      setPiecesQuantity(1);
      setPiecesFormula(null);
      setWidthFormula('');
      setHeightFormula('');
      setGlassName('');
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

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) throw new Error('Nenhum item selecionado');
      
      const itemType = editingItem.item_template?.type;
      
      const updateData: Record<string, any> = {};
      
      if (itemType === 'glass') {
        updateData.width_formula = widthFormula || null;
        updateData.height_formula = heightFormula || null;
        updateData.notes = glassName || null;
        updateData.side = side || null;
        updateData.quantity_formula = quantityFormula || '1';
        updateData.pieces_quantity = piecesQuantity;
        updateData.pieces_formula = piecesFormula || null;
      } else {
        updateData.quantity_formula = quantityFormula;
        updateData.pieces_quantity = piecesQuantity;
        updateData.pieces_formula = piecesFormula || null;
        updateData.cut_angle = cutAngle;
        updateData.side = side || null;
      }
      
      const { error } = await supabase
        .from('product_template_items')
        .update(updateData as never)
        .eq('id', editingItem.id);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template-items', id] });
      toast.success('Item atualizado!');
      setIsEditItemDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const handleEditItem = (item: ProductTemplateItem) => {
    setEditingItem(item);
    const itemType = item.item_template?.type;
    
    if (itemType === 'glass') {
      setWidthFormula(item.width_formula || '');
      setHeightFormula(item.height_formula || '');
      setGlassName(item.notes || '');
      setSide(item.side || null);
      setQuantityFormula(item.quantity_formula || '1');
      setPiecesQuantity(item.pieces_quantity || 1);
      setPiecesFormula((item as any).pieces_formula || null);
    } else {
      setQuantityFormula(item.quantity_formula || '1');
      setPiecesQuantity(item.pieces_quantity || 1);
      setPiecesFormula((item as any).pieces_formula || null);
      setSide(item.side || null);
      setCutAngle(item.cut_angle || 90);
    }
    
    setIsEditItemDialogOpen(true);
  };

  const handleAddItem = () => {
    if (activeTab === 'glass') {
      if (!widthFormula.trim()) {
        toast.error('Informe a fórmula da largura do vidro');
        return;
      }
      if (!heightFormula.trim()) {
        toast.error('Informe a fórmula da altura do vidro');
        return;
      }
      
      const wv = validateFormula(widthFormula);
      const hv = validateFormula(heightFormula);
      
      if (!wv.isValid) {
        toast.error(`Fórmula de largura inválida: ${wv.error}`);
        return;
      }
      if (!hv.isValid) {
        toast.error(`Fórmula de altura inválida: ${hv.error}`);
        return;
      }
    }
    addItemMutation.mutate();
  };

  const handleUpdateItem = () => {
    const itemType = editingItem?.item_template?.type;
    if (itemType === 'glass') {
      if (!widthFormula.trim()) {
        toast.error('Informe a fórmula da largura do vidro');
        return;
      }
      if (!heightFormula.trim()) {
        toast.error('Informe a fórmula da altura do vidro');
        return;
      }
      
      const wv = validateFormula(widthFormula);
      const hv = validateFormula(heightFormula);
      
      if (!wv.isValid) {
        toast.error(`Fórmula de largura inválida: ${wv.error}`);
        return;
      }
      if (!hv.isValid) {
        toast.error(`Fórmula de altura inválida: ${hv.error}`);
        return;
      }
    }
    updateItemMutation.mutate();
  };


  const getItemsByType = (tabValue: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === tabValue);
    const dbType = currentTab?.dbType;
    return productItems?.filter((item) => item.item_template?.type === dbType) || [];
  };

  const getStorageUrl = (path: string | null, bucket: 'item-templates' | 'product-templates' = 'item-templates') => resolveImageUrl(path, bucket);

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
          {product?.linha && (
            <>
              <ChevronRight className="w-4 h-4" />
              <button 
                onClick={() => navigate(`/produtos/linha/${product.linha}`)}
                className="hover:text-foreground transition-colors"
              >
                {product.linha}
              </button>
            </>
          )}
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground font-medium truncate max-w-[150px]">
            {product?.name}
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
                <div className="flex items-center gap-3">
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome do produto"
                  />
                  <div className="flex items-center gap-2 border rounded-md px-3 h-10 bg-muted/20 shrink-0">
                    <Checkbox 
                      id="has-multiple-sides" 
                      checked={formData.has_multiple_sides} 
                      onCheckedChange={(checked) => setFormData({ ...formData, has_multiple_sides: checked === true })}
                    />
                    <Label htmlFor="has-multiple-sides" className="text-xs font-medium cursor-pointer whitespace-nowrap">
                      Múltiplos Lados
                    </Label>
                  </div>
                </div>
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

            <div className="space-y-2">
              <Label>Descritivo do produto: (opcional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do produto"
                rows={3}
              />
            </div>

            {/* Fiscal Fields Card - Only shown when fiscal mode is active */}
            {modoFiscalAtivo && (
              <div className="mt-4">
                <FiscalFieldsCard
                  data={fiscalData}
                  onChange={setFiscalData}
                  type="produto"
                />
              </div>
            )}
          </div>
        </div>

        {/* Items Tabs with Progress Indicators */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Composição do Produto</h2>
            <p className="text-sm text-muted-foreground">
              {productItems?.length || 0} itens configurados
            </p>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Enhanced Tab Navigation */}
            <div className="bg-muted/50 rounded-xl p-1.5">
              <TabsList className="w-full h-auto bg-transparent gap-1">
                {itemTypeTabs.map((tab, index) => {
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
                {/* Actions bar with navigation hints */}
                <div className="flex justify-between items-center gap-2 mb-4">
                  <p className="text-sm text-muted-foreground">
                    {getItemsByType(tab.value).length === 0 
                      ? `Adicione ${tab.label.toLowerCase()} à composição`
                      : `${getItemsByType(tab.value).length} ${tab.label.toLowerCase()} configurados`
                    }
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setIsCopyCompositionOpen(true)}
                    >
                      <Layers className="w-4 h-4" />
                      Copiar Composição de outro Produto
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={() => setIsAddItemDialogOpen(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar item
                    </Button>
                  </div>
                </div>


              {/* Items grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {getItemsByType(tab.value).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleEditItem(item)}
                    className="bg-card border rounded-lg p-4 relative group hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
                  >
                    {/* Menu button */}
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
                      {item.item_template?.image_url ? (
                        <img
                          src={getStorageUrl(item.item_template.image_url)}
                          alt={item.item_template.name}
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
                      {item.item_template?.name}
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
                        {item.side && (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              Lado: {item.side}
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
                        {item.side && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                            Lado: {item.side}
                          </span>
                        )}
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
        </div>

        {/* Sticky bottom save bar */}
        <div className="fixed bottom-0 left-0 lg:left-60 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
          <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <Button variant="outline" onClick={() => {
              const linha = product?.linha;
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
              <Button variant="outline" className="hidden sm:inline-flex">Resetar produto</Button>
              <Button onClick={() => saveProductMutation.mutate()} disabled={saveProductMutation.isPending} className="gap-2">
                {saveProductMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </div>

        {/* Copiar composição de outro produto */}
        {id && (
          <CopyCompositionDialog
            open={isCopyCompositionOpen}
            onOpenChange={setIsCopyCompositionOpen}
            productTemplateId={id}
            companyId={isSaasAdmin ? null : (currentCompany?.id ?? null)}
          />
        )}

        {/* Add Item Dialog */}

        <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Item ao Produto</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Tab navigation inside dialog */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {itemTypeTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setActiveTab(tab.value);
                      setSelectedItemToAdd('');
                    }}
                    className={cn(
                      "flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all",
                      activeTab === tab.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              
              {/* Filtro por Linha */}
              {availableLinhas.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Filtrar por Linha</Label>
                  <Select value={linhaFilter} onValueChange={setLinhaFilter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Todas as linhas" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50 max-h-[260px]">
                      <SelectItem value="__all__">Todas as linhas</SelectItem>
                      {availableLinhas.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {linhaFilter !== '__all__' && (
                    <p className="text-[11px] text-muted-foreground">
                      Mostrando {filteredAvailableItems.length} item(ns) da linha <strong>{linhaFilter}</strong>.
                    </p>
                  )}
                </div>
              )}

              {/* Item selection with search */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Selecione o item:
                  {product?.linha && (
                    <span className="ml-2 text-xs text-primary font-normal">
                      (Itens da linha "{product.linha}" aparecem primeiro)
                    </span>
                  )}
                </Label>
                <Select value={selectedItemToAdd} onValueChange={setSelectedItemToAdd}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Clique para escolher um item" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50 max-h-[400px]">
                    {filteredAvailableItems?.map((item, index) => {
                      const isProductLinha = item.linha === product?.linha;
                      const prevItem = index > 0 ? filteredAvailableItems[index - 1] : null;
                      const showSeparator = prevItem && prevItem.linha !== item.linha;
                      const isFirstOfProductLinha = isProductLinha && (!prevItem || prevItem.linha !== item.linha);
                      
                      return (
                        <div key={item.id}>
                          {isFirstOfProductLinha && (
                            <div className="px-2 py-1.5 text-xs font-semibold text-primary bg-primary/10 border-b">
                              ⭐ Itens da linha {product?.linha}
                            </div>
                          )}
                          {showSeparator && !isFirstOfProductLinha && (
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-y">
                              {item.linha || 'Sem Linha'}
                            </div>
                          )}
                          <SelectItem 
                            value={item.id} 
                            className={cn(
                              "py-2",
                              isProductLinha && "bg-primary/5"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {/* Item image */}
                              <div className="w-10 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                                {item.image_url ? (
                                  <img 
                                    src={item.image_url.startsWith('http') ? item.image_url : item.image_url.startsWith('/') ? item.image_url : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/item-templates/${item.image_url}`}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                    —
                                  </div>
                                )}
                              </div>
                              {/* Item info */}
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate">{item.name}</span>
                                {item.linha && (
                                  <span className={cn(
                                    "text-xs",
                                    isProductLinha 
                                      ? "text-primary font-medium"
                                      : "text-muted-foreground"
                                  )}>
                                    {item.linha}
                                  </span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        </div>
                      );
                    })}
                    {!availableItems?.length && (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        Nenhum item disponível para esta categoria
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Side Selection for Multi-side products */}
              {formData.has_multiple_sides && (
                <div className="space-y-2">
                  <Label>Lado</Label>
                  <Select value={side || 'A'} onValueChange={setSide}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="A">Lado A</SelectItem>
                      <SelectItem value="B">Lado B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show GlassFormulaEditor for glass items, FormulaEditor for others */}
              {activeTab === 'glass' ? (
                <>
                  {/* Glass Name Input */}
                  <div className="space-y-2">
                    <Label>Nome do Vidro (opcional)</Label>
                    <Input
                      placeholder="Ex: Vidro Fixo, Vidro Móvel, Bandeira..."
                      value={glassName}
                      onChange={(e) => setGlassName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Identifique o vidro para facilitar no plano de corte
                    </p>
                  </div>
                  
                  <GlassFormulaEditor
                    widthFormula={widthFormula}
                    heightFormula={heightFormula}
                    onWidthFormulaChange={setWidthFormula}
                    onHeightFormulaChange={setHeightFormula}
                    showPiecesQuantity={true}
                    piecesQuantity={piecesQuantity}
                    onPiecesChange={setPiecesQuantity}
                    piecesFormula={piecesFormula}
                    onPiecesFormulaChange={setPiecesFormula}
                  />

                  <FormulaEditor
                    value={quantityFormula}
                    onChange={setQuantityFormula}
                    showPiecesQuantity={false}
                    piecesQuantity={piecesQuantity}
                    onPiecesChange={setPiecesQuantity}
                    piecesFormula={piecesFormula}
                    onPiecesFormulaChange={setPiecesFormula}
                  />
                </>
              ) : (
                <FormulaEditor
                  value={quantityFormula}
                  onChange={setQuantityFormula}
                  showPiecesQuantity={activeTab === 'profile'}
                  piecesQuantity={piecesQuantity}
                  onPiecesChange={setPiecesQuantity}
                  piecesFormula={piecesFormula}
                  onPiecesFormulaChange={setPiecesFormula}
                />
              )}
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddItemDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddItem}
                  disabled={!selectedItemToAdd || addItemMutation.isPending}
                >
                  {addItemMutation.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {editingItem?.item_template?.image_url && (
                  <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                    <img
                      src={getStorageUrl(editingItem.item_template.image_url)}
                      alt={editingItem.item_template.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                Editar {editingItem?.item_template?.name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Side Selection for Multi-side products */}
              {formData.has_multiple_sides && (
                <div className="space-y-2">
                  <Label>Lado</Label>
                  <Select value={side || 'A'} onValueChange={setSide}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="A">Lado A</SelectItem>
                      <SelectItem value="B">Lado B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show GlassFormulaEditor for glass items, FormulaEditor for others */}
              {editingItem?.item_template?.type === 'glass' ? (
                <>
                  {/* Glass Name Input */}
                  <div className="space-y-2">
                    <Label>Nome do Vidro (opcional)</Label>
                    <Input
                      placeholder="Ex: Vidro Fixo, Vidro Móvel, Bandeira..."
                      value={glassName}
                      onChange={(e) => setGlassName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Identifique o vidro para facilitar no plano de corte
                    </p>
                  </div>
                  
                  <GlassFormulaEditor
                    widthFormula={widthFormula}
                    heightFormula={heightFormula}
                    onWidthFormulaChange={setWidthFormula}
                    onHeightFormulaChange={setHeightFormula}
                    showPiecesQuantity={true}
                    piecesQuantity={piecesQuantity}
                    onPiecesChange={setPiecesQuantity}
                    piecesFormula={piecesFormula}
                    onPiecesFormulaChange={setPiecesFormula}
                  />

                  <FormulaEditor
                    value={quantityFormula}
                    onChange={setQuantityFormula}
                    showPiecesQuantity={false}
                    piecesQuantity={piecesQuantity}
                    onPiecesChange={setPiecesQuantity}
                    piecesFormula={piecesFormula}
                    onPiecesFormulaChange={setPiecesFormula}
                  />
                </>
              ) : (
                <>
                  <FormulaEditor
                    value={quantityFormula}
                    onChange={setQuantityFormula}
                    showPiecesQuantity={editingItem?.item_template?.type === 'profile'}
                    piecesQuantity={piecesQuantity}
                    onPiecesChange={setPiecesQuantity}
                    piecesFormula={piecesFormula}
                    onPiecesFormulaChange={setPiecesFormula}
                  />
                  
                  {/* Cut Angle for profiles */}
                  {editingItem?.item_template?.type === 'profile' && (
                    <div className="space-y-2">
                      <Label>Ângulo de corte</Label>
                      <div className="flex gap-2">
                        {[45, 90].map((angle) => (
                          <Button
                            key={angle}
                            type="button"
                            variant={cutAngle === angle ? 'default' : 'outline'}
                            onClick={() => setCutAngle(angle)}
                            className="flex-1"
                          >
                            {angle}°
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleUpdateItem}
                  disabled={updateItemMutation.isPending}
                >
                  {updateItemMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
