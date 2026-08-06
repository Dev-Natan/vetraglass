import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProductPriceLinesTab } from '@/components/precos/ProductPriceLinesTab';
import { GlassWater, Info, Loader2, Percent, Save, DollarSign } from 'lucide-react';
import { toast } from 'sonner';


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface AdminColor { id: string; name: string; slug: string; sort_order: number; is_active: boolean }
interface AdminThickness { id: string; thickness_mm: number; label: string; sort_order: number; is_active: boolean }
interface GlassRow {
  id?: string;
  glass_color: string;
  thickness_mm: number;
  price_per_sqm: number | null;
  cost_per_sqm: number | null;
}

const cellKey = (color: string, mm: number) => `${color.toLowerCase()}::${mm}`;

export default function MeusPrecos() {
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();

  const { data: colors = [] } = useQuery({
    queryKey: ['admin-glass-colors-active'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('admin_glass_colors')
        .select('id, name, slug, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as AdminColor[];
    },
    staleTime: 60_000,
  });

  const { data: thicknesses = [] } = useQuery({
    queryKey: ['admin-glass-thicknesses-active'],
    queryFn: async () => {
      const { data, error } = await sb
        .from('admin_glass_thicknesses')
        .select('id, thickness_mm, label, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as AdminThickness[];
    },
    staleTime: 60_000,
  });

  const { data: existing = [], isLoading } = useQuery({
    queryKey: ['company-glass-prices', currentCompany?.id],
    queryFn: async () => {
      if (!currentCompany?.id) return [] as GlassRow[];
      const { data, error } = await sb
        .from('company_suggested_prices')
        .select('id, glass_color, thickness_mm, price_per_sqm, cost_per_sqm')
        .eq('company_id', currentCompany.id)
        .eq('kind', 'glass');
      if (error) throw error;
      return (data ?? []) as GlassRow[];
    },
    enabled: !!currentCompany?.id,
    staleTime: 30_000,
  });

  // Local editable matrix: key = color::mm → { price, cost }
  const [matrix, setMatrix] = useState<Record<string, { price: string; cost: string }>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next: Record<string, { price: string; cost: string }> = {};
    for (const r of existing) {
      if (!r.glass_color || r.thickness_mm == null) continue;
      next[cellKey(r.glass_color, r.thickness_mm)] = {
        price: r.price_per_sqm != null ? String(r.price_per_sqm) : '',
        cost: r.cost_per_sqm != null ? String(r.cost_per_sqm) : '',
      };
    }
    setMatrix(next);
    setDirty(new Set());
  }, [existing]);

  const setCell = (color: string, mm: number, field: 'price' | 'cost', val: string) => {
    const k = cellKey(color, mm);
    setMatrix(prev => ({ ...prev, [k]: { ...(prev[k] ?? { price: '', cost: '' }), [field]: val } }));
    setDirty(prev => new Set(prev).add(k));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentCompany?.id) throw new Error('Empresa não selecionada');
      const rows = Array.from(dirty).map(k => {
        const cell = matrix[k] ?? { price: '', cost: '' };
        const [colorLower, mmStr] = k.split('::');
        // Recover original color name (case) from admin list
        const color = colors.find(c => c.name.toLowerCase() === colorLower)?.name ?? colorLower;
        return {
          company_id: currentCompany.id,
          kind: 'glass' as const,
          glass_color: color,
          thickness_mm: Number(mmStr),
          price_per_sqm: cell.price ? Number(cell.price) : null,
          cost_per_sqm: cell.cost ? Number(cell.cost) : null,
          updated_at: new Date().toISOString(),
        };
      });
      if (rows.length === 0) return;

      // Upsert manual by (company_id, kind, glass_color, thickness_mm)
      for (const row of rows) {
        const match = existing.find(
          e => (e.glass_color ?? '').toLowerCase() === row.glass_color.toLowerCase()
            && Number(e.thickness_mm) === row.thickness_mm,
        );
        if (match?.id) {
          const { error } = await sb.from('company_suggested_prices').update(row).eq('id', match.id);
          if (error) throw error;
        } else {
          const { error } = await sb.from('company_suggested_prices').insert(row);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-glass-prices'] });
      queryClient.invalidateQueries({ queryKey: ['company-suggested-prices-cache'] });
      toast.success('Preços de vidro salvos.');
      setDirty(new Set());
    },
    onError: (e: Error) => toast.error('Erro ao salvar: ' + e.message),
  });

  const bulkAdjust = useMutation({
    mutationFn: async ({ percent, field }: { percent: number; field: 'price' | 'cost' | 'both' }) => {
      const factor = 1 + percent / 100;
      const next: Record<string, { price: string; cost: string }> = { ...matrix };
      const newDirty = new Set(dirty);
      for (const c of colors) {
        for (const t of thicknesses) {
          const k = cellKey(c.name, t.thickness_mm);
          const cur = next[k] ?? { price: '', cost: '' };
          const newCell = { ...cur };
          if ((field === 'price' || field === 'both') && cur.price) {
            newCell.price = (Number(cur.price) * factor).toFixed(2);
          }
          if ((field === 'cost' || field === 'both') && cur.cost) {
            newCell.cost = (Number(cur.cost) * factor).toFixed(2);
          }
          if (newCell.price !== cur.price || newCell.cost !== cur.cost) {
            next[k] = newCell;
            newDirty.add(k);
          }
        }
      }
      setMatrix(next);
      setDirty(newDirty);
    },
    onSuccess: () => toast.success('Reajuste aplicado. Revise e clique em Salvar.'),
  });

  const hasChanges = dirty.size > 0;
  const gridReady = colors.length > 0 && thicknesses.length > 0;

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <GlassWater className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Meus Preços</h1>
            <p className="text-sm text-muted-foreground">
              Matriz de vidros e <strong>linhas de preço por variação</strong> dos seus produtos.
            </p>
          </div>
        </div>

        <Tabs defaultValue="vidros" className="space-y-6">
          <TabsList>
            <TabsTrigger value="vidros">Vidros</TabsTrigger>
            <TabsTrigger value="produtos">Produtos · Variações</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos">
            {currentCompany?.id ? (
              <ProductPriceLinesTab companyId={currentCompany.id} />
            ) : (
              <Card className="p-6 text-sm text-muted-foreground">Selecione uma empresa.</Card>
            )}
          </TabsContent>

          <TabsContent value="vidros" className="space-y-6">
        <div className="flex items-center justify-end gap-2">
          <BulkAdjustDialog onApply={(p, f) => bulkAdjust.mutate({ percent: p, field: f })} />
          <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} className="gap-2">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar {hasChanges ? `(${dirty.size})` : ''}
          </Button>
        </div>

        <Card className="p-4 bg-primary/5 border-primary/20 flex gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Cálculo no orçamento: <strong>Área do vidro (m²) × Preço m²</strong> desta tabela, mais adicionais de processamento configurados no produto.
            Células em branco caem no <strong>preço sugerido do sistema</strong>.
          </div>
        </Card>


        {isLoading || !gridReady ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-semibold w-32">Espessura</th>
                    {colors.map(c => (
                      <th key={c.id} className="text-left p-3 font-semibold min-w-[180px]">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {thicknesses.map(t => (
                    <tr key={t.id} className="border-t">
                      <td className="p-3 font-medium align-top">
                        <div>{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.thickness_mm} mm</div>
                      </td>
                      {colors.map(c => {
                        const k = cellKey(c.name, t.thickness_mm);
                        const cell = matrix[k] ?? { price: '', cost: '' };
                        const isDirty = dirty.has(k);
                        return (
                          <td key={c.id} className={`p-2 align-top ${isDirty ? 'bg-primary/5' : ''}`}>
                            <div className="space-y-1">
                              <Label className="text-[10px] text-muted-foreground">Preço m²</Label>
                              <Input
                                type="number" step="0.01" inputMode="decimal"
                                value={cell.price}
                                onChange={e => setCell(c.name, t.thickness_mm, 'price', e.target.value)}
                                placeholder="0,00"
                                className="h-8"
                              />
                              <Label className="text-[10px] text-muted-foreground">Custo m²</Label>
                              <Input
                                type="number" step="0.01" inputMode="decimal"
                                value={cell.cost}
                                onChange={e => setCell(c.name, t.thickness_mm, 'cost', e.target.value)}
                                placeholder="0,00"
                                className="h-8"
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>

  );
}

function BulkAdjustDialog({ onApply }: { onApply: (percent: number, field: 'price' | 'cost' | 'both') => void }) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState('7');
  const [field, setField] = useState<'price' | 'cost' | 'both'>('both');

  const apply = () => {
    const p = parseFloat(percent);
    if (!Number.isFinite(p)) return;
    onApply(p, field);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2"><Percent className="w-4 h-4" />Reajuste em lote</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />Reajuste percentual (vidros)
          </DialogTitle>
          <DialogDescription>
            Aplica o percentual a <strong>todas as células preenchidas</strong> da matriz. Após aplicar, revise e clique em <em>Salvar</em>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Percentual (%)</Label>
            <Input type="number" step="0.01" value={percent} onChange={e => setPercent(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Ex.: <code>7</code> aumenta 7%. Use <code>-5</code> para reduzir 5%.</p>
          </div>
          <div>
            <Label>Aplicar em</Label>
            <div className="flex gap-2 mt-1">
              {(['both', 'price', 'cost'] as const).map(f => (
                <Button key={f} type="button" size="sm"
                  variant={field === f ? 'default' : 'outline'}
                  onClick={() => setField(f)}>
                  {f === 'both' ? 'Custo e Preço' : f === 'price' ? 'Somente Preço' : 'Somente Custo'}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={apply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
