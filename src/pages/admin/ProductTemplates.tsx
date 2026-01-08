import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Package, 
  Settings2, 
  ArrowLeft, 
  Search,
  Layers,
  Ruler,
  Copy,
  MoreVertical,
  Eye,
  EyeOff,
  Upload,
  ImageUp,
  CheckCircle2,
  XCircle,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  created_at: string;
};

type ProductTemplateItem = {
  id: string;
  product_template_id: string;
  item_template_id: string;
  quantity_formula: string;
  pieces_quantity: number;
  cut_angle: number;
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
  linha: string | null;
};

type ProductCategory = "window" | "door" | "shower" | "mirror" | "partition" | "facade" | "other";

const categoriesList: ProductCategory[] = ["window", "door", "shower", "mirror", "partition", "facade", "other"];

const categoryLabels: Record<string, string> = {
  window: "Janela",
  door: "Porta",
  shower: "Box",
  mirror: "Espelho",
  partition: "Divisória",
  facade: "Fachada",
  other: "Outro",
};

const categoryColors: Record<string, string> = {
  window: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  door: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  shower: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  mirror: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  partition: "bg-green-500/10 text-green-600 border-green-500/20",
  facade: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  other: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

export default function ProductTemplates() {
  const { linha: linhaParam } = useParams<{ linha?: string }>();
  const navigate = useNavigate();
  const { isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCompositionDialogOpen, setIsCompositionDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProductTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLinha, setFilterLinha] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  
  // Bulk upload state
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [bulkUploadProgress, setBulkUploadProgress] = useState<{
    total: number;
    processed: number;
    matched: number;
    notMatched: string[];
    isUploading: boolean;
  }>({
    total: 0,
    processed: 0,
    matched: 0,
    notMatched: [],
    isUploading: false,
  });
  
  const currentLinha = linhaParam ? decodeURIComponent(linhaParam) : null;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "window" as ProductCategory,
    linha: currentLinha || "",
    min_width: "",
    max_width: "",
    min_height: "",
    max_height: "",
    is_active: true,
  });

  // Fetch product templates with composition count
  const { data: templates, isLoading } = useQuery({
    queryKey: ["product-templates", currentLinha],
    queryFn: async () => {
      let query = supabase.from("product_templates").select("*");
      
      if (currentLinha) {
        query = query.eq("linha", currentLinha);
      }
      
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data as ProductTemplate[];
    },
  });

  // Fetch composition counts for all templates
  const { data: compositionCounts } = useQuery({
    queryKey: ["product-template-items-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_template_items")
        .select("product_template_id");
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach((item) => {
        counts[item.product_template_id] = (counts[item.product_template_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Fetch available lines
  const { data: availableLines } = useQuery({
    queryKey: ["available-lines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_templates")
        .select("linha")
        .not("linha", "is", null);
      if (error) throw error;
      const lines = [...new Set(data.map((d) => d.linha).filter(Boolean))];
      return lines as string[];
    },
  });

  // Fetch item templates for composition
  const { data: itemTemplates } = useQuery({
    queryKey: ["item-templates-active", currentLinha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_templates")
        .select("id, name, type, unit, linha")
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
        .eq("product_template_id", selectedTemplate.id)
        .order("created_at");
      if (error) throw error;
      return data as ProductTemplateItem[];
    },
    enabled: !!selectedTemplate,
  });

  // Filter templates
  const filteredTemplates = templates?.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || template.category === filterCategory;
    const matchesLinha = filterLinha === "all" || template.linha === filterLinha;
    const matchesActive = showInactive || template.is_active;
    return matchesSearch && matchesCategory && matchesLinha && matchesActive;
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        category: data.category,
        linha: data.linha || null,
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
      queryClient.invalidateQueries({ queryKey: ["admin-product-linhas"] });
      queryClient.invalidateQueries({ queryKey: ["available-lines"] });
      toast.success(editingTemplate ? "Produto atualizado!" : "Produto criado!");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete composition items
      await supabase.from("product_template_items").delete().eq("product_template_id", id);
      const { error } = await supabase.from("product_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      queryClient.invalidateQueries({ queryKey: ["product-template-items-counts"] });
      toast.success("Produto excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir: " + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("product_templates")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      toast.success("Status atualizado!");
    },
  });

  // Copy product mutation
  const copyMutation = useMutation({
    mutationFn: async (template: ProductTemplate) => {
      // Create copy of product
      const { data: newProduct, error: productError } = await supabase
        .from("product_templates")
        .insert([{
          name: `${template.name} (Cópia)`,
          description: template.description,
          category: template.category as "window" | "door" | "shower" | "mirror" | "partition" | "facade" | "other",
          linha: template.linha,
          min_width: template.min_width,
          max_width: template.max_width,
          min_height: template.min_height,
          max_height: template.max_height,
          is_active: false,
        }])
        .select()
        .single();
      if (productError) throw productError;

      // Copy composition items
      const { data: items } = await supabase
        .from("product_template_items")
        .select("*")
        .eq("product_template_id", template.id);

      if (items && items.length > 0) {
        const newItems = items.map((item) => ({
          product_template_id: newProduct.id,
          item_template_id: item.item_template_id,
          quantity_formula: item.quantity_formula,
          pieces_quantity: item.pieces_quantity,
          cut_angle: item.cut_angle,
          is_optional: item.is_optional,
          notes: item.notes,
        }));
        await supabase.from("product_template_items").insert(newItems);
      }

      return newProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      queryClient.invalidateQueries({ queryKey: ["product-template-items-counts"] });
      toast.success("Produto duplicado!");
    },
    onError: (error) => {
      toast.error("Erro ao duplicar: " + error.message);
    },
  });

  // Add composition item mutation
  const addCompositionMutation = useMutation({
    mutationFn: async (data: { 
      item_template_id: string; 
      quantity_formula: string; 
      pieces_quantity: number;
      cut_angle: number;
      is_optional: boolean;
      notes: string;
    }) => {
      if (!selectedTemplate) throw new Error("Nenhum template selecionado");
      const { error } = await supabase.from("product_template_items").insert({
        product_template_id: selectedTemplate.id,
        item_template_id: data.item_template_id,
        quantity_formula: data.quantity_formula,
        pieces_quantity: data.pieces_quantity,
        cut_angle: data.cut_angle,
        is_optional: data.is_optional,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-template-items", selectedTemplate?.id] });
      queryClient.invalidateQueries({ queryKey: ["product-template-items-counts"] });
      toast.success("Item adicionado!");
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
      queryClient.invalidateQueries({ queryKey: ["product-template-items-counts"] });
      toast.success("Item removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });

  // Quick image upload mutation
  const quickImageUploadMutation = useMutation({
    mutationFn: async ({ templateId, file }: { templateId: string; file: File }) => {
      setUploadingImageId(templateId);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-templates')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-templates')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('product_templates')
        .update({ image_url: urlData.publicUrl })
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
      toast.success('Imagem atualizada!');
      setUploadingImageId(null);
    },
    onError: (error) => {
      toast.error('Erro ao atualizar imagem: ' + error.message);
      setUploadingImageId(null);
    },
  });

  const handleQuickImageUpload = (templateId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        quickImageUploadMutation.mutate({ templateId, file });
      }
    };
    input.click();
  };

  // Bulk image upload handler
  const handleBulkImageUpload = async (files: FileList) => {
    if (!templates) return;
    
    setBulkUploadProgress({
      total: files.length,
      processed: 0,
      matched: 0,
      notMatched: [],
      isUploading: true,
    });
    setBulkUploadDialogOpen(true);

    const notMatchedFiles: string[] = [];
    let matchedCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      
      // Try to find matching template by name (case-insensitive, ignoring spaces/dashes)
      const normalizedFileName = fileName.toLowerCase().replace(/[-_\s]+/g, '-');
      const matchingTemplate = templates.find(template => {
        const normalizedTemplateName = template.name.toLowerCase().replace(/[-_\s]+/g, '-');
        return normalizedTemplateName === normalizedFileName;
      });

      if (matchingTemplate) {
        try {
          const fileExt = file.name.split('.').pop();
          const storageName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `products/${storageName}`;

          const { error: uploadError } = await supabase.storage
            .from('product-templates')
            .upload(filePath, file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('product-templates')
              .getPublicUrl(filePath);

            await supabase
              .from('product_templates')
              .update({ image_url: urlData.publicUrl })
              .eq('id', matchingTemplate.id);
            
            matchedCount++;
          }
        } catch (err) {
          console.error('Error uploading:', err);
          notMatchedFiles.push(fileName + ' (erro)');
        }
      } else {
        notMatchedFiles.push(fileName);
      }

      setBulkUploadProgress(prev => ({
        ...prev,
        processed: i + 1,
        matched: matchedCount,
        notMatched: notMatchedFiles,
      }));
    }

    setBulkUploadProgress(prev => ({ ...prev, isUploading: false }));
    queryClient.invalidateQueries({ queryKey: ['product-templates'] });
    
    if (matchedCount > 0) {
      toast.success(`${matchedCount} imagens atualizadas!`);
    }
  };

  const openBulkUploadDialog = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        handleBulkImageUpload(files);
      }
    };
    input.click();
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: "",
      description: "",
      category: "window" as ProductCategory,
      linha: currentLinha || "",
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
      linha: template.linha || "",
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

  // Filter item templates for composition - prioritize same line
  const sortedItemTemplates = itemTemplates?.sort((a, b) => {
    const aIsCurrentLine = a.linha === currentLinha || a.linha === selectedTemplate?.linha;
    const bIsCurrentLine = b.linha === currentLinha || b.linha === selectedTemplate?.linha;
    if (aIsCurrentLine && !bIsCurrentLine) return -1;
    if (!aIsCurrentLine && bIsCurrentLine) return 1;
    return a.name.localeCompare(b.name);
  });

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
          <div className="flex items-center gap-4">
            {currentLinha && (
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin/linhas')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {currentLinha ? `Produtos - ${currentLinha}` : 'Produtos Templates'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {filteredTemplates?.length || 0} produtos 
                {currentLinha ? ` na linha ${currentLinha}` : ' cadastrados'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openBulkUploadDialog}>
              <ImageUp className="w-4 h-4 mr-2" />
              Upload em Lote
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleCloseDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Produto
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? "Editar Produto" : "Novo Produto"}
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
                      placeholder="Ex: Janela 2 Folhas"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linha">Linha</Label>
                    <Select
                      value={formData.linha}
                      onValueChange={(value) => setFormData({ ...formData, linha: value })}
                      disabled={!!currentLinha}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma linha" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLines?.map((line) => (
                          <SelectItem key={line} value={line}>
                            {line}
                          </SelectItem>
                        ))}
                        <SelectItem value="new">+ Nova Linha</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.linha === "new" && (
                      <Input
                        value=""
                        onChange={(e) => setFormData({ ...formData, linha: e.target.value })}
                        placeholder="Nome da nova linha"
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria *</Label>
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
                            {categoryLabels[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descrição do produto"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Ruler className="w-4 h-4" />
                    Dimensões (mm)
                  </Label>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Larg. Mín</span>
                      <Input
                        type="number"
                        value={formData.min_width}
                        onChange={(e) => setFormData({ ...formData, min_width: e.target.value })}
                        placeholder="500"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Larg. Máx</span>
                      <Input
                        type="number"
                        value={formData.max_width}
                        onChange={(e) => setFormData({ ...formData, max_width: e.target.value })}
                        placeholder="2000"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Alt. Mín</span>
                      <Input
                        type="number"
                        value={formData.min_height}
                        onChange={(e) => setFormData({ ...formData, min_height: e.target.value })}
                        placeholder="500"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Alt. Máx</span>
                      <Input
                        type="number"
                        value={formData.max_height}
                        onChange={(e) => setFormData({ ...formData, max_height: e.target.value })}
                        placeholder="2200"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Produto ativo</Label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
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
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
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
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categoriesList.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabels[cat]}
                </SelectItem>
              ))}
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

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-40" />
              </Card>
            ))}
          </div>
        ) : filteredTemplates?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum produto encontrado</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? "Tente outro termo de busca" : "Clique em 'Novo Produto' para começar"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates?.map((template) => (
              <Card 
                key={template.id} 
                className={`group relative transition-all hover:shadow-md ${
                  !template.is_active ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold truncate">
                        {template.name}
                      </CardTitle>
                      {template.description && (
                        <CardDescription className="text-xs mt-1 line-clamp-1">
                          {template.description}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedTemplate(template);
                          setIsCompositionDialogOpen(true);
                        }}>
                          <Settings2 className="w-4 h-4 mr-2" />
                          Composição
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleQuickImageUpload(template.id)}
                          disabled={uploadingImageId === template.id}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingImageId === template.id 
                            ? "Enviando..." 
                            : template.image_url 
                              ? "Trocar Imagem" 
                              : "Adicionar Imagem"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyMutation.mutate(template)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => toggleActiveMutation.mutate({ 
                            id: template.id, 
                            is_active: !template.is_active 
                          })}
                        >
                          {template.is_active ? (
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
                            if (confirm("Excluir este produto e sua composição?")) {
                              deleteMutation.mutate(template.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant="outline" 
                      className={categoryColors[template.category] || categoryColors.other}
                    >
                      {categoryLabels[template.category] || template.category}
                    </Badge>
                    {!template.is_active && (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {/* Image thumbnail */}
                  {template.image_url ? (
                    <div className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-gradient-to-br from-muted to-muted/50 border border-border/50 shadow-sm">
                      <img 
                        src={template.image_url} 
                        alt={template.name}
                        className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickImageUpload(template.id);
                        }}
                        className="absolute bottom-2 right-2 p-1.5 rounded-md bg-background/80 backdrop-blur-sm border border-border/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-background"
                        disabled={uploadingImageId === template.id}
                      >
                        <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickImageUpload(template.id);
                      }}
                      disabled={uploadingImageId === template.id}
                      className="relative aspect-[4/3] w-full rounded-lg overflow-hidden bg-gradient-to-br from-muted/50 to-muted border-2 border-dashed border-border/50 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted transition-colors duration-200 cursor-pointer group"
                    >
                      {uploadingImageId === template.id ? (
                        <div className="animate-pulse text-muted-foreground text-xs">Enviando...</div>
                      ) : (
                        <>
                          <div className="p-3 rounded-full bg-muted-foreground/10 group-hover:bg-primary/10 transition-colors">
                            <ImageUp className="w-6 h-6 text-muted-foreground/60 group-hover:text-primary/60 transition-colors" />
                          </div>
                          <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                            Adicionar imagem
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Dimensions */}
                  {(template.min_width || template.max_width || template.min_height || template.max_height) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Ruler className="w-3 h-3" />
                      <span>
                        L: {template.min_width || "?"} - {template.max_width || "?"} mm
                      </span>
                      <span>•</span>
                      <span>
                        A: {template.min_height || "?"} - {template.max_height || "?"} mm
                      </span>
                    </div>
                  )}
                  
                  {/* Composition count */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm">
                      <Layers className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {compositionCounts?.[template.id] || 0} itens na composição
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setIsCompositionDialogOpen(true);
                      }}
                    >
                      <Settings2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Composition Dialog */}
        <Dialog open={isCompositionDialogOpen} onOpenChange={setIsCompositionDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Composição: {selectedTemplate?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Add item form */}
              <Card className="bg-muted/50">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </CardTitle>
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
                        pieces_quantity: parseInt(formData.get("pieces_quantity") as string) || 1,
                        cut_angle: parseInt(formData.get("cut_angle") as string) || 90,
                        is_optional: formData.get("is_optional") === "on",
                        notes: formData.get("notes") as string || "",
                      });
                      form.reset();
                    }}
                    className="grid grid-cols-6 gap-3 items-end"
                  >
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Item *</Label>
                      <Select name="item_template_id" required>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedItemTemplates?.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              <span className="flex items-center gap-2">
                                {item.name}
                                <Badge variant="outline" className="text-xs">
                                  {item.type}
                                </Badge>
                                {item.linha === selectedTemplate?.linha && (
                                  <Badge variant="secondary" className="text-xs">
                                    {item.linha}
                                  </Badge>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fórmula *</Label>
                      <Input
                        name="quantity_formula"
                        placeholder="Altura - 50"
                        defaultValue="1"
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qtd Peças</Label>
                      <Input
                        name="pieces_quantity"
                        type="number"
                        defaultValue="1"
                        min="1"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ângulo °</Label>
                      <Input
                        name="cut_angle"
                        type="number"
                        defaultValue="90"
                        min="0"
                        max="90"
                      />
                    </div>
                    <Button type="submit" disabled={addCompositionMutation.isPending}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adicionar
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Items list */}
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Fórmula</TableHead>
                      <TableHead className="text-center">Peças</TableHead>
                      <TableHead className="text-center">Ângulo</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {compositionItems?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
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
                            <Badge variant="outline" className="text-xs">
                              {item.item_template?.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                              {item.quantity_formula}
                            </code>
                          </TableCell>
                          <TableCell className="text-center">
                            {item.pieces_quantity}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.cut_angle}°
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                            {item.notes || "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCompositionMutation.mutate(item.id)}
                              className="h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </DialogContent>
        </Dialog>
        {/* Bulk Upload Progress Dialog */}
        <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageUp className="w-5 h-5" />
                Upload de Imagens em Lote
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progresso</span>
                  <span>{bulkUploadProgress.processed} / {bulkUploadProgress.total}</span>
                </div>
                <Progress 
                  value={(bulkUploadProgress.processed / bulkUploadProgress.total) * 100} 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>{bulkUploadProgress.matched} associadas</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span>{bulkUploadProgress.notMatched.length} não encontradas</span>
                </div>
              </div>

              {bulkUploadProgress.notMatched.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Arquivos sem correspondência:
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-muted rounded-md p-2">
                    {bulkUploadProgress.notMatched.map((file, i) => (
                      <div key={i} className="text-xs text-muted-foreground truncate">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!bulkUploadProgress.isUploading && (
                <Button 
                  className="w-full" 
                  onClick={() => setBulkUploadDialogOpen(false)}
                >
                  Fechar
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
