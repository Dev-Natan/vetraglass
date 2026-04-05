import { useEffect, useRef, useState } from "react";
import { resolveImageUrl } from '@/utils/imageUrl';
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { processFileWithWhiteBackground } from '@/utils/imageBackgroundProcessor';
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
import { FormulaEditor } from "@/components/produtos/FormulaEditor";
import { GlassFormulaEditor } from "@/components/produtos/GlassFormulaEditor";
import { cn } from "@/lib/utils";
import { useProductCategoryLabels } from "@/hooks/useProductCategories";
import { useItemTypeLabels } from "@/hooks/useItemTypes";
import { useProductLinhas } from "@/hooks/useProductLinhas";

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
  width_formula: string | null;
  height_formula: string | null;
  item_template?: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    linha: string | null;
  };
};

type ItemTemplate = {
  id: string;
  name: string;
  type: string;
  unit: string;
  linha: string | null;
  image_url: string | null;
};

type CompositionDraft = {
  templateId: string;
  activeTab: string;
  selectedItemToAdd: string;
  quantityFormula: string;
  piecesQuantity: number;
  widthFormula: string;
  heightFormula: string;
  glassName: string;
  cutAngle: number;
  isOpen: boolean;
};

const COMPOSITION_DRAFT_STORAGE_KEY = "admin-product-template-composition-draft";

// Item type tabs for the dialog - derived from itemTypes hook
const getItemTypeTabs = (itemTypes: { slug: string; name: string }[] | undefined) => {
  const defaultTabs = [
    { value: 'glass', label: 'VIDROS', dbType: 'glass' },
    { value: 'profile', label: 'PERFIS', dbType: 'profile' },
    { value: 'accessory', label: 'ACESSÓRIOS', dbType: 'accessory' },
  ];
  
  if (!itemTypes?.length) return defaultTabs;
  
  return itemTypes.map(type => ({
    value: type.slug,
    label: type.name.toUpperCase(),
    dbType: type.slug,
  }));
};

export default function ProductTemplates() {
  const { linha: linhaParam } = useParams<{ linha?: string }>();
  
  // Dynamic categories, item types and linhas from hooks
  const { labels: categoryLabels, colors: categoryColors, categories: productCategories } = useProductCategoryLabels();
  const { labels: typeLabels, colors: typeColors, itemTypes } = useItemTypeLabels();
  const { data: productLinhas } = useProductLinhas();
  
  const categoriesList = productCategories?.map(c => c.slug) || [];
  const itemTypeTabs = getItemTypeTabs(itemTypes);
  const availableLines = productLinhas?.map(l => l.name) || [];
  const navigate = useNavigate();
  const { isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();
  const compositionDraftRestoredRef = useRef(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCompositionDialogOpen, setIsCompositionDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProductTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLinha, setFilterLinha] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  
  // Composition dialog states
  const [compositionActiveTab, setCompositionActiveTab] = useState("glass");
  const [selectedItemToAdd, setSelectedItemToAdd] = useState("");
  const [quantityFormula, setQuantityFormula] = useState("1");
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [widthFormula, setWidthFormula] = useState("");
  const [heightFormula, setHeightFormula] = useState("");
  const [glassName, setGlassName] = useState("");
  const [cutAngle, setCutAngle] = useState(90);
  
  // Edit item dialog states
  const [editingItem, setEditingItem] = useState<ProductTemplateItem | null>(null);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [editQuantityFormula, setEditQuantityFormula] = useState("1");
  const [editPiecesQuantity, setEditPiecesQuantity] = useState(1);
  const [editPiecesFormula, setEditPiecesFormula] = useState<string | null>(null);
  const [editWidthFormula, setEditWidthFormula] = useState("");
  const [editHeightFormula, setEditHeightFormula] = useState("");
  const [editGlassName, setEditGlassName] = useState("");
  const [editCutAngle, setEditCutAngle] = useState(90);
  
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
    category: "janelas",
    linha: currentLinha || "",
    min_width: "",
    max_width: "",
    min_height: "",
    max_height: "",
    is_active: true,
  });

  const clearCompositionDraft = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(COMPOSITION_DRAFT_STORAGE_KEY);
  };

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

  // availableLines is now provided by useProductLinhas hook above

  // Fetch item templates for composition
  const { data: itemTemplates } = useQuery({
    queryKey: ["item-templates-active", currentLinha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_templates")
        .select("id, name, type, unit, linha, image_url")
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
          item_template:item_templates(id, name, type, unit, image_url, linha)
        `)
        .eq("product_template_id", selectedTemplate.id)
        .order("created_at");
      if (error) throw error;
      return data as ProductTemplateItem[];
    },
    enabled: !!selectedTemplate,
  });

  useEffect(() => {
    if (compositionDraftRestoredRef.current || !templates?.length || typeof window === "undefined") {
      return;
    }

    const rawDraft = window.sessionStorage.getItem(COMPOSITION_DRAFT_STORAGE_KEY);
    compositionDraftRestoredRef.current = true;

    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as Partial<CompositionDraft>;

      if (!draft.isOpen || !draft.templateId) {
        clearCompositionDraft();
        return;
      }

      const draftTemplate = templates.find((template) => template.id === draft.templateId);
      if (!draftTemplate) {
        clearCompositionDraft();
        return;
      }

      setSelectedTemplate(draftTemplate);
      setIsCompositionDialogOpen(true);
      setCompositionActiveTab(draft.activeTab || "glass");
      setSelectedItemToAdd(draft.selectedItemToAdd || "");
      setQuantityFormula(draft.quantityFormula || "1");
      setPiecesQuantity(typeof draft.piecesQuantity === "number" ? draft.piecesQuantity : 1);
      setWidthFormula(draft.widthFormula || "");
      setHeightFormula(draft.heightFormula || "");
      setGlassName(draft.glassName || "");
      setCutAngle(typeof draft.cutAngle === "number" ? draft.cutAngle : 90);
    } catch {
      clearCompositionDraft();
    }
  }, [templates]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isCompositionDialogOpen || !selectedTemplate?.id) {
      clearCompositionDraft();
      return;
    }

    const draft: CompositionDraft = {
      templateId: selectedTemplate.id,
      activeTab: compositionActiveTab,
      selectedItemToAdd,
      quantityFormula,
      piecesQuantity,
      widthFormula,
      heightFormula,
      glassName,
      cutAngle,
      isOpen: true,
    };

    window.sessionStorage.setItem(COMPOSITION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    isCompositionDialogOpen,
    selectedTemplate?.id,
    compositionActiveTab,
    selectedItemToAdd,
    quantityFormula,
    piecesQuantity,
    widthFormula,
    heightFormula,
    glassName,
    cutAngle,
  ]);

  // Filter templates
  const filteredTemplates = templates?.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || template.category === filterCategory;
    const matchesLinha = filterLinha === "all" || template.linha === filterLinha;
    const matchesActive = showInactive || template.is_active;
    return matchesSearch && matchesCategory && matchesLinha && matchesActive;
  });

  // Sort item templates - prioritize items from the selected template's linha
  const sortedItemTemplates = itemTemplates?.slice().sort((a, b) => {
    const templateLinha = selectedTemplate?.linha;
    if (!templateLinha) return a.name.localeCompare(b.name);
    
    const aMatchesLinha = a.linha === templateLinha;
    const bMatchesLinha = b.linha === templateLinha;
    
    if (aMatchesLinha && !bMatchesLinha) return -1;
    if (!aMatchesLinha && bMatchesLinha) return 1;
    
    // Secondary sort by linha name, then by item name
    if (a.linha !== b.linha) {
      return (a.linha || 'ZZZ').localeCompare(b.linha || 'ZZZ');
    }
    return a.name.localeCompare(b.name);
  });

  // Get items filtered by type for composition dialog
  const getItemsByTypeForAdd = (tabValue: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === tabValue);
    const dbType = currentTab?.dbType;
    return sortedItemTemplates?.filter((item) => item.type === dbType) || [];
  };

  // Get items already in composition by type
  const getCompositionItemsByType = (tabValue: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === tabValue);
    const dbType = currentTab?.dbType;
    return compositionItems?.filter((item) => item.item_template?.type === dbType) || [];
  };

  // Helper to get storage URL
  const getStorageUrl = (path: string | null, bucket: 'item-templates' | 'product-templates' = 'item-templates') => resolveImageUrl(path, bucket);

  // Reset composition form
  const resetCompositionForm = () => {
    setSelectedItemToAdd("");
    setQuantityFormula("1");
    setPiecesQuantity(1);
    setWidthFormula("");
    setHeightFormula("");
    setGlassName("");
    setCutAngle(90);
  };

  // Handle add composition item
  const handleAddCompositionItem = () => {
    if (!selectedItemToAdd) return;
    
    addCompositionMutation.mutate({
      item_template_id: selectedItemToAdd,
      quantity_formula: quantityFormula,
      pieces_quantity: piecesQuantity,
      cut_angle: cutAngle,
      is_optional: false,
      notes: compositionActiveTab === 'glass' ? glassName : "",
      width_formula: compositionActiveTab === 'glass' ? widthFormula : undefined,
      height_formula: compositionActiveTab === 'glass' ? heightFormula : undefined,
    }, {
      onSuccess: () => {
        resetCompositionForm();
      }
    });
  };

  // Handle edit item - open dialog with item data
  const handleEditItem = (item: ProductTemplateItem) => {
    setEditingItem(item);
    setEditQuantityFormula(item.quantity_formula || "1");
    setEditPiecesQuantity(item.pieces_quantity || 1);
    setEditWidthFormula(item.width_formula || "");
    setEditHeightFormula(item.height_formula || "");
    setEditGlassName(item.notes || "");
    setEditCutAngle(item.cut_angle || 90);
    setIsEditItemDialogOpen(true);
  };

  // Handle update item
  const handleUpdateItem = () => {
    if (!editingItem) return;
    
    const itemType = editingItem.item_template?.type;
    
    updateCompositionMutation.mutate({
      id: editingItem.id,
      quantity_formula: editQuantityFormula,
      pieces_quantity: editPiecesQuantity,
      cut_angle: editCutAngle,
      notes: itemType === 'glass' ? editGlassName : undefined,
      width_formula: itemType === 'glass' ? editWidthFormula : undefined,
      height_formula: itemType === 'glass' ? editHeightFormula : undefined,
    });
  };

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      const payload: Record<string, unknown> = {
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
        const { error } = await supabase.from("product_templates").insert(payload as never);
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
      // First delete composition items from template
      await supabase.from("product_template_items").delete().eq("product_template_id", id);
      
      // company_products are automatically unlinked via ON DELETE SET NULL
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
          category: template.category,
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
      width_formula?: string;
      height_formula?: string;
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
        width_formula: data.width_formula || null,
        height_formula: data.height_formula || null,
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

  // Update composition item mutation
  const updateCompositionMutation = useMutation({
    mutationFn: async (data: { 
      id: string;
      quantity_formula: string; 
      pieces_quantity: number;
      cut_angle: number;
      notes?: string;
      width_formula?: string;
      height_formula?: string;
    }) => {
      const { error } = await supabase
        .from("product_template_items")
        .update({
          quantity_formula: data.quantity_formula,
          pieces_quantity: data.pieces_quantity,
          cut_angle: data.cut_angle,
          notes: data.notes || null,
          width_formula: data.width_formula || null,
          height_formula: data.height_formula || null,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-template-items", selectedTemplate?.id] });
      toast.success("Item atualizado!");
      setIsEditItemDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  // Quick image upload mutation
  const quickImageUploadMutation = useMutation({
    mutationFn: async ({ templateId, file }: { templateId: string; file: File }) => {
      setUploadingImageId(templateId);
      
      // Process image to have white background
      const processedFile = await processFileWithWhiteBackground(file);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-templates')
        .upload(filePath, processedFile);

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
      category: categoriesList[0] || "janelas",
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
      category: template.category,
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
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesList.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {categoryLabels[cat] || cat}
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
                    <div className="relative aspect-square rounded-md overflow-hidden bg-muted">
                      <img 
                        src={template.image_url} 
                        alt={template.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-square rounded-md overflow-hidden bg-muted flex items-center justify-center">
                      <Package className="w-8 h-8 text-muted-foreground/50" />
                    </div>
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
        <Dialog open={isCompositionDialogOpen} onOpenChange={(open) => {
          setIsCompositionDialogOpen(open);
          if (!open) {
            clearCompositionDraft();
            resetCompositionForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Composição: {selectedTemplate?.name}
                {selectedTemplate?.linha && (
                  <Badge variant="secondary">{selectedTemplate.linha}</Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Tab Navigation */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg">
                {itemTypeTabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setCompositionActiveTab(tab.value);
                      setSelectedItemToAdd("");
                    }}
                    className={cn(
                      "flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all",
                      compositionActiveTab === tab.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Add Item Section */}
              <Card className="border-primary/20">
                <CardHeader className="py-3 bg-primary/5">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Item Selection with images */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Selecione o item:
                      {selectedTemplate?.linha && (
                        <span className="ml-2 text-xs text-primary font-normal">
                          (Itens da linha "{selectedTemplate.linha}" aparecem primeiro)
                        </span>
                      )}
                    </Label>
                    <Select value={selectedItemToAdd} onValueChange={setSelectedItemToAdd}>
                      <SelectTrigger className="h-auto min-h-[3.5rem] py-2">
                        {selectedItemToAdd ? (
                          (() => {
                            const sel = getItemsByTypeForAdd(compositionActiveTab).find(i => i.id === selectedItemToAdd);
                            if (!sel) return <SelectValue placeholder="Clique para escolher um item" />;
                            return (
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden border border-border">
                                  {sel.image_url ? (
                                    <img src={getStorageUrl(sel.image_url)} alt={sel.name} className="w-full h-full object-contain p-0.5" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">—</div>
                                  )}
                                </div>
                                <div className="flex flex-col min-w-0 text-left">
                                  <span className="font-medium truncate text-sm">{sel.name}</span>
                                  {sel.linha && <span className="text-xs text-muted-foreground">{sel.linha}</span>}
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <SelectValue placeholder="Clique para escolher um item" />
                        )}
                      </SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        {getItemsByTypeForAdd(compositionActiveTab).map((item, index) => {
                          const isProductLinha = item.linha === selectedTemplate?.linha;
                          const prevItem = index > 0 ? getItemsByTypeForAdd(compositionActiveTab)[index - 1] : null;
                          const showSeparator = prevItem && prevItem.linha !== item.linha;
                          const isFirstOfProductLinha = isProductLinha && (!prevItem || prevItem.linha !== item.linha);
                          
                          return (
                            <div key={item.id}>
                              {isFirstOfProductLinha && (
                                <div className="px-2 py-1.5 text-xs font-semibold text-primary bg-primary/10 border-b">
                                  ⭐ Itens da linha {selectedTemplate?.linha}
                                </div>
                              )}
                              {showSeparator && !isFirstOfProductLinha && (
                                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-y">
                                  {item.linha || 'Sem Linha'}
                                </div>
                              )}
                              <SelectItem 
                                value={item.id} 
                                className={cn(
                                  "py-2",
                                  isProductLinha && "bg-primary/5"
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Item image - larger with contain */}
                                  <div className="w-12 h-12 rounded-md bg-muted flex-shrink-0 overflow-hidden border border-border">
                                    {item.image_url ? (
                                      <img 
                                        src={getStorageUrl(item.image_url)}
                                        alt={item.name}
                                        className="w-full h-full object-contain p-0.5"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                        —
                                      </div>
                                    )}
                                  </div>
                                  {/* Item info */}
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-medium truncate">{item.name}</span>
                                    {item.linha && (
                                      <span className={cn(
                                        "text-xs",
                                        isProductLinha 
                                          ? "text-primary font-medium"
                                          : "text-muted-foreground"
                                      )}>
                                        {item.linha}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            </div>
                          );
                        })}
                        {getItemsByTypeForAdd(compositionActiveTab).length === 0 && (
                          <div className="p-4 text-sm text-muted-foreground text-center">
                            Nenhum item disponível para esta categoria
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Show GlassFormulaEditor for glass items, FormulaEditor for others */}
                  {compositionActiveTab === 'glass' ? (
                    <>
                      {/* Glass Name Input */}
                      <div className="space-y-2">
                        <Label>Nome do Vidro (opcional)</Label>
                        <Input
                          placeholder="Ex: Vidro Fixo, Vidro Móvel, Bandeira..."
                          value={glassName}
                          onChange={(e) => setGlassName(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Identifique o vidro para facilitar no plano de corte
                        </p>
                      </div>
                      
                      <GlassFormulaEditor
                        widthFormula={widthFormula}
                        heightFormula={heightFormula}
                        onWidthFormulaChange={setWidthFormula}
                        onHeightFormulaChange={setHeightFormula}
                      />
                    </>
                  ) : (
                    <>
                      <FormulaEditor
                        value={quantityFormula}
                        onChange={setQuantityFormula}
                        showPiecesQuantity={compositionActiveTab === 'profile'}
                        piecesQuantity={piecesQuantity}
                        onPiecesChange={setPiecesQuantity}
                      />
                      
                      {compositionActiveTab === 'profile' && (
                        <div className="space-y-2">
                          <Label>Ângulo de corte (graus)</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant={cutAngle === 90 ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCutAngle(90)}
                            >
                              90°
                            </Button>
                            <Button
                              type="button"
                              variant={cutAngle === 45 ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCutAngle(45)}
                            >
                              45°
                            </Button>
                            <Input
                              type="number"
                              value={cutAngle}
                              onChange={(e) => setCutAngle(Number(e.target.value))}
                              className="w-24"
                              min={0}
                              max={90}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleAddCompositionItem}
                      disabled={!selectedItemToAdd || addCompositionMutation.isPending}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Items Grid by Type */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Itens adicionados ({getCompositionItemsByType(compositionActiveTab).length})
                </h4>
                
                {getCompositionItemsByType(compositionActiveTab).length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                      <Layers className="w-10 h-10 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum item desta categoria na composição
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {getCompositionItemsByType(compositionActiveTab).map((item) => (
                      <div
                        key={item.id}
                        className="bg-card border rounded-lg p-3 relative group hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50"
                        onClick={() => handleEditItem(item)}
                      >
                        {/* Delete button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCompositionMutation.mutate(item.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>

                        {/* Edit indicator */}
                        <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Pencil className="w-2.5 h-2.5 text-primary" />
                        </div>

                        {/* Item image */}
                        <div className="aspect-square bg-muted rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                          {item.item_template?.image_url ? (
                            <img
                              src={getStorageUrl(item.item_template.image_url)}
                              alt={item.item_template.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="text-2xl text-muted-foreground/30">📦</div>
                          )}
                        </div>

                        {/* Item info */}
                        {compositionActiveTab === 'glass' && item.notes && (
                          <h4 className="font-bold text-xs text-foreground truncate text-center mb-0.5">
                            {item.notes}
                          </h4>
                        )}
                        <h4 className={cn(
                          "font-medium text-[11px] truncate text-center",
                          compositionActiveTab === 'glass' && item.notes ? 'text-muted-foreground' : 'text-primary'
                        )}>
                          {item.item_template?.name}
                        </h4>
                        
                        {/* Glass formulas display */}
                        {compositionActiveTab === 'glass' && (item.width_formula || item.height_formula) && (
                          <div className="mt-1.5 space-y-0.5">
                            {item.width_formula && (
                              <div className="flex items-center justify-center">
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  L: {item.width_formula}
                                </span>
                              </div>
                            )}
                            {item.height_formula && (
                              <div className="flex items-center justify-center">
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  A: {item.height_formula}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Formula for non-glass items */}
                        {compositionActiveTab !== 'glass' && (
                          <p className="text-[10px] text-muted-foreground text-center mt-1 font-mono">
                            {item.quantity_formula}
                          </p>
                        )}

                        {/* Pieces and angle for profiles */}
                        {compositionActiveTab === 'profile' && (
                          <div className="flex justify-center gap-1 mt-1.5">
                            <span className="text-[9px] font-medium text-foreground bg-primary/10 px-1.5 py-0.5 rounded">
                              {item.pieces_quantity || 1}x
                            </span>
                            <span className="text-[9px] font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">
                              {item.cut_angle || 90}°
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Item Dialog */}
        <Dialog open={isEditItemDialogOpen} onOpenChange={(open) => {
          setIsEditItemDialogOpen(open);
          if (!open) setEditingItem(null);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                Editar Item: {editingItem?.item_template?.name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Item preview */}
              <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                  {editingItem?.item_template?.image_url ? (
                    <img
                      src={getStorageUrl(editingItem.item_template.image_url)}
                      alt={editingItem.item_template.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-2xl text-muted-foreground/30">📦</div>
                  )}
                </div>
                <div>
                  <h4 className="font-medium">{editingItem?.item_template?.name}</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {editingItem?.item_template?.type} • {editingItem?.item_template?.linha || 'Sem linha'}
                  </p>
                </div>
              </div>

              {/* Show GlassFormulaEditor for glass items, FormulaEditor for others */}
              {editingItem?.item_template?.type === 'glass' ? (
                <>
                  {/* Glass Name Input */}
                  <div className="space-y-2">
                    <Label>Nome do Vidro (opcional)</Label>
                    <Input
                      placeholder="Ex: Vidro Fixo, Vidro Móvel, Bandeira..."
                      value={editGlassName}
                      onChange={(e) => setEditGlassName(e.target.value)}
                    />
                  </div>
                  
                  <GlassFormulaEditor
                    widthFormula={editWidthFormula}
                    heightFormula={editHeightFormula}
                    onWidthFormulaChange={setEditWidthFormula}
                    onHeightFormulaChange={setEditHeightFormula}
                  />
                </>
              ) : (
                <>
                  <FormulaEditor
                    value={editQuantityFormula}
                    onChange={setEditQuantityFormula}
                    showPiecesQuantity={editingItem?.item_template?.type === 'profile'}
                    piecesQuantity={editPiecesQuantity}
                    onPiecesChange={setEditPiecesQuantity}
                  />
                  
                  {editingItem?.item_template?.type === 'profile' && (
                    <div className="space-y-2">
                      <Label>Ângulo de corte (graus)</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={editCutAngle === 90 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEditCutAngle(90)}
                        >
                          90°
                        </Button>
                        <Button
                          type="button"
                          variant={editCutAngle === 45 ? "default" : "outline"}
                          size="sm"
                          onClick={() => setEditCutAngle(45)}
                        >
                          45°
                        </Button>
                        <Input
                          type="number"
                          value={editCutAngle}
                          onChange={(e) => setEditCutAngle(Number(e.target.value))}
                          className="w-24"
                          min={0}
                          max={90}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleUpdateItem}
                  disabled={updateCompositionMutation.isPending}
                >
                  {updateCompositionMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
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
