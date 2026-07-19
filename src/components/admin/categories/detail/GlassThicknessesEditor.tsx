import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAdminGlassThicknesses, type AdminGlassThickness } from "@/hooks/useAdminPricingLists";

export function GlassThicknessesEditor() {
  const { data, isLoading, upsert, remove } = useAdminGlassThicknesses();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminGlassThickness | null>(null);
  const [form, setForm] = useState({ thickness_mm: 0, label: "", sort_order: 0, is_active: true });

  const openDialog = (item?: AdminGlassThickness) => {
    if (item) {
      setEditing(item);
      setForm({ thickness_mm: item.thickness_mm, label: item.label, sort_order: item.sort_order, is_active: item.is_active });
    } else {
      setEditing(null);
      setForm({ thickness_mm: 0, label: "", sort_order: (data?.length ?? 0) + 1, is_active: true });
    }
    setOpen(true);
  };

  const save = async () => {
    if (!form.label.trim() || !form.thickness_mm) return;
    await upsert.mutateAsync({
      ...(editing ? { id: editing.id } : {}),
      thickness_mm: form.thickness_mm,
      label: form.label,
      sort_order: form.sort_order,
      is_active: form.is_active,
    });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Espessuras de Vidro</CardTitle>
          <CardDescription>Catálogo global de espessuras (mm).</CardDescription>
        </div>
        <Button onClick={() => openDialog()}><Plus className="h-4 w-4 mr-2" />Nova Espessura</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">mm</TableHead>
                <TableHead>Rótulo</TableHead>
                <TableHead>Ordem</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id} className={!t.is_active ? "opacity-50" : ""}>
                  <TableCell className="font-mono">{t.thickness_mm} mm</TableCell>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell className="text-muted-foreground">{t.sort_order}</TableCell>
                  <TableCell>
                    <Switch checked={t.is_active} onCheckedChange={(v) => upsert.mutate({ id: t.id, is_active: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Excluir "${t.label}"?`)) remove.mutate(t.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma espessura cadastrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Espessura" : "Nova Espessura"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Espessura (mm)</Label><Input type="number" step="0.1" value={form.thickness_mm} onChange={(e) => setForm({ ...form, thickness_mm: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Rótulo</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: 8mm Incolor" /></div>
            <div><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
