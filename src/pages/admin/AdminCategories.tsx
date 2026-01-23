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
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
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
import { 
  useAllGlassTypes, 
  useGlassTypeMutations,
  type GlassType 
} from "@/hooks/useGlassTypes";
import { 
  useProductLinhas, 
  useProductLinhaMutations,
  type ProductLinha 
} from "@/hooks/useProductLinhas";
import { SortableTableBody } from "@/components/common/SortableTable";

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
  const [activeTab, setActiveTab] = useState("linhas");
  
  // Linhas state
  const { data: linhas, isLoading: loadingLinhas } = useProductLinhas(true);
  const { createMutation: createLinha, updateMutation: updateLinha, deleteMutation: deleteLinha } = useProductLinhaMutations();
  const [linhaDialogOpen, setLinhaDialogOpen] = useState(false);
  const [editingLinha, setEditingLinha] = useState<ProductLinha | null>(null);
  const [linhaForm, setLinhaForm] = useState({ name: "", description: "", color: "gray", sort_order: 0 });
  
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
  
  // Glass types state
  const { data: glassTypes, isLoading: loadingGlassTypes } = useAllGlassTypes();
  const { createMutation: createGlassType, updateMutation: updateGlassType, deleteMutation: deleteGlassType } = useGlassTypeMutations();
  const [glassTypeDialogOpen, setGlassTypeDialogOpen] = useState(false);
  const [editingGlassType, setEditingGlassType] = useState<GlassType | null>(null);
  const [glassTypeForm, setGlassTypeForm] = useState({ name: "", description: "", sort_order: 0 });
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

  // Linha handlers
  const handleOpenLinhaDialog = (linha?: ProductLinha) => {
    if (linha) {
      setEditingLinha(linha);
      setLinhaForm({ 
        name: linha.name, 
        description: linha.description || "", 
        color: linha.color, 
        sort_order: linha.sort_order 
      });
    } else {
      setEditingLinha(null);
      const nextOrder = (linhas?.length ?? 0) + 1;
      setLinhaForm({ name: "", description: "", color: "gray", sort_order: nextOrder });
    }
    setLinhaDialogOpen(true);
  };

  const handleSaveLinha = async () => {
    if (!linhaForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    try {
      if (editingLinha) {
        await updateLinha.mutateAsync({
          id: editingLinha.id,
          name: linhaForm.name,
          description: linhaForm.description || null,
          color: linhaForm.color,
          sort_order: linhaForm.sort_order,
        });
        toast.success("Linha atualizada");
      } else {
        await createLinha.mutateAsync({
          slug: generateSlug(linhaForm.name),
          name: linhaForm.name,
          description: linhaForm.description || null,
          image_url: null,
          color: linhaForm.color,
          sort_order: linhaForm.sort_order,
          is_active: true,
        });
        toast.success("Linha criada");
      }
      setLinhaDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar linha");
    }
  };

  const handleToggleLinhaActive = async (linha: ProductLinha) => {
    try {
      await updateLinha.mutateAsync({ id: linha.id, is_active: !linha.is_active });
      toast.success(linha.is_active ? "Linha desativada" : "Linha ativada");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar linha");
    }
  };

  const handleDeleteLinha = async (linha: ProductLinha) => {
    if (!confirm(`Deseja excluir a linha "${linha.name}"?`)) return;
    try {
      await deleteLinha.mutateAsync(linha.id);
      toast.success("Linha excluída");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir linha");
    }
  };

  const handleReorderLinhas = async (reorderedLinhas: ProductLinha[]) => {
    try {
      await Promise.all(
        reorderedLinhas.map((linha) =>
          updateLinha.mutateAsync({ id: linha.id, sort_order: linha.sort_order })
        )
      );
      toast.success("Ordem atualizada");
    } catch (error: any) {
      toast.error(error.message || "Erro ao reordenar");
    }
  };

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

  const handleReorderCategories = async (reorderedCategories: ProductCategory[]) => {
    try {
      await Promise.all(
        reorderedCategories.map((cat) =>
          updateCategory.mutateAsync({ id: cat.id, sort_order: cat.sort_order })
        )
      );
      toast.success("Ordem atualizada");
    } catch (error: any) {
      toast.error(error.message || "Erro ao reordenar");
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

  const handleReorderItemTypes = async (reorderedItemTypes: ItemType[]) => {
    try {
      await Promise.all(
        reorderedItemTypes.map((type) =>
          updateItemType.mutateAsync({ id: type.id, sort_order: type.sort_order })
        )
      );
      toast.success("Ordem atualizada");
    } catch (error: any) {
      toast.error(error.message || "Erro ao reordenar");
    }
  };

  // Glass type handlers
  const handleOpenGlassTypeDialog = (glassType?: GlassType) => {
    if (glassType) {
      setEditingGlassType(glassType);
      setGlassTypeForm({ name: glassType.name, description: glassType.description || "", sort_order: glassType.sort_order });
    } else {
      setEditingGlassType(null);
      const nextOrder = (glassTypes?.length ?? 0) + 1;
      setGlassTypeForm({ name: "", description: "", sort_order: nextOrder });
    }
    setGlassTypeDialogOpen(true);
  };

  const handleSaveGlassType = async () => {
    if (!glassTypeForm.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    
    try {
      if (editingGlassType) {
        await updateGlassType.mutateAsync({
          id: editingGlassType.id,
          name: glassTypeForm.name,
          description: glassTypeForm.description || null,
          sort_order: glassTypeForm.sort_order,
        });
        toast.success("Tipo de vidro atualizado");
      } else {
        await createGlassType.mutateAsync({
          slug: generateSlug(glassTypeForm.name),
          name: glassTypeForm.name,
          description: glassTypeForm.description || undefined,
          sort_order: glassTypeForm.sort_order,
        });
        toast.success("Tipo de vidro criado");
      }
      setGlassTypeDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar tipo de vidro");
    }
  };

  const handleToggleGlassTypeActive = async (glassType: GlassType) => {
    try {
      await updateGlassType.mutateAsync({ id: glassType.id, is_active: !glassType.is_active });
      toast.success(glassType.is_active ? "Tipo desativado" : "Tipo ativado");
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar tipo");
    }
  };

  const handleDeleteGlassType = async (glassType: GlassType) => {
    if (!confirm(`Deseja excluir o tipo "${glassType.name}"?`)) return;
    try {
      await deleteGlassType.mutateAsync(glassType.id);
      toast.success("Tipo de vidro excluído");
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir tipo de vidro");
    }
  };

  const handleReorderGlassTypes = async (reorderedGlassTypes: GlassType[]) => {
    try {
      await Promise.all(
        reorderedGlassTypes.map((type) =>
          updateGlassType.mutateAsync({ id: type.id, sort_order: type.sort_order })
        )
      );
      toast.success("Ordem atualizada");
    } catch (error: any) {
      toast.error(error.message || "Erro ao reordenar");
    }
  };

  // Render functions for sortable table cells
  const renderLinhaCells = (linha: ProductLinha) => (
    <>
      <TableCell className="font-medium">{linha.name}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">
        {linha.slug}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${getColorClass(linha.color)}`} />
          <span className="text-sm capitalize">{linha.color}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
        {linha.description || "-"}
      </TableCell>
      <TableCell>
        <Switch
          checked={linha.is_active}
          onCheckedChange={() => handleToggleLinhaActive(linha)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenLinhaDialog(linha)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteLinha(linha)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </>
  );

  const renderCategoryCells = (category: ProductCategory) => (
    <>
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
    </>
  );

  const renderItemTypeCells = (itemType: ItemType) => (
    <>
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
    </>
  );

  const renderGlassTypeCells = (glassType: GlassType) => (
    <>
      <TableCell className="font-medium">{glassType.name}</TableCell>
      <TableCell className="text-muted-foreground font-mono text-sm">
        {glassType.slug}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
        {glassType.description || "-"}
      </TableCell>
      <TableCell>
        <Switch
          checked={glassType.is_active}
          onCheckedChange={() => handleToggleGlassTypeActive(glassType)}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenGlassTypeDialog(glassType)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDeleteGlassType(glassType)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </>
  );

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Linhas, Categorias e Tipos</h1>
          <p className="text-muted-foreground">Gerencie linhas de produtos, categorias e tipos de itens. Arraste para reordenar.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="linhas">Linhas de Produtos</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="item-types">Tipos de Itens</TabsTrigger>
            <TabsTrigger value="glass-types">Tipos de Vidro</TabsTrigger>
          </TabsList>

          <TabsContent value="linhas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Linhas de Produtos</CardTitle>
                  <CardDescription>Suprema, Gold, Vidro Temperado, etc. Arraste para reordenar.</CardDescription>
                </div>
                <Button onClick={() => handleOpenLinhaDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Linha
                </Button>
              </CardHeader>
              <CardContent>
                {loadingLinhas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas && linhas.length > 0 && (
                        <SortableTableBody
                          items={linhas}
                          renderCells={renderLinhaCells}
                          getIsInactive={(linha) => !linha.is_active}
                          onReorder={handleReorderLinhas}
                        />
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Categorias de Produtos</CardTitle>
                  <CardDescription>Janela, Porta, Box, Espelho, etc. Arraste para reordenar.</CardDescription>
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
                        <TableHead className="w-20">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories && categories.length > 0 && (
                        <SortableTableBody
                          items={categories}
                          renderCells={renderCategoryCells}
                          getIsInactive={(cat) => !cat.is_active}
                          onReorder={handleReorderCategories}
                        />
                      )}
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
                  <CardDescription>Vidro, Perfil, Acessório, Serviço, etc. Arraste para reordenar.</CardDescription>
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
                        <TableHead className="w-20">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Cor</TableHead>
                        <TableHead>Unidade</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemTypes && itemTypes.length > 0 && (
                        <SortableTableBody
                          items={itemTypes}
                          renderCells={renderItemTypeCells}
                          getIsInactive={(type) => !type.is_active}
                          onReorder={handleReorderItemTypes}
                        />
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="glass-types">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Tipos de Vidro</CardTitle>
                  <CardDescription>Vidro Comum, Temperado, Laminado, etc. Arraste para reordenar.</CardDescription>
                </div>
                <Button onClick={() => handleOpenGlassTypeDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Tipo de Vidro
                </Button>
              </CardHeader>
              <CardContent>
                {loadingGlassTypes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Ordem</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Slug</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {glassTypes && glassTypes.length > 0 && (
                        <SortableTableBody
                          items={glassTypes}
                          renderCells={renderGlassTypeCells}
                          getIsInactive={(type) => !type.is_active}
                          onReorder={handleReorderGlassTypes}
                        />
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Linha Dialog */}
        <Dialog open={linhaDialogOpen} onOpenChange={setLinhaDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLinha ? "Editar Linha" : "Nova Linha"}</DialogTitle>
              <DialogDescription>
                {editingLinha ? "Atualize os dados da linha" : "Adicione uma nova linha de produtos"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="linha-name">Nome</Label>
                <Input
                  id="linha-name"
                  value={linhaForm.name}
                  onChange={(e) => setLinhaForm({ ...linhaForm, name: e.target.value })}
                  placeholder="Ex: Linha Suprema"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linha-description">Descrição (opcional)</Label>
                <Input
                  id="linha-description"
                  value={linhaForm.description}
                  onChange={(e) => setLinhaForm({ ...linhaForm, description: e.target.value })}
                  placeholder="Ex: Linha premium com acabamento superior"
                />
              </div>
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select
                  value={linhaForm.color}
                  onValueChange={(value) => setLinhaForm({ ...linhaForm, color: value })}
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
                <Label htmlFor="linha-order">Ordem de exibição</Label>
                <Input
                  id="linha-order"
                  type="number"
                  min={1}
                  value={linhaForm.sort_order}
                  onChange={(e) => setLinhaForm({ ...linhaForm, sort_order: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinhaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveLinha}
                disabled={createLinha.isPending || updateLinha.isPending}
              >
                {(createLinha.isPending || updateLinha.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

        {/* Glass Type Dialog */}
        <Dialog open={glassTypeDialogOpen} onOpenChange={setGlassTypeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingGlassType ? "Editar Tipo de Vidro" : "Novo Tipo de Vidro"}</DialogTitle>
              <DialogDescription>
                {editingGlassType ? "Atualize os dados do tipo de vidro" : "Adicione um novo tipo de vidro"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="glasstype-name">Nome</Label>
                <Input
                  id="glasstype-name"
                  value={glassTypeForm.name}
                  onChange={(e) => setGlassTypeForm({ ...glassTypeForm, name: e.target.value })}
                  placeholder="Ex: Vidro Temperado"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="glasstype-description">Descrição (opcional)</Label>
                <Input
                  id="glasstype-description"
                  value={glassTypeForm.description}
                  onChange={(e) => setGlassTypeForm({ ...glassTypeForm, description: e.target.value })}
                  placeholder="Ex: Vidro tratado termicamente para maior resistência"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="glasstype-order">Ordem de exibição</Label>
                <Input
                  id="glasstype-order"
                  type="number"
                  min={1}
                  value={glassTypeForm.sort_order}
                  onChange={(e) => setGlassTypeForm({ ...glassTypeForm, sort_order: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGlassTypeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveGlassType}
                disabled={createGlassType.isPending || updateGlassType.isPending}
              >
                {(createGlassType.isPending || updateGlassType.isPending) && (
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
