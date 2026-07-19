import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  useProductLinhas, 
  useProductLinhaMutations,
  type ProductLinha 
} from "@/hooks/useProductLinhas";
import { LinhasTab } from "@/components/admin/categories/LinhasTab";
import { CategoriesTab } from "@/components/admin/categories/CategoriesTab";
import { ItemTypesTab } from "@/components/admin/categories/ItemTypesTab";

import {
  LinhaDialog,
  CategoryDialog,
  ItemTypeDialog,
  getColorClass,
  generateSlug,
} from "@/components/admin/categories/CategoryDialogs";

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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao salvar linha";
      toast.error(message);
    }
  };

  const handleToggleLinhaActive = async (linha: ProductLinha) => {
    try {
      await updateLinha.mutateAsync({ id: linha.id, is_active: !linha.is_active });
      toast.success(linha.is_active ? "Linha desativada" : "Linha ativada");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar linha";
      toast.error(message);
    }
  };

  const handleDeleteLinha = async (linha: ProductLinha) => {
    if (!confirm(`Deseja excluir a linha "${linha.name}"?`)) return;
    try {
      await deleteLinha.mutateAsync(linha.id);
      toast.success("Linha excluída");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao excluir linha";
      toast.error(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao reordenar";
      toast.error(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao salvar categoria";
      toast.error(message);
    }
  };

  const handleToggleCategoryActive = async (category: ProductCategory) => {
    try {
      await updateCategory.mutateAsync({ id: category.id, is_active: !category.is_active });
      toast.success(category.is_active ? "Categoria desativada" : "Categoria ativada");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar categoria";
      toast.error(message);
    }
  };

  const handleDeleteCategory = async (category: ProductCategory) => {
    if (!confirm(`Deseja excluir a categoria "${category.name}"?`)) return;
    try {
      await deleteCategory.mutateAsync(category.id);
      toast.success("Categoria excluída");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao excluir categoria";
      toast.error(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao reordenar";
      toast.error(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao salvar tipo de item";
      toast.error(message);
    }
  };

  const handleToggleItemTypeActive = async (itemType: ItemType) => {
    try {
      await updateItemType.mutateAsync({ id: itemType.id, is_active: !itemType.is_active });
      toast.success(itemType.is_active ? "Tipo desativado" : "Tipo ativado");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar tipo";
      toast.error(message);
    }
  };

  const handleDeleteItemType = async (itemType: ItemType) => {
    if (!confirm(`Deseja excluir o tipo "${itemType.name}"?`)) return;
    try {
      await deleteItemType.mutateAsync(itemType.id);
      toast.success("Tipo excluído");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao excluir tipo";
      toast.error(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao reordenar";
      toast.error(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao salvar tipo de vidro";
      toast.error(message);
    }
  };

  const handleToggleGlassTypeActive = async (glassType: GlassType) => {
    try {
      await updateGlassType.mutateAsync({ id: glassType.id, is_active: !glassType.is_active });
      toast.success(glassType.is_active ? "Tipo desativado" : "Tipo ativado");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar tipo";
      toast.error(message);
    }
  };

  const handleDeleteGlassType = async (glassType: GlassType) => {
    if (!confirm(`Deseja excluir o tipo "${glassType.name}"?`)) return;
    try {
      await deleteGlassType.mutateAsync(glassType.id);
      toast.success("Tipo de vidro excluído");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao excluir tipo de vidro";
      toast.error(message);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao reordenar";
      toast.error(message);
    }
  };

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
            
            
          </TabsList>

          <TabsContent value="linhas">
            <LinhasTab
              linhas={linhas}
              isLoading={loadingLinhas}
              getColorClass={getColorClass}
              onOpenDialog={handleOpenLinhaDialog}
              onToggleActive={handleToggleLinhaActive}
              onDelete={handleDeleteLinha}
              onReorder={handleReorderLinhas}
            />
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesTab
              categories={categories}
              isLoading={loadingCategories}
              getColorClass={getColorClass}
              onOpenDialog={handleOpenCategoryDialog}
              onToggleActive={handleToggleCategoryActive}
              onDelete={handleDeleteCategory}
              onReorder={handleReorderCategories}
            />
          </TabsContent>

          <TabsContent value="item-types">
            <ItemTypesTab
              itemTypes={itemTypes}
              isLoading={loadingItemTypes}
              getColorClass={getColorClass}
              onOpenDialog={handleOpenItemTypeDialog}
              onToggleActive={handleToggleItemTypeActive}
              onDelete={handleDeleteItemType}
              onReorder={handleReorderItemTypes}
            />
          </TabsContent>




        </Tabs>

        {/* Dialogs */}
        <LinhaDialog
          open={linhaDialogOpen}
          onOpenChange={setLinhaDialogOpen}
          isEditing={!!editingLinha}
          form={linhaForm}
          setForm={setLinhaForm}
          onSave={handleSaveLinha}
          isPending={createLinha.isPending || updateLinha.isPending}
        />

        <CategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          isEditing={!!editingCategory}
          form={categoryForm}
          setForm={setCategoryForm}
          onSave={handleSaveCategory}
          isPending={createCategory.isPending || updateCategory.isPending}
        />

        <ItemTypeDialog
          open={itemTypeDialogOpen}
          onOpenChange={setItemTypeDialogOpen}
          isEditing={!!editingItemType}
          form={itemTypeForm}
          setForm={setItemTypeForm}
          onSave={handleSaveItemType}
          isPending={createItemType.isPending || updateItemType.isPending}
        />

        <GlassTypeDialog
          open={glassTypeDialogOpen}
          onOpenChange={setGlassTypeDialogOpen}
          isEditing={!!editingGlassType}
          form={glassTypeForm}
          setForm={setGlassTypeForm}
          onSave={handleSaveGlassType}
          isPending={createGlassType.isPending || updateGlassType.isPending}
        />
      </div>
    </AdminLayout>
  );
}
