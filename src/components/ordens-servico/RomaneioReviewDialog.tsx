import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Replace, Loader2, Package, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { applyRomaneioBaixa, type RomaneioLineFinal } from '@/utils/applyRomaneioBaixa';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemServicoId: string;
  companyId: string;
  /** chamado após baixa efetuada com sucesso (para atualizar status da OS) */
  onConfirmed: () => void;
}

interface DraftLine {
  key: string;
  consumptionId: string | null;
  companyItemId: string | null;
  itemName: string;
  unit: string;
  quantity: number;
  unitCost: number;
}

interface StockOption {
  id: string;
  name: string;
  unit: string;
  cost: number;
  stockQty: number;
}

export function RomaneioReviewDialog({ open, onOpenChange, ordemServicoId, companyId, onConfirmed }: Props) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Sugestão: material_consumption pending/available
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['romaneio-suggestions', ordemServicoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_consumption')
        .select('id, item_name, unit, quantity_calculated, company_item_id, item_template_id, company_items:company_item_id(id, name, cost, unit)')
        .eq('ordem_servico_id', ordemServicoId)
        .in('status', ['pending', 'available']);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!ordemServicoId,
    staleTime: 0,
    gcTime: 0,
  });

  // Catálogo do estoque para swap / adicionar
  const { data: stockCatalog } = useQuery({
    queryKey: ['romaneio-stock-catalog', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_items')
        .select('id, name, unit, cost, company_stock(quantity)')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return (data || []).map((it: any) => ({
        id: it.id,
        name: it.name,
        unit: it.unit || 'un',
        cost: Number(it.cost || 0),
        stockQty: Number(it.company_stock?.[0]?.quantity ?? it.company_stock?.quantity ?? 0),
      })) as StockOption[];
    },
    enabled: open && !!companyId,
    staleTime: 0,
    gcTime: 0,
  });

  // Carregar drafts ao abrir
  useEffect(() => {
    if (!open) return;
    if (!suggestions) return;
    const initial: DraftLine[] = suggestions.map((s: any) => {
      const ci = Array.isArray(s.company_items) ? s.company_items[0] : s.company_items;
      return {
        key: s.id,
        consumptionId: s.id,
        companyItemId: s.company_item_id || ci?.id || null,
        itemName: s.item_name || ci?.name || 'Insumo',
        unit: s.unit || ci?.unit || 'un',
        quantity: Number(s.quantity_calculated || 0),
        unitCost: Number(ci?.cost || 0),
      };
    });
    setLines(initial);
    setRemoved([]);
  }, [open, suggestions]);

  const totalLines = lines.length;
  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0),
    [lines]
  );

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    const line = lines.find((l) => l.key === key);
    if (line?.consumptionId) setRemoved((r) => [...r, line.consumptionId!]);
  }

  function swapLineItem(key: string, opt: StockOption) {
    updateLine(key, {
      companyItemId: opt.id,
      itemName: opt.name,
      unit: opt.unit,
      unitCost: opt.cost,
    });
  }

  function addExtra(opt: StockOption) {
    setLines((prev) => [
      ...prev,
      {
        key: `extra-${Date.now()}-${opt.id}`,
        consumptionId: null,
        companyItemId: opt.id,
        itemName: opt.name,
        unit: opt.unit,
        quantity: 1,
        unitCost: opt.cost,
      },
    ]);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const finals: RomaneioLineFinal[] = lines
        .filter((l) => l.companyItemId && l.quantity > 0)
        .map((l) => ({
          consumptionId: l.consumptionId,
          companyItemId: l.companyItemId!,
          itemName: l.itemName,
          unit: l.unit,
          quantity: l.quantity,
          unitCost: l.unitCost,
        }));

      const result = await applyRomaneioBaixa({
        companyId,
        ordemServicoId,
        lines: finals,
        cancelledConsumptionIds: removed,
      });

      if (!result.success) throw new Error(result.error);
      toast.success('Baixa de estoque confirmada');
      onOpenChange(false);
      onConfirmed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar baixa');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" /> Revisão de Material para Baixa
          </DialogTitle>
          <DialogDescription>
            Confira, ajuste ou substitua os insumos antes de dar baixa no estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando sugestões...
            </div>
          ) : lines.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum insumo sugerido. Adicione manualmente abaixo.
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-muted text-xs font-medium text-muted-foreground">
                <div className="col-span-5">Insumo</div>
                <div className="col-span-2">Unid.</div>
                <div className="col-span-2">Qtd</div>
                <div className="col-span-2 text-right">Subtotal</div>
                <div className="col-span-1" />
              </div>
              {lines.map((l) => (
                <div
                  key={l.key}
                  className="grid grid-cols-2 sm:grid-cols-12 gap-2 px-3 py-2 sm:items-center border-t"
                >
                  <div className="col-span-2 sm:col-span-5 text-sm">
                    <div className="font-medium">{l.itemName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground sm:hidden">{l.unit}</span>
                      {!l.consumptionId && <Badge variant="secondary" className="text-[10px]">Extra</Badge>}
                    </div>
                  </div>
                  <div className="hidden sm:block sm:col-span-2 text-xs text-muted-foreground">{l.unit}</div>
                  <div className="col-span-1 sm:col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={l.quantity}
                      onChange={(e) => updateLine(l.key, { quantity: Number(e.target.value) || 0 })}
                      className="h-8"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 text-right text-sm self-center">
                    R$ {(l.quantity * l.unitCost).toFixed(2)}
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end gap-1">
                    <StockPicker
                      options={stockCatalog || []}
                      onPick={(opt) => swapLineItem(l.key, opt)}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Trocar item">
                          <Replace className="w-3.5 h-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeLine(l.key)}
                      title="Remover"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2">
            <StockPicker
              options={stockCatalog || []}
              onPick={addExtra}
              trigger={
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-3.5 h-3.5" /> Adicionar insumo extra
                </Button>
              }
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row items-stretch sm:items-center gap-2 border-t pt-3">
          <div className="text-sm mr-auto">
            <span className="text-muted-foreground">{totalLines} insumo(s)</span>
            <span className="mx-2">•</span>
            <span className="font-semibold">Custo estimado: R$ {total.toFixed(2)}</span>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || lines.length === 0}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Confirmar Baixa e Faturar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockPicker({
  options,
  onPick,
  trigger,
}: {
  options: StockOption[];
  onPick: (opt: StockOption) => void;
  trigger: React.ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.name.toLowerCase().includes(q)).slice(0, 50);
  }, [search, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar insumo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground p-3 text-center">Nenhum item encontrado</div>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onPick(opt);
                  setOpen(false);
                  setSearch('');
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent border-b last:border-0"
              >
                <div className="font-medium">{opt.name}</div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Estoque: {opt.stockQty} {opt.unit}</span>
                  <span>R$ {opt.cost.toFixed(2)}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
