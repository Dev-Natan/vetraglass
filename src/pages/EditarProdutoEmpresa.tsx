import { useState, useEffect, useMemo } from 'react';
import { resolveImageUrl, resolveProductImageUrl } from '@/utils/imageUrl';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { ArrowLeft, Upload, Trash2, Plus, ChevronRight, Home, Package, CheckCircle2, Circle, RotateCcw, DollarSign, Calculator, Info, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { processFileWithWhiteBackground } from '@/utils/imageBackgroundProcessor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { FormulaEditor } from '@/components/produtos/FormulaEditor';
import { GlassFormulaEditor } from '@/components/produtos/GlassFormulaEditor';
import { ProductConfigPanel, ProductConfigData } from '@/components/produtos/ProductConfigPanel';
import { ProductCompositionPricing } from '@/components/produtos/ProductCompositionPricing';
import { ParametricEngineeringRulesPanel } from '@/components/produtos/ParametricEngineeringRulesPanel';

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
    composition_mode: string;
  } | null;
};

type CompanyProductItem = {
  id: string;
  company_product_id: string;
  item_template_id: string | null;
  company_item_id: string | null;
  quantity_formula: string;
  pieces_formula: string | null;
  width_formula: string | null;
  height_formula: string | null;
  is_optional: boolean | null;
  notes: string | null;
  sort_order: number | null;
  cut_angle: number | null;
  pieces_quantity: number | null;
  side: string | null;
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
  const [addItemSection, setAddItemSection] = useState<'profile' | 'accessory' | 'glass' | 'rubber' | 'contramarco'>('glass');
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [linhaFilter, setLinhaFilter] = useState<string>('__all__');
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isCopyCompositionOpen, setIsCopyCompositionOpen] = useState(false);
  const [copySourceProductId, setCopySourceProductId] = useState<string>('');
  
  const [editingItem, setEditingItem] = useState<CompanyProductItem | null>(null);
  const [selectedItemToAdd, setSelectedItemToAdd] = useState('');
  const [selectedFormulaIndex, setSelectedFormulaIndex] = useState<number>(0);
  const [quantityFormula, setQuantityFormula] = useState('1');
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [cutAngle, setCutAngle] = useState(90);
  const [piecesFormula, setPiecesFormula] = useState<string | null>(null);
  const [widthFormula, setWidthFormula] = useState('');
  const [heightFormula, setHeightFormula] = useState('');
  const [glassName, setGlassName] = useState('');
  const [side, setSide] = useState<string | null>(null);
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
          product_template:product_templates(id, name, image_url, linha, composition_mode)
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
            product_template:product_templates(id, name, image_url, linha, composition_mode)
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

  // Fetch product items (company-specific overrides)
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
      return data as unknown as CompanyProductItem[];
    },
    enabled: !!id,
  });

  // Fetch inherited default composition (admin template) — used when the company
  // hasn't customized this product yet. Copy-on-write: any edit materializes these.
  const inheritanceEnabled = !!product?.product_template_id && (productItems?.length ?? 0) === 0;
  const { data: templateItems } = useQuery({
    queryKey: ['product-template-items-inherit', product?.product_template_id],
    enabled: inheritanceEnabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_template_items')
        .select(`
          *,
          item_template:item_templates(id, name, type, unit, image_url, linha)
        `)
        .eq('product_template_id', product!.product_template_id!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const isInherited = inheritanceEnabled && (templateItems?.length ?? 0) > 0;

  // Virtual items projected from the admin template so the UI renders the
  // default composition until the company makes its first change.
  const displayItems: CompanyProductItem[] = useMemo(() => {
    if (!isInherited) return productItems || [];
    return (templateItems || []).map((ti: any) => ({
      id: `virt_${ti.id}`,
      company_product_id: id!,
      item_template_id: ti.item_template_id,
      company_item_id: null,
      quantity_formula: ti.quantity_formula ?? '1',
      pieces_formula: ti.pieces_formula ?? null,
      width_formula: ti.width_formula ?? null,
      height_formula: ti.height_formula ?? null,
      is_optional: ti.is_optional ?? false,
      notes: ti.notes ?? null,
      sort_order: ti.sort_order ?? 0,
      cut_angle: ti.cut_angle ?? 90,
      pieces_quantity: ti.pieces_quantity ?? 1,
      side: ti.side ?? null,
      item_template: ti.item_template ?? null,
      company_item: null,
      _inherited: true,
    } as CompanyProductItem & { _inherited: boolean }));
  }, [isInherited, templateItems, productItems, id]);

  // Copy-on-write: on first modification, snapshot admin template into
  // company_product_items so the company owns its composition from then on.
  const ensureMaterialized = async (): Promise<Array<{ id: string; item_template_id: string | null }>> => {
    if (!isInherited || !templateItems || !id) {
      return (productItems || []).map(p => ({ id: p.id, item_template_id: p.item_template_id }));
    }
    const rows = templateItems.map((ti: any, idx: number) => ({
      company_product_id: id,
      item_template_id: ti.item_template_id,
      name: ti.name,
      type: ti.type,
      unit: ti.unit,
      image_url: ti.image_url,
      section: ti.section,
      side: ti.side,
      is_optional: ti.is_optional,
      bar_length_mm: ti.bar_length_mm,
      cut_angle: ti.cut_angle,
      pieces_quantity: ti.pieces_quantity,
      width_formula: ti.width_formula,
      height_formula: ti.height_formula,
      quantity_formula: ti.quantity_formula ?? '1',
      sort_order: ti.sort_order ?? idx,
    }));
    const { data, error } = await supabase
      .from('company_product_items')
      .insert(rows as never)
      .select('id, item_template_id');
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
    return (data || []) as Array<{ id: string; item_template_id: string | null }>;
  };

  // Other company products that already have a customized composition,
  // used as source options in the "Copiar composição" dialog.
  const { data: copySourceProducts } = useQuery({
    queryKey: ['copy-source-products', currentCompany?.id, id],
    enabled: !!currentCompany?.id && isCopyCompositionOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_products')
        .select('id, commercial_name, linha, product_template:product_templates(name), company_product_items(id)')
        .eq('company_id', currentCompany!.id)
        .neq('id', id!)
        .eq('is_active', true)
        .order('commercial_name');
      if (error) throw error;
      return (data as any[])
        .filter(p => (p.company_product_items?.length ?? 0) > 0)
        .map(p => ({
          id: p.id as string,
          name: (p.commercial_name || p.product_template?.name || 'Sem nome') as string,
          linha: (p.linha || '') as string,
          itemCount: p.company_product_items.length as number,
        }));
    },
  });

  // Clone all composition items from another company product into this one.
  const copyCompositionMutation = useMutation({
    mutationFn: async (sourceProductId: string) => {
      if (!id) throw new Error('Produto inválido');
      const { data: sourceItems, error: srcErr } = await supabase
        .from('company_product_items')
        .select('*')
        .eq('company_product_id', sourceProductId)
        .order('sort_order', { ascending: true });
      if (srcErr) throw srcErr;
      if (!sourceItems || sourceItems.length === 0) throw new Error('Produto de origem sem itens');

      // If this product is still inheriting from admin template, drop the
      // virtual inheritance by materializing nothing — we replace with the copy.
      // We do NOT delete existing real items — clone is additive to allow merge.
      const baseSort = (productItems?.length || 0);
      const rows = sourceItems.map((it: any, idx: number) => {
        const { id: _oldId, company_product_id: _oldPid, created_at, updated_at, ...rest } = it;
        return {
          ...rest,
          company_product_id: id,
          sort_order: baseSort + idx + 1,
        };
      });

      const { error: insErr } = await supabase
        .from('company_product_items')
        .insert(rows as never);
      if (insErr) throw insErr;
      return rows.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
      if (id) recalculateProductPrice(id);
      toast.success(`${count} itens copiados para a composição!`);
      setIsCopyCompositionOpen(false);
      setCopySourceProductId('');
    },
    onError: (error: any) => {
      toast.error('Erro ao copiar composição: ' + (error?.message || 'desconhecido'));
    },
  });

  // Fetch available item templates for adding
  const { data: availableItems } = useQuery({
    queryKey: ['item-templates-by-type', addItemSection, product?.linha, currentCompany?.id],
    enabled: !!currentCompany?.id,
    queryFn: async () => {
      const dbType = addItemSection === 'contramarco' ? 'profile' : addItemSection === 'rubber' ? 'accessory' : addItemSection;
      
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .eq('type', dbType as "accessory" | "glass" | "profile" | "service")
        .eq('is_active', true)
        .or(`company_id.is.null,company_id.eq.${currentCompany!.id}`)
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
          composition_finished: formData.composition_finished,
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

      // COPY-ON-WRITE: if this product is still inheriting from the admin
      // template, snapshot the template into the company scope before adding.
      const materialized = await ensureMaterialized();

      const isContramarco = addItemSection === 'contramarco';
      const insertData = {
        company_id: currentCompany.id,
        company_product_id: id,
        item_template_id: selectedItemToAdd,
        company_item_id: companyItemId,
        quantity_formula: quantityFormula,
        pieces_quantity: piecesQuantity,
        pieces_formula: piecesFormula,
        is_optional: isContramarco ? true : false,
        cut_angle: cutAngle,
        side: side,
        width_formula: addItemSection === 'glass' ? (widthFormula || null) : null,
        height_formula: addItemSection === 'glass' ? (heightFormula || null) : null,
        notes: addItemSection === 'glass' ? (glassName || null) : null,
        sort_order: (materialized.length || productItems?.length || 0) + 1,
        section: isContramarco ? 'contramarco' : null,
      };

      const { error } = await supabase
        .from('company_product_items')
        .insert(insertData as never);
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
      let targetId = itemId;
      // If we're removing an inherited (virtual) item, materialize the
      // template into company scope first, then delete the equivalent row.
      if (itemId.startsWith('virt_')) {
        const templateItemId = itemId.slice(5);
        const source = (templateItems || []).find((t: any) => t.id === templateItemId);
        const rows = await ensureMaterialized();
        const match = rows.find(r => r.item_template_id === source?.item_template_id);
        if (!match) throw new Error('Item herdado não encontrado após materialização');
        targetId = match.id;
      }
      const { error } = await supabase
        .from('company_product_items')
        .delete()
        .eq('id', targetId);
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



  // Reset item to template default
  const resetItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('reset_company_product_item', {
        p_company_product_item_id: itemId,
      });
      if (error) throw error;
      return data as { success: boolean; action?: string; error?: string };
    },
    onSuccess: (res) => {
      if (!res?.success) {
        toast.error(res?.error || 'Erro ao restaurar item');
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
      queryClient.invalidateQueries({ queryKey: ['company-product', id] });
      if (id) recalculateProductPrice(id);
      toast.success(res.action === 'reset' ? 'Item restaurado ao padrão!' : 'Item removido (não existe no template)');
    },
    onError: (error: Error) => toast.error('Erro ao restaurar: ' + error.message),
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
        updateData.side = side;
      } else {
        updateData.quantity_formula = quantityFormula;
        updateData.pieces_quantity = piecesQuantity;
        updateData.pieces_formula = piecesFormula || null;
        updateData.cut_angle = cutAngle;
        updateData.side = side;
      }
      // Copy-on-write: if editing an inherited item, materialize first and
      // redirect the update to the newly-created company row.
      let targetId = editingItem.id;
      if (targetId.startsWith('virt_')) {
        const rows = await ensureMaterialized();
        const match = rows.find(r => r.item_template_id === editingItem.item_template_id);
        if (!match) throw new Error('Item herdado não encontrado após materialização');
        targetId = match.id;
      }
      const { error } = await supabase
        .from('company_product_items')
        .update(updateData as never)
        .eq('id', targetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-product-items', id] });
      if (id) recalculateProductPrice(id);
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
    setSelectedFormulaIndex(0);
    setQuantityFormula('1');
    setPiecesQuantity(1);
    setPiecesFormula(null);
    setCutAngle(90);
    setWidthFormula('');
    setHeightFormula('');
    setGlassName('');
    setSide(null);
    setItemSearchQuery('');
  };

  const normalizePos = (raw: unknown): 'Largura' | 'Altura' => {
    const s = String(raw ?? '').toLowerCase();
    return s === 'height' || s === 'altura' ? 'Altura' : 'Largura';
  };

  /** Lista de fórmulas pré-cadastradas válidas do item atualmente selecionado. */
  const selectedItemFormulas = useMemo(() => {
    const item = availableItems?.find(i => i.id === selectedItemToAdd);
    const arr = Array.isArray(item?.default_formulas) ? (item!.default_formulas as any[]) : [];
    return arr.filter((f) => f && String(f.formula || '').trim());
  }, [availableItems, selectedItemToAdd]);

  /** Aplica uma entrada de fórmula ao formulário. */
  const applyFormulaEntry = (entry: any) => {
    if (!entry) return;
    const formulaStr = String(entry.formula || '').trim();
    const isHeight = normalizePos(entry.position) === 'Altura';
    if (addItemSection === 'glass') {
      if (isHeight) setHeightFormula(formulaStr);
      else setWidthFormula(formulaStr);
    } else {
      if (formulaStr) setQuantityFormula(formulaStr);
      if (entry.pieces != null && String(entry.pieces).trim()) {
        setPiecesFormula(String(entry.pieces).trim());
      }
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemToAdd(itemId);
    setSelectedFormulaIndex(0);
    const item = availableItems?.find(i => i.id === itemId);
    const formulas = Array.isArray(item?.default_formulas) ? (item!.default_formulas as any[]) : [];
    if (formulas.length === 0) return;
    if (addItemSection === 'glass') {
      const wf = formulas.find((f) => normalizePos(f.position) === 'Largura');
      const hf = formulas.find((f) => normalizePos(f.position) === 'Altura');
      if (wf) applyFormulaEntry(wf);
      if (hf) applyFormulaEntry(hf);
    } else {
      applyFormulaEntry(formulas[0]);
    }
  };

  // Linhas disponíveis derivadas dos itens carregados (apenas perfis/contramarco usam)
  const availableLinhas = useMemo(() => {
    if (!availableItems) return [] as string[];
    const set = new Set<string>();
    availableItems.forEach(i => { if (i.linha) set.add(i.linha); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [availableItems]);

  // Detecta linha do produto pelo campo linha ou pelo nome comercial
  const detectProductLinha = (): string | null => {
    const explicit = product?.linha || product?.product_template?.linha;
    if (explicit) return explicit;
    const name = (product?.commercial_name || product?.product_template?.name || '').toLowerCase();
    if (!name || !availableLinhas.length) return null;
    return availableLinhas.find(l => name.includes(l.toLowerCase())) || null;
  };

  // Auto-preenche o filtro de Linha ao abrir o diálogo (todas as seções)
  useEffect(() => {
    if (!isAddItemDialogOpen) return;
    const detected = detectProductLinha();
    setLinhaFilter(detected && availableLinhas.includes(detected) ? detected : '__all__');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddItemDialogOpen, addItemSection, availableLinhas.length, product?.id]);

  const filteredAvailableItems = useMemo(() => {
    if (!availableItems) return [];
    let list = availableItems;
    if (linhaFilter && linhaFilter !== '__all__') {
      list = list.filter(item => item.linha === linhaFilter);
    }
    if (!itemSearchQuery) return list;
    const q = itemSearchQuery.toLowerCase();
    return list.filter(
      item => item.name.toLowerCase().includes(q) || item.linha?.toLowerCase().includes(q)
    );
  }, [availableItems, itemSearchQuery, linhaFilter]);

  const handleEditItem = (item: CompanyProductItem) => {
    setEditingItem(item);
    const itemType = item.item_template?.type || item.company_item?.type;
    // Carrega TODOS os campos salvos antes de abrir o modal.
    // Preserva quantity_formula mesmo quando vier como string vazia ('' -> '1' só se realmente nulo/undefined).
    const savedFormula =
      item.quantity_formula !== null && item.quantity_formula !== undefined
        ? item.quantity_formula
        : '1';

    setQuantityFormula(savedFormula);
    setPiecesQuantity(item.pieces_quantity ?? 1);
    setPiecesFormula(item.pieces_formula ?? null);
    setCutAngle(item.cut_angle ?? 90);
    setSide(item.side ?? null);
    setWidthFormula(item.width_formula ?? '');
    setHeightFormula(item.height_formula ?? '');
    setGlassName(itemType === 'glass' ? (item.notes ?? '') : '');
    setIsEditItemDialogOpen(true);
  };

  const handleAddItem = () => {
    if (addItemSection === 'glass') {
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
    const itemType = editingItem?.item_template?.type || editingItem?.company_item?.type;
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
    return displayItems?.filter((item) => {
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

        {product.product_template_id
          && product.product_template?.composition_mode === 'parametric'
          && currentCompany?.id && (
            <ParametricEngineeringRulesPanel
              companyId={currentCompany.id}
              productTemplateId={product.product_template_id}
            />
          )}

        {/* Composição do Produto — split view idêntico ao admin */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Composição do Produto</h2>
            <p className="text-sm text-muted-foreground">
              {productItems?.length || 0} itens configurados
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,32%)_1fr] gap-4">
            {/* LEFT — Aside: adicionar item */}
            <aside className="lg:sticky lg:top-0 self-start bg-card border rounded-xl p-4 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Plus className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">Adicionar {addItemSection === 'glass' ? 'Vidro' : addItemSection === 'profile' ? 'Perfil' : addItemSection === 'contramarco' ? 'Contramarco' : 'Componente'}</h3>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 h-8 text-xs"
                onClick={() => setIsCopyCompositionOpen(true)}
              >
                <Layers className="w-3.5 h-3.5" />
                Copiar de outro produto
              </Button>

              {availableLinhas.length > 0 && (addItemSection === 'profile' || addItemSection === 'contramarco') && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Filtrar por Linha</Label>
                  <Select value={linhaFilter} onValueChange={setLinhaFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas as linhas" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50 max-h-[260px]">
                      <SelectItem value="__all__">Todas as linhas</SelectItem>
                      {availableLinhas.map(l => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Buscar item</Label>
                <Input
                  placeholder="Pesquisar..."
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  className="h-9"
                />
                <div className="max-h-[220px] overflow-y-auto rounded-md border bg-muted/20 p-1.5 space-y-0.5">
                  {filteredAvailableItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum item</p>
                  ) : filteredAvailableItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors',
                        selectedItemToAdd === item.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                      )}
                    >
                      <div className="w-7 h-7 rounded border bg-muted flex-shrink-0 flex items-center justify-center overflow-hidden">
                        {item.image_url ? (
                          <img src={getStorageUrl(item.image_url)} alt={item.name} className="w-full h-full object-contain" />
                        ) : <span className="text-[10px]">📦</span>}
                      </div>
                      <span className="text-xs truncate flex-1">{item.name}</span>
                      {item.linha && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">{item.linha}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {selectedItemToAdd && selectedItemFormulas.length > 0 && addItemSection !== 'glass' && (
                <div className="space-y-1.5 p-2 rounded-md border border-primary/30 bg-primary/5">
                  <Label className="text-xs font-medium">Fórmula pré-cadastrada ({selectedItemFormulas.length})</Label>
                  <Select
                    value={String(selectedFormulaIndex)}
                    onValueChange={(v) => {
                      const idx = parseInt(v);
                      setSelectedFormulaIndex(idx);
                      applyFormulaEntry(selectedItemFormulas[idx]);
                    }}
                  >
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {selectedItemFormulas.map((f: any, idx: number) => {
                        const pos = normalizePos(f.position);
                        const label = f.label && String(f.label).trim() ? String(f.label).trim() : pos;
                        return (
                          <SelectItem key={idx} value={String(idx)}>
                            <span className="text-xs">
                              <span className="font-medium">{label}</span>
                              <span className="text-muted-foreground"> · {pos}</span>
                              <code className="ml-1 text-[10px] font-mono">{f.formula}</code>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedItemToAdd && (
                <>
                  {addItemSection === 'glass' ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome do vidro (opcional)</Label>
                        <Input value={glassName} onChange={(e) => setGlassName(e.target.value)} placeholder="Ex: Vidro fixo" className="h-9" />
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
                    </>
                  ) : (
                    <FormulaEditor
                      value={quantityFormula}
                      onChange={setQuantityFormula}
                      showPiecesQuantity={addItemSection === 'profile' || addItemSection === 'accessory' || addItemSection === 'rubber' || addItemSection === 'contramarco'}
                      piecesQuantity={piecesQuantity}
                      onPiecesChange={setPiecesQuantity}
                      piecesFormula={piecesFormula}
                      onPiecesFormulaChange={setPiecesFormula}
                    />
                  )}

                  {(addItemSection === 'profile' || addItemSection === 'contramarco') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Ângulo de corte</Label>
                      <div className="flex gap-2">
                        {[45, 90].map(angle => (
                          <Button
                            key={angle}
                            type="button"
                            variant={cutAngle === angle ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCutAngle(angle)}
                            className="flex-1 h-8"
                          >
                            {angle}°
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs">Lado / Posição</Label>
                    <div className="flex gap-1 flex-wrap">
                      {[
                        { value: null, label: 'Ambos' },
                        { value: 'A', label: 'A' },
                        { value: 'B', label: 'B' },
                        { value: 'C', label: 'C' },
                      ].map(option => (
                        <Button
                          key={String(option.value)}
                          type="button"
                          variant={side === option.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSide(option.value)}
                          className="flex-1 min-w-[50px] h-8"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleAddItem}
                    disabled={!selectedItemToAdd || addItemMutation.isPending}
                    className="w-full gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {addItemMutation.isPending ? 'Adicionando...' : 'Adicionar à composição'}
                  </Button>
                </>
              )}
            </aside>

            {/* RIGHT — Category pills + grid */}
            <section className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-1.5">
                <div className="flex flex-wrap gap-1">
                  {itemTypeTabs.map((tab) => {
                    const itemCount = getItemsByType(tab.value).length;
                    const isActive = activeTab === tab.value;
                    const hasItems = itemCount > 0;
                    return (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => { setActiveTab(tab.value); setAddItemSection(tab.value as any); resetItemForm(); }}
                        className={cn(
                          'flex-1 min-w-[110px] py-2.5 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : hasItems
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100'
                              : 'text-muted-foreground hover:bg-background'
                        )}
                      >
                        <div className="flex items-center justify-center gap-2">
                          {hasItems ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          <span className="hidden sm:inline">{tab.label}</span>
                          <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full',
                            isActive ? 'bg-primary-foreground/20' : hasItems ? 'bg-green-600/20' : 'bg-muted'
                          )}>{itemCount}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {(() => {
                  const items = getItemsByType(activeTab);
                  if (items.length === 0) {
                    return (
                      <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                        <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhum item nesta categoria. Use o painel à esquerda para adicionar.</p>
                      </div>
                    );
                  }
                  return items.map((item) => {
                    const template = item.item_template || item.company_item;
                    const isGlass = activeTab === 'glass';
                    const isProfile = activeTab === 'profile';
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleEditItem(item)}
                        className="bg-card border rounded-lg p-3 relative group hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
                      >
                        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          {canReset && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-6 h-6"
                              onClick={(e) => { e.stopPropagation(); resetItemMutation.mutate(item.id); }}
                              title="Restaurar padrão"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-6 h-6 text-destructive"
                            onClick={(e) => { e.stopPropagation(); removeItemMutation.mutate(item.id); }}
                            title="Remover"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <div className="aspect-square rounded-lg mb-2 flex items-center justify-center overflow-hidden bg-muted/30">
                          {template?.image_url ? (
                            <img src={getStorageUrl(template.image_url)} alt={template.name} className="w-full h-full object-contain" />
                          ) : <span className="text-2xl opacity-30">📦</span>}
                        </div>

                        {isGlass && item.notes && (
                          <h4 className="font-bold text-sm text-foreground truncate text-center mb-0.5">{item.notes}</h4>
                        )}
                        <h4 className={cn(
                          'font-medium text-xs truncate text-center',
                          isGlass && item.notes ? 'text-muted-foreground' : 'text-primary'
                        )}>{template?.name}</h4>

                        <div className="flex flex-wrap justify-center gap-1 mt-2">
                          {isGlass && item.width_formula && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">L: {item.width_formula}</span>
                          )}
                          {isGlass && item.height_formula && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">A: {item.height_formula}</span>
                          )}
                          {!isGlass && item.quantity_formula && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground truncate max-w-full">{item.quantity_formula}</span>
                          )}
                          {item.side && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">Lado {item.side}</span>
                          )}
                          {isProfile && (
                            <>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{item.pieces_quantity || 1}x</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{item.cut_angle || 90}°</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </section>
          </div>
        </div>


        {/* Composition-Based Pricing (Visible if composition selected) */}
        {pricingType === 'composition' && (
          <ProductCompositionPricing
            productId={id!}
            onSuccess={(cost, price) => {
              setCostPerSqm(cost);
              setPricePerSqm(price);
            }}
            productItems={displayItems || []}
            currentCostPerSqm={product.cost_per_sqm}
            currentPricePerSqm={product.price_per_sqm}
            currentMargin={product.margin_percent}
          />
        )}
      </div>


      {/* Edit Item Dialog */}
      <Dialog open={isEditItemDialogOpen} onOpenChange={setIsEditItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Item</DialogTitle><DialogDescription>{editingItem?.item_template?.name || editingItem?.company_item?.name}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {(() => {
              const itemType = editingItem?.item_template?.type || editingItem?.company_item?.type;
              const isGlass = itemType === 'glass';
              return (
                <>
                  {isGlass ? (
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
                  ) : (
                    <FormulaEditor
                      value={quantityFormula}
                      onChange={setQuantityFormula}
                      showPiecesQuantity={true}
                      piecesQuantity={piecesQuantity}
                      onPiecesChange={setPiecesQuantity}
                      piecesFormula={piecesFormula}
                      onPiecesFormulaChange={setPiecesFormula}
                    />
                  )}

                  {!isGlass && itemType === 'profile' && (
                    <div className="space-y-2">
                      <Label>Ângulo de corte</Label>
                      <div className="flex gap-2">
                        {[45, 90].map(angle => (
                          <Button
                            key={angle}
                            type="button"
                            variant={cutAngle === angle ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCutAngle(angle)}
                            className="flex-1"
                          >
                            {angle}°
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 border-t pt-4">
                    <Label>Lado / Posição</Label>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { value: null, label: 'Ambos' },
                        { value: 'A', label: 'Lado A' },
                        { value: 'B', label: 'Lado B' },
                        { value: 'C', label: 'Lado C' },
                      ].map(option => (
                        <Button
                          key={String(option.value)}
                          type="button"
                          variant={side === option.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSide(option.value)}
                          className="flex-1 min-w-[70px]"
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateItem} disabled={updateItemMutation.isPending}>{updateItemMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
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

      <Dialog open={isCopyCompositionOpen} onOpenChange={(v) => { setIsCopyCompositionOpen(v); if (!v) setCopySourceProductId(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Layers className="w-5 h-5 text-primary" /> Copiar composição</DialogTitle>
            <DialogDescription>
              Selecione um produto de origem. Todos os itens da composição dele (perfis, vidros, componentes, contramarco) serão clonados para este produto, com fórmulas e quantidades preservadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs">Produto de origem</Label>
            {(!copySourceProducts || copySourceProducts.length === 0) ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum outro produto desta empresa possui composição configurada.
              </p>
            ) : (
              <div className="max-h-[320px] overflow-y-auto rounded-md border bg-muted/20 p-1.5 space-y-0.5">
                {copySourceProducts.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setCopySourceProductId(p.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center justify-between gap-2",
                      copySourceProductId === p.id ? "bg-primary/10 border border-primary/40" : "hover:bg-muted"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      {p.linha && <div className="text-xs text-muted-foreground truncate">{p.linha}</div>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{p.itemCount} itens</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyCompositionOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => copySourceProductId && copyCompositionMutation.mutate(copySourceProductId)}
              disabled={!copySourceProductId || copyCompositionMutation.isPending}
            >
              {copyCompositionMutation.isPending ? 'Copiando...' : 'Copiar composição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
