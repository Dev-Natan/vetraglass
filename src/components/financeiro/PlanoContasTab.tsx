import { useState } from 'react';
import {
  useFinancialCategories,
  type FinancialCategory,
  type DreGroup,
  DRE_GROUP_LABEL,
  DRE_GROUPS_BY_KIND,
} from '@/hooks/useFinancialCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Lock, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#16a34a','#dc2626','#ea580c','#0ea5e9','#7c3aed','#0891b2',
  '#475569','#be123c','#64748b','#facc15','#22c55e','#3b82f6',
];

export function PlanoContasTab() {
  const { data: categories = [], isLoading, upsert, remove } = useFinancialCategories();
  const [activeKind, setActiveKind] = useState<'receita' | 'despesa'>('despesa');
  const [editing, setEditing] = useState<Partial<FinancialCategory> | null>(null);

  const filtered = categories.filter((c) => c.kind === activeKind);
  const grouped = DRE_GROUPS_BY_KIND[activeKind].map((g) => ({
    group: g,
    items: filtered.filter((c) => c.dre_group === g),
  })).filter((g) => g.items.length > 0);

  const handleSave = () => {
    if (!editing?.name?.trim()) {
      toast.error('Informe o nome da categoria');
      return;
    }
    if (!editing.dre_group) {
      toast.error('Selecione o grupo DRE');
      return;
    }
    upsert.mutate({
      ...editing,
      kind: editing.kind ?? activeKind,
    }, {
      onSuccess: () => setEditing(null),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Plano de Contas</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Categorias usadas para classificar receitas e despesas, organizadas por grupo do DRE.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              setEditing({
                kind: activeKind,
                dre_group: activeKind === 'receita' ? 'receita_bruta' : 'despesas_operacionais',
                color: PRESET_COLORS[0],
              })
            }
          >
            <Plus className="w-4 h-4 mr-1" /> Nova categoria
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeKind} onValueChange={(v) => setActiveKind(v as 'receita' | 'despesa')}>
            <TabsList className="mb-4">
              <TabsTrigger value="despesa" className="gap-2">
                <TrendingDown className="w-4 h-4" /> Despesas / Custos
              </TabsTrigger>
              <TabsTrigger value="receita" className="gap-2">
                <TrendingUp className="w-4 h-4" /> Receitas
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeKind} className="space-y-6">
              {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
              {!isLoading && grouped.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
              )}
              {grouped.map(({ group, items }) => (
                <div key={group}>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    {DRE_GROUP_LABEL[group as DreGroup]}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {items.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center gap-2 p-2.5 border rounded-md bg-card hover:bg-muted/40 transition-colors group"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color || '#64748b' }}
                        />
                        <span className="text-sm flex-1 truncate">{cat.name}</span>
                        {cat.is_system && (
                          <Badge variant="outline" className="gap-1 text-[10px] h-5">
                            <Lock className="w-3 h-3" /> sistema
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100"
                          onClick={() => setEditing(cat)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {!cat.is_system && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                            onClick={() => {
                              if (confirm(`Remover categoria "${cat.name}"?`)) remove.mutate(cat.id);
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Ex.: Compra de Vidro Temperado"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={editing.kind || activeKind}
                    onValueChange={(v) =>
                      setEditing({
                        ...editing,
                        kind: v as 'receita' | 'despesa',
                        dre_group:
                          v === 'receita' ? 'receita_bruta' : 'despesas_operacionais',
                      })
                    }
                    disabled={editing.is_system}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Grupo DRE</Label>
                  <Select
                    value={editing.dre_group}
                    onValueChange={(v) => setEditing({ ...editing, dre_group: v as DreGroup })}
                    disabled={editing.is_system}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DRE_GROUPS_BY_KIND[editing.kind || activeKind].map((g) => (
                        <SelectItem key={g} value={g}>{DRE_GROUP_LABEL[g]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditing({ ...editing, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        editing.color === c ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
