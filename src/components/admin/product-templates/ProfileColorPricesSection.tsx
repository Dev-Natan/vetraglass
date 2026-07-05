import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Palette, Plus, Trash2, Loader2 } from 'lucide-react';
import { useAdminAluminumColors } from '@/hooks/useAdminPricingLists';
import { useItemTemplateColorPrices } from '@/hooks/useItemColorPrices';

interface Props {
  itemTemplateId?: string | null;
}

export function ProfileColorPricesSection({ itemTemplateId }: Props) {
  const { data: aluColors = [] } = useAdminAluminumColors();
  const { data: rows = [], upsert, remove, isLoading } = useItemTemplateColorPrices(itemTemplateId || undefined);
  const [newColor, setNewColor] = useState<string>('');
  const [newCost, setNewCost] = useState<string>('');
  const [newPrice, setNewPrice] = useState<string>('');

  if (!itemTemplateId) {
    return (
      <div className="space-y-2 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4" /> Precificação por Cor
        </h4>
        <p className="text-xs text-muted-foreground">
          Salve o perfil primeiro para poder cadastrar preços por cor.
        </p>
      </div>
    );
  }

  const usedColors = new Set(rows.map(r => r.color_name));
  const available = aluColors.filter(c => c.is_active && !usedColors.has(c.name));

  const handleAdd = () => {
    if (!newColor) return;
    upsert.mutate(
      {
        item_template_id: itemTemplateId,
        color_name: newColor,
        cost_per_meter: newCost ? parseFloat(newCost) : null,
        price_per_meter: newPrice ? parseFloat(newPrice) : null,
      },
      {
        onSuccess: () => {
          setNewColor('');
          setNewCost('');
          setNewPrice('');
        },
      },
    );
  };

  return (
    <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Palette className="w-4 h-4" /> Precificação por Cor
      </h4>
      <p className="text-xs text-muted-foreground">
        Cadastre cores disponíveis para este perfil e defina custo/preço por metro linear.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cor</TableHead>
              <TableHead className="w-32">Custo/ml</TableHead>
              <TableHead className="w-32">Preço/ml</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <EditableRow
                key={r.id ?? r.color_name}
                row={r}
                onSave={(cost, price) =>
                  upsert.mutate({
                    item_template_id: itemTemplateId,
                    color_name: r.color_name,
                    cost_per_meter: cost,
                    price_per_meter: price,
                  })
                }
                onDelete={() => r.id && remove.mutate(r.id)}
              />
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-3">
                  Nenhuma cor cadastrada ainda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <div className="grid grid-cols-[1fr_120px_120px_auto] gap-2 items-end pt-2 border-t">
        <div className="space-y-1">
          <Label className="text-xs">Adicionar cor</Label>
          <Select value={newColor} onValueChange={setNewColor}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={available.length ? 'Selecione...' : 'Todas as cores já adicionadas'} />
            </SelectTrigger>
            <SelectContent>
              {available.map(c => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Custo/ml</Label>
          <Input type="number" step="0.01" value={newCost} onChange={e => setNewCost(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Preço/ml</Label>
          <Input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="h-9" />
        </div>
        <Button type="button" size="sm" onClick={handleAdd} disabled={!newColor || upsert.isPending}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function EditableRow({
  row,
  onSave,
  onDelete,
}: {
  row: { color_name: string; cost_per_meter: number | null; price_per_meter: number | null };
  onSave: (cost: number | null, price: number | null) => void;
  onDelete: () => void;
}) {
  const [cost, setCost] = useState(row.cost_per_meter != null ? String(row.cost_per_meter) : '');
  const [price, setPrice] = useState(row.price_per_meter != null ? String(row.price_per_meter) : '');
  return (
    <TableRow>
      <TableCell className="font-medium">{row.color_name}</TableCell>
      <TableCell>
        <Input
          type="number" step="0.01" value={cost} className="h-8"
          onChange={e => setCost(e.target.value)}
          onBlur={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number" step="0.01" value={price} className="h-8"
          onChange={e => setPrice(e.target.value)}
          onBlur={() => onSave(cost ? parseFloat(cost) : null, price ? parseFloat(price) : null)}
        />
      </TableCell>
      <TableCell>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
