import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { registerOffcutsFromCuttingPlan } from '@/hooks/useOffcuts';
import { distributeAcrossBars } from '@/utils/profileOptimization';
import { useQueryClient } from '@tanstack/react-query';

type ProfileInput = {
  itemTemplateId: string;
  itemName: string;
  cutLength: number;
  quantity: number;
  barLengthMm?: number;
};

type GlassInput = {
  glassName: string;
  color?: string | null;
  thickness?: number | null;
  calculatedWidth: number;
  calculatedHeight: number;
  quantity: number;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string | null | undefined;
  profiles: ProfileInput[];
  glasses?: GlassInput[];
  defaultReference?: string | null;
  defaultOsId?: string | null;
}

export function SaveOffcutsDialog({
  open,
  onOpenChange,
  companyId,
  profiles,
  glasses = [],
  defaultReference,
  defaultOsId,
}: Props) {
  const qc = useQueryClient();
  const [minLengthMm, setMinLengthMm] = useState<number>(300);
  const [reference, setReference] = useState<string>(defaultReference ?? '');
  const [osId, setOsId] = useState<string>(defaultOsId ?? '');
  const [saving, setSaving] = useState(false);

  const previewEntries = useMemo(() => {
    const entries: Array<{
      kind: 'perfil' | 'vidro';
      name: string;
      color?: string | null;
      thickness?: number | null;
      length_mm?: number | null;
      width_mm?: number | null;
      height_mm?: number | null;
      item_template_id?: string | null;
    }> = [];

    // Group profiles by template and compute leftovers per bar via FFD
    const byProfile = new Map<string, ProfileInput[]>();
    profiles.forEach((p) => {
      const arr = byProfile.get(p.itemTemplateId) || [];
      arr.push(p);
      byProfile.set(p.itemTemplateId, arr);
    });

    byProfile.forEach((group, id) => {
      const barLen = group[0].barLengthMm || 6000;
      const cuts = group.map((c) => ({ length: c.cutLength, qty: c.quantity }));
      const bars = distributeAcrossBars(cuts, barLen);
      bars.forEach((b) => {
        if (b.remainingLength >= minLengthMm) {
          entries.push({
            kind: 'perfil',
            name: `Retalho ${group[0].itemName}`,
            length_mm: Math.round(b.remainingLength),
            item_template_id: id,
          });
        }
      });
    });

    // Glass: only include when caller passes explicit offcuts (rare in current UI)
    glasses.forEach((g) => {
      entries.push({
        kind: 'vidro',
        name: `Retalho ${g.glassName}`,
        color: g.color ?? null,
        thickness: g.thickness ?? null,
        width_mm: Math.round(g.calculatedWidth),
        height_mm: Math.round(g.calculatedHeight),
      });
    });

    return entries;
  }, [profiles, glasses, minLengthMm]);

  const handleSave = async () => {
    if (!companyId) {
      toast.error('Empresa não identificada');
      return;
    }
    if (previewEntries.length === 0) {
      toast.info('Nenhuma sobra atingiu o mínimo configurado.');
      return;
    }
    setSaving(true);
    try {
      const expanded = previewEntries.flatMap((e) =>
        Array.from({ length: 1 }).map(() => ({
          kind: e.kind,
          name: e.name,
          color: e.color ?? null,
          thickness: e.thickness ?? null,
          length_mm: e.length_mm ?? null,
          width_mm: e.width_mm ?? null,
          height_mm: e.height_mm ?? null,
          item_template_id: e.item_template_id ?? null,
          source_reference: reference.trim() || null,
          source_os_id: osId.trim() || null,
        })),
      );
      await registerOffcutsFromCuttingPlan({ companyId, entries: expanded });
      await qc.invalidateQueries({ queryKey: ['offcuts'] });
      toast.success(`${expanded.length} retalho(s) registrado(s) no banco.`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error('Erro ao registrar retalhos', { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Sobras no Banco de Retalhos</DialogTitle>
          <DialogDescription>
            Sobras geradas pelo otimizador serão cadastradas como retalhos disponíveis
            (source: plano_corte) e ficam vinculadas à OS/orçamento informado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="min-length">Sobra mínima (mm)</Label>
              <Input
                id="min-length"
                type="number"
                min={50}
                step={50}
                value={minLengthMm}
                onChange={(e) => setMinLengthMm(Math.max(50, Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <Label htmlFor="ref">Referência OS/Orçamento</Label>
              <Input
                id="ref"
                placeholder="Ex: OS-1234"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="os">ID da OS (opcional)</Label>
              <Input
                id="os"
                placeholder="UUID da OS"
                value={osId}
                onChange={(e) => setOsId(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 text-sm">
              <span className="font-medium">Prévia das sobras</span>
              <Badge variant="secondary">{previewEntries.length}</Badge>
            </div>
            <ScrollArea className="max-h-64">
              {previewEntries.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma sobra ≥ {minLengthMm}mm foi detectada.
                </div>
              ) : (
                <ul className="divide-y">
                  {previewEntries.map((e, i) => (
                    <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.kind === 'perfil'
                            ? `${e.length_mm}mm linear`
                            : `${e.width_mm}×${e.height_mm}mm${e.thickness ? ` · ${e.thickness}mm` : ''}${e.color ? ` · ${e.color}` : ''}`}
                        </div>
                      </div>
                      <Badge variant="outline">{e.kind}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || previewEntries.length === 0}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Registrar {previewEntries.length > 0 ? `(${previewEntries.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
