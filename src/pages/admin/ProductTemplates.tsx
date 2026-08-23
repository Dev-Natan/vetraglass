// Product templates admin page
import { useEffect, useRef, useState, useMemo } from "react";
import { resolveImageUrl, resolveProductImageUrl } from '@/utils/imageUrl';
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
  DialogFooter,
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
  AlertCircle,
  LayoutGrid,
  LayoutList,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Palette,
  Scissors
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormulaEditor } from "@/components/produtos/FormulaEditor";
import { LinhaCardSimple } from "@/components/produtos/LinhaCardSimple";

import { GlassFormulaEditor } from "@/components/produtos/GlassFormulaEditor";
import { cn } from "@/lib/utils";
import { useProductCategoryLabels } from "@/hooks/useProductCategories";
import { useItemTypeLabels } from "@/hooks/useItemTypes";
import { useProductLinhas } from "@/hooks/useProductLinhas";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { VariablesTab } from "@/components/admin/product-templates/VariablesTab";
import { EngineeringCenter } from "@/components/admin/product-templates/EngineeringCenter";
import { CopyCompositionDialog } from "@/components/produtos/CopyCompositionDialog";



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
  has_multiple_sides: boolean;
  has_cutting_plan: boolean;
  created_at: string;
  composition_mode: "fixed" | "parametric";
  publication_status: "draft" | "active" | "inactive";
};

type ProductTemplateItem = {
  id: string;
  product_template_id: string;
  item_template_id: string;
  quantity_formula: string;
  pieces_quantity: number;
  cut_angle: number;
  cut_angle_start?: number;
  cut_angle_end?: number;
  pieces_formula?: string | null;
  is_optional: boolean;
  notes: string | null;
  width_formula: string | null;
  height_formula: string | null;
  side: string | null;
  item_template?: {
    id: string;
    name: string;
    type: string;
    unit: string;
    image_url: string | null;
    linha: string | null;
  };
};

const getDisplayedItemFormula = (item: ProductTemplateItem): string => {
  const quantityFormula = item.quantity_formula?.trim();
  const widthFormula = item.width_formula?.trim();
  const heightFormula = item.height_formula?.trim();

  if (quantityFormula && quantityFormula !== '1') return quantityFormula;
  if (widthFormula) return widthFormula;
  if (heightFormula) return heightFormula;
  return quantityFormula || '—';
};

const getDisplayedFormulaPosition = (item: ProductTemplateItem): string | null => {
  const sideMap: Record<string, string> = {
    width: 'Largura',
    largura: 'Largura',
    horizontal: 'Largura',
    height: 'Altura',
    altura: 'Altura',
    vertical: 'Altura',
  };
  const side = (item as any).side?.toString().trim().toLowerCase();
  if (side && sideMap[side]) return sideMap[side];
  if (side) return side.charAt(0).toUpperCase() + side.slice(1);

  if (item.width_formula?.trim()) return 'Largura';
  if (item.height_formula?.trim()) return 'Altura';
  const quantityFormula = item.quantity_formula?.trim();
  if (quantityFormula && quantityFormula !== '1') return 'Quantidade';
  return null;
};

const getDisplayedPieces = (item: ProductTemplateItem): string => {
  const formula = item.pieces_formula?.trim();
  return formula || String(item.pieces_quantity || 1);
};

type DefaultFormula = {
  formula: string;
  position: string;
};

type ItemTemplate = {
  id: string;
  name: string;
  type: string;
  unit: string;
  linha: string | null;
  image_url: string | null;
  default_formulas: DefaultFormula[] | null;
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
  cutAngleStart: number;
  cutAngleEnd: number;
  side: string;
  isOpen: boolean;
};

const COMPOSITION_DRAFT_STORAGE_KEY = "admin-product-template-composition-draft";

const ITEM_TYPE_ALIASES: Record<string, string> = {
  vidro: 'glass',
  glass: 'glass',
  perfil: 'profile',
  profile: 'profile',
  acessorio: 'accessory',
  acessorios: 'accessory',
  accessory: 'accessory',
  guarnicao: 'accessory',
  guarnição: 'accessory',
  borracha: 'accessory',
  borrachas: 'accessory',
  servico: 'service',
  serviço: 'service',
  service: 'service',
  chaparia: 'sheet',
  sheet: 'sheet',
};

const normalizeItemTypeForComposition = (value: string | undefined) => {
  const key = String(value || '').trim().toLowerCase();
  return ITEM_TYPE_ALIASES[key] || key;
};

const getItemTypeTabs = (itemTypes: { slug: string; name: string }[] | undefined) => {
  const defaultTabs = [
    { value: 'glass', label: 'VIDROS', dbType: 'glass' },
    { value: 'profile', label: 'PERFIS', dbType: 'profile' },
    { value: 'accessory', label: 'ACESSÓRIOS', dbType: 'accessory' },
  ];
  
  if (!itemTypes?.length) return defaultTabs;

  const tabs = itemTypes.reduce<typeof defaultTabs>((acc, type) => {
    const dbType = normalizeItemTypeForComposition(type.slug);
    if (!dbType || acc.some((tab) => tab.dbType === dbType)) return acc;
    acc.push({
      value: dbType,
      label: type.name.toUpperCase(),
      dbType,
    });
    return acc;
  }, []);

  return tabs.length ? tabs : defaultTabs;
};

export default function ProductTemplates() {
  const { linha: linhaParam } = useParams<{ linha?: string }>();
  
  const { labels: categoryLabels, colors: categoryColors, categories: productCategories } = useProductCategoryLabels();
  const { labels: typeLabels, colors: typeColors, itemTypes } = useItemTypeLabels();
  // Admin: inclui linhas inativas para permitir editar produtos de linhas desativadas
  const { data: productLinhas } = useProductLinhas(true);
  
  const categoriesList = productCategories?.map(c => c.slug) || [];
  const itemTypeTabs = getItemTypeTabs(itemTypes);
  const availableLines = productLinhas?.map(l => ({ value: l.slug, label: l.name })) || [];
  const navigate = useNavigate();
  const { isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();
  const compositionDraftRestoredRef = useRef(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [editingTemplate, setEditingTemplate] = useState<ProductTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProductTemplate | null>(null);
  const [isCopyCompositionOpen, setIsCopyCompositionOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(true);
  const [showReady, setShowReady] = useState(true);

  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'grouped'>('grouped');
  const [expandedLinhas, setExpandedLinhas] = useState<Set<string>>(new Set());
  const [linhaView, setLinhaView] = useState<string | null>(null);

  
  const [compositionActiveTab, setCompositionActiveTab] = useState("glass");
  const [dialogTab, setDialogTab] = useState<"dados" | "composicao" | "engenharia" | "variaveis">("dados");
  const [selectedItemToAdd, setSelectedItemToAdd] = useState("");
  const [selectedFormulaIndex, setSelectedFormulaIndex] = useState<number>(0);
  const [linhaFilter, setLinhaFilter] = useState<string>("__all__");
  const [quantityFormula, setQuantityFormula] = useState("1");
  const [piecesQuantity, setPiecesQuantity] = useState(1);
  const [piecesFormula, setPiecesFormula] = useState<string | null>(null);
  const [widthFormula, setWidthFormula] = useState("");
  const [heightFormula, setHeightFormula] = useState("");
  const [glassName, setGlassName] = useState("");
  const [cutAngle, setCutAngle] = useState(90);
  const [cutAngleStart, setCutAngleStart] = useState(90);
  const [cutAngleEnd, setCutAngleEnd] = useState(90);
  const [compositionSide, setCompositionSide] = useState<string>("");
  const [profilePosition, setProfilePosition] = useState<'Largura' | 'Altura'>('Largura');
  const [useFixedQty, setUseFixedQty] = useState(false);
  const [useFixedQtyEdit, setUseFixedQtyEdit] = useState(false);

  
  const [editingItem, setEditingItem] = useState<ProductTemplateItem | null>(null);
  const [isEditItemDialogOpen, setIsEditItemDialogOpen] = useState(false);
  const [editQuantityFormula, setEditQuantityFormula] = useState("1");
  const [editPiecesQuantity, setEditPiecesQuantity] = useState(1);
  const [editPiecesFormula, setEditPiecesFormula] = useState<string | null>(null);
  const [editWidthFormula, setEditWidthFormula] = useState("");
  const [editHeightFormula, setEditHeightFormula] = useState("");
  const [editGlassName, setEditGlassName] = useState("");
  const [editCutAngle, setEditCutAngle] = useState(90);
  const [editCutAngleStart, setEditCutAngleStart] = useState(90);
  const [editCutAngleEnd, setEditCutAngleEnd] = useState(90);
  const [editSide, setEditSide] = useState<string>("");
  const [editProfilePosition, setEditProfilePosition] = useState<'Largura' | 'Altura'>('Largura');
  
  const currentLinha = linhaParam ? decodeURIComponent(linhaParam) : null;

  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [isUploadingFormImage, setIsUploadingFormImage] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: categoriesList[0] || "janelas",
    linha: currentLinha || "",
    min_width: "",
    max_width: "",
    min_height: "",
    max_height: "",
    is_active: true,
    is_ready: false,
    has_multiple_sides: false,
    has_cutting_plan: true,
    composition_mode: "fixed" as "fixed" | "parametric",
    publication_status: "draft" as "draft" | "active" | "inactive",
    base_price: "",
    ncm: "",
    cest: "",
    cfop_venda: "",
    origem: "",
  });

  const clearCompositionDraft = () => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(COMPOSITION_DRAFT_STORAGE_KEY);
  };

  const { data: templates, isLoading } = useQuery({
    queryKey: ["product-templates", currentLinha],
    queryFn: async () => {
      let query = supabase.from("product_templates").select("*");
      
      if (currentLinha) {
        query = query.eq("linha", currentLinha);
      }
      
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data as unknown as ProductTemplate[];
    },
  });

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

  const { data: itemTemplates } = useQuery({
    queryKey: ["item-templates-active", currentLinha],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("item_templates")
        .select("id, name, type, unit, linha, image_url, default_formulas")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as ItemTemplate[];
    },
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

      handleEdit(draftTemplate);
      setCompositionActiveTab(draft.activeTab || "glass");

      setSelectedItemToAdd(draft.selectedItemToAdd || "");
      setQuantityFormula(draft.quantityFormula || "1");
      setPiecesQuantity(typeof draft.piecesQuantity === "number" ? draft.piecesQuantity : 1);
      setWidthFormula(draft.widthFormula || "");
      setHeightFormula(draft.heightFormula || "");
      setGlassName(draft.glassName || "");
      setCutAngle(typeof draft.cutAngle === "number" ? draft.cutAngle : 90);
      setCutAngleStart(typeof draft.cutAngleStart === "number" ? draft.cutAngleStart : 90);
      setCutAngleEnd(typeof draft.cutAngleEnd === "number" ? draft.cutAngleEnd : 90);
    } catch {
      clearCompositionDraft();
    }
  }, [templates]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isDialogOpen || !selectedTemplate?.id) {
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
      cutAngleStart,
      cutAngleEnd,
      side: compositionSide,
      isOpen: true,
    };

    window.sessionStorage.setItem(COMPOSITION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [
    isDialogOpen,

    selectedTemplate?.id,
    compositionActiveTab,
    selectedItemToAdd,
    quantityFormula,
    piecesQuantity,
    widthFormula,
    heightFormula,
    glassName,
    cutAngle,
    cutAngleStart,
    cutAngleEnd,
  ]);

  // Lista de fórmulas pré-cadastradas do item selecionado
  const selectedItemFormulas = useMemo(() => {
    if (!selectedItemToAdd || !itemTemplates) return [] as any[];
    const it = itemTemplates.find((i) => i.id === selectedItemToAdd);
    const raw = Array.isArray((it as any)?.default_formulas) ? (it as any).default_formulas : [];
    return raw.filter((f: any) => f && typeof f === 'object' && String(f.formula || '').trim());
  }, [selectedItemToAdd, itemTemplates]);

  /** Aplica uma entrada de fórmula pré-cadastrada aos campos do form. */
  const applyFormulaEntry = (entry: any) => {
    if (!entry) return;
    const posRaw = String(entry.position ?? '').toLowerCase();
    const isHeight = posRaw === 'height' || posRaw === 'altura';
    const formulaStr = String(entry.formula || '').trim();

    if (compositionActiveTab === 'profile') {
      setProfilePosition(isHeight ? 'Altura' : 'Largura');
      if (formulaStr) setQuantityFormula(formulaStr);
      if (entry.pieces != null && String(entry.pieces).trim()) {
        setPiecesFormula(String(entry.pieces).trim());
      }
      if (typeof entry.cutAngleStart === 'number') setCutAngleStart(entry.cutAngleStart);
      if (typeof entry.cutAngleEnd === 'number') setCutAngleEnd(entry.cutAngleEnd);
    } else {
      if (isHeight) {
        if (formulaStr) setHeightFormula(formulaStr);
      } else if (formulaStr) {
        setWidthFormula(formulaStr);
      }
    }
  };

  const lastAutoFilledItemRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedItemToAdd) {
      lastAutoFilledItemRef.current = null;
      setSelectedFormulaIndex(0);
      return;
    }
    // Só auto-preenche quando o usuário TROCA de item selecionado
    if (lastAutoFilledItemRef.current === selectedItemToAdd) return;

    setSelectedFormulaIndex(0);

    if (selectedItemFormulas.length > 0) {
      // Para vidros/acessórios: aplica todas as entradas (largura + altura, quando existirem)
      if (compositionActiveTab !== 'profile') {
        const widthEntry = selectedItemFormulas.find(
          (f: any) => !['height', 'altura'].includes(String(f.position ?? '').toLowerCase())
        );
        const heightEntry = selectedItemFormulas.find((f: any) =>
          ['height', 'altura'].includes(String(f.position ?? '').toLowerCase())
        );
        if (widthEntry) applyFormulaEntry(widthEntry);
        else if (compositionActiveTab === 'glass' && !widthFormula) setWidthFormula('Largura');
        if (heightEntry) applyFormulaEntry(heightEntry);
        else if (compositionActiveTab === 'glass' && !heightFormula) setHeightFormula('Altura');
      } else {
        applyFormulaEntry(selectedItemFormulas[0]);
      }
    }

    lastAutoFilledItemRef.current = selectedItemToAdd;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemToAdd, itemTemplates]);

  // Auto-detecta a Linha do template (campo explícito ou pelo nome) e preenche o filtro
  useEffect(() => {
    if (!isDialogOpen || dialogTab !== 'composicao') return;
    const linhas = getLinhasForAddTab(compositionActiveTab);
    if (!linhas.length) { setLinhaFilter('__all__'); return; }
    const explicit = (selectedTemplate as any)?.linha;
    if (explicit && linhas.includes(explicit)) { setLinhaFilter(explicit); return; }
    const name = ((selectedTemplate as any)?.name || '').toLowerCase();
    const detected = name ? linhas.find(l => name.includes(l.toLowerCase())) : null;
    setLinhaFilter(detected || '__all__');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialogOpen, dialogTab, compositionActiveTab, selectedTemplate?.id, itemTemplates?.length]);

  const filteredTemplates = templates?.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || template.category === filterCategory;
    const matchesActive = showInactive || template.is_active;
    const matchesReady = showReady || !template.description?.includes("[PRONTO]");
    return matchesSearch && matchesCategory && matchesActive && matchesReady;
  });

  const sortedItemTemplates = itemTemplates?.slice().sort((a, b) => {
    const templateLinha = selectedTemplate?.linha;
    if (!templateLinha) return a.name.localeCompare(b.name);
    
    // Prioritize items that match the template's line OR are "Universal"
    const aMatchesLinha = a.linha === templateLinha || a.linha === "Universal";
    const bMatchesLinha = b.linha === templateLinha || b.linha === "Universal";
    
    if (aMatchesLinha && !bMatchesLinha) return -1;
    if (!aMatchesLinha && bMatchesLinha) return 1;
    
    if (a.linha !== b.linha) {
      return (a.linha || 'ZZZ').localeCompare(b.linha || 'ZZZ');
    }
    return a.name.localeCompare(b.name);
  });

  const groupedTemplates = useMemo(() => {
    if (!filteredTemplates) return new Map<string, ProductTemplate[]>();
    // Normaliza por slug case-insensitive para evitar grupos duplicados ("Gold" vs "gold")
    const groups = new Map<string, ProductTemplate[]>();
    const displayName = new Map<string, string>();
    for (const t of filteredTemplates) {
      const raw = (t.linha || 'Sem Linha').trim();
      const key = raw.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, []);
        displayName.set(key, raw);
      }
      groups.get(key)!.push(t);
    }
    const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
    return new Map(sorted.map(([k, v]) => [displayName.get(k) || k, v]));
  }, [filteredTemplates]);

  const qualityStats = useMemo(() => {
    if (!templates) return { total: 0, semImagem: 0, inativos: 0, prontos: 0 };
    return {
      total: templates.length,
      semImagem: templates.filter(t => !t.image_url).length,
      inativos: templates.filter(t => !t.is_active).length,
      prontos: templates.filter(t => t.description?.includes("[PRONTO]")).length,
    };
  }, [templates]);

  const toggleLinha = (linha: string) => {
    setExpandedLinhas(prev => {
      const next = new Set(prev);
      if (next.has(linha)) next.delete(linha);
      else next.add(linha);
      return next;
    });
  };

  const expandAll = () => setExpandedLinhas(new Set(groupedTemplates.keys()));
  const collapseAll = () => setExpandedLinhas(new Set());


  const getItemsByTypeForAdd = (tabValue: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === tabValue);
    const dbType = currentTab?.dbType || normalizeItemTypeForComposition(tabValue);
    const base = sortedItemTemplates?.filter((item) => item.type === dbType) || [];
    if (!linhaFilter || linhaFilter === "__all__") return base;
    return base.filter((item) => item.linha === linhaFilter);
  };

  const getLinhasForAddTab = (tabValue: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === tabValue);
    const dbType = currentTab?.dbType || normalizeItemTypeForComposition(tabValue);
    const base = sortedItemTemplates?.filter((item) => item.type === dbType) || [];
    const set = new Set<string>();
    base.forEach((i: any) => { if (i.linha) set.add(i.linha); });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  };

  const getCompositionItemsByType = (tabValue: string) => {
    const currentTab = itemTypeTabs.find(t => t.value === tabValue);
    const dbType = currentTab?.dbType || normalizeItemTypeForComposition(tabValue);
    return compositionItems?.filter((item) => item.item_template?.type === dbType) || [];
  };

  const getStorageUrl = (path: string | null, bucket: 'item-templates' | 'product-templates' = 'item-templates') => resolveImageUrl(path, bucket);

  const resetCompositionForm = () => {
    setSelectedItemToAdd("");
    setQuantityFormula("1");
    setPiecesQuantity(1);
    setPiecesFormula(null);
    setWidthFormula("");
    setHeightFormula("");
    setGlassName("");
    setCutAngle(90);
    setCutAngleStart(90);
    setCutAngleEnd(90);
    setCompositionSide("");
    setProfilePosition("Largura");
    setUseFixedQty(false);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTemplate(null);
    setFormImageFile(null);
    setFormImagePreview(null);
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
      is_ready: false,
      has_multiple_sides: false,
      has_cutting_plan: true,
      composition_mode: "fixed",
      publication_status: "draft",
      base_price: "",
      ncm: "",
      cest: "",
      cfop_venda: "",
      origem: "",
    });
  };

  const handleEdit = (template: ProductTemplate) => {
    setEditingTemplate(template);
    setSelectedTemplate(template);
    setDialogTab("dados");
    setFormImageFile(null);
    setFormImagePreview(resolveProductImageUrl(template.image_url) || null);
    setFormData({
      name: template.name,
      description: (template.description || "").replace("[PRONTO]", "").trim(),
      category: template.category,
      linha: template.linha || "",
      min_width: template.min_width?.toString() || "",
      max_width: template.max_width?.toString() || "",
      min_height: template.min_height?.toString() || "",
      max_height: template.max_height?.toString() || "",
      is_active: template.is_active,
      is_ready: template.description?.includes("[PRONTO]") || false,
      has_multiple_sides: template.has_multiple_sides || false,
      has_cutting_plan: (template as any).has_cutting_plan ?? true,
      composition_mode: template.composition_mode || "fixed",
      publication_status: template.publication_status || (template.is_active ? "active" : "inactive"),
      base_price: (template as any).base_price?.toString() || "",
      ncm: (template as any).ncm || "",
      cest: (template as any).cest || "",
      cfop_venda: (template as any).cfop_venda || "",
      origem: (template as any).origem || "",
    });
    setIsDialogOpen(true);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let finalDescription = formData.description.trim();
    if (formData.is_ready) {
      if (!finalDescription.includes("[PRONTO]")) {
        finalDescription = `[PRONTO] ${finalDescription}`.trim();
      }
    } else {
      finalDescription = finalDescription.replace("[PRONTO]", "").trim();
    }
    
    saveMutation.mutate({ 
      ...formData, 
      description: finalDescription,
      id: editingTemplate?.id 
    });
  };

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
        base_price: data.base_price ? parseFloat(data.base_price) : 0,
        ncm: data.ncm || null,
        cest: data.cest || null,
        cfop_venda: data.cfop_venda || null,
        origem: data.origem || null,
        has_multiple_sides: data.has_multiple_sides,
        has_cutting_plan: data.has_cutting_plan,
        composition_mode: data.composition_mode,
        publication_status: data.publication_status,
      };



      let savedId = data.id;

      if (data.id) {
        const { error } = await supabase
          .from("product_templates")
          .update(payload as never)
          .eq("id", data.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("product_templates").insert(payload as never).select("id").single();
        if (error) throw error;
        savedId = inserted.id;
      }

      // Upload image if a new file was selected
      if (formImageFile && savedId) {
        let toUpload: Blob = formImageFile;
        let contentType = formImageFile.type || 'image/png';
        try {
          const processed = await processFileWithWhiteBackground(formImageFile);
          if (processed && processed.size > 0) {
            toUpload = processed;
            contentType = 'image/png';
          }
        } catch (e) {
          console.warn('[product-template-upload] background processing failed, uploading original', e);
        }
        const fileName = `${savedId}.png`;
        const { error: uploadError } = await supabase.storage
          .from('product-templates')
          .upload(fileName, toUpload, { upsert: true, contentType, cacheControl: '0' });
        if (uploadError) {
          console.error('[product-template-upload] storage error', uploadError);
          throw new Error(uploadError.message || 'Falha no upload da imagem');
        }
        const { data: urlData } = supabase.storage.from('product-templates').getPublicUrl(fileName);
        const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        await supabase.from('product_templates').update({ image_url: newUrl }).eq('id', savedId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      toast.success(editingTemplate ? "Produto atualizado!" : "Produto criado!");
      handleCloseDialog();
    },
    onError: async (error: any) => {
      const msg = String(error?.message || error);
      if (msg.includes('row-level security') || error?.code === '42501') {
        const { data: { user } } = await supabase.auth.getUser();
        const loggedEmail = user?.email ?? 'desconhecido';
        toast.error(
          `Acesso negado. Sessão atual: ${loggedEmail}. Apenas natanjk7@gmail.com pode editar templates. ` +
          (loggedEmail !== 'natanjk7@gmail.com'
            ? 'Faça logout e entre novamente com a conta correta.'
            : 'Tente sair e entrar novamente para renovar o token.')
        );
      } else {
        toast.error("Erro ao salvar: " + msg);
      }
    },
  });

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
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const toggleReadyMutation = useMutation({
    mutationFn: async ({ id, description, is_ready }: { id: string; description: string | null; is_ready: boolean }) => {
      let newDescription = (description || "").trim();
      if (is_ready) {
        if (!newDescription.includes("[PRONTO]")) {
          newDescription = `[PRONTO] ${newDescription}`.trim();
        }
      } else {
        newDescription = newDescription.replace("[PRONTO]", "").trim();
      }

      const { error } = await supabase
        .from("product_templates")
        .update({ description: newDescription })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      toast.success("Status de finalização atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const copyMutation = useMutation({
    mutationFn: async (template: ProductTemplate) => {
      const { data, error } = await supabase
        .from("product_templates")
        .insert({
          name: `${template.name} (cópia)`,
          description: template.description,
          category: template.category,
          linha: template.linha,
          image_url: template.image_url,
          is_active: false,
          has_multiple_sides: template.has_multiple_sides,
        } as any)
        .select()
        .single();
      if (error) throw error;
      
      if (compositionItems) {
        const itemsToCopy = compositionItems.map(item => ({
          product_template_id: data.id,
          item_template_id: item.item_template_id,
          quantity_formula: item.quantity_formula,
          pieces_quantity: item.pieces_quantity,
          cut_angle: item.cut_angle,
          cut_angle_start: item.cut_angle_start || item.cut_angle,
          cut_angle_end: item.cut_angle_end || item.cut_angle,
          is_optional: item.is_optional,
          notes: item.notes,
          width_formula: item.width_formula,
          height_formula: item.height_formula,
          side: (item as any).side || null,
        }));
        await supabase.from("product_template_items").insert(itemsToCopy as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      toast.success("Produto duplicado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error: itemsError } = await supabase.from("product_template_items").delete().eq("product_template_id", id);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from("product_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      toast.success("Produto excluído!");
    },
    onError: (err: any) => {
      const msg = String(err?.message || err);
      if (msg.includes("row-level security") || err?.code === "42501") {
        toast.error("Acesso negado. Apenas o ADM SaaS (natanjk7@gmail.com) pode excluir produtos.");
      } else if (err?.code === "23503" || msg.includes("foreign key")) {
        toast.error("Não foi possível excluir: este produto está vinculado a registros que bloqueiam a exclusão.");
      } else {
        toast.error("Erro ao excluir produto: " + msg);
      }
    },
  });

  const addCompositionMutation = useMutation({
    mutationFn: async (data: { 
      item_template_id: string; 
      quantity_formula: string; 
      pieces_quantity: number;
      pieces_formula?: string | null;
      cut_angle: number;
      cut_angle_start: number;
      cut_angle_end: number;
      is_optional: boolean;
      notes: string;
      width_formula?: string;
      height_formula?: string;
      side?: string;
    }) => {
      if (!selectedTemplate) throw new Error("Nenhum template selecionado");
      const { error } = await supabase.from("product_template_items").insert({
        product_template_id: selectedTemplate.id,
        item_template_id: data.item_template_id,
        quantity_formula: (data.quantity_formula && data.quantity_formula.trim() !== "") ? data.quantity_formula : "1",
        pieces_quantity: data.pieces_quantity,
        pieces_formula: data.pieces_formula,
        cut_angle: data.cut_angle,
        cut_angle_start: data.cut_angle_start,
        cut_angle_end: data.cut_angle_end,
        is_optional: data.is_optional,
        notes: data.notes || null,
        width_formula: data.width_formula || null,
        height_formula: data.height_formula || null,
        side: data.side || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-template-items", selectedTemplate?.id] });
      toast.success("Item adicionado!");
    },
    onError: (error: any) => {
      console.error("Erro ao adicionar item:", error);
      toast.error("Erro ao adicionar item: " + (error.message || "Erro desconhecido"));
    }
  });

  const removeCompositionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_template_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-template-items", selectedTemplate?.id] });
      toast.success("Item removido!");
    },
    onError: (error: any) => {
      console.error("Erro ao remover item:", error);
      toast.error("Erro ao remover item: " + (error.message || "Erro desconhecido"));
    }
  });

  const updateCompositionMutation = useMutation({
    mutationFn: async (data: { 
      id: string;
      quantity_formula: string; 
      pieces_quantity: number;
      pieces_formula?: string | null;
      cut_angle: number;
      cut_angle_start: number;
      cut_angle_end: number;
      notes?: string;
      width_formula?: string;
      height_formula?: string;
      side?: string;
    }) => {
      const { error } = await supabase
        .from("product_template_items")
        .update({
          quantity_formula: (data.quantity_formula && data.quantity_formula.trim() !== "") ? data.quantity_formula : "1",
          pieces_quantity: data.pieces_quantity,
          pieces_formula: data.pieces_formula,
          cut_angle: data.cut_angle,
          cut_angle_start: data.cut_angle_start,
          cut_angle_end: data.cut_angle_end,
          notes: data.notes || null,
          width_formula: data.width_formula || null,
          height_formula: data.height_formula || null,
          side: data.side || null,
        } as any)
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-template-items", selectedTemplate?.id] });
      toast.success("Item atualizado!");
      setIsEditItemDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar item:", error);
      toast.error("Erro ao atualizar item: " + (error.message || "Erro desconhecido"));
    }
  });

  const handleAddCompositionItem = () => {
    if (!selectedItemToAdd) return;
    
    // Glass specific validation
    if (compositionActiveTab === 'glass') {
      if (!widthFormula || widthFormula.trim() === "") {
        toast.error("Por favor, informe a fórmula da largura do vidro.");
        return;
      }
      if (!heightFormula || heightFormula.trim() === "") {
        toast.error("Por favor, informe a fórmula da altura do vidro.");
        return;
      }
    }
    
    addCompositionMutation.mutate({
      item_template_id: selectedItemToAdd,
      quantity_formula: profilePosition === 'Largura' && compositionActiveTab === 'profile' ? undefined : quantityFormula,
      pieces_quantity: piecesQuantity,
      pieces_formula: piecesFormula,
      cut_angle: cutAngle,
      cut_angle_start: cutAngleStart,
      cut_angle_end: cutAngleEnd,
      is_optional: false,
      notes: compositionActiveTab === 'glass' ? glassName : "",
      width_formula: compositionActiveTab === 'glass' ? widthFormula : (profilePosition === 'Largura' ? quantityFormula : undefined),
      height_formula: compositionActiveTab === 'glass' ? heightFormula : (profilePosition === 'Altura' ? quantityFormula : undefined),
      side: selectedTemplate?.has_multiple_sides ? compositionSide : undefined,
    }, {
      onSuccess: () => {
        resetCompositionForm();
      }
    });
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;
    
    const itemType = editingItem.item_template?.type;
    
    // Glass specific validation
    if (itemType === 'glass') {
      if (!editWidthFormula || editWidthFormula.trim() === "") {
        toast.error("Por favor, informe a fórmula da largura do vidro.");
        return;
      }
      if (!editHeightFormula || editHeightFormula.trim() === "") {
        toast.error("Por favor, informe a fórmula da altura do vidro.");
        return;
      }
    }
    
    updateCompositionMutation.mutate({
      id: editingItem.id,
      quantity_formula: editProfilePosition === 'Largura' && itemType === 'profile' ? undefined : editQuantityFormula,
      pieces_quantity: editPiecesQuantity,
      pieces_formula: editPiecesFormula,
      cut_angle: editCutAngle,
      cut_angle_start: editCutAngleStart,
      cut_angle_end: editCutAngleEnd,
      notes: itemType === 'glass' ? editGlassName : undefined,
      width_formula: itemType === 'glass' ? editWidthFormula : (editProfilePosition === 'Largura' ? editQuantityFormula : undefined),
      height_formula: itemType === 'glass' ? editHeightFormula : (editProfilePosition === 'Altura' ? editQuantityFormula : undefined),
      side: selectedTemplate?.has_multiple_sides ? editSide : undefined,
    });
  };

  const handleEditItem = (item: ProductTemplateItem) => {
    setEditingItem(item);
    const itemType = item.item_template?.type || (item as any).company_item?.type;
    let effectiveQty = item.quantity_formula || "1";
    if (itemType === 'profile') {
      if (item.width_formula?.trim()) effectiveQty = item.width_formula;
      else if (item.height_formula?.trim()) effectiveQty = item.height_formula;
    }
    setEditQuantityFormula(effectiveQty);
    setUseFixedQtyEdit(/^\d+(?:[.,]\d+)?$/.test(String(effectiveQty).trim()));
    setEditPiecesQuantity(item.pieces_quantity || 1);
    setEditPiecesFormula(item.pieces_formula || null);
    setEditWidthFormula(item.width_formula || "");
    setEditHeightFormula(item.height_formula || "");
    setEditGlassName(item.notes || "");
    setEditCutAngle(item.cut_angle || 90);
    setEditCutAngleStart(item.cut_angle_start || item.cut_angle || 90);
    setEditCutAngleEnd(item.cut_angle_end || item.cut_angle || 90);
    setEditSide(item.side || "");
    setIsEditItemDialogOpen(true);
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Product Templates</h1>
            <p className="text-muted-foreground">Gerencie os modelos globais de produtos e suas composições</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/item-templates")} className="gap-2">
              <Package className="w-4 h-4" />
              Itens
            </Button>
            <Button onClick={() => { handleCloseDialog(); setDialogTab("dados"); setIsDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Produto
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><Package className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Total de Produtos</p>
                  <p className="text-2xl font-bold">{qualityStats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Prontos</p>
                  <p className="text-2xl font-bold">{qualityStats.prontos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg"><ImageIcon className="w-5 h-5 text-amber-600" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Sem Imagem</p>
                  <p className="text-2xl font-bold">{qualityStats.semImagem}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg"><EyeOff className="w-5 h-5 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Inativos</p>
                  <p className="text-2xl font-bold">{qualityStats.inativos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex flex-wrap gap-3 flex-1 w-full md:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categoriesList.map(c => <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>)}
              </SelectContent>
            </Select>

          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReady(!showReady)}
              className={cn("gap-2", showReady && "bg-primary/10 border-primary/30")}
            >
              {showReady ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showReady ? "Ocultar Prontos" : "Mostrar Prontos"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInactive(!showInactive)}
              className={cn("gap-2", showInactive && "bg-primary/10 border-primary/30")}
            >
              {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showInactive ? "Ocultar Inativos" : "Mostrar Inativos"}
            </Button>
          </div>
        </div>



        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : filteredTemplates?.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <h3 className="text-lg font-medium">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">Tente ajustar seus filtros ou busque por outro termo.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">

            {filteredTemplates?.map(template => {
              const imgUrl = resolveProductImageUrl(template.image_url);
              const isReady = template.description?.includes("[PRONTO]");
              return (
                <Card 
                  key={template.id} 
                  className={cn(
                    "group relative overflow-hidden transition-all hover:shadow-lg border-2",
                    !template.is_active && "opacity-50",
                    isReady ? "border-emerald-300 dark:border-emerald-700" : "border-transparent hover:border-primary/30"
                  )}
                >
                  {/* Ready badge */}
                  {isReady && (
                    <div className="absolute top-2 left-2 z-10">
                      <div className="bg-emerald-500 text-white rounded-full p-1 shadow-md">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                  )}

                  {/* Actions menu */}
                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm">
                          <MoreVertical className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Pencil className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyMutation.mutate(template)}>
                          <Copy className="w-4 h-4 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { handleEdit(template); setDialogTab("composicao"); }}>
                          <Settings2 className="w-4 h-4 mr-2" /> Composição
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleReadyMutation.mutate({ id: template.id, description: template.description, is_ready: !isReady })}>
                          {isReady ? (
                            <><XCircle className="w-4 h-4 mr-2 text-destructive" /> Desmarcar como Pronto</>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Marcar como Pronto</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(template.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Image area */}
                  <div className="aspect-square bg-muted/50 flex items-center justify-center p-3 relative overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={template.name} className="w-full h-full object-contain" />
                    ) : (
                      <Package className="w-10 h-10 text-muted-foreground/30" />
                    )}
                    {/* Upload overlay */}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <div className="flex flex-col items-center text-white gap-1">
                        <ImageUp className="w-6 h-6" />
                        <span className="text-xs font-medium">Trocar imagem</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const processedFile = await processFileWithWhiteBackground(file);
                            const fileName = `${template.id}.png`;
                            const { error: uploadError } = await supabase.storage
                              .from('product-templates')
                              .upload(fileName, processedFile, { upsert: true, contentType: 'image/png', cacheControl: '0' });
                            if (uploadError) throw uploadError;
                            const { data: urlData } = supabase.storage.from('product-templates').getPublicUrl(fileName);
                            const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
                            await supabase.from('product_templates').update({ image_url: newUrl }).eq('id', template.id);
                            queryClient.invalidateQueries({ queryKey: ['product-templates'] });
                            toast.success('Imagem atualizada!');
                          } catch (err: any) {
                            const msg = String(err?.message || err);
                            if (msg.includes('row-level security') || err?.code === '42501') {
                              toast.error('Acesso negado. Apenas o administrador SaaS (natanjk7@gmail.com) pode alterar imagens de templates.');
                            } else {
                              toast.error('Erro ao enviar imagem: ' + msg);
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {/* Info area */}
                  <div className="p-3 space-y-1.5">
                    <h3 className="font-semibold text-sm leading-tight truncate" title={template.name}>
                      {template.name}
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {categoryLabels[template.category] || template.category}
                      </Badge>
                      {template.linha && (
                        <span className="text-[10px] text-muted-foreground truncate">{template.linha}</span>
                      )}
                      <Badge variant={template.composition_mode === "parametric" ? "default" : "outline"} className="text-[9px] px-1 py-0">
                        {template.composition_mode === "parametric" ? "PARAMETRIC" : "FIXED"}
                      </Badge>
                      <Badge variant={template.publication_status === "active" ? "default" : "secondary"} className="text-[9px] px-1 py-0 uppercase">
                        {template.publication_status || (template.is_active ? "active" : "inactive")}
                      </Badge>
                      {template.has_multiple_sides && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/10 border-primary/30 text-primary">
                          2 Lados
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <Switch 
                        checked={template.is_active} 
                        onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: template.id, is_active: checked })}
                        className="scale-75 origin-left"
                      />
                      <span className={cn("text-[10px] font-medium", template.is_active ? "text-emerald-600" : "text-muted-foreground")}>
                        {template.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
              </div>
            ) : viewMode === 'table' ? (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates?.map(template => {
                      const imgUrl = resolveProductImageUrl(template.image_url);
                      const isReady = template.description?.includes("[PRONTO]");
                      return (
                        <TableRow key={template.id} className={cn(!template.is_active && "opacity-50")}>
                          <TableCell>
                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center overflow-hidden">
                              {imgUrl ? (
                                <img src={imgUrl} alt={template.name} className="w-full h-full object-contain" />
                              ) : (
                                <Package className="w-5 h-5 text-muted-foreground/30" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium flex items-center gap-2">
                                {template.name}
                                {isReady && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                                <Badge variant={template.composition_mode === "parametric" ? "default" : "outline"} className="text-[9px]">
                                  {template.composition_mode === "parametric" ? "PARAMETRIC" : "FIXED"}
                                </Badge>
                              </span>
                              {template.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                                  {template.description.replace("[PRONTO]", "").trim()}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {categoryLabels[template.category] || template.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {template.linha || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={template.is_active} 
                                onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: template.id, is_active: checked })}
                              />

                              <span className={cn("text-xs font-medium", template.is_active ? "text-emerald-600" : "text-muted-foreground")}>
                                {(template.publication_status || (template.is_active ? "active" : "inactive")).toUpperCase()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(template)}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyMutation.mutate(template)}><Copy className="w-4 h-4 mr-2" /> Duplicar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { handleEdit(template); setDialogTab("composicao"); }}>
                                  <Settings2 className="w-4 h-4 mr-2" /> Composição
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => toggleReadyMutation.mutate({ id: template.id, description: template.description, is_ready: !isReady })}>
                                  {isReady ? (
                                    <><XCircle className="w-4 h-4 mr-2 text-destructive" /> Desmarcar Pronto</>
                                  ) : (
                                    <><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Marcar Pronto</>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(template.id)}><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                              </DropdownMenuContent>

                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const entries = [...groupedTemplates.entries()];
                  const linhaMeta = (slug: string) =>
                    productLinhas?.find(l => l.slug === slug || l.name === slug);

                  // Apenas linhas ATIVAS aparecem aqui. Ativar/desativar em /admin/categories
                  // reflete imediatamente esta lista.
                  const activeLinhas = (productLinhas || []).filter(l => l.is_active);
                  const activeKeys = new Set(activeLinhas.map(l => l.slug.toLowerCase()));

                  const filteredEntries = entries.filter(([k]) => {
                    const slug = (linhaMeta(k)?.slug || k).toLowerCase();
                    return activeKeys.has(slug);
                  });

                  const mergedEntries: Array<[string, ProductTemplate[]]> = [...filteredEntries];
                  const existingKeys = new Set(
                    filteredEntries.map(([k]) => (linhaMeta(k)?.slug || k).toLowerCase())
                  );
                  activeLinhas.forEach((l) => {
                    if (!existingKeys.has(l.slug.toLowerCase())) {
                      mergedEntries.push([l.slug, []]);
                    }
                  });
                  mergedEntries.sort(([a], [b]) => {
                    const la = linhaMeta(a)?.name || a;
                    const lb = linhaMeta(b)?.name || b;
                    return la.localeCompare(lb);
                  });


                  // ===== Visão 1: GRID de cards das linhas (estilo /produtos) =====
                  if (!linhaView) {
                    return (
                      <div className="section-card p-3 sm:p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {mergedEntries.map(([linha, templates]) => {
                            const meta = linhaMeta(linha);
                            const cats = Array.from(new Set(templates.map(t => t.category).filter(Boolean))) as string[];
                            return (
                              <LinhaCardSimple
                                key={linha}
                                linha={linha}
                                label={meta?.name || linha}
                                onViewProducts={() => setLinhaView(linha)}
                                isRemovable={false}
                                categories={cats}
                                categoryLabels={categoryLabels}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  }



                  // ===== Visão 2: produtos da linha selecionada =====
                  const meta = linhaMeta(linhaView);
                  const templates = groupedTemplates.get(linhaView) || [];

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLinhaView(null)}
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar às linhas
                          </Button>
                          <div>
                            <h2 className="text-lg font-bold leading-tight">{meta?.name || linhaView}</h2>
                            <p className="text-xs text-muted-foreground">
                              {templates.length} produtos · {templates.filter(t => t.is_active).length} ativos
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {templates.map(template => {
                          const imgUrl = resolveProductImageUrl(template.image_url);
                          const isReady = template.description?.includes("[PRONTO]");
                          return (
                            <Card
                              key={template.id}
                              onClick={() => handleEdit(template)}
                              className={cn(
                                "group relative overflow-hidden transition-all hover:shadow-lg border-2 cursor-pointer",
                                !template.is_active && "opacity-50",
                                isReady ? "border-emerald-300 dark:border-emerald-700" : "border-transparent hover:border-primary/30"
                              )}
                            >

                              {isReady && (
                                <div className="absolute top-2 left-2 z-10">
                                  <div className="bg-emerald-500 text-white rounded-full p-1 shadow-md">
                                    <CheckCircle2 className="w-4 h-4" />
                                  </div>
                                </div>
                              )}
                              <div onClick={(e) => e.stopPropagation()} className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">

                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm">
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(template)}><Pencil className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => copyMutation.mutate(template)}><Copy className="w-4 h-4 mr-2" /> Duplicar</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { handleEdit(template); setDialogTab("composicao"); }}>
                                      <Settings2 className="w-4 h-4 mr-2" /> Composição
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => toggleReadyMutation.mutate({ id: template.id, description: template.description, is_ready: !isReady })}>
                                      {isReady ? (
                                        <><XCircle className="w-4 h-4 mr-2 text-destructive" /> Desmarcar Pronto</>
                                      ) : (
                                        <><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Marcar Pronto</>
                                      )}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(template.id)}><Trash2 className="w-4 h-4 mr-2" /> Excluir</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="aspect-square bg-muted/50 flex items-center justify-center p-3 relative overflow-hidden">
                                {imgUrl ? (
                                  <img src={imgUrl} alt={template.name} className="w-full h-full object-contain" />
                                ) : (
                                  <Package className="w-10 h-10 text-muted-foreground/30" />
                                )}
                              </div>
                              <div className="p-3 space-y-1.5">
                                <h3 className="font-semibold text-sm leading-tight truncate" title={template.name}>
                                  {template.name}
                                </h3>
                                <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                                  <Switch
                                    checked={template.is_active}
                                    onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: template.id, is_active: checked })}
                                    className="scale-75 origin-left"
                                  />
                                  <span className={cn("text-[10px] font-medium", template.is_active ? "text-emerald-600" : "text-muted-foreground")}>
                                    {template.is_active ? "Ativo" : "Inativo"}
                                  </span>
                                </div>

                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        )}


        {/* Product Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog();
            clearCompositionDraft();
            resetCompositionForm();
          } else {
            setIsDialogOpen(true);
          }
        }}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            </DialogHeader>
            <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as "dados" | "composicao" | "engenharia" | "variaveis")} className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="composicao" disabled={!editingTemplate || !formData.has_cutting_plan}>
                  <Settings2 className="w-4 h-4 mr-2" /> Composição
                </TabsTrigger>
                <TabsTrigger value="engenharia" disabled={!editingTemplate || formData.composition_mode !== "parametric"}>
                  <Ruler className="w-4 h-4 mr-2" /> Engenharia
                </TabsTrigger>
                <TabsTrigger value="variaveis" disabled={!editingTemplate}>
                  <Palette className="w-4 h-4 mr-2" /> Variáveis
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dados" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Image + Basic Info */}
              <div className="flex gap-6">
                {/* Image upload */}
                <div className="shrink-0">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Imagem</Label>
                  <label className="relative w-32 h-32 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors cursor-pointer flex items-center justify-center overflow-hidden bg-muted/30 group">
                    {formImagePreview ? (
                      <img src={formImagePreview} alt="Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <ImageUp className="w-8 h-8" />
                        <span className="text-[10px]">Adicionar</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setFormImageFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => setFormImagePreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {/* Basic fields */}
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs">Nome *</Label>
                      <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="category" className="text-xs">Categoria *</Label>
                      <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoriesList.map(c => (
                            <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="linha" className="text-xs">Linha</Label>
                      {availableLines.length > 0 ? (
                        <Select value={formData.linha || "none"} onValueChange={(v) => setFormData({ ...formData, linha: v === "none" ? "" : v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma</SelectItem>
                            {availableLines.map(l => (
                              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input id="linha" value={formData.linha} onChange={(e) => setFormData({ ...formData, linha: e.target.value })} placeholder="Ex: Suprema" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="base_price" className="text-xs">Preço Base (R$)</Label>
                      <Input id="base_price" type="number" step="0.01" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: e.target.value })} placeholder="0,00" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs">Descrição</Label>
                    <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
                  </div>
                </div>
              </div>

              {/* Dimensions */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" />
                  Dimensões Permitidas (mm)
                </Label>
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Larg. Mín.</Label>
                    <Input type="number" value={formData.min_width} onChange={(e) => setFormData({ ...formData, min_width: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Larg. Máx.</Label>
                    <Input type="number" value={formData.max_width} onChange={(e) => setFormData({ ...formData, max_width: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Alt. Mín.</Label>
                    <Input type="number" value={formData.min_height} onChange={(e) => setFormData({ ...formData, min_height: e.target.value })} placeholder="0" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Alt. Máx.</Label>
                    <Input type="number" value={formData.max_height} onChange={(e) => setFormData({ ...formData, max_height: e.target.value })} placeholder="0" />
                  </div>
                </div>
              </div>

              {/* Fiscal Info */}
              <details className="group">
                <summary className="text-xs font-semibold cursor-pointer flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <Layers className="w-3.5 h-3.5" />
                  Dados Fiscais (opcional)
                  <span className="text-[10px] ml-auto text-muted-foreground group-open:hidden">clique para expandir</span>
                </summary>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">NCM</Label>
                    <Input value={formData.ncm} onChange={(e) => setFormData({ ...formData, ncm: e.target.value })} placeholder="0000.00.00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">CEST</Label>
                    <Input value={formData.cest} onChange={(e) => setFormData({ ...formData, cest: e.target.value })} placeholder="00.000.00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">CFOP Venda</Label>
                    <Input value={formData.cfop_venda} onChange={(e) => setFormData({ ...formData, cfop_venda: e.target.value })} placeholder="5102" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Origem</Label>
                    <Select value={formData.origem || "none"} onValueChange={(v) => setFormData({ ...formData, origem: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-</SelectItem>
                        <SelectItem value="0">0 - Nacional</SelectItem>
                        <SelectItem value="1">1 - Estrangeira (Imp. Direta)</SelectItem>
                        <SelectItem value="2">2 - Estrangeira (Mercado Interno)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </details>

              {/* Toggles */}
              <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Modelo de composição</Label>
                  <Select value={formData.composition_mode} onValueChange={(value: "fixed" | "parametric") => setFormData({ ...formData, composition_mode: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="fixed">FIXED — composição tradicional</SelectItem><SelectItem value="parametric">PARAMETRIC — motor de engenharia</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Publicação</Label>
                  <Select value={formData.publication_status} onValueChange={(value: "draft" | "active" | "inactive") => setFormData({ ...formData, publication_status: value, is_active: value === "active" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="draft">DRAFT — somente SaaS Admin</SelectItem><SelectItem value="active">ACTIVE — disponível às empresas</SelectItem><SelectItem value="inactive">INACTIVE — somente históricos</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked, publication_status: checked ? "active" : "inactive" })}
                  />
                  <Label htmlFor="is_active" className="text-sm">Produto ativo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_ready"
                    checked={formData.is_ready}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_ready: checked })}
                  />
                  <Label htmlFor="is_ready" className="text-sm flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Pronto/Completo
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="has_multiple_sides"
                    checked={formData.has_multiple_sides}
                    onCheckedChange={(checked) => setFormData({ ...formData, has_multiple_sides: checked })}
                  />
                  <Label htmlFor="has_multiple_sides" className="text-sm flex items-center gap-1">
                    <Layers className="w-4 h-4 text-primary" />
                    Múltiplos Lados (ex: Box de Canto)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="has_cutting_plan"
                    checked={formData.has_cutting_plan}
                    onCheckedChange={(checked) => setFormData({ ...formData, has_cutting_plan: checked })}
                  />
                  <Label htmlFor="has_cutting_plan" className="text-sm flex items-center gap-1">
                    <Scissors className="w-4 h-4 text-primary" />
                    Este produto possui plano de corte?
                  </Label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
              </TabsContent>
              <TabsContent value="composicao" className="mt-4">
            <div className="flex items-center justify-end mb-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setIsCopyCompositionOpen(true)}
                disabled={!(editingTemplate?.id || selectedTemplate?.id)}
              >
                <Layers className="w-4 h-4" />
                Copiar Composição de outro Produto
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,32%)_1fr] gap-4">

              {/* LEFT COLUMN — Add form */}
              <aside className="bg-muted/40 dark:bg-muted/20 border rounded-lg p-4 space-y-4 lg:sticky lg:top-0 self-start">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Plus className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Adicionar Item</h3>
                </div>

                {getLinhasForAddTab(compositionActiveTab).length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Filtrar por Linha</Label>
                    <Select value={linhaFilter} onValueChange={setLinhaFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Todas as linhas" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50 max-h-[260px]">
                        <SelectItem value="__all__">Todas as linhas</SelectItem>
                        {getLinhasForAddTab(compositionActiveTab).map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Selecione o item</Label>
                  <Select value={selectedItemToAdd} onValueChange={setSelectedItemToAdd}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Clique para escolher" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[400px]">
                      {getItemsByTypeForAdd(compositionActiveTab).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {item.image_url ? (
                                <img src={getStorageUrl(item.image_url)} alt={item.name} className="w-full h-full object-contain p-0.5" />
                              ) : (
                                <Package className="w-4 h-4 text-muted-foreground/50" />
                              )}
                            </div>
                            <span className="font-medium text-sm">{item.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedItemToAdd && selectedItemFormulas.length > 0 && compositionActiveTab === 'profile' && (
                  <div className="space-y-2 p-3 rounded-md border border-primary/30 bg-primary/5">
                    <Label className="text-xs font-medium">
                      Fórmula pré-cadastrada ({selectedItemFormulas.length} disponíveis)
                    </Label>
                    <Select
                      value={String(selectedFormulaIndex)}
                      onValueChange={(v) => {
                        const idx = parseInt(v);
                        setSelectedFormulaIndex(idx);
                        applyFormulaEntry(selectedItemFormulas[idx]);
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedItemFormulas.map((f: any, idx: number) => {
                          const posRaw = String(f.position ?? '').toLowerCase();
                          const pos = posRaw === 'height' || posRaw === 'altura' ? 'Altura' : 'Largura';
                          const label = f.label && String(f.label).trim() ? String(f.label).trim() : pos;
                          return (
                            <SelectItem key={idx} value={String(idx)}>
                              <span className="text-sm">
                                <span className="font-medium">{label}</span>
                                <span className="text-muted-foreground"> · {pos}</span>
                                <code className="ml-2 text-[11px] font-mono">{f.formula}</code>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {compositionActiveTab === 'glass' ? (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Nome do Vidro (opcional)</Label>
                      <Input
                        placeholder="Ex: Vidro Fixo, Vidro Móvel..."
                        value={glassName}
                        onChange={(e) => setGlassName(e.target.value)}
                      />
                    </div>
                    <GlassFormulaEditor
                      widthFormula={widthFormula}
                      heightFormula={heightFormula}
                      onWidthFormulaChange={setWidthFormula}
                      onHeightFormulaChange={setHeightFormula}
                      showPiecesQuantity={true}
                      piecesQuantity={piecesQuantity}
                      onPiecesChange={setPiecesQuantity}
                      piecesFormula={piecesFormula}
                      onPiecesFormulaChange={setPiecesFormula}
                    />
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                      <div>
                        <Label className="text-sm font-medium">Quantidade fixa</Label>
                        <p className="text-xs text-muted-foreground">Ative para digitar um número em vez de fórmula</p>
                      </div>
                      <Switch
                        checked={useFixedQty}
                        onCheckedChange={(checked) => {
                          setUseFixedQty(checked);
                          if (checked && !/^\d+(?:[.,]\d+)?$/.test(quantityFormula.trim())) {
                            setQuantityFormula("1");
                          }
                        }}
                      />
                    </div>
                    {useFixedQty ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Quantidade</Label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={quantityFormula}
                          onChange={(e) => setQuantityFormula(e.target.value || "0")}
                          placeholder="Ex: 5"
                        />
                      </div>
                    ) : (
                      <FormulaEditor
                        value={quantityFormula}
                        onChange={setQuantityFormula}
                        showPiecesQuantity={compositionActiveTab === 'profile' || compositionActiveTab === 'accessory'}
                        piecesQuantity={piecesQuantity}
                        onPiecesChange={setPiecesQuantity}
                        piecesFormula={piecesFormula}
                        onPiecesFormulaChange={setPiecesFormula}
                      />
                    )}
                  </>
                )}

                {compositionActiveTab === 'profile' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Posição do Perfil</Label>
                      <div className="flex gap-2">
                        {(['Largura', 'Altura'] as const).map((pos) => (
                          <Button
                            key={pos}
                            type="button"
                            variant={profilePosition === pos ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setProfilePosition(pos)}
                            className="flex-1"
                          >
                            {pos}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Ângulo Início</Label>
                        <div className="flex gap-2">
                          {[45, 90].map((angle) => (
                            <Button
                              key={angle}
                              type="button"
                              variant={cutAngleStart === angle ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCutAngleStart(angle)}
                              className="flex-1 relative overflow-hidden"
                            >
                              <div
                                className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20"
                                style={{ transform: angle === 45 ? 'skewY(-45deg)' : 'none', transformOrigin: 'top' }}
                              />
                              {angle}°
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Ângulo Fim</Label>
                        <div className="flex gap-2">
                          {[45, 90].map((angle) => (
                            <Button
                              key={angle}
                              type="button"
                              variant={cutAngleEnd === angle ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCutAngleEnd(angle)}
                              className="flex-1 relative overflow-hidden"
                            >
                              <div
                                className="absolute right-0 top-0 bottom-0 w-1 bg-primary/20"
                                style={{ transform: angle === 45 ? 'skewY(45deg)' : 'none', transformOrigin: 'top' }}
                              />
                              {angle}°
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {selectedTemplate?.has_multiple_sides && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Lado do Produto</Label>
                    <div className="flex gap-2">
                      {[
                        { value: "", label: "Ambos" },
                        { value: "A", label: "Lado A" },
                        { value: "B", label: "Lado B" },
                      ].map((opt) => (
                        <Button
                          key={opt.value}
                          type="button"
                          variant={compositionSide === opt.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCompositionSide(opt.value)}
                          className="flex-1"
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t">
                  <Button
                    onClick={handleAddCompositionItem}
                    disabled={!selectedItemToAdd || addCompositionMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </aside>

              {/* RIGHT COLUMN — Category tabs + list */}
              <section className="space-y-4 min-w-0">
                {/* Category sub-tabs — pill style like reference */}
                <div className="flex flex-wrap gap-2 p-2 bg-white dark:bg-muted/30 border rounded-xl shadow-sm sticky top-0 z-10">
                  {itemTypeTabs.map((tab) => {
                    const active = compositionActiveTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        onClick={() => {
                          setCompositionActiveTab(tab.value);
                          setSelectedItemToAdd("");
                        }}
                        className={cn(
                          "flex-1 min-w-[90px] px-4 py-2.5 text-xs sm:text-sm font-semibold tracking-wide rounded-lg transition-all",
                          active
                            ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Action bar — blank surface with Pronto on the right */}
                <div className="flex items-center justify-end gap-3 bg-white dark:bg-muted/20 border rounded-xl shadow-sm px-4 py-3 min-h-[56px]">
                  <Button size="sm" variant="secondary" onClick={handleCloseDialog} className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Pronto
                  </Button>
                </div>

                {/* Items count */}
                <h4 className="text-sm text-muted-foreground px-1">
                  Itens adicionados ({getCompositionItemsByType(compositionActiveTab).length})
                </h4>

                {/* Grid */}
                {getCompositionItemsByType(compositionActiveTab).length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Layers className="w-10 h-10 text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum item desta categoria na composição</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {getCompositionItemsByType(compositionActiveTab).map((item) => {
                      const displayedFormula = getDisplayedItemFormula(item);
                      const formulaPosition = getDisplayedFormulaPosition(item);
                      const displayedPieces = getDisplayedPieces(item);
                      const widthF = item.width_formula ?? item.quantity_formula;
                      const heightF = item.height_formula;
                      const typeLabel =
                        item.item_template?.type === 'glass' ? 'Vidro'
                        : item.item_template?.type === 'profile' ? 'Perfil'
                        : item.item_template?.type === 'accessory' ? 'Acessório'
                        : item.item_template?.type === 'service' ? 'Serviço'
                        : item.item_template?.type === 'sheet' ? 'Chaparia'
                        : (item.item_template?.type ?? '');

                      return (
                        <div
                          key={item.id}
                          className="bg-white dark:bg-muted/20 border rounded-2xl p-4 relative group hover:shadow-md transition-shadow cursor-pointer hover:border-primary/50 flex flex-col"
                          onClick={() => handleEditItem(item)}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCompositionMutation.mutate(item.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>

                          {/* Image tile */}
                          <div className="aspect-square bg-muted/60 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                            {item.item_template?.image_url ? (
                              <img
                                src={getStorageUrl(item.item_template.image_url)}
                                alt={item.item_template.name}
                                className="w-full h-full object-contain p-3"
                              />
                            ) : (
                              <div className="text-3xl text-muted-foreground/30">📦</div>
                            )}
                          </div>

                          {/* Title: NAME (Category) — blue */}
                          <h4 className="font-semibold text-sm text-center text-primary truncate">
                            {item.item_template?.name}
                            {typeLabel && (
                              <span className="font-normal"> ({typeLabel})</span>
                            )}
                          </h4>

                          {/* Formula lines — plain text */}
                          <div className="mt-2 space-y-0.5 text-center text-xs text-muted-foreground">
                            {item.item_template?.type === 'glass' && heightF ? (
                              <>
                                <p><span className="font-medium text-foreground/80">Fórmula Largura:</span> {widthF}</p>
                                <p><span className="font-medium text-foreground/80">Fórmula Altura:</span> {heightF}</p>
                              </>
                            ) : item.item_template?.type === 'profile' && heightF ? (
                              <>
                                <p><span className="font-medium text-foreground/80">Fórmula Largura:</span> {widthF}</p>
                                <p><span className="font-medium text-foreground/80">Fórmula Altura:</span> {heightF}</p>
                              </>
                            ) : (
                              <p><span className="font-medium text-foreground/80">Fórmula:</span> {displayedFormula}</p>
                            )}

                            {formulaPosition && (
                              <p><span className="font-medium text-foreground/80">Posição:</span> {formulaPosition}</p>
                            )}

                            {item.item_template?.type === 'profile' && (
                              <p><span className="font-medium text-foreground/80">Ângulo:</span> {item.cut_angle_start ?? item.cut_angle ?? 90}° / {item.cut_angle_end ?? item.cut_angle ?? 90}°</p>
                            )}

                            {item.side && (
                              <p><span className="font-medium text-foreground/80">Lado:</span> {item.side}</p>
                            )}
                          </div>

                          {/* Pieces pill */}
                          <div className="mt-3 flex justify-center">
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border bg-muted/40 text-xs">
                              <span className="font-semibold">Peças:</span>
                              <span>{displayedPieces}</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

              </TabsContent>


              <TabsContent value="engenharia" className="mt-4">
                {editingTemplate && (
                  <EngineeringCenter productTemplateId={editingTemplate.id} line={editingTemplate.linha} />
                )}
              </TabsContent>


              <TabsContent value="variaveis" className="mt-4">
                <VariablesTab />
              </TabsContent>

            </Tabs>
          </DialogContent>
        </Dialog>

        {(editingTemplate?.id || selectedTemplate?.id) && (
          <CopyCompositionDialog
            open={isCopyCompositionOpen}
            onOpenChange={setIsCopyCompositionOpen}
            productTemplateId={(editingTemplate?.id || selectedTemplate?.id) as string}
            companyId={null}
          />
        )}




        {/* Edit Item Dialog */}
        <Dialog open={isEditItemDialogOpen} onOpenChange={(open) => {
          setIsEditItemDialogOpen(open);
          if (!open) setEditingItem(null);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                {editingItem?.item_template?.image_url && (
                  <div className="w-10 h-10 rounded bg-muted overflow-hidden shrink-0">
                    <img
                      src={getStorageUrl(editingItem.item_template.image_url)}
                      alt={editingItem.item_template.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                Editar {editingItem?.item_template?.name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {(editingItem?.item_template?.type === 'glass') ? (
                <>
                  <div className="space-y-2">
                    <Label>Nome do Vidro (opcional)</Label>
                    <Input
                      placeholder="Ex: Vidro Fixo, Vidro Móvel..."
                      value={editGlassName}
                      onChange={(e) => setEditGlassName(e.target.value)}
                    />
                  </div>
                  
                  <GlassFormulaEditor
                    widthFormula={editWidthFormula}
                    heightFormula={editHeightFormula}
                    onWidthFormulaChange={setEditWidthFormula}
                    onHeightFormulaChange={setEditHeightFormula}
                    showPiecesQuantity={true}
                    piecesQuantity={editPiecesQuantity}
                    onPiecesChange={setEditPiecesQuantity}
                    piecesFormula={editPiecesFormula}
                    onPiecesFormulaChange={setEditPiecesFormula}
                  />
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                    <div>
                      <Label className="text-sm font-medium">Quantidade fixa</Label>
                      <p className="text-xs text-muted-foreground">Ative para digitar um número em vez de fórmula</p>
                    </div>
                    <Switch
                      checked={useFixedQtyEdit}
                      onCheckedChange={(checked) => {
                        setUseFixedQtyEdit(checked);
                        if (checked && !/^\d+(?:[.,]\d+)?$/.test(editQuantityFormula.trim())) {
                          setEditQuantityFormula("1");
                        }
                      }}
                    />
                  </div>
                  {useFixedQtyEdit ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Quantidade</Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={editQuantityFormula}
                        onChange={(e) => setEditQuantityFormula(e.target.value || "0")}
                        placeholder="Ex: 5"
                      />
                    </div>
                  ) : (
                    <FormulaEditor
                      value={editQuantityFormula}
                      onChange={setEditQuantityFormula}
                      showPiecesQuantity={editingItem?.item_template?.type === 'profile' || editingItem?.item_template?.type === 'accessory'}
                      piecesQuantity={editPiecesQuantity}
                      onPiecesChange={setEditPiecesQuantity}
                      piecesFormula={editPiecesFormula}
                      onPiecesFormulaChange={setEditPiecesFormula}
                    />
                  )}
                  
              {editingItem?.item_template?.type === 'profile' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Posição do Perfil</Label>
                    <div className="flex gap-2">
                      {(['Largura', 'Altura'] as const).map((pos) => (
                        <Button
                          key={pos}
                          type="button"
                          variant={editProfilePosition === pos ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setEditProfilePosition(pos)}
                          className="flex-1"
                        >
                          {pos}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Ângulo Início</Label>
                        <div className="flex gap-2">
                          {[45, 90].map((angle) => (
                            <Button
                              key={angle}
                              type="button"
                              variant={editCutAngleStart === angle ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setEditCutAngleStart(angle)}
                              className="flex-1 relative overflow-hidden"
                            >
                              <div 
                                className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20" 
                                style={{ transform: angle === 45 ? 'skewY(-45deg)' : 'none', transformOrigin: 'top' }}
                              />
                              {angle}°
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Ângulo Fim</Label>
                        <div className="flex gap-2">
                          {[45, 90].map((angle) => (
                            <Button
                              key={angle}
                              type="button"
                              variant={editCutAngleEnd === angle ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setEditCutAngleEnd(angle)}
                              className="flex-1 relative overflow-hidden"
                            >
                              <div 
                                className="absolute right-0 top-0 bottom-0 w-1 bg-primary/20" 
                                style={{ transform: angle === 45 ? 'skewY(45deg)' : 'none', transformOrigin: 'top' }}
                              />
                              {angle}°
                            </Button>
                          ))}
                        </div>
                      </div>
                  </div>
                </>
              )}
                </>
              )}
              
              {/* Side selector for multi-side products in edit mode */}
              {selectedTemplate?.has_multiple_sides && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Lado do Produto</Label>
                  <div className="flex gap-2">
                    {[
                      { value: "", label: "Ambos" },
                      { value: "A", label: "Lado A" },
                      { value: "B", label: "Lado B" },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={editSide === opt.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setEditSide(opt.value)}
                        className="flex-1"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsEditItemDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateItem}>Salvar Alterações</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
