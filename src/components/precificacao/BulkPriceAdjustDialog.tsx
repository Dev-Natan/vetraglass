import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Product {
  id: string;
  commercial_name: string;
  linha: string | null;
  category: string | null;
  margin_percent: number | null;
  cost_per_sqm: number | null;
  price_per_sqm: number | null;
}

interface BulkPriceAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  linhas: string[];
  onSaved: () => void;
}

const categoryLabels: Record<string, string> = {
  window: 'Janela', door: 'Porta', facade: 'Fachada',
  shower: 'Box', mirror: 'Espelho', partition: 'Divisória',
  guarda_corpo: 'Guarda Corpo', other: 'Outros',
};

export function BulkPriceAdjustDialog({ open, onOpenChange, products, linhas, onSaved }: BulkPriceAdjustDialogProps) {
  const [filterLinha, setFilterLinha] = useState('__all__');
  const [filterCategory, setFilterCategory] = useState('__all__');
  const [newMargin, setNewMargin] = useState(30);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (filterLinha !== '__all__' && p.linha !== filterLinha) return false;
      if (filterCategory !== '__all__' && p.category !== filterCategory) return false;
      return p.cost_per_sqm && p.cost_per_sqm > 0;
    });
  }, [products, filterLinha, filterCategory]);

  const toggleAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecione pelo menos um produto.');
      return;
    }
    setSaving(true);
    try {
      const toUpdate = filteredProducts.filter(p => selectedIds.has(p.id));
      for (const p of toUpdate) {
        const cost = p.cost_per_sqm || 0;
        const newPrice = cost * (1 + newMargin / 100);
        const { error } = await supabase
          .from('company_products')
          .update({
            margin_percent: newMargin,
            price_per_sqm: newPrice,
          })
          .eq('id', p.id);
        if (error) throw error;
      }
      toast.success(`Margem atualizada em ${toUpdate.length} produto(s)!`);
      onSaved();
      onOpenChange(false);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error('Erro ao atualizar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Reajuste de Margem em Massa
          </DialogTitle>
          <DialogDescription>
            Selecione os produtos e defina a nova margem de lucro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Filtrar por Linha</Label>
              <Select value={filterLinha} onValueChange={v => { setFilterLinha(v); setSelectedIds(new Set()); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {linhas.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Filtrar por Categoria</Label>
              <Select value={filterCategory} onValueChange={v => { setFilterCategory(v); setSelectedIds(new Set()); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{categoryLabels[c] || c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Margin input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nova Margem de Lucro (%)</Label>
            <Input
              type="number" min={0} step={1}
              value={newMargin}
              onChange={e => setNewMargin(parseFloat(e.target.value) || 0)}
              className="text-lg font-bold text-center"
            />
          </div>

          {/* Product list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{filteredProducts.length} produtos disponíveis</Label>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                {selectedIds.size === filteredProducts.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
              {filteredProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum produto precificado encontrado com esses filtros.
                </p>
              ) : (
                filteredProducts.map(p => {
                  const currentMargin = p.margin_percent || 0;
                  const newPrice = (p.cost_per_sqm || 0) * (1 + newMargin / 100);
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded hover:bg-accent/30 cursor-pointer transition-colors",
                        selectedIds.has(p.id) && "bg-primary/5"
                      )}
                      onClick={() => toggleOne(p.id)}
                    >
                      <Checkbox checked={selectedIds.has(p.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{p.commercial_name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>Atual: {currentMargin.toFixed(0)}%</span>
                          <span>→</span>
                          <span className="text-primary font-medium">{newMargin.toFixed(0)}%</span>
                          <span className="text-muted-foreground">({formatCurrency(newPrice)}/m²)</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {selectedIds.size > 0 && newMargin < 10 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-600 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Margem abaixo de 10% pode comprometer a lucratividade.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleApply} disabled={saving || selectedIds.size === 0}>
            {saving ? 'Aplicando...' : `Aplicar em ${selectedIds.size} produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
