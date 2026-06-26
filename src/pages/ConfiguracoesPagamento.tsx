import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CreditCard, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2, 
  ArrowLeft,
  Percent,
  DollarSign,
  Banknote,
  GripVertical
} from 'lucide-react';
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface FormaPagamento {
  id: string;
  nome: string;
  tipo: 'avista' | 'parcelado' | 'misto';
  is_active: boolean;
  sort_order: number;
}

interface CondicaoPagamento {
  id: string;
  nome: string;
  parcelas: number;
  dias_entre_parcelas: number;
  juros_percent: number;
  desconto_percent: number;
  forma_pagamento_id: string | null;
  is_active: boolean;
  sort_order: number;
  forma_pagamento?: FormaPagamento | null;
}

export default function ConfiguracoesPagamento() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  
  // Dialog states
  const [formaDialogOpen, setFormaDialogOpen] = useState(false);
  const [condicaoDialogOpen, setCondicaoDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingForma, setEditingForma] = useState<FormaPagamento | null>(null);
  const [editingCondicao, setEditingCondicao] = useState<CondicaoPagamento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'forma' | 'condicao'; id: string; nome: string } | null>(null);

  // Form states
  const [formaNome, setFormaNome] = useState("");
  const [formaTipo, setFormaTipo] = useState<'avista' | 'parcelado' | 'misto'>('avista');
  
  const [condicaoNome, setCondicaoNome] = useState("");
  const [condicaoParcelas, setCondicaoParcelas] = useState(1);
  const [condicaoDias, setCondicaoDias] = useState(30);
  const [condicaoJuros, setCondicaoJuros] = useState(0);
  const [condicaoDesconto, setCondicaoDesconto] = useState(0);
  const [condicaoFormaId, setCondicaoFormaId] = useState<string | null>(null);

  // Fetch formas de pagamento
  const { data: formas = [], isLoading: loadingFormas } = useQuery({
    queryKey: ['formas-pagamento-config', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as FormaPagamento[];
    },
    enabled: !!currentCompany?.id,
  });

  // Fetch condições de pagamento
  const { data: condicoes = [], isLoading: loadingCondicoes } = useQuery({
    queryKey: ['condicoes-pagamento-config', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [];
      const { data, error } = await supabase
        .from('condicoes_pagamento')
        .select('*, forma_pagamento:formas_pagamento(*)')
        .eq('company_id', currentCompany.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as CondicaoPagamento[];
    },
    enabled: !!currentCompany?.id,
  });

  // Mutations
  const saveFormaMutation = useMutation({
    mutationFn: async (data: { id?: string; nome: string; tipo: string }) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");
      
      if (data.id) {
        const { error } = await supabase
          .from('formas_pagamento')
          .update({ nome: data.nome, tipo: data.tipo })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('formas_pagamento')
          .insert({
            company_id: currentCompany.id,
            nome: data.nome,
            tipo: data.tipo,
            sort_order: formas.length,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento-config'] });
      queryClient.invalidateQueries({ queryKey: ['formas-pagamento'] });
      toast.success(editingForma ? "Forma de pagamento atualizada!" : "Forma de pagamento criada!");
      closeFormaDialog();
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const saveCondicaoMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      nome: string;
      parcelas: number;
      dias_entre_parcelas: number;
      juros_percent: number;
      desconto_percent: number;
      forma_pagamento_id: string | null;
    }) => {
      if (!currentCompany?.id) throw new Error("Empresa não encontrada");
      
      if (data.id) {
        const { error } = await supabase
          .from('condicoes_pagamento')
          .update({
            nome: data.nome,
            parcelas: data.parcelas,
            dias_entre_parcelas: data.dias_entre_parcelas,
            juros_percent: data.juros_percent,
            desconto_percent: data.desconto_percent,
            forma_pagamento_id: data.forma_pagamento_id,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('condicoes_pagamento')
          .insert({
            company_id: currentCompany.id,
            nome: data.nome,
            parcelas: data.parcelas,
            dias_entre_parcelas: data.dias_entre_parcelas,
            juros_percent: data.juros_percent,
            desconto_percent: data.desconto_percent,
            forma_pagamento_id: data.forma_pagamento_id,
            sort_order: condicoes.length,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['condicoes-pagamento-config'] });
      queryClient.invalidateQueries({ queryKey: ['condicoes-pagamento'] });
      toast.success(editingCondicao ? "Condição de pagamento atualizada!" : "Condição de pagamento criada!");
      closeCondicaoDialog();
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ type, id, is_active }: { type: 'forma' | 'condicao'; id: string; is_active: boolean }) => {
      const table = type === 'forma' ? 'formas_pagamento' : 'condicoes_pagamento';
      const { error } = await supabase
        .from(table)
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const key = variables.type === 'forma' ? 'formas-pagamento' : 'condicoes-pagamento';
      queryClient.invalidateQueries({ queryKey: [`${key}-config`] });
      queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(variables.is_active ? "Ativado!" : "Desativado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ type, id }: { type: 'forma' | 'condicao'; id: string }) => {
      const table = type === 'forma' ? 'formas_pagamento' : 'condicoes_pagamento';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const key = variables.type === 'forma' ? 'formas-pagamento' : 'condicoes-pagamento';
      queryClient.invalidateQueries({ queryKey: [`${key}-config`] });
      queryClient.invalidateQueries({ queryKey: [key] });
      toast.success("Excluído com sucesso!");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  // Dialog handlers
  const openFormaDialog = (forma?: FormaPagamento) => {
    if (forma) {
      setEditingForma(forma);
      setFormaNome(forma.nome);
      setFormaTipo(forma.tipo);
    } else {
      setEditingForma(null);
      setFormaNome("");
      setFormaTipo('avista');
    }
    setFormaDialogOpen(true);
  };

  const closeFormaDialog = () => {
    setFormaDialogOpen(false);
    setEditingForma(null);
    setFormaNome("");
    setFormaTipo('avista');
  };

  const openCondicaoDialog = (condicao?: CondicaoPagamento) => {
    if (condicao) {
      setEditingCondicao(condicao);
      setCondicaoNome(condicao.nome);
      setCondicaoParcelas(condicao.parcelas);
      setCondicaoDias(condicao.dias_entre_parcelas);
      setCondicaoJuros(condicao.juros_percent);
      setCondicaoDesconto(condicao.desconto_percent);
      setCondicaoFormaId(condicao.forma_pagamento_id);
    } else {
      setEditingCondicao(null);
      setCondicaoNome("");
      setCondicaoParcelas(1);
      setCondicaoDias(30);
      setCondicaoJuros(0);
      setCondicaoDesconto(0);
      setCondicaoFormaId(null);
    }
    setCondicaoDialogOpen(true);
  };

  const closeCondicaoDialog = () => {
    setCondicaoDialogOpen(false);
    setEditingCondicao(null);
  };

  const handleSaveForma = () => {
    if (!formaNome.trim()) {
      toast.error("Informe o nome da forma de pagamento");
      return;
    }
    saveFormaMutation.mutate({
      id: editingForma?.id,
      nome: formaNome.trim(),
      tipo: formaTipo,
    });
  };

  const handleSaveCondicao = () => {
    if (!condicaoNome.trim()) {
      toast.error("Informe o nome da condição");
      return;
    }
    saveCondicaoMutation.mutate({
      id: editingCondicao?.id,
      nome: condicaoNome.trim(),
      parcelas: condicaoParcelas,
      dias_entre_parcelas: condicaoDias,
      juros_percent: condicaoJuros,
      desconto_percent: condicaoDesconto,
      forma_pagamento_id: condicaoFormaId,
    });
  };

  const tipoLabels = {
    avista: 'À Vista',
    parcelado: 'Parcelado',
    misto: 'Misto',
  };

  const isLoading = loadingFormas || loadingCondicoes;

  return (
    <MainLayout>
      <div className="space-y-8 pt-12 lg:pt-0">
        {/* Header */}
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <Link to="/configuracoes" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Formas e Condições de Pagamento</h1>
              <p className="text-muted-foreground">Configure as opções de pagamento para orçamentos e vendas</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formas de Pagamento */}
            <Card className="animate-slide-up">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-primary" />
                    Formas de Pagamento
                  </CardTitle>
                  <CardDescription>PIX, Dinheiro, Cartão, Boleto, etc.</CardDescription>
                </div>
                <Button size="sm" onClick={() => openFormaDialog()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Nova
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {formas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma forma de pagamento cadastrada
                  </p>
                ) : (
                  formas.map((forma) => (
                    <div
                      key={forma.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium text-sm">{forma.nome}</p>
                          <Badge variant="secondary" className="text-xs">
                            {tipoLabels[forma.tipo]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={forma.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ type: 'forma', id: forma.id, is_active: checked })
                          }
                        />
                        <Button size="icon" variant="ghost" onClick={() => openFormaDialog(forma)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTarget({ type: 'forma', id: forma.id, nome: forma.nome });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Condições de Pagamento */}
            <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Percent className="w-5 h-5 text-primary" />
                    Condições de Pagamento
                  </CardTitle>
                  <CardDescription>À vista com desconto, parcelado com juros, etc.</CardDescription>
                </div>
                <Button size="sm" onClick={() => openCondicaoDialog()}>
                  <Plus className="w-4 h-4 mr-1" />
                  Nova
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {condicoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma condição de pagamento cadastrada
                  </p>
                ) : (
                  condicoes.map((condicao) => (
                    <div
                      key={condicao.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium text-sm">{condicao.nome}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {condicao.parcelas > 1 && (
                              <Badge variant="outline" className="text-xs">
                                {condicao.parcelas}x
                              </Badge>
                            )}
                            {condicao.desconto_percent > 0 && (
                              <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                -{condicao.desconto_percent}%
                              </Badge>
                            )}
                            {condicao.juros_percent > 0 && (
                              <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                                +{condicao.juros_percent}%
                              </Badge>
                            )}
                            {condicao.forma_pagamento && (
                              <Badge variant="secondary" className="text-xs">
                                {condicao.forma_pagamento.nome}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={condicao.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ type: 'condicao', id: condicao.id, is_active: checked })
                          }
                        />
                        <Button size="icon" variant="ghost" onClick={() => openCondicaoDialog(condicao)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTarget({ type: 'condicao', id: condicao.id, nome: condicao.nome });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Dialog: Forma de Pagamento */}
      <Dialog open={formaDialogOpen} onOpenChange={setFormaDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingForma ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
            </DialogTitle>
            <DialogDescription>
              Configure as opções disponíveis para recebimento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="forma-nome">Nome</Label>
              <Input
                id="forma-nome"
                value={formaNome}
                onChange={(e) => setFormaNome(e.target.value)}
                placeholder="Ex: PIX, Cartão de Crédito"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="forma-tipo">Tipo</Label>
              <Select value={formaTipo} onValueChange={(v) => setFormaTipo(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avista">À Vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="misto">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeFormaDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSaveForma} disabled={saveFormaMutation.isPending}>
              {saveFormaMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Condição de Pagamento */}
      <Dialog open={condicaoDialogOpen} onOpenChange={setCondicaoDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCondicao ? 'Editar Condição de Pagamento' : 'Nova Condição de Pagamento'}
            </DialogTitle>
            <DialogDescription>
              Configure parcelas, descontos e juros
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="condicao-nome">Nome</Label>
              <Input
                id="condicao-nome"
                value={condicaoNome}
                onChange={(e) => setCondicaoNome(e.target.value)}
                placeholder="Ex: À vista com 5% desconto"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condicao-parcelas">Parcelas</Label>
                <Input
                  id="condicao-parcelas"
                  type="number"
                  min={1}
                  value={condicaoParcelas}
                  onChange={(e) => setCondicaoParcelas(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="condicao-dias">Dias entre parcelas</Label>
                <Input
                  id="condicao-dias"
                  type="number"
                  min={1}
                  value={condicaoDias}
                  onChange={(e) => setCondicaoDias(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="condicao-desconto" className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Desconto (%)
                </Label>
                <Input
                  id="condicao-desconto"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={condicaoDesconto}
                  onChange={(e) => setCondicaoDesconto(parseFloat(e.target.value) || 0)}
                  className="border-green-200 focus-visible:ring-green-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="condicao-juros" className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-amber-600" />
                  Juros (%)
                </Label>
                <Input
                  id="condicao-juros"
                  type="number"
                  step="0.1"
                  min={0}
                  max={100}
                  value={condicaoJuros}
                  onChange={(e) => setCondicaoJuros(parseFloat(e.target.value) || 0)}
                  className="border-amber-200 focus-visible:ring-amber-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="condicao-forma">Forma de Pagamento (opcional)</Label>
              <Select value={condicaoFormaId || '__any__'} onValueChange={(v) => setCondicaoFormaId(v === '__any__' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer forma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Qualquer forma</SelectItem>
                  {formas.filter(f => f.is_active).map((forma) => (
                    <SelectItem key={forma.id} value={forma.id}>
                      {forma.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview */}
            {(condicaoDesconto > 0 || condicaoJuros > 0) && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                <p className="text-sm text-muted-foreground mb-1">Exemplo para R$ 1.000,00:</p>
                <p className="font-medium">
                  {condicaoDesconto > 0 && (
                    <span className="text-green-600">
                      R$ {(1000 * (1 - condicaoDesconto / 100)).toFixed(2)} (-{condicaoDesconto}%)
                    </span>
                  )}
                  {condicaoJuros > 0 && (
                    <span className="text-amber-600">
                      R$ {(1000 * (1 + condicaoJuros / 100)).toFixed(2)} (+{condicaoJuros}%)
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeCondicaoDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSaveCondicao} disabled={saveCondicaoMutation.isPending}>
              {saveCondicaoMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar exclusão */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.nome}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate({ type: deleteTarget.type, id: deleteTarget.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
