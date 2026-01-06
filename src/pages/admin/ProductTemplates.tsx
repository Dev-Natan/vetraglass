import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Settings2 } from "lucide-react";

type ProductTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  is_active: boolean;
  min_width: number | null;
  max_width: number | null;
  min_height: number | null;
  max_height: number | null;
  created_at: string;
};

type ProductTemplateItem = {
  id: string;
  product_template_id: string;
  item_template_id: string;
  quantity_formula: string;
  is_optional: boolean;
  notes: string | null;
  item_template?: {
    id: string;
    name: string;
    type: string;
    unit: string;
  };
};

type ItemTemplate = {
  id: string;
  name: string;
  type: string;
  unit: string;
};

type ProductCategory = "window" | "door" | "shower" | "mirror" | "partition" | "facade" | "other";

const categoriesList: ProductCategory[] = ["window", "door", "shower", "mirror", "partition", "facade", "other"];

export default function ProductTemplates() {
  const { isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCompositionDialogOpen, setIsCompositionDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProductTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "shower" as ProductCategory,
    min_width: "",
    max_width: "",
    min_height: "",
    max_height: "",
    is_active: true,
  });

  // Fetch product templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["product-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as ProductTemplate[];
    },
  });

  // Fetch item templates for composition
  const { data: itemTemplates } = useQuery({
    queryKey: ["item-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_templates")
        .select("id, name, type, unit")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as ItemTemplate[];
    },
  });

  // Fetch composition items for selected template
  const { data: compositionItems } = useQuery({
    queryKey: ["product-template-items", selectedTemplate?.id],
    queryFn: async () => {
      if (!selectedTemplate) return [];
      const { data, error } = await supabase
        .from("product_template_items")
        .select(`
          *,
          item_template:item_templates(id, name, type, unit)
        `)
        .eq("product_template_id", selectedTemplate.id);
      if (error) throw error;
      return data as ProductTemplateItem[];
    },
    enabled: !!selectedTemplate,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        category: data.category,
        min_width: data.min_width ? parseFloat(data.min_width) : null,
        max_width: data.max_width ? parseFloat(data.max_width) : null,
        min_height: data.min_height ? parseFloat(data.min_height) : null,
        max_height: data.max_height ? parseFloat(data.max_height) : null,
        is_active: data.is_active,
      };

      if (data.id) {
        const { error } = await supabase
          .from("product_templates")
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      toast.success(editingTemplate ? "Template atualizado!" : "Template criado!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      toast.success("Template excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  // Add composition item mutation
  const addCompositionMutation = useMutation({
    mutationFn: async (data: { item_template_id: string; quantity_formula: string; is_optional: boolean }) => {
      if (!selectedTemplate) throw new Error("Nenhum template selecionado");
      const { error } = await supabase.from("product_template_items").insert({
        product_template_id: selectedTemplate.id,
        item_template_id: data.item_template_id,
        quantity_formula: data.quantity_formula,
        is_optional: data.is_optional,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-template-items", selectedTemplate?.id] });
      toast.success("Item adicionado à composição!");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar: " + error.message);
    },
  });

  // Remove composition item mutation
  const removeCompositionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_template_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-template-items", selectedTemplate?.id] });
      toast.success("Item removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      category: "shower" as ProductCategory,
      min_width: "",
      max_width: "",
      min_height: "",
      max_height: "",
      is_active: true,
    });
  };

  const handleEdit = (template: ProductTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      category: template.category as ProductCategory,
      min_width: template.min_width?.toString() || "",
      max_width: template.max_width?.toString() || "",
      min_height: template.min_height?.toString() || "",
      max_height: template.max_height?.toString() || "",
      is_active: template.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, id: editingTemplate?.id });
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      box: "Box",
      porta: "Porta",
      janela: "Janela",
      espelho: "Espelho",
      fechamento: "Fechamento",
      outro: "Outro",
    };
    return labels[category] || category;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Product Templates</h1>
            <p className="text-muted-foreground">
              Gerencie os modelos de produtos globais do sistema
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleCloseDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Editar Template" : "Novo Template de Produto"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Box Canto 90°"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value as ProductCategory })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesList.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {getCategoryLabel(cat)}
                          </SelectItem>
                        ))}
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
                    placeholder="Descrição do produto modelo"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_width">Largura Mín (mm)</Label>
                    <Input
                      id="min_width"
                      type="number"
                      value={formData.min_width}
                      onChange={(e) => setFormData({ ...formData, min_width: e.target.value })}
                      placeholder="500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_width">Largura Máx (mm)</Label>
                    <Input
                      id="max_width"
                      type="number"
                      value={formData.max_width}
                      onChange={(e) => setFormData({ ...formData, max_width: e.target.value })}
                      placeholder="2000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min_height">Altura Mín (mm)</Label>
                    <Input
                      id="min_height"
                      type="number"
                      value={formData.min_height}
                      onChange={(e) => setFormData({ ...formData, min_height: e.target.value })}
                      placeholder="1000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_height">Altura Máx (mm)</Label>
                    <Input
                      id="max_height"
                      type="number"
                      value={formData.max_height}
                      onChange={(e) => setFormData({ ...formData, max_height: e.target.value })}
                      placeholder="2200"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Ativo</Label>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Composition Dialog */}
        <Dialog open={isCompositionDialogOpen} onOpenChange={setIsCompositionDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Composição: {selectedTemplate?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Add item form */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Adicionar Item</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const formData = new FormData(form);
                      addCompositionMutation.mutate({
                        item_template_id: formData.get("item_template_id") as string,
                        quantity_formula: formData.get("quantity_formula") as string || "1",
                        is_optional: formData.get("is_optional") === "on",
                      });
                      form.reset();
                    }}
                    className="flex gap-4 items-end"
                  >
                    <div className="flex-1 space-y-2">
                      <Label>Item</Label>
                      <Select name="item_template_id" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um item" />
                        </SelectTrigger>
                        <SelectContent>
                          {itemTemplates?.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name} ({item.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-48 space-y-2">
                      <Label>Fórmula Qtd</Label>
                      <Input
                        name="quantity_formula"
                        placeholder="Ex: largura * altura"
                        defaultValue="1"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" name="is_optional" id="is_optional" />
                      <Label htmlFor="is_optional">Opcional</Label>
                    </div>
                    <Button type="submit" disabled={addCompositionMutation.isPending}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Items list */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fórmula Quantidade</TableHead>
                    <TableHead>Opcional</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compositionItems?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum item na composição
                      </TableCell>
                    </TableRow>
                  ) : (
                    compositionItems?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.item_template?.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.item_template?.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-sm bg-muted px-2 py-1 rounded">
                            {item.quantity_formula}
                          </code>
                        </TableCell>
                        <TableCell>
                          {item.is_optional ? (
                            <Badge variant="secondary">Opcional</Badge>
                          ) : (
                            <Badge>Obrigatório</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCompositionMutation.mutate(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>

        {/* Templates Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Dimensões (mm)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : templates?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum template cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  templates?.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{template.name}</p>
                            {template.description && (
                              <p className="text-sm text-muted-foreground truncate max-w-xs">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryLabel(template.category)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.min_width || template.max_width ? (
                          <>
                            L: {template.min_width || "?"} - {template.max_width || "?"}
                            <br />
                            A: {template.min_height || "?"} - {template.max_height || "?"}
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {template.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTemplate(template);
                              setIsCompositionDialogOpen(true);
                            }}
                            title="Composição"
                          >
                            <Settings2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(template)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Excluir este template?")) {
                                deleteMutation.mutate(template.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
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
