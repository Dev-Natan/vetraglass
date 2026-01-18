import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { GlassWater, Plus, Search, Trash2, Pencil, Save, X, Copy, ChevronDown, ChevronRight } from 'lucide-react';
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
  formula_name: string;
  description: string | null;
  width_formula: string;
  height_formula: string;
  panel_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFormula, setEditingFormula] = useState<GlassFormula | null>(null);
  const [selectedLinha, setSelectedLinha] = useState<string>('');
  const [formData, setFormData] = useState<FormData>({
    formula_name: '',
    description: '',
    width_formula: 'Largura',
    height_formula: 'Altura',
    panel_index: 0,
    is_active: true,
  });

  // Fetch all glass formulas grouped by linha
  const { data: formulas, isLoading } = useQuery({
    queryKey: ['admin-glass-formulas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('glass_line_formulas')
        .select('*')
        .order('linha')
        .order('panel_index')
        .order('formula_name');
      
      if (error) throw error;
      return data as GlassFormula[];
    },
  });

  // Fetch all unique linhas from product_templates
  const { data: availableLinhas } = useQuery({
    queryKey: ['available-linhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('linha')
        .not('linha', 'is', null);
      
      if (error) throw error;
      
      const uniqueLinhas = [...new Set(data?.map(p => p.linha).filter(Boolean))] as string[];
      return uniqueLinhas.sort();
    },
  });

  // Group formulas by linha
  const formulasByLinha = formulas?.reduce((acc, formula) => {
    if (!acc[formula.linha]) {
      acc[formula.linha] = [];
    }
    acc[formula.linha].push(formula);
    return acc;
  }, {} as Record<string, GlassFormula[]>) || {};

  // Save formula mutation
  const saveMutation = useMutation({
    mutationFn: async ({ formula, linha }: { formula: FormData; linha: string }) => {
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
            linha,
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

  const handleOpenDialog = (linha: string, formula?: GlassFormula) => {
    setSelectedLinha(linha);
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
    setSelectedLinha('');
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
    saveMutation.mutate({ formula: formData, linha: selectedLinha });
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

  // Filter linhas
  const filteredLinhas = Object.keys(formulasByLinha).filter(
    linha => linha.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Linhas without formulas yet
  const linhasWithoutFormulas = availableLinhas?.filter(
    linha => !formulasByLinha[linha]
  ) || [];

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
              Gerencie as fórmulas de cálculo de vidro por linha de produto
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar linha..."
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
            {/* Linhas with formulas */}
            {filteredLinhas.map(linha => (
              <Collapsible
                key={linha}
                open={expandedLinhas.has(linha)}
                onOpenChange={() => toggleLinha(linha)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {expandedLinhas.has(linha) ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                          <CardTitle className="text-lg">{linha}</CardTitle>
                          <Badge variant="secondary">
                            {formulasByLinha[linha].length} fórmula(s)
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDialog(linha);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Nova Fórmula
                        </Button>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {formulasByLinha[linha].map(formula => (
                          <div
                            key={formula.id}
                            className={`p-4 border rounded-lg ${formula.is_active ? 'bg-background' : 'bg-muted/50 opacity-60'}`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium">{formula.formula_name}</h4>
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
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {formula.description}
                                  </p>
                                )}
                                <div className="grid grid-cols-2 gap-4 text-sm">
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
                                  onClick={() => handleOpenDialog(linha, formula)}
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => duplicateMutation.mutate(formula)}
                                  title="Duplicar"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm('Tem certeza que deseja excluir esta fórmula?')) {
                                      deleteMutation.mutate(formula.id);
                                    }
                                  }}
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}

            {/* Linhas without formulas */}
            {linhasWithoutFormulas.length > 0 && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg text-muted-foreground">
                    Linhas sem fórmulas configuradas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {linhasWithoutFormulas.map(linha => (
                      <Button
                        key={linha}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(linha)}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {linha}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredLinhas.length === 0 && linhasWithoutFormulas.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma linha encontrada.
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
              {editingFormula ? 'Editar Fórmula' : 'Nova Fórmula'} - {selectedLinha}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome da Fórmula *</Label>
              <Input
                value={formData.formula_name}
                onChange={e => setFormData({ ...formData, formula_name: e.target.value })}
                placeholder="Ex: Vidro Fixo, Vidro Móvel"
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
