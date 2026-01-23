import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { 
  useProductCategories, 
  useProductCategoryMutations,
  type ProductCategory 
} from "@/hooks/useProductCategories";
import { 
  useItemTypes, 
  useItemTypeMutations,
  type ItemType 
} from "@/hooks/useItemTypes";

const colorOptions = [
  { value: "gray", label: "Cinza", class: "bg-gray-500" },
  { value: "blue", label: "Azul", class: "bg-blue-500" },
  { value: "green", label: "Verde", class: "bg-green-500" },
  { value: "cyan", label: "Ciano", class: "bg-cyan-500" },
  { value: "purple", label: "Roxo", class: "bg-purple-500" },
  { value: "orange", label: "Laranja", class: "bg-orange-500" },
  { value: "indigo", label: "Índigo", class: "bg-indigo-500" },
  { value: "rose", label: "Rosa", class: "bg-rose-500" },
  { value: "amber", label: "Âmbar", class: "bg-amber-500" },
  { value: "violet", label: "Violeta", class: "bg-violet-500" },
  { value: "emerald", label: "Esmeralda", class: "bg-emerald-500" },
  { value: "red", label: "Vermelho", class: "bg-red-500" },
];

const unitOptions = [
  { value: "un", label: "Unidade (un)" },
  { value: "m", label: "Metro (m)" },
  { value: "m²", label: "Metro² (m²)" },
  { value: "kg", label: "Quilograma (kg)" },
  { value: "L", label: "Litro (L)" },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getColorClass(color: string): string {
  const found = colorOptions.find(c => c.value === color);
  return found?.class ?? "bg-gray-500";
}

export default function AdminCategories() {
  const { isSaasAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("categories");
  
  // Categories state
  const { data: categories, isLoading: loadingCategories } = useProductCategories(true);
  const { createMutation: createCategory, updateMutation: updateCategory, deleteMutation: deleteCategory } = useProductCategoryMutations();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ProductCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", color: "gray", sort_order: 0 });
  
  // Item types state
  const { data: itemTypes, isLoading: loadingItemTypes } = useItemTypes(true);
  const { createMutation: createItemType, updateMutation: updateItemType, deleteMutation: deleteItemType } = useItemTypeMutations();
  const [itemTypeDialogOpen, setItemTypeDialogOpen] = useState(false);
  const [editingItemType, setEditingItemType] = useState<ItemType | null>(null);
  const [itemTypeForm, setItemTypeForm] = useState({ name: "", color: "gray", unit_default: "un", sort_order: 0 });

  if (!isSaasAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
            <CardDescription>Você não tem permissão para acessar esta página.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Category handlers
  const handleOpenCategoryDialog = (category?: ProductCategory) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, color: category.color, sort_order: category.sort_order });
    } else {
      setEditingCategory(null);
      const nextOrder = (categories?.length ?? 0) + 1;
      setCategoryForm({ name: "", color: "gray", sort_order: nextOrder });
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    try {
      if (editingCategory) {
        await updateCategory.mutateAsync({
          id: editingCategory.id,
          name: categoryForm.name,
          color: categoryForm.color,
          sort_order: categoryForm.sort_order,
        });
        toast.success("Categoria atualizada");
      } else {
        await createCategory.mutateAsync({
          slug: generateSlug(categoryForm.name),
          name: categoryForm.name,
          color: categoryForm.color,
          icon: null,
          sort_order: categoryForm.sort_order,
          is_active: true,
        });
        toast.success("Categoria criada");
      }
      setCategoryDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar categoria");
    }
  };

  const handleToggleCategoryActive = async (category: ProductCategory) => {
    try {
      await updateCategory.mutateAsync({ id: category.id, is_active: !category.is_active });
      toast.success(category.is_active ? "Categoria desativada" : "Categoria ativada");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar categoria");
    }
  };

  const handleDeleteCategory = async (category: ProductCategory) => {
    if (!confirm(`Deseja excluir a categoria "${category.name}"?`)) return;
    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success("Categoria excluída");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir categoria");
    }
  };

  // Item type handlers
  const handleOpenItemTypeDialog = (itemType?: ItemType) => {
    if (itemType) {
      setEditingItemType(itemType);
      setItemTypeForm({ 
        name: itemType.name, 
        color: itemType.color, 
        unit_default: itemType.unit_default,
        sort_order: itemType.sort_order 
      });
    } else {
      setEditingItemType(null);
      const nextOrder = (itemTypes?.length ?? 0) + 1;
      setItemTypeForm({ name: "", color: "gray", unit_default: "un", sort_order: nextOrder });
    }
    setItemTypeDialogOpen(true);
  };

  const handleSaveItemType = async () => {
    if (!itemTypeForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    try {
      if (editingItemType) {
        await updateItemType.mutateAsync({
          id: editingItemType.id,
          name: itemTypeForm.name,
          color: itemTypeForm.color,
          unit_default: itemTypeForm.unit_default,
          sort_order: itemTypeForm.sort_order,
        });
        toast.success("Tipo de item atualizado");
      } else {
        await createItemType.mutateAsync({
          slug: generateSlug(itemTypeForm.name),
          name: itemTypeForm.name,
          color: itemTypeForm.color,
          icon: null,
          unit_default: itemTypeForm.unit_default,
          sort_order: itemTypeForm.sort_order,
          is_active: true,
        });
        toast.success("Tipo de item criado");
      }
      setItemTypeDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar tipo de item");
    }
  };

  const handleToggleItemTypeActive = async (itemType: ItemType) => {
    try {
      await updateItemType.mutateAsync({ id: itemType.id, is_active: !itemType.is_active });
      toast.success(itemType.is_active ? "Tipo desativado" : "Tipo ativado");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar tipo");
    }
  };

  const handleDeleteItemType = async (itemType: ItemType) => {
    if (!confirm(`Deseja excluir o tipo "${itemType.name}"?`)) return;
    try {
      await deleteItemType.mutateAsync(itemType.id);
      toast.success("Tipo excluído");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir tipo");
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Categorias e Tipos</h1>
          <p className="text-muted-foreground">Gerencie categorias de produtos e tipos de itens</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="categories">Categorias de Produtos</TabsTrigger>
            <TabsTrigger value="item-types">Tipos de Itens</TabsTrigger>
          </TabsList>

          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Categorias de Produtos</CardTitle>
                  <CardDescription>Janela, Porta, Box, Espelho, etc.</CardDescription>
                </div>
                <Button onClick={() => handleOpenCategoryDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Categoria
                </Button>
              </CardHeader>
              <CardContent>
                {loadingCategories ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories?.map((category) => (
                        <TableRow key={category.id} className={!category.is_active ? "opacity-50" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              {category.sort_order}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{category.name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-sm">
                            {category.slug}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded ${getColorClass(category.color)}`} />
                              <span className="text-sm capitalize">{category.color}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={category.is_active}
                              onCheckedChange={() => handleToggleCategoryActive(category)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenCategoryDialog(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteCategory(category)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="item-types">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Tipos de Itens</CardTitle>
                  <CardDescription>Vidro, Perfil, Acessório, Serviço, etc.</CardDescription>
                </div>
                <Button onClick={() => handleOpenItemTypeDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Tipo
                </Button>
              </CardHeader>
              <CardContent>
                {loadingItemTypes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemTypes?.map((itemType) => (
                        <TableRow key={itemType.id} className={!itemType.is_active ? "opacity-50" : ""}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              {itemType.sort_order}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{itemType.name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-sm">
                            {itemType.slug}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded ${getColorClass(itemType.color)}`} />
                              <span className="text-sm capitalize">{itemType.color}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{itemType.unit_default}</Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={itemType.is_active}
                              onCheckedChange={() => handleToggleItemTypeActive(itemType)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenItemTypeDialog(itemType)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteItemType(itemType)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Category Dialog */}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
              <DialogDescription>
                {editingCategory ? "Atualize os dados da categoria" : "Adicione uma nova categoria de produtos"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="category-name">Nome</Label>
                <Input
                  id="category-name"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Ex: Janela"
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select
                  value={categoryForm.color}
                  onValueChange={(value) => setCategoryForm({ ...categoryForm, color: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-order">Ordem de exibição</Label>
                <Input
                  id="category-order"
                  type="number"
                  min={1}
                  value={categoryForm.sort_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveCategory}
                disabled={createCategory.isPending || updateCategory.isPending}
              >
                {(createCategory.isPending || updateCategory.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Item Type Dialog */}
        <Dialog open={itemTypeDialogOpen} onOpenChange={setItemTypeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItemType ? "Editar Tipo de Item" : "Novo Tipo de Item"}</DialogTitle>
              <DialogDescription>
                {editingItemType ? "Atualize os dados do tipo" : "Adicione um novo tipo de item"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="itemtype-name">Nome</Label>
                <Input
                  id="itemtype-name"
                  value={itemTypeForm.name}
                  onChange={(e) => setItemTypeForm({ ...itemTypeForm, name: e.target.value })}
                  placeholder="Ex: Vidro"
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select
                  value={itemTypeForm.color}
                  onValueChange={(value) => setItemTypeForm({ ...itemTypeForm, color: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidade Padrão</Label>
                <Select
                  value={itemTypeForm.unit_default}
                  onValueChange={(value) => setItemTypeForm({ ...itemTypeForm, unit_default: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="itemtype-order">Ordem de exibição</Label>
                <Input
                  id="itemtype-order"
                  type="number"
                  min={1}
                  value={itemTypeForm.sort_order}
                  onChange={(e) => setItemTypeForm({ ...itemTypeForm, sort_order: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setItemTypeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveItemType}
                disabled={createItemType.isPending || updateItemType.isPending}
              >
                {(createItemType.isPending || updateItemType.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
