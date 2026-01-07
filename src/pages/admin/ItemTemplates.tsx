import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Pencil, Trash2, Search, Package, Upload, X } from 'lucide-react';

interface ItemTemplate {
  id: string;
  name: string;
  description: string | null;
  type: 'glass' | 'profile' | 'accessory' | 'service';
  unit: string;
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
  glass: 'bg-blue-500/10 text-blue-500',
  profile: 'bg-amber-500/10 text-amber-500',
  accessory: 'bg-green-500/10 text-green-500',
  service: 'bg-purple-500/10 text-purple-500',
};

export default function ItemTemplates() {
  const { isSaasAdmin } = useAuth();
  const { toast } = useToast();
  
  const [items, setItems] = useState<ItemTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'glass' as 'glass' | 'profile' | 'accessory' | 'service',
    unit: 'm²',
    default_price: '',
    specifications: '{}',
    is_active: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (isSaasAdmin) {
      fetchItems();
    }
  }, [isSaasAdmin]);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('item_templates')
        .select('*')
        .order('type')
        .order('name');
      
      if (error) throw error;
      setItems(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar itens',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `items/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('item-templates')
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('item-templates')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let imageUrl = editingItem?.image_url || null;

      // Upload new image if selected
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const itemData = {
        name: formData.name,
        description: formData.description || null,
        type: formData.type,
        unit: formData.unit,
        default_price: parseFloat(formData.default_price) || 0,
        specifications: JSON.parse(formData.specifications || '{}'),
        image_url: imageUrl,
        is_active: formData.is_active,
      };

      if (editingItem) {
        const { error } = await supabase
          .from('item_templates')
          .update(itemData)
          .eq('id', editingItem.id);
        
        if (error) throw error;
        toast({ title: 'Item atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('item_templates')
          .insert(itemData);
        
        if (error) throw error;
        toast({ title: 'Item criado com sucesso!' });
      }

      setDialogOpen(false);
      resetForm();
      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar item',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: ItemTemplate) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      type: item.type,
      unit: item.unit,
      default_price: item.default_price.toString(),
      specifications: JSON.stringify(item.specifications, null, 2),
      is_active: item.is_active,
    });
    setImagePreview(item.image_url);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    try {
      const { error } = await supabase
        .from('item_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: 'Item excluído com sucesso!' });
      fetchItems();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir item',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      type: 'glass',
      unit: 'm²',
      default_price: '',
      specifications: '{}',
      is_active: true,
    });
    setImageFile(null);
    setImagePreview(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || item.type === filterType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-3xl text-foreground">Item Templates</h1>
            <p className="text-muted-foreground">Gerencie vidros, perfis, acessórios e serviços globais</p>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            SaaS Admin
          </Badge>
        </div>

        {/* Actions */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar itens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="glass">Vidros</SelectItem>
                  <SelectItem value="profile">Perfis</SelectItem>
                  <SelectItem value="accessory">Acessórios</SelectItem>
                  <SelectItem value="service">Serviços</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openNewDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? 'Editar Item' : 'Novo Item'}</DialogTitle>
                    <DialogDescription>
                      {editingItem ? 'Atualize as informações do item template.' : 'Cadastre um novo item template global.'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
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
                      <div className="space-y-2">
                        <Label htmlFor="default_price">Preço Padrão (R$)</Label>
                        <Input
                          id="default_price"
                          type="number"
                          step="0.01"
                          value={formData.default_price}
                          onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-2">
                      <Label>Imagem</Label>
                      <div className="flex items-center gap-4">
                        {imagePreview ? (
                          <div className="relative">
                            <img 
                              src={imagePreview} 
                              alt="Preview" 
                              className="w-24 h-24 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={clearImage}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground mt-1">Upload</span>
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

                    <div className="space-y-2">
                      <Label htmlFor="specifications">Especificações (JSON)</Label>
                      <Textarea
                        id="specifications"
                        value={formData.specifications}
                        onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                        rows={3}
                        className="font-mono text-sm"
                        placeholder='{"espessura": "8mm", "cor": "incolor"}'
                      />
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingItem ? 'Atualizar' : 'Criar'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Itens Cadastrados
            </CardTitle>
            <CardDescription>
              {filteredItems.length} item(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imagem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Preço Padrão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum item encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.image_url ? (
                          <div className="w-16 h-16 bg-white rounded-lg border p-1 flex items-center justify-center">
                            <img 
                              src={item.image_url} 
                              alt={item.name}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={typeColors[item.type]}>
                          {typeLabels[item.type]}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(item.default_price)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.is_active ? 'default' : 'secondary'}>
                          {item.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
