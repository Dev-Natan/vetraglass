import { useState, useMemo } from 'react';
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
  AlertCircle, AlertTriangle, LayoutGrid, LayoutList, Image, ChevronDown, ChevronRight
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useItemTypeLabels } from '@/hooks/useItemTypes';
import { useProductLinhas } from '@/hooks/useProductLinhas';

interface ItemTemplate {
  id: string;
  name: string;
  description: string | null;
  type: 'glass' | 'profile' | 'accessory' | 'service';
  unit: string;
  linha: string | null;
  default_price: number;
  weight_per_meter: number | null;
  weight_per_bar: number | null;
  default_cost: number | null;
  default_sale_price: number | null;
  bar_length_mm: number | null;
  specifications: unknown;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
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
  const [showInactive, setShowInactive] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'grouped'>('grouped');
  const [expandedLinhas, setExpandedLinhas] = useState<Set<string>>(new Set());
  
  const [page, setPage] = useState(1);
  const pageSize = 200;
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemTemplate | null>(null);
  
  const [formData, setFormData] = useState({
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
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  
  const [forceDeleteDialog, setForceDeleteDialog] = useState<{
    open: boolean;
    itemId: string | null;
    itemName: string;
    errorMessage: string;
  }>({ open: false, itemId: null, itemName: '', errorMessage: '' });
  
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
        .select('id, name, description, type, unit, linha, default_price, weight_per_meter, weight_per_bar, default_cost, default_sale_price, bar_length_mm, specifications, image_url, is_active, created_at', { count: 'exact' });
      
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }
      if (filterType !== 'all') {
        query = query.eq('type', filterType as any);
      }
      if (filterLinha !== 'all') {
        query = query.eq('linha', filterLinha);
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

  const { data: productLinhas } = useProductLinhas();
  const availableLines = productLinhas?.map(l => l.name) || [];

  const filteredItems = items;

  // Group items by linha
  const groupedItems = useMemo(() => {
    if (!filteredItems) return new Map<string, ItemTemplate[]>();
    const groups = new Map<string, ItemTemplate[]>();
    for (const item of filteredItems) {
      const key = item.linha || 'Sem Linha';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    // Sort groups alphabetically
    return new Map([...groups.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [filteredItems]);

  // Data quality stats
  const qualityStats = useMemo(() => {
    if (!filteredItems) return { total: 0, semImagem: 0, semPreco: 0, inativos: 0 };
    return {
      total: filteredItems.length,
      semImagem: filteredItems.filter(i => !i.image_url).length,
      semPreco: filteredItems.filter(i => !i.default_price || i.default_price === 0).length,
      inativos: filteredItems.filter(i => !i.is_active).length,
    };
  }, [filteredItems]);

  // Stats by type
  const stats = useMemo(() => ({
    total: items?.length || 0,
    byType: {
      glass: items?.filter(i => i.type === 'glass').length || 0,
      profile: items?.filter(i => i.type === 'profile').length || 0,
      accessory: items?.filter(i => i.type === 'accessory').length || 0,
      service: items?.filter(i => i.type === 'service').length || 0,
    }
  }), [items]);

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
      const itemData: any = {
        name: data.name,
        description: data.description || null,
        type: data.type,
        unit: data.unit,
        linha: data.linha || null,
        default_price: parseFloat(data.default_price) || 0,
        specifications: JSON.parse(data.specifications || '{}'),
        image_url: imageUrl,
        is_active: data.is_active,
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
    mutationFn: async ({ id, force = false }: { id: string; force?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-item-template', { body: { id, force } });
      if (error) throw error;
      if (!data?.success) {
        if (data?.code === 'IN_USE' || data?.code === 'IN_STOCK' || data?.code === 'IN_PRICES') {
          const err = new Error(data?.error || 'Item em uso');
          (err as any).canForce = true;
          throw err;
        }
        throw new Error(data?.error || 'Não foi possível excluir este item.');
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
      if (data?.removed) {
        toast.success(`Item excluído! Removido de ${data.removed.products} produtos, ${data.removed.stock} estoques, ${data.removed.companyItems} itens de empresa.`);
      } else {
        toast.success('Item excluído!');
      }
      setForceDeleteDialog({ open: false, itemId: null, itemName: '', errorMessage: '' });
    },
    onError: (error: Error) => {
      if ((error as any).canForce) {
        setForceDeleteDialog(prev => ({ ...prev, open: true, errorMessage: error.message }));
      } else {
        toast.error('Erro ao excluir: ' + error.message);
      }
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
    setFormData({ name: '', description: '', type: 'profile', unit: 'barra', linha: '', default_price: '', weight_per_meter: '', weight_per_bar: '', default_cost: '', default_sale_price: '', bar_length_mm: '6000', specifications: '{}', is_active: true });
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
    });
    setImagePreview(item.image_url);
    setDialogOpen(true);
  };

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
    saveMutation.mutate({ ...formData, id: editingItem?.id, image_url: editingItem?.image_url });
  };

  // Render item card (reused in grid and grouped views)
  const renderItemCard = (item: ItemTemplate) => (
    <Card 
      key={item.id} 
      className={`group relative transition-all hover:shadow-md ${!item.is_active ? "opacity-60" : ""}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handleQuickImageUpload(item.id)}
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
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
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
              <DropdownMenuItem className="text-destructive" onClick={() => {
                setForceDeleteDialog({ open: false, itemId: item.id, itemName: item.name, errorMessage: '' });
                deleteMutation.mutate({ id: item.id, force: false });
              }}><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
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
            <DropdownMenuItem className="text-destructive" onClick={() => {
              setForceDeleteDialog({ open: false, itemId: item.id, itemName: item.name, errorMessage: '' });
              deleteMutation.mutate({ id: item.id, force: false });
            }}><Trash2 className="w-4 h-4 mr-2" />Excluir</DropdownMenuItem>
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
              {totalItems} itens cadastrados • {productLinhas?.length || 0} linhas
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <div className="flex gap-2">
              <Button variant="outline" onClick={openBulkUploadDialog}>
                <ImageUp className="w-4 h-4 mr-2" />
                Upload em Massa
              </Button>
              <DialogTrigger asChild>
                <Button onClick={handleCloseDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Item
                </Button>
              </DialogTrigger>
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
                    <Label htmlFor="linha">Linha</Label>
                    <Select value={formData.linha} onValueChange={(value) => setFormData({ ...formData, linha: value === 'none' ? '' : value })}>
                      <SelectTrigger><SelectValue placeholder="Selecione uma linha" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem Linha</SelectItem>
                        {availableLines?.map((line) => <SelectItem key={line} value={line}>{line}</SelectItem>)}
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
                {/* Profile-specific fields: Weight & Pricing */}
                {formData.type === 'profile' && (
                  <div className="space-y-4 p-4 rounded-lg border border-amber-500/20 bg-amber-500/5">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Ruler className="w-4 h-4" />
                      Peso e Preços Sugestivos (Perfil)
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bar_length_mm">Comprimento da Barra (mm)</Label>
                        <Input id="bar_length_mm" type="number" value={formData.bar_length_mm} onChange={(e) => setFormData({ ...formData, bar_length_mm: e.target.value })} placeholder="6000" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight_per_meter">Peso por Metro (kg/m)</Label>
                        <Input id="weight_per_meter" type="number" step="0.001" value={formData.weight_per_meter} onChange={(e) => {
                          const wpm = parseFloat(e.target.value) || 0;
                          const barLen = (parseInt(formData.bar_length_mm) || 6000) / 1000;
                          setFormData({ ...formData, weight_per_meter: e.target.value, weight_per_bar: wpm > 0 ? (wpm * barLen).toFixed(3) : '' });
                        }} placeholder="0.000" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weight_per_bar">Peso por Barra (kg)</Label>
                        <Input id="weight_per_bar" type="number" step="0.001" value={formData.weight_per_bar} onChange={(e) => {
                          const wpb = parseFloat(e.target.value) || 0;
                          const barLen = (parseInt(formData.bar_length_mm) || 6000) / 1000;
                          setFormData({ ...formData, weight_per_bar: e.target.value, weight_per_meter: wpb > 0 ? (wpb / barLen).toFixed(3) : '' });
                        }} placeholder="0.000" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="default_cost">Custo Sugestivo (R$/barra)</Label>
                        <Input id="default_cost" type="number" step="0.01" value={formData.default_cost} onChange={(e) => setFormData({ ...formData, default_cost: e.target.value })} placeholder="0.00" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="default_sale_price">Preço Venda Sugestivo (R$/barra)</Label>
                        <Input id="default_sale_price" type="number" step="0.01" value={formData.default_sale_price} onChange={(e) => setFormData({ ...formData, default_sale_price: e.target.value })} placeholder="0.00" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} placeholder="Descrição do item..." />
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
          <Card className="bg-muted/30">
            <CardContent className="pt-3 pb-2">
              <p className="text-2xl font-bold text-muted-foreground">{groupedItems.size}</p>
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
              {availableLines?.map((line) => <SelectItem key={line} value={line}>{line}</SelectItem>)}
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
          <div className="space-y-2">
            <div className="flex gap-2 mb-2">
              <Button variant="ghost" size="sm" onClick={expandAll}>Expandir tudo</Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>Recolher tudo</Button>
            </div>
            {Array.from(groupedItems.entries()).map(([linha, groupItems]) => (
              <Collapsible key={linha} open={expandedLinhas.has(linha)} onOpenChange={() => toggleLinha(linha)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-4 h-auto hover:bg-muted/50 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {expandedLinhas.has(linha) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="font-semibold">{linha}</span>
                      <Badge variant="secondary" className="text-xs">{groupItems.length} itens</Badge>
                      {groupItems.some(i => !i.image_url) && (
                        <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">
                          {groupItems.filter(i => !i.image_url).length} sem foto
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {Object.entries(
                        groupItems.reduce((acc, i) => { acc[i.type] = (acc[i.type] || 0) + 1; return acc; }, {} as Record<string, number>)
                      ).map(([type, count]) => (
                        <Badge key={type} variant="outline" className={`text-xs ${typeColors[type]}`}>{typeLabels[type]}: {count}</Badge>
                      ))}
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pl-4">
                    {groupItems.map(renderItemCard)}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
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
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
          </div>
        )}
      </div>

      {/* Force Delete Dialog */}
      <AlertDialog open={forceDeleteDialog.open} onOpenChange={(open) => setForceDeleteDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" />Item em Uso</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="font-medium text-foreground">{forceDeleteDialog.itemName}</p>
              <p className="text-sm">{forceDeleteDialog.errorMessage}</p>
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <strong>Atenção:</strong> Forçar exclusão irá remover este item de todos os produtos, estoques e preços configurados. Esta ação não pode ser desfeita.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setForceDeleteDialog({ open: false, itemId: null, itemName: '', errorMessage: '' })}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (forceDeleteDialog.itemId) deleteMutation.mutate({ id: forceDeleteDialog.itemId, force: true }); }} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Excluindo...</> : 'Forçar Exclusão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
