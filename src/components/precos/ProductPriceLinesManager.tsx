import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Pencil, X, Check, Layers } from 'lucide-react';
import {
  PRICE_LINE_UNITS,
  formatUnitLabel,
  useProductPriceLines,
  usePriceLineMutations,
  type ProductPriceLine,
  type ProductPriceLineInput,
} from '@/hooks/useProductPriceLines';

const currency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const emptyLine = (sortOrder: number): ProductPriceLineInput => ({
  description: '',
  glass_type: '',
  thickness_mm: null,
  color: '',
  price: 0,
  cost: null,
  unit: 'm2',
  sort_order: sortOrder,
  is_active: true,
});

export interface ProductPriceLinesManagerProps {
  companyId: string;
  companyProductId: string;
}

/**
 * CRUD inline das "Linhas de Preço" (variações) de um produto.
 * Cada linha representa uma configuração técnica com preço/custo próprios.
 */
export function ProductPriceLinesManager({ companyId, companyProductId }: ProductPriceLinesManagerProps) {
  const { data: lines = [], isLoading } = useProductPriceLines(companyProductId);
  const { save, remove } = usePriceLineMutations(companyId, companyProductId);
  const [draft, setDraft] = useState<ProductPriceLineInput | null>(null);

  const startNew = () => setDraft(emptyLine(lines.length));
  const startEdit = (line: ProductPriceLine) =>
    setDraft({
      id: line.id,
      description: line.description,
      glass_type: line.glass_type ?? '',
      thickness_mm: line.thickness_mm,
      color: line.color ?? '',
      price: Number(line.price),
      cost: line.cost != null ? Number(line.cost) : null,
      unit: line.unit,
      sort_order: line.sort_order,
      is_active: line.is_active,
    });

  const commit = async () => {
    if (!draft) return;
    await save.mutateAsync(draft);
    setDraft(null);
  };

  const margin = (price: number, cost: number | null) => {
    if (cost == null || cost <= 0 || !price) return null;
    return ((price - cost) / price) * 100;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lines.length === 0 && !draft && (
        <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
          Nenhuma variação cadastrada. Adicione linhas de preço (ex.: <em>Vidro 6mm Incolor</em>) para
          precificar o mesmo produto conforme a especificação escolhida no orçamento.
        </div>
      )}

      {lines.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Variação</th>
                <th className="text-left p-2 font-medium">Espessura</th>
                <th className="text-left p-2 font-medium">Tipo / Cor</th>
                <th className="text-right p-2 font-medium">Custo</th>
                <th className="text-right p-2 font-medium">Preço</th>
                <th className="text-right p-2 font-medium">Margem</th>
                <th className="text-left p-2 font-medium">Un.</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {lines.map(line => {
                const m = margin(Number(line.price), line.cost != null ? Number(line.cost) : null);
                return (
                  <tr key={line.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{line.description}</div>
                      {!line.is_active && (
                        <Badge variant="outline" className="mt-1 text-[10px]">Inativa</Badge>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {line.thickness_mm != null ? `${line.thickness_mm} mm` : '—'}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {[line.glass_type, line.color].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="p-2 text-right text-muted-foreground">
                      {line.cost != null ? currency(Number(line.cost)) : '—'}
                    </td>
                    <td className="p-2 text-right font-semibold">{currency(Number(line.price))}</td>
                    <td className="p-2 text-right">
                      {m == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={m < 0 ? 'text-destructive' : m < 15 ? 'text-yellow-600' : 'text-emerald-600'}>
                          {m.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-muted-foreground">{formatUnitLabel(line.unit)}</td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(line)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => remove.mutate(line.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {draft ? (
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <Label className="text-xs">Descrição da variação *</Label>
              <Input
                value={draft.description}
                placeholder="Ex.: Vidro Incolor 6mm"
                onChange={e => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Espessura (mm)</Label>
              <Input
                type="number" step="0.1" inputMode="decimal"
                value={draft.thickness_mm ?? ''}
                placeholder="6"
                onChange={e => setDraft({ ...draft, thickness_mm: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Input
                value={draft.glass_type ?? ''}
                placeholder="Ex.: Temperado"
                onChange={e => setDraft({ ...draft, glass_type: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Cor</Label>
              <Input
                value={draft.color ?? ''}
                placeholder="Ex.: Verde"
                onChange={e => setDraft({ ...draft, color: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Custo</Label>
              <Input
                type="number" step="0.01" inputMode="decimal"
                value={draft.cost ?? ''}
                placeholder="0,00"
                onChange={e => setDraft({ ...draft, cost: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Preço *</Label>
              <Input
                type="number" step="0.01" inputMode="decimal"
                value={draft.price || ''}
                placeholder="0,00"
                onChange={e => setDraft({ ...draft, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <Select value={draft.unit} onValueChange={v => setDraft({ ...draft, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRICE_LINE_UNITS.map(u => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.is_active}
                onCheckedChange={v => setDraft({ ...draft, is_active: v })}
              />
              <span className="text-sm text-muted-foreground">Variação ativa</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraft(null)} className="gap-1">
                <X className="w-4 h-4" />Cancelar
              </Button>
              <Button size="sm" onClick={commit} disabled={save.isPending} className="gap-1">
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Salvar variação
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={startNew} className="gap-2">
          <Plus className="w-4 h-4" />Adicionar nova variação
        </Button>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Layers className="w-3 h-3" />
        No orçamento, ao escolher este produto o sistema pedirá a variação e aplicará o preço correspondente.
      </p>
    </div>
  );
}
