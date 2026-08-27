import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { processFileWithWhiteBackground } from '@/utils/imageBackgroundProcessor';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Loader2, Plus, Pencil, Trash2, Search, Package, Upload, X, MoreVertical,
  Eye, EyeOff, Copy, DollarSign, Ruler, ImageUp, CheckCircle2, XCircle,
  AlertCircle, LayoutGrid, LayoutList, Image, ChevronDown, ChevronRight, ArrowLeft
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useItemTypeLabels } from '@/hooks/useItemTypes';
import { useProductLinhas } from '@/hooks/useProductLinhas';
import { LinhaCardSimple } from '@/components/produtos/LinhaCardSimple';
import { ProfileColorPricesSection } from '@/components/admin/product-templates/ProfileColorPricesSection';
import { LENGTH_FORMULA_PRESETS, PIECES_FORMULA_PRESETS } from '@/utils/formulaPresets';

interface DefaultFormulaEntry {
  label?: string | null;           // Rótulo livre (ex: "Vertical externo", "Travessa superior")
  position: string;                // 'Largura' | 'Altura' (normalizado)
  formula: string;                 // fórmula do comprimento
  pieces?: string | null;          // qtd de peças (ex: "2", "N", "N*2")
  cutAngleStart?: number | null;   // ângulo início (°)
  cutAngleEnd?: number | null;     // ângulo fim (°)
}

interface ItemTemplate {
  id: string;
  name: string;
  description: string | null;
  type: 'glass' | 'profile' | 'accessory' | 'service';
  unit: string;
  linha: string | null;
  category_id: string | null;
  line_id: string | null;
  default_price: number;
  weight_per_meter: number | null;
  weight_per_bar: number | null;
  default_cost: number | null;
  default_sale_price: number | null;
  bar_length_mm: number | null;
  specifications: unknown;
  image_url: string | null;
  is_active: boolean;
  default_formulas: DefaultFormulaEntry[] | unknown | null;
  created_at: string;
}

/** Normaliza a posição para 'Largura' | 'Altura'. */
function normalizePosition(raw: unknown): 'Largura' | 'Altura' {
  const s = String(raw ?? '').toLowerCase();
  return s === 'height' || s === 'altura' ? 'Altura' : 'Largura';
}

/** Lê o array bruto de default_formulas normalizando os campos. */
function readFormulasArray(raw: unknown): DefaultFormulaEntry[] {
  const arr = Array.isArray(raw) ? (raw as any[]) : [];
  return arr
    .filter((f) => f && typeof f === 'object')
    .map((f) => ({
      label: typeof f.label === 'string' && f.label.trim() ? f.label : null,
      position: normalizePosition(f.position),
      formula: typeof f.formula === 'string' ? f.formula : '',
      pieces: f.pieces != null && String(f.pieces).trim() !== '' ? String(f.pieces) : null,
      cutAngleStart: typeof f.cutAngleStart === 'number' ? f.cutAngleStart : 90,
      cutAngleEnd: typeof f.cutAngleEnd === 'number' ? f.cutAngleEnd : 90,
    }));
}

const unitLabels: Record<string, string> = {
  'm²': 'Metro Quadrado',
  'm': 'Metro Linear',
  'un': 'Unidade',
  'kg': 'Quilograma',
  'pç': 'Peça',
  'barra': 'Barra',
};

export default function ItemTemplates() {
  const { isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { labels: typeLabels, colors: typeColors, itemTypes } = useItemTypeLabels();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLinha, setFilterLinha] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'grouped'>('grouped');
  const [expandedLinhas, setExpandedLinhas] = useState<Set<string>>(new Set());
  
  const [page, setPage] = useState(1);
  const pageSize = 200;
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemTemplate | null>(null);
  
  const defaultFormData = {
    name: '',
    description: '',
    type: 'profile' as 'glass' | 'profile' | 'accessory' | 'service',
    unit: 'barra',
    linha: '',
    default_price: '',
    weight_per_meter: '',
    weight_per_bar: '',
    default_cost: '',
    default_sale_price: '',
    bar_length_mm: '6000',
    specifications: '{}',
    is_active: true,
    formulas: [] as DefaultFormulaEntry[],
  };
  const [formData, setFormData] = useState(defaultFormData);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{
    total: number;
    processed: number;
    matched: number;
    notMatched: string[];
    isUploading: boolean;
  }>({ total: 0, processed: 0, matched: 0, notMatched: [], isUploading: false });

  // Fetch all items for the current page
  const { data: itemsData, isLoading } = useQuery({
    queryKey: ['item-templates-admin', page, pageSize, searchTerm, filterType, filterLinha, showInactive],
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      let query = supabase
        .from('item_templates')
        .select('id, name, description, type, unit, linha, category_id, line_id, default_price, weight_per_meter, weight_per_bar, default_cost, default_sale_price, bar_length_mm, specifications, image_url, is_active, default_formulas, created_at', { count: 'exact' });
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }
      if (filterType !== 'all') {
        query = query.eq('type', filterType as any);
      }
      if (filterLinha !== 'all') {
        // Case-insensitive: linhas podem estar cadastradas com caixas diferentes ("Gold" vs "gold")
        query = query.ilike('linha', filterLinha);
      }
      if (!showInactive) {
        query = query.eq('is_active', true);
      }
      
      const { data, error, count } = await query
        .order('linha', { ascending: true })
        .order('name', { ascending: true })
        .range(from, to);
        
      if (error) throw error;
      return { items: data as ItemTemplate[], total: count || 0 };
    },
    enabled: isSaasAdmin,
  });

  const items = itemsData?.items;
  const totalItems = itemsData?.total || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const { data: allProductLinhas } = useProductLinhas(true);
  const productLinhas = useMemo(
    () => (allProductLinhas || []).filter(l => l.is_active),
    [allProductLinhas]
  );

  // Busca TODOS os itens (linha + type + image_url) para cálculo de stats globais e tipos por linha
  const { data: allItemsMeta } = useQuery({
    queryKey: ['item-templates-meta-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('linha, type, image_url, default_price, is_active');
      if (error) throw error;
      return data || [];
    },
  });

  // Linhas: fonte oficial = product_linhas ATIVAS (gerenciada em /admin/categories).
  // Inclui slugs órfãos apenas se não corresponderem a uma linha DESATIVADA.
  const availableLines = useMemo(() => {
    const inactiveSlugs = new Set(
      (allProductLinhas || [])
        .filter(l => !l.is_active)
        .flatMap(l => [l.slug.toLowerCase(), l.name.toLowerCase()])
    );
    const map = new Map<string, string>();
    productLinhas.forEach(l => {
      map.set(l.slug.toLowerCase(), l.slug);
    });
    (allItemsMeta || []).forEach((r: any) => {
      const n = (r.linha || '').trim();
      if (!n) return;
      const k = n.toLowerCase();
      if (inactiveSlugs.has(k)) return;
      if (!map.has(k)) map.set(k, n);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [productLinhas, allProductLinhas, allItemsMeta]);

  // Mapa global: linha (lowercase) -> Set de tipos
  const linhaTypesMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    (allItemsMeta || []).forEach((r: any) => {
      const k = (r.linha || '').trim().toLowerCase();
      if (!k || !r.type) return;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(r.type);
    });
    return map;
  }, [allItemsMeta]);

  // Helper: formata slug feio (linha_25 -> Linha 25) como fallback
  const prettifyLinha = (raw: string) => {
    const meta = productLinhas?.find(l => l.slug.toLowerCase() === raw.toLowerCase() || l.name.toLowerCase() === raw.toLowerCase());
    const name = meta?.name || raw;
    if (!name.includes('_')) return name;
    return name
      .split('_')
      .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
      .join(' ');
  };

  // Slugs/names de linhas DESATIVADAS em /admin/categories → esconder itens vinculados
  const inactiveLinhaKeys = useMemo(() => {
    return new Set(
      (allProductLinhas || [])
        .filter(l => !l.is_active)
        .flatMap(l => [l.slug.toLowerCase(), l.name.toLowerCase()])
    );
  }, [allProductLinhas]);

  const filteredItems = useMemo(() => {
    if (!items) return items;
    return items.filter(it => {
      const key = (it.linha || '').trim().toLowerCase();
      if (!key) return true;
      return !inactiveLinhaKeys.has(key);
    });
  }, [items, inactiveLinhaKeys]);

  // Group items by linha (current page)
  const groupedItems = useMemo(() => {
    if (!filteredItems) return new Map<string, ItemTemplate[]>();
    const groups = new Map<string, ItemTemplate[]>();
    for (const item of filteredItems) {
      const key = item.linha || 'Sem Linha';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [filteredItems]);

  // Stats globais (todos os itens, não só a página)
  const qualityStats = useMemo(() => {
    const all = allItemsMeta || [];
    return {
      total: all.length,
      semImagem: all.filter((i: any) => !i.image_url).length,
      semPreco: all.filter((i: any) => !i.default_price || i.default_price === 0).length,
      inativos: all.filter((i: any) => !i.is_active).length,
    };
  }, [allItemsMeta]);

  const stats = useMemo(() => {
    const all = allItemsMeta || [];
    return {
      total: all.length,
      byType: {
        glass: all.filter((i: any) => i.type === 'glass').length,
        profile: all.filter((i: any) => i.type === 'profile').length,
        accessory: all.filter((i: any) => i.type === 'accessory').length,
        service: all.filter((i: any) => i.type === 'service').length,
        other: all.filter((i: any) => !['glass', 'profile', 'accessory', 'service'].includes(i.type)).length,
      },
    };
  }, [allItemsMeta]);


  const toggleLinha = (linha: string) => {
    setExpandedLinhas(prev => {
      const next = new Set(prev);
      if (next.has(linha)) next.delete(linha);
      else next.add(linha);
      return next;
    });
  };

  const expandAll = () => setExpandedLinhas(new Set(groupedItems.keys()));
  const collapseAll = () => setExpandedLinhas(new Set());

  // Mutations (same as before)
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string; image_url?: string | null }) => {
      let imageUrl = data.image_url || null;
      if (imageFile) {
        const processedFile = await processFileWithWhiteBackground(imageFile);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        const filePath = `items/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('item-templates').upload(filePath, processedFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('item-templates').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }
      const specsBase = JSON.parse(data.specifications || '{}');
      // Sanitiza a lista de fórmulas cadastradas (rótulo + posição + fórmula + peças + ângulos)
      const df: DefaultFormulaEntry[] = (data.formulas || [])
        .map((f) => ({
          label: f.label && String(f.label).trim() ? String(f.label).trim() : null,
          position: normalizePosition(f.position),
          formula: String(f.formula || '').trim(),
          pieces: f.pieces && String(f.pieces).trim() ? String(f.pieces).trim() : null,
          cutAngleStart: typeof f.cutAngleStart === 'number' ? f.cutAngleStart : 90,
          cutAngleEnd: typeof f.cutAngleEnd === 'number' ? f.cutAngleEnd : 90,
        }))
        .filter((f) => f.formula.length > 0);
      const itemData: any = {
        name: data.name,
        description: data.description || null,
        type: data.type,
        unit: data.unit,
        linha: data.linha || null,
        category_id: itemTypes?.find((type) => type.slug === data.type)?.id || null,
        line_id: (allProductLinhas || []).find((line) =>
          line.slug.toLowerCase() === data.linha.toLowerCase()
          || line.name.toLowerCase() === data.linha.toLowerCase()
        )?.id || null,
        default_price: parseFloat(data.default_price) || 0,
        specifications: specsBase,
        image_url: imageUrl,
        is_active: data.is_active,
        default_formulas: df.length ? df : [],
      };
      if (data.type === 'profile') {
        itemData.weight_per_meter = parseFloat(data.weight_per_meter) || null;
        itemData.weight_per_bar = parseFloat(data.weight_per_bar) || null;
        itemData.default_cost = parseFloat(data.default_cost) || null;
        itemData.default_sale_price = parseFloat(data.default_sale_price) || null;
        itemData.bar_length_mm = parseInt(data.bar_length_mm) || 6000;
      }
      if (data.id) {
        const { error } = await supabase.from('item_templates').update(itemData).eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('item_templates').insert(itemData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['item-template-lines'] });
      toast.success(editingItem ? 'Item atualizado!' : 'Item criado!');
      handleCloseDialog();
    },
    onError: (error) => toast.error('Erro ao salvar: ' + error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await supabase.rpc('delete_item_template_transactional', {
        _item_template_id: id,
      });
      if (error) {
        throw new Error(error.message?.includes('permission denied') ? 'UNAUTHORIZED' : 'DELETE_FAILED');
      }
      const result = data as {
        success?: boolean;
        code?: string;
        action?: 'deleted' | 'archived' | 'already_deleted';
        message?: string;
      } | null;
      if (!result?.success) throw new Error(result?.code || 'DELETE_FAILED');
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['item-templates-meta-all'] });
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
      if (data.action === 'archived') {
        toast.warning(data.message || 'Item em uso: ele foi arquivado para preservar o histórico.');
      } else if (data.action === 'already_deleted') {
        toast.info('Este item já havia sido excluído.');
      } else {
        toast.success('Item excluído!');
      }
    },
    onError: (error: Error) => {
      const messages: Record<string, string> = {
        UNAUTHORIZED: 'Acesso negado. Apenas o SaaS Admin pode excluir itens globais.',
        ITEM_IN_USE: 'Este item possui histórico e não pode ser excluído.',
        ITEM_HAS_COMPANY_LINKS: 'Este item está vinculado a empresas e não pode ser excluído.',
        ITEM_HAS_ENGINEERING_REFERENCES: 'Este item está sendo usado na engenharia de produtos.',
        DELETE_FAILED: 'Não foi possível excluir o item. Tente novamente.',
      };
      toast.error(messages[error.message] || messages.DELETE_FAILED);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('item_templates').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      toast.success('Status atualizado!');
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (item: ItemTemplate) => {
      const { error } = await supabase.from('item_templates').insert([{
        name: `${item.name} (Cópia)`,
        description: item.description,
        type: item.type,
        unit: item.unit,
        linha: item.linha,
        default_price: item.default_price,
        specifications: item.specifications as Json,
        image_url: item.image_url,
        is_active: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      toast.success('Item duplicado!');
    },
  });

  const quickImageUploadMutation = useMutation({
    mutationFn: async ({ itemId, file }: { itemId: string; file: File }) => {
      setUploadingImageId(itemId);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `items/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('item-templates').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('item-templates').getPublicUrl(filePath);
      const { error } = await supabase.from('item_templates').update({ image_url: urlData.publicUrl }).eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      toast.success('Imagem atualizada!');
      setUploadingImageId(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar imagem: ' + error.message);
      setUploadingImageId(null);
    },
  });

  const handleQuickImageUpload = (itemId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) quickImageUploadMutation.mutate({ itemId, file });
    };
    input.click();
  };

  const handleBulkImageUpload = async (files: FileList) => {
    if (!items) return;
    setBulkUploadProgress({ total: files.length, processed: 0, matched: 0, notMatched: [], isUploading: true });
    setBulkUploadDialogOpen(true);
    const notMatchedFiles: string[] = [];
    let matchedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      const normalizedFileName = fileName.toLowerCase().replace(/\s+/g, '-');
      const matchingItem = items.find(item => item.name.toLowerCase().replace(/\s+/g, '-') === normalizedFileName);
      if (matchingItem) {
        try {
          const fileExt = file.name.split('.').pop();
          const storageName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `items/${storageName}`;
          const { error: uploadError } = await supabase.storage.from('item-templates').upload(filePath, file);
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('item-templates').getPublicUrl(filePath);
            await supabase.from('item_templates').update({ image_url: urlData.publicUrl }).eq('id', matchingItem.id);
            matchedCount++;
          }
        } catch { notMatchedFiles.push(fileName + ' (erro)'); }
      } else { notMatchedFiles.push(fileName); }
      setBulkUploadProgress(prev => ({ ...prev, processed: i + 1, matched: matchedCount, notMatched: notMatchedFiles }));
    }
    setBulkUploadProgress(prev => ({ ...prev, isUploading: false }));
    queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
    if (matchedCount > 0) toast.success(`${matchedCount} imagens atualizadas!`);
  };

  const openBulkUploadDialog = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) handleBulkImageUpload(files);
    };
    input.click();
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData(defaultFormData);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleEdit = (item: ItemTemplate) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      type: item.type,
      unit: item.unit,
      linha: item.linha || '',
      default_price: item.default_price.toString(),
      weight_per_meter: item.weight_per_meter?.toString() || '',
      weight_per_bar: item.weight_per_bar?.toString() || '',
      default_cost: item.default_cost?.toString() || '',
      default_sale_price: item.default_sale_price?.toString() || '',
      bar_length_mm: item.bar_length_mm?.toString() || '6000',
      specifications: JSON.stringify(item.specifications, null, 2),
      is_active: item.is_active,
      formulas: readFormulasArray(item.default_formulas),
    });
    setImagePreview(item.image_url);
    setDialogOpen(true);
  };

  // Auto-abrir dialog de edição via ?edit=<itemId> na URL (deep-link vindo de outras páginas)
  const [searchParams, setSearchParams] = useSearchParams();
  const editIdFromUrl = searchParams.get('edit');
  useEffect(() => {
    if (!editIdFromUrl || !isSaasAdmin) return;
    if (editingItem?.id === editIdFromUrl && dialogOpen) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('id, name, description, type, unit, linha, category_id, line_id, default_price, weight_per_meter, weight_per_bar, default_cost, default_sale_price, bar_length_mm, specifications, image_url, is_active, default_formulas, created_at')
        .eq('id', editIdFromUrl)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error('Item não encontrado para edição.');
        setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('edit'); return p; }, { replace: true });
        return;
      }
      handleEdit(data as ItemTemplate);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editIdFromUrl, isSaasAdmin]);

  // Limpa o ?edit quando o dialog é fechado
  useEffect(() => {
    if (!dialogOpen && editIdFromUrl) {
      setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('edit'); return p; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.type === 'profile' && !formData.linha) {
      toast.error('Linha é obrigatória para perfis de alumínio.');
      return;
    }
    saveMutation.mutate({ ...formData, id: editingItem?.id, image_url: editingItem?.image_url });
  };

  // Render item card (reused in grid and grouped views)
  const renderItemCard = (item: ItemTemplate) => (
    <Card 
      key={item.id} 
      onClick={() => handleEdit(item)}
      className={`group relative transition-all hover:shadow-md cursor-pointer ${!item.is_active ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleQuickImageUpload(item.id); }}
              disabled={uploadingImageId === item.id}
              className="relative w-12 h-12 bg-white rounded-lg border p-1 flex-shrink-0 flex items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors group/img disabled:opacity-50"
              title="Clique para trocar imagem"
            >
              {uploadingImageId === item.id ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : item.image_url ? (
                <>
                  <img src={item.image_url} alt={item.name} className="max-w-full max-h-full object-contain" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Upload className="h-4 w-4 text-white" />
                  </div>
                </>
              ) : (
                <>
                  <Package className="h-5 w-5 text-muted-foreground group-hover/img:hidden" />
                  <Upload className="h-5 w-5 text-primary hidden group-hover/img:block" />
                </>
              )}
            </button>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold truncate">{item.name}</CardTitle>
              {item.linha && <p className="text-xs text-muted-foreground truncate">{item.linha}</p>}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => handleEdit(item)}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleQuickImageUpload(item.id)}><Upload className="w-4 h-4 mr-2" />Trocar Imagem</DropdownMenuItem>
              <DropdownMenuItem onClick={() => copyMutation.mutate(item)}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}>
                {item.is_active ? <><EyeOff className="w-4 h-4 mr-2" />Desativar</> : <><Eye className="w-4 h-4 mr-2" />Ativar</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate({ id: item.id })}>
                <Trash2 className="w-4 h-4 mr-2" />Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={typeColors[item.type]}>{typeLabels[item.type]}</Badge>
            {!item.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
            {!item.image_url && <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600"><Image className="w-3 h-3 mr-1" />Sem foto</Badge>}
          </div>
          <span className="text-xs text-muted-foreground">{item.unit}</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-xs text-muted-foreground">Preço padrão</span>
          <span className={`text-sm font-medium ${item.default_price === 0 ? 'text-muted-foreground/50' : ''}`}>
            {item.default_price > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.default_price) : '—'}
          </span>
        </div>
        {item.type === 'profile' && (item.weight_per_meter || item.default_cost || item.default_sale_price) && (
          <div className="space-y-1 pt-1 border-t text-xs">
            {item.weight_per_meter && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peso</span>
                <span>{item.weight_per_meter} kg/m</span>
              </div>
            )}
            {item.default_cost && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo sug.</span>
                <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.default_cost)}</span>
              </div>
            )}
            {item.default_sale_price && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Venda sug.</span>
                <span className="text-green-600 font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.default_sale_price)}</span>
              </div>
            )}
          </div>
        )}
        {(() => {
          const formulas = readFormulasArray(item.default_formulas);
          if (formulas.length === 0) return null;
          return (
            <div className="pt-1 border-t space-y-1">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                  {formulas.length === 1 ? 'Fórmula' : `${formulas.length} Fórmulas`}
                </Badge>
              </div>
              <div className="text-xs space-y-1">
                {formulas.slice(0, 3).map((f, i) => (
                  <div key={i} className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground truncate max-w-[45%]" title={f.label || f.position}>
                        {f.label ? `${f.label}` : f.position}
                      </span>
                      <code className="font-mono text-[11px] truncate max-w-[55%]" title={f.formula}>{f.formula}</code>
                    </div>
                    {(f.pieces || (f.cutAngleStart ?? 90) !== 90 || (f.cutAngleEnd ?? 90) !== 90) && (
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        {f.pieces && <span>Peças: {f.pieces}</span>}
                        <span>{f.cutAngleStart ?? 90}° / {f.cutAngleEnd ?? 90}°</span>
                      </div>
                    )}
                  </div>
                ))}
                {formulas.length > 3 && (
                  <div className="text-[10px] text-muted-foreground italic">+{formulas.length - 3} mais…</div>
                )}
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );

  // Render table row
  const renderTableRow = (item: ItemTemplate) => (
    <tr key={item.id} className={`border-b hover:bg-muted/50 cursor-pointer transition-colors ${!item.is_active ? 'opacity-60' : ''}`} onClick={() => handleEdit(item)}>
      <td className="p-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleQuickImageUpload(item.id); }}
            className="relative w-10 h-10 bg-white rounded border p-0.5 flex-shrink-0 flex items-center justify-center hover:border-primary transition-colors"
          >
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="max-w-full max-h-full object-contain" />
            ) : (
              <Package className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{item.name}</p>
            {item.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.description}</p>}
          </div>
        </div>
      </td>
      <td className="p-3"><Badge variant="outline" className={`text-xs ${typeColors[item.type]}`}>{typeLabels[item.type]}</Badge></td>
      <td className="p-3 text-sm text-muted-foreground">{item.linha || '—'}</td>
      <td className="p-3 text-sm text-muted-foreground">{item.unit}</td>
      <td className="p-3 text-sm text-right">
        {item.default_price > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.default_price) : '—'}
      </td>
      <td className="p-3">
        <div className="flex items-center gap-1 justify-end">
          {!item.image_url && <span title="Sem imagem"><AlertCircle className="w-4 h-4 text-amber-500" /></span>}
          {!item.is_active && <span title="Inativo"><EyeOff className="w-4 h-4 text-muted-foreground" /></span>}
        </div>
      </td>
      <td className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(item)}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyMutation.mutate(item)}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}>
              {item.is_active ? <><EyeOff className="w-4 h-4 mr-2" />Desativar</> : <><Eye className="w-4 h-4 mr-2" />Ativar</>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate({ id: item.id })}>
              <Trash2 className="w-4 h-4 mr-2" />Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );

  if (!isSaasAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Você não tem permissão para acessar esta página.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Item Templates</h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} itens cadastrados • {availableLines.length} linhas
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setDialogOpen(true); }}>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openBulkUploadDialog}>
                <ImageUp className="w-4 h-4 mr-2" />
                Upload em Massa
              </Button>
              <Button onClick={() => { handleCloseDialog(); setDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Item
              </Button>
            </div>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: SU-001" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo *</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="glass">Vidro</SelectItem>
                        <SelectItem value="profile">Perfil</SelectItem>
                        <SelectItem value="accessory">Acessório</SelectItem>
                        <SelectItem value="service">Serviço</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="linha">
                      Linha {formData.type === 'profile' && <span className="text-destructive">*</span>}
                    </Label>
                    <Select value={formData.linha} onValueChange={(value) => setFormData({ ...formData, linha: value === 'none' ? '' : value })}>
                      <SelectTrigger><SelectValue placeholder="Selecione uma linha" /></SelectTrigger>
                      <SelectContent>
                        {formData.type !== 'profile' && <SelectItem value="none">Sem Linha</SelectItem>}
                        {availableLines?.map((line) => <SelectItem key={line} value={line}>{prettifyLinha(line)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade *</Label>
                    <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="barra">Barra</SelectItem>
                        <SelectItem value="m²">m² (metro quadrado)</SelectItem>
                        <SelectItem value="m">m (metro linear)</SelectItem>
                        <SelectItem value="un">un (unidade)</SelectItem>
                        <SelectItem value="kg">kg (quilograma)</SelectItem>
                        <SelectItem value="pç">pç (peça)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="default_price">Preço Padrão (R$)</Label>
                    <Input id="default_price" type="number" step="0.01" value={formData.default_price} onChange={(e) => setFormData({ ...formData, default_price: e.target.value })} placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Imagem</Label>
                    <div className="flex items-center gap-3">
                      {imagePreview ? (
                        <div className="relative">
                          <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border bg-white" />
                          <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5" onClick={() => { setImageFile(null); setImagePreview(null); }}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
                {/* Profile-specific fields */}
                {formData.type === 'profile' && (
                  <div className="space-y-4 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Ruler className="w-4 h-4" />
                      Dados Técnicos do Perfil
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bar_length_mm">Tamanho da Barra (mm)</Label>
                        <Input id="bar_length_mm" type="number" value={formData.bar_length_mm} onChange={(e) => {
                          const newBarLen = (parseInt(e.target.value) || 6000) / 1000;
                          const wpm = parseFloat(formData.weight_per_meter) || 0;
                          setFormData({ ...formData, bar_length_mm: e.target.value, weight_per_bar: wpm > 0 ? (wpm * newBarLen).toFixed(3) : formData.weight_per_bar });
                        }} placeholder="6000" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight_per_bar">Peso da Barra (kg)</Label>
                        <Input id="weight_per_bar" type="number" step="0.001" value={formData.weight_per_bar} onChange={(e) => {
                          const wpb = parseFloat(e.target.value) || 0;
                          const barLen = (parseInt(formData.bar_length_mm) || 6000) / 1000;
                          setFormData({ ...formData, weight_per_bar: e.target.value, weight_per_meter: wpb > 0 ? (wpb / barLen).toFixed(3) : '' });
                        }} placeholder="0.000" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight_per_meter">Peso/m (kg/m)</Label>
                        <Input id="weight_per_meter" type="number" step="0.001" value={formData.weight_per_meter} onChange={(e) => {
                          const wpm = parseFloat(e.target.value) || 0;
                          const barLen = (parseInt(formData.bar_length_mm) || 6000) / 1000;
                          setFormData({ ...formData, weight_per_meter: e.target.value, weight_per_bar: wpm > 0 ? (wpm * barLen).toFixed(3) : '' });
                        }} placeholder="0.000" />
                      </div>
                    </div>
                  </div>
                )}
                {formData.type === 'profile' && (
                  <ProfileColorPricesSection itemTemplateId={editingItem?.id ?? null} />
                )}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Descrição do item..." />
                </div>
                <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Fórmulas padrão (opcional)</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Cadastre uma ou mais fórmulas. Ao adicionar este insumo na composição de um produto, você poderá escolher qual usar. Variáveis:{' '}
                        <code>L</code> (largura), <code>A</code> (altura), <code>FL</code>/<code>FA</code> (folgas), <code>N</code> (nº de folhas).
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          formulas: [
                            ...formData.formulas,
                            { label: '', position: 'Largura', formula: '', pieces: null, cutAngleStart: 90, cutAngleEnd: 90 },
                          ],
                        })
                      }
                    >
                      <Plus className="h-4 w-4 mr-1" /> Adicionar fórmula
                    </Button>
                  </div>

                  {formData.formulas.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-3 text-center border border-dashed border-border rounded">
                      Nenhuma fórmula cadastrada. Clique em "Adicionar fórmula" para cadastrar posições e cortes deste item.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.formulas.map((f, idx) => {
                        const updateEntry = (patch: Partial<DefaultFormulaEntry>) => {
                          const next = [...formData.formulas];
                          next[idx] = { ...next[idx], ...patch };
                          setFormData({ ...formData, formulas: next });
                        };
                        const removeEntry = () => {
                          const next = formData.formulas.filter((_, i) => i !== idx);
                          setFormData({ ...formData, formulas: next });
                        };
                        return (
                          <div key={idx} className="space-y-2 p-3 rounded-md border border-border bg-background">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-muted-foreground">Fórmula #{idx + 1}</span>
                              <Button type="button" size="icon" variant="ghost" onClick={removeEntry} className="h-7 w-7">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[11px]">Rótulo (opcional)</Label>
                                <Input
                                  value={f.label || ''}
                                  onChange={(e) => updateEntry({ label: e.target.value })}
                                  placeholder="Ex: Vertical externo, Travessa superior"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[11px]">Posição</Label>
                                <div className="flex gap-1">
                                  {(['Largura', 'Altura'] as const).map((pos) => (
                                    <Button
                                      key={pos}
                                      type="button"
                                      size="sm"
                                      variant={f.position === pos ? 'default' : 'outline'}
                                      onClick={() => updateEntry({ position: pos })}
                                      className="flex-1 h-8"
                                    >
                                      {pos}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <Label className="text-[11px]">Fórmula do comprimento</Label>
                                <Select value="" onValueChange={(v) => updateEntry({ formula: v })}>
                                  <SelectTrigger className="h-6 w-auto min-w-[140px] text-[10px] gap-1 px-2">
                                    <SelectValue placeholder="💡 Sugestões" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    {LENGTH_FORMULA_PRESETS.map((p) => (
                                      <SelectItem key={p.formula} value={p.formula} className="text-xs">
                                        <div className="flex flex-col">
                                          <span className="font-medium">{p.label}</span>
                                          <code className="text-[10px] text-muted-foreground font-mono">{p.formula}</code>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Input
                                value={f.formula}
                                onChange={(e) => updateEntry({ formula: e.target.value })}
                                placeholder={f.position === 'Largura' ? 'Ex: L - 40' : 'Ex: A - 40'}
                                className="h-8 font-mono text-sm"
                              />
                            </div>
                            {formData.type === 'profile' && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <Label className="text-[11px]">Peças</Label>
                                    <Select value="" onValueChange={(v) => updateEntry({ pieces: v })}>
                                      <SelectTrigger className="h-6 w-auto min-w-[90px] text-[10px] gap-1 px-2">
                                        <SelectValue placeholder="💡" />
                                      </SelectTrigger>
                                      <SelectContent className="max-h-72">
                                        {PIECES_FORMULA_PRESETS.map((p) => (
                                          <SelectItem key={p.formula} value={p.formula} className="text-xs">
                                            <div className="flex flex-col">
                                              <span className="font-medium">{p.label}</span>
                                              <code className="text-[10px] text-muted-foreground font-mono">{p.formula}</code>
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Input
                                    value={f.pieces || ''}
                                    onChange={(e) => updateEntry({ pieces: e.target.value || null })}
                                    placeholder="Ex: 2 ou N"
                                    className="h-8 font-mono text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Ângulo início (°)</Label>
                                  <Input
                                    type="number"
                                    value={f.cutAngleStart ?? 90}
                                    onChange={(e) => updateEntry({ cutAngleStart: parseInt(e.target.value) || 90 })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[11px]">Ângulo fim (°)</Label>
                                  <Input
                                    type="number"
                                    value={f.cutAngleEnd ?? 90}
                                    onChange={(e) => updateEntry({ cutAngleEnd: parseInt(e.target.value) || 90 })}
                                    className="h-8 text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specifications">Especificações (JSON)</Label>
                  <Textarea id="specifications" value={formData.specifications} onChange={(e) => setFormData({ ...formData, specifications: e.target.value })} rows={2} className="font-mono text-sm" placeholder='{"peso": "0.5kg/m"}' />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="is_active" checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                  <Label htmlFor="is_active">Item ativo</Label>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Salvando...' : 'Salvar'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Bulk Upload Progress Dialog */}
          <Dialog open={bulkUploadDialogOpen} onOpenChange={(open) => { if (!bulkUploadProgress.isUploading) setBulkUploadDialogOpen(open); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><ImageUp className="w-5 h-5" />Upload em Massa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span>Progresso</span><span>{bulkUploadProgress.processed} / {bulkUploadProgress.total}</span></div>
                  <Progress value={(bulkUploadProgress.processed / Math.max(bulkUploadProgress.total, 1)) * 100} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <div><p className="text-xl font-bold text-green-600">{bulkUploadProgress.matched}</p><p className="text-xs text-muted-foreground">Atualizadas</p></div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <div><p className="text-xl font-bold text-amber-600">{bulkUploadProgress.notMatched.length}</p><p className="text-xs text-muted-foreground">Não encontrados</p></div>
                  </div>
                </div>
                {bulkUploadProgress.notMatched.length > 0 && !bulkUploadProgress.isUploading && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1"><XCircle className="w-4 h-4 text-amber-500" />Arquivos sem correspondência:</p>
                    <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground bg-muted/50 p-2 rounded space-y-1">
                      {bulkUploadProgress.notMatched.map((name, i) => <div key={i}>{name}</div>)}
                    </div>
                  </div>
                )}
                {!bulkUploadProgress.isUploading && <Button className="w-full" onClick={() => setBulkUploadDialogOpen(false)}>Fechar</Button>}
                {bulkUploadProgress.isUploading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Enviando imagens...</div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="pt-3 pb-2">
              <p className="text-2xl font-bold text-amber-600">{stats.byType.profile}</p>
              <p className="text-xs text-muted-foreground">Perfis</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="pt-3 pb-2">
              <p className="text-2xl font-bold text-blue-600">{stats.byType.glass}</p>
              <p className="text-xs text-muted-foreground">Vidros</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="pt-3 pb-2">
              <p className="text-2xl font-bold text-green-600">{stats.byType.accessory}</p>
              <p className="text-xs text-muted-foreground">Acessórios</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardContent className="pt-3 pb-2">
              <p className="text-2xl font-bold text-purple-600">{stats.byType.service}</p>
              <p className="text-xs text-muted-foreground">Serviços</p>
            </CardContent>
          </Card>
          {/* Quality indicators */}
          <Card className={`border-amber-500/20 ${qualityStats.semImagem > 0 ? 'bg-amber-500/5' : 'bg-muted/30'}`}>
            <CardContent className="pt-3 pb-2">
              <p className={`text-2xl font-bold ${qualityStats.semImagem > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{qualityStats.semImagem}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Image className="w-3 h-3" />Sem foto</p>
            </CardContent>
          </Card>
          {stats.byType.other > 0 && (
            <Card className="bg-slate-500/5 border-slate-500/20">
              <CardContent className="pt-3 pb-2">
                <p className="text-2xl font-bold text-slate-600">{stats.byType.other}</p>
                <p className="text-xs text-muted-foreground">Outros</p>
              </CardContent>
            </Card>
          )}
          <Card className="bg-muted/30">
            <CardContent className="pt-3 pb-2">
              <p className="text-2xl font-bold text-muted-foreground">{availableLines.length}</p>
              <p className="text-xs text-muted-foreground">Linhas</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters + View Toggle */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar itens..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={filterLinha} onValueChange={(v) => { setFilterLinha(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Linha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Linhas</SelectItem>
              {availableLines?.map((line) => <SelectItem key={line} value={line}>{prettifyLinha(line)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => { setFilterType(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipos</SelectItem>
              <SelectItem value="glass">Vidros</SelectItem>
              <SelectItem value="profile">Perfis</SelectItem>
              <SelectItem value="accessory">Acessórios</SelectItem>
              <SelectItem value="service">Serviços</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={showInactive ? "secondary" : "outline"} size="sm" onClick={() => { setShowInactive(!showInactive); setPage(1); }}>
            {showInactive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
            {showInactive ? "Todos" : "Só ativos"}
          </Button>
          <div className="flex items-center border rounded-lg overflow-hidden ml-auto">
            <Button variant={viewMode === 'grouped' ? 'secondary' : 'ghost'} size="sm" className="rounded-none" onClick={() => setViewMode('grouped')}>
              <LayoutList className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="rounded-none" onClick={() => setViewMode('grid')}>
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" className="rounded-none" onClick={() => setViewMode('table')}>
              <LayoutList className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : !filteredItems?.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum item encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">{searchTerm ? "Tente outro termo de busca" : "Clique em 'Novo Item' para começar"}</p>
            </CardContent>
          </Card>
        ) : viewMode === 'grouped' ? (
          <div className="space-y-6">
            {/* Linha Cards Grid — esconde quando uma linha é selecionada */}
            {expandedLinhas.size === 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {availableLines.map((linha) => {
                  const types = Array.from(linhaTypesMap.get(linha.toLowerCase()) || []);
                  return (
                    <LinhaCardSimple
                      key={linha}
                      linha={linha}
                      label={prettifyLinha(linha)}
                      isRemovable={false}
                      categories={types}
                      categoryLabels={typeLabels}
                      onViewProducts={() => {
                        setExpandedLinhas(new Set([linha]));
                        setFilterLinha(linha);
                        setPage(1);
                      }}
                    />
                  );
                })}
              </div>
            )}

            {/* Detalhe da linha selecionada */}
            {Array.from(expandedLinhas).map(linha => {
              const groupItems = groupedItems.get(linha);
              if (!groupItems) return null;
              return (
                <Card key={`detail-${linha}`} className="ring-1 ring-primary/20 overflow-hidden">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => setExpandedLinhas(new Set())}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar às linhas
                      </Button>
                      <div>
                        <CardTitle className="text-lg">{prettifyLinha(linha)}</CardTitle>
                        <CardDescription>{groupItems.length} itens cadastrados</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left p-3 font-medium text-muted-foreground w-10"></th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                            <th className="text-left p-3 font-medium text-muted-foreground">Unidade</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Peso (kg/m)</th>
                            <th className="text-right p-3 font-medium text-muted-foreground">Preço</th>
                            <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                            <th className="p-3 w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupItems.map((item) => (
                            <tr key={item.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                              <td className="p-3">
                                <button
                                  type="button"
                                  onClick={() => handleQuickImageUpload(item.id)}
                                  className="relative w-9 h-9 bg-white rounded border flex items-center justify-center hover:border-primary transition-colors flex-shrink-0"
                                >
                                  {uploadingImageId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  ) : item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="max-w-full max-h-full object-contain p-0.5" />
                                  ) : (
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </button>
                              </td>
                              <td className="p-3">
                                <p className="font-medium text-foreground">{item.name}</p>
                                {item.description && <p className="text-xs text-muted-foreground truncate max-w-[250px]">{item.description}</p>}
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className={`text-xs ${typeColors[item.type]}`}>{typeLabels[item.type]}</Badge>
                              </td>
                              <td className="p-3 text-muted-foreground">{unitLabels[item.unit] || item.unit}</td>
                              <td className="p-3 text-right font-mono">
                                {item.weight_per_meter ? `${item.weight_per_meter}` : '—'}
                              </td>
                              <td className="p-3 text-right">
                                {item.default_price > 0
                                  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.default_price)
                                  : <span className="text-muted-foreground">—</span>
                                }
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {item.is_active
                                    ? <span className="w-2 h-2 rounded-full bg-green-500" title="Ativo" />
                                    : <span className="w-2 h-2 rounded-full bg-muted-foreground" title="Inativo" />
                                  }
                                  {!item.image_url && <span title="Sem imagem"><AlertCircle className="w-3.5 h-3.5 text-amber-500" /></span>}
                                </div>
                              </td>
                              <td className="p-3">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <MoreVertical className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(item)}><Pencil className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleQuickImageUpload(item.id)}><Upload className="w-4 h-4 mr-2" />Trocar Imagem</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => copyMutation.mutate(item)}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}>
                                      {item.is_active ? <><EyeOff className="w-4 h-4 mr-2" />Desativar</> : <><Eye className="w-4 h-4 mr-2" />Ativar</>}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate({ id: item.id })}>
                                      <Trash2 className="w-4 h-4 mr-2" />Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : viewMode === 'table' ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium">Item</th>
                  <th className="text-left p-3 text-sm font-medium">Tipo</th>
                  <th className="text-left p-3 text-sm font-medium">Linha</th>
                  <th className="text-left p-3 text-sm font-medium">Unidade</th>
                  <th className="text-right p-3 text-sm font-medium">Preço</th>
                  <th className="text-right p-3 text-sm font-medium">Status</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>{filteredItems.map(renderTableRow)}</tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map(renderItemCard)}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !(viewMode === 'grouped' && expandedLinhas.size === 0) && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        )}
      </div>

    </AdminLayout>
  );
}
