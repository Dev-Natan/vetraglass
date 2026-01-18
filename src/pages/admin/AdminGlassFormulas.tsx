import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassWater, Plus, Search, Trash2, Pencil, Save, Copy, ChevronDown, ChevronRight, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface GlassFormula {
  id: string;
  linha: string;
  product_template_id: string | null;
  formula_name: string;
  description: string | null;
  width_formula: string;
  height_formula: string;
  panel_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ProductTemplate {
  id: string;
  name: string;
  linha: string | null;
  category: string;
  is_active: boolean;
}

interface FormData {
  formula_name: string;
  description: string;
  width_formula: string;
  height_formula: string;
  panel_index: number;
  is_active: boolean;
}

export default function AdminGlassFormulas() {
  const { isSaasAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLinhas, setExpandedLinhas] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<GlassFormula | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductTemplate | null>(null);
  const [formData, setFormData] = useState<FormData>({
    formula_name: '',
    description: '',
    width_formula: 'Largura',
    height_formula: 'Altura',
    panel_index: 0,
    is_active: true,
  });

  // Fetch all glass formulas
  const { data: formulas, isLoading: loadingFormulas } = useQuery({
    queryKey: ['admin-glass-formulas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glass_line_formulas')
        .select('*')
        .order('panel_index')
        .order('formula_name');
      
      if (error) throw error;
      return data as GlassFormula[];
    },
  });

  // Fetch all product templates grouped by linha
  const { data: products, isLoading: loadingProducts } = useQuery({
    queryKey: ['admin-products-for-formulas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('id, name, linha, category, is_active')
        .not('linha', 'is', null)
        .order('linha')
        .order('name');
      
      if (error) throw error;
      return data as ProductTemplate[];
    },
  });

  // Group products by linha
  const productsByLinha = products?.reduce((acc, product) => {
    const linha = product.linha || 'Sem Linha';
    if (!acc[linha]) {
      acc[linha] = [];
    }
    acc[linha].push(product);
    return acc;
  }, {} as Record<string, ProductTemplate[]>) || {};

  // Get formulas for a specific product
  const getFormulasForProduct = (productId: string) => {
    return formulas?.filter(f => f.product_template_id === productId) || [];
  };

  // Save formula mutation
  const saveMutation = useMutation({
    mutationFn: async ({ formula, product }: { formula: FormData; product: ProductTemplate }) => {
      if (editingFormula) {
        const { error } = await supabase
          .from('glass_line_formulas')
          .update({
            formula_name: formula.formula_name,
            description: formula.description || null,
            width_formula: formula.width_formula,
            height_formula: formula.height_formula,
            panel_index: formula.panel_index,
            is_active: formula.is_active,
          })
          .eq('id', editingFormula.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('glass_line_formulas')
          .insert({
            linha: product.linha || '',
            product_template_id: product.id,
            formula_name: formula.formula_name,
            description: formula.description || null,
            width_formula: formula.width_formula,
            height_formula: formula.height_formula,
            panel_index: formula.panel_index,
            is_active: formula.is_active,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-glass-formulas'] });
      toast.success(editingFormula ? 'Fórmula atualizada!' : 'Fórmula criada!');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar fórmula');
    },
  });

  // Delete formula mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('glass_line_formulas')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-glass-formulas'] });
      toast.success('Fórmula excluída!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir');
    },
  });

  // Duplicate formula mutation
  const duplicateMutation = useMutation({
    mutationFn: async (formula: GlassFormula) => {
      const { error } = await supabase
        .from('glass_line_formulas')
        .insert({
          linha: formula.linha,
          product_template_id: formula.product_template_id,
          formula_name: `${formula.formula_name} (cópia)`,
          description: formula.description,
          width_formula: formula.width_formula,
          height_formula: formula.height_formula,
          panel_index: formula.panel_index,
          is_active: formula.is_active,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-glass-formulas'] });
      toast.success('Fórmula duplicada!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao duplicar');
    },
  });

  const handleOpenDialog = (product: ProductTemplate, formula?: GlassFormula) => {
    setSelectedProduct(product);
    if (formula) {
      setEditingFormula(formula);
      setFormData({
        formula_name: formula.formula_name,
        description: formula.description || '',
        width_formula: formula.width_formula,
        height_formula: formula.height_formula,
        panel_index: formula.panel_index,
        is_active: formula.is_active,
      });
    } else {
      setEditingFormula(null);
      setFormData({
        formula_name: '',
        description: '',
        width_formula: 'Largura',
        height_formula: 'Altura',
        panel_index: 0,
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingFormula(null);
    setSelectedProduct(null);
  };

  const handleSave = () => {
    if (!formData.formula_name.trim()) {
      toast.error('Nome da fórmula é obrigatório');
      return;
    }
    if (!formData.width_formula.trim() || !formData.height_formula.trim()) {
      toast.error('Fórmulas de largura e altura são obrigatórias');
      return;
    }
    if (!selectedProduct) return;
    saveMutation.mutate({ formula: formData, product: selectedProduct });
  };

  const toggleLinha = (linha: string) => {
    setExpandedLinhas(prev => {
      const next = new Set(prev);
      if (next.has(linha)) {
        next.delete(linha);
      } else {
        next.add(linha);
      }
      return next;
    });
  };

  const toggleProduct = (productId: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Filter linhas
  const filteredLinhas = Object.keys(productsByLinha).filter(
    linha => linha.toLowerCase().includes(searchTerm.toLowerCase()) ||
    productsByLinha[linha].some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isLoading = loadingFormulas || loadingProducts;

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
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <GlassWater className="w-8 h-8" />
              Fórmulas de Vidro
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie as fórmulas de cálculo de vidro por produto
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar linha ou produto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Info card about formulas */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-800">
              <strong>Variáveis disponíveis:</strong> Use <code className="bg-blue-100 px-1 rounded">Largura</code> (ou <code className="bg-blue-100 px-1 rounded">L</code>) 
              para a largura do vão e <code className="bg-blue-100 px-1 rounded">Altura</code> (ou <code className="bg-blue-100 px-1 rounded">A</code>) para a altura do vão.
              <br />
              <strong>Exemplos:</strong> <code className="bg-blue-100 px-1 rounded">Largura - 40</code>, <code className="bg-blue-100 px-1 rounded">Altura / 2 - 10</code>, <code className="bg-blue-100 px-1 rounded">(L - 60) / 2</code>
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            {filteredLinhas.map(linha => (
              <Collapsible
                key={linha}
                open={expandedLinhas.has(linha)}
                onOpenChange={() => toggleLinha(linha)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {expandedLinhas.has(linha) ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                        <CardTitle className="text-lg">{linha}</CardTitle>
                        <Badge variant="secondary">
                          {productsByLinha[linha].length} produto(s)
                        </Badge>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-3">
                      {productsByLinha[linha].map(product => {
                        const productFormulas = getFormulasForProduct(product.id);
                        const isExpanded = expandedProducts.has(product.id);
                        
                        return (
                          <Collapsible
                            key={product.id}
                            open={isExpanded}
                            onOpenChange={() => toggleProduct(product.id)}
                          >
                            <div className={`border rounded-lg ${!product.is_active ? 'opacity-60' : ''}`}>
                              <CollapsibleTrigger asChild>
                                <div className="p-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                    <Package className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium">{product.name}</span>
                                    {productFormulas.length > 0 && (
                                      <Badge variant="outline" className="text-xs">
                                        {productFormulas.length} fórmula(s)
                                      </Badge>
                                    )}
                                    {!product.is_active && (
                                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDialog(product);
                                    }}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Fórmula
                                  </Button>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="px-3 pb-3 space-y-2">
                                  {productFormulas.length === 0 ? (
                                    <p className="text-sm text-muted-foreground py-2 pl-8">
                                      Nenhuma fórmula configurada
                                    </p>
                                  ) : (
                                    productFormulas.map(formula => (
                                      <div
                                        key={formula.id}
                                        className={`ml-8 p-3 border rounded-lg ${formula.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'}`}
                                      >
                                        <div className="flex items-start justify-between gap-4">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h4 className="font-medium text-sm">{formula.formula_name}</h4>
                                              {!formula.is_active && (
                                                <Badge variant="outline" className="text-xs">Inativo</Badge>
                                              )}
                                              {formula.panel_index > 0 && (
                                                <Badge variant="secondary" className="text-xs">
                                                  Painel {formula.panel_index}
                                                </Badge>
                                              )}
                                            </div>
                                            {formula.description && (
                                              <p className="text-xs text-muted-foreground mb-2">
                                                {formula.description}
                                              </p>
                                            )}
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                              <div>
                                                <span className="text-muted-foreground">Largura: </span>
                                                <code className="bg-muted px-1.5 py-0.5 rounded text-primary">
                                                  {formula.width_formula}
                                                </code>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Altura: </span>
                                                <code className="bg-muted px-1.5 py-0.5 rounded text-primary">
                                                  {formula.height_formula}
                                                </code>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => handleOpenDialog(product, formula)}
                                              title="Editar"
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => duplicateMutation.mutate(formula)}
                                              title="Duplicar"
                                            >
                                              <Copy className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => {
                                                if (confirm('Tem certeza que deseja excluir esta fórmula?')) {
                                                  deleteMutation.mutate(formula.id);
                                                }
                                              }}
                                              title="Excluir"
                                            >
                                              <Trash2 className="w-3 h-3 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}

            {filteredLinhas.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum produto encontrado.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFormula ? 'Editar Fórmula' : 'Nova Fórmula'}
            </DialogTitle>
            {selectedProduct && (
              <p className="text-sm text-muted-foreground">
                Produto: {selectedProduct.name}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Fórmula *</Label>
              <Input
                value={formData.formula_name}
                onChange={e => setFormData({ ...formData, formula_name: e.target.value })}
                placeholder="Ex: Vidro Fixo, Vidro Móvel, Vidro A, Vidro B"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fórmula da Largura *</Label>
                <Input
                  value={formData.width_formula}
                  onChange={e => setFormData({ ...formData, width_formula: e.target.value })}
                  placeholder="Ex: Largura - 40"
                />
              </div>
              <div>
                <Label>Fórmula da Altura *</Label>
                <Input
                  value={formData.height_formula}
                  onChange={e => setFormData({ ...formData, height_formula: e.target.value })}
                  placeholder="Ex: Altura - 20"
                />
              </div>
            </div>
            <div>
              <Label>Índice do Painel (0 = todos)</Label>
              <Input
                type="number"
                min={0}
                value={formData.panel_index}
                onChange={e => setFormData({ ...formData, panel_index: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use 0 para aplicar a todos os painéis, ou especifique o índice (1, 2, 3...) para painéis específicos.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_active}
                onCheckedChange={checked => setFormData({ ...formData, is_active: checked })}
              />
              <Label>Fórmula ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
