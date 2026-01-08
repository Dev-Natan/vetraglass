import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
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
import { toast } from 'sonner';
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  Search, 
  Package, 
  Upload, 
  X, 
  MoreVertical,
  Eye,
  EyeOff,
  Copy,
  DollarSign,
  Ruler
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ItemTemplate {
  id: string;
  name: string;
  description: string | null;
  type: 'glass' | 'profile' | 'accessory' | 'service';
  unit: string;
  linha: string | null;
  default_price: number;
  specifications: unknown;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  glass: 'Vidro',
  profile: 'Perfil',
  accessory: 'Acessório',
  service: 'Serviço',
};

const typeColors: Record<string, string> = {
  glass: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  profile: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  accessory: 'bg-green-500/10 text-green-600 border-green-500/20',
  service: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

const unitLabels: Record<string, string> = {
  'm²': 'Metro Quadrado',
  'm': 'Metro Linear',
  'un': 'Unidade',
  'kg': 'Quilograma',
  'pç': 'Peça',
};

export default function ItemTemplates() {
  const { isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLinha, setFilterLinha] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemTemplate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'profile' as 'glass' | 'profile' | 'accessory' | 'service',
    unit: 'm',
    linha: '',
    default_price: '',
    specifications: '{}',
    is_active: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Fetch items
  const { data: items, isLoading } = useQuery({
    queryKey: ['item-templates-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .order('type')
        .order('name');
      if (error) throw error;
      return data as ItemTemplate[];
    },
    enabled: isSaasAdmin,
  });

  // Fetch available lines
  const { data: availableLines } = useQuery({
    queryKey: ['item-template-lines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_templates')
        .select('linha')
        .not('linha', 'is', null);
      if (error) throw error;
      const lines = [...new Set(data.map((d) => d.linha).filter(Boolean))];
      return lines as string[];
    },
  });

  // Filter items
  const filteredItems = items?.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesLinha = filterLinha === 'all' || item.linha === filterLinha;
    const matchesActive = showInactive || item.is_active;
    return matchesSearch && matchesType && matchesLinha && matchesActive;
  });

  // Stats
  const stats = {
    total: items?.length || 0,
    active: items?.filter(i => i.is_active).length || 0,
    byType: {
      glass: items?.filter(i => i.type === 'glass').length || 0,
      profile: items?.filter(i => i.type === 'profile').length || 0,
      accessory: items?.filter(i => i.type === 'accessory').length || 0,
      service: items?.filter(i => i.type === 'service').length || 0,
    }
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string; image_url?: string | null }) => {
      let imageUrl = data.image_url || null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `items/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('item-templates')
          .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('item-templates')
          .getPublicUrl(filePath);

        imageUrl = urlData.publicUrl;
      }

      const itemData = {
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

      if (data.id) {
        const { error } = await supabase
          .from('item_templates')
          .update(itemData)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('item_templates')
          .insert(itemData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      queryClient.invalidateQueries({ queryKey: ['item-template-lines'] });
      toast.success(editingItem ? 'Item atualizado!' : 'Item criado!');
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('item_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      toast.success('Item excluído!');
    },
    onError: (error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('item_templates')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-templates-admin'] });
      toast.success('Status atualizado!');
    },
  });

  // Copy mutation
  const copyMutation = useMutation({
    mutationFn: async (item: ItemTemplate) => {
      const { error } = await supabase
        .from('item_templates')
        .insert([{
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

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      type: 'profile',
      unit: 'm',
      linha: '',
      default_price: '',
      specifications: '{}',
      is_active: true,
    });
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
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ 
      ...formData, 
      id: editingItem?.id,
      image_url: editingItem?.image_url 
    });
  };

  if (!isSaasAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>
              Você não tem permissão para acessar esta página.
            </CardDescription>
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
              {filteredItems?.length || 0} de {stats.total} itens
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCloseDialog}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingItem ? 'Editar Item' : 'Novo Item'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: SU-001"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo *</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(v) => setFormData({ ...formData, type: v as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    <Select
                      value={formData.linha}
                      onValueChange={(value) => setFormData({ ...formData, linha: value === 'none' ? '' : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma linha" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem Linha</SelectItem>
                        {availableLines?.map((line) => (
                          <SelectItem key={line} value={line}>
                            {line}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade *</Label>
                    <Select 
                      value={formData.unit} 
                      onValueChange={(v) => setFormData({ ...formData, unit: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
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
                    <Input
                      id="default_price"
                      type="number"
                      step="0.01"
                      value={formData.default_price}
                      onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Imagem</Label>
                    <div className="flex items-center gap-3">
                      {imagePreview ? (
                        <div className="relative">
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="w-16 h-16 object-cover rounded-lg border bg-white"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-5 w-5"
                            onClick={() => { setImageFile(null); setImagePreview(null); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    placeholder="Descrição do item..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specifications">Especificações (JSON)</Label>
                  <Textarea
                    id="specifications"
                    value={formData.specifications}
                    onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                    rows={2}
                    className="font-mono text-sm"
                    placeholder='{"peso": "0.5kg/m"}'
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Item ativo</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.byType.profile}</p>
                  <p className="text-xs text-muted-foreground">Perfis</p>
                </div>
                <Ruler className="w-8 h-8 text-amber-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.byType.glass}</p>
                  <p className="text-xs text-muted-foreground">Vidros</p>
                </div>
                <Package className="w-8 h-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.byType.accessory}</p>
                  <p className="text-xs text-muted-foreground">Acessórios</p>
                </div>
                <Package className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-600">{stats.byType.service}</p>
                  <p className="text-xs text-muted-foreground">Serviços</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar itens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterLinha} onValueChange={setFilterLinha}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Linha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Linhas</SelectItem>
              {availableLines?.map((line) => (
                <SelectItem key={line} value={line}>
                  {line}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Tipos</SelectItem>
              <SelectItem value="glass">Vidros</SelectItem>
              <SelectItem value="profile">Perfis</SelectItem>
              <SelectItem value="accessory">Acessórios</SelectItem>
              <SelectItem value="service">Serviços</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showInactive ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
            {showInactive ? "Todos" : "Só ativos"}
          </Button>
        </div>

        {/* Items Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredItems?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum item encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? "Tente outro termo de busca" : "Clique em 'Novo Item' para começar"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems?.map((item) => (
              <Card 
                key={item.id} 
                className={`group relative transition-all hover:shadow-md ${
                  !item.is_active ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {item.image_url ? (
                        <div className="w-12 h-12 bg-white rounded-lg border p-1 flex-shrink-0 flex items-center justify-center">
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded-lg flex-shrink-0 flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold truncate">
                          {item.name}
                        </CardTitle>
                        {item.linha && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.linha}
                          </p>
                        )}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(item)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyMutation.mutate(item)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => toggleActiveMutation.mutate({ 
                            id: item.id, 
                            is_active: !item.is_active 
                          })}
                        >
                          {item.is_active ? (
                            <>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Desativar
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            if (confirm("Excluir este item?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {item.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {item.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={typeColors[item.type]}
                      >
                        {typeLabels[item.type]}
                      </Badge>
                      {!item.is_active && (
                        <Badge variant="secondary" className="text-xs">Inativo</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t">
                    <span className="text-xs text-muted-foreground">Preço padrão</span>
                    <span className="text-sm font-medium">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(item.default_price)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
